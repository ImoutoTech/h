import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException } from '@reus-able/nestjs';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import {
  EmailVerificationChallenge,
  EmailVerificationAttempt,
  EmailVerificationPurpose,
  User,
} from '@/entity';
import { CreateEmailVerificationChallengeDto } from '@/dto';
import { EmailNotificationService } from './email-notification.service';
import { normalizeEmail } from '@/utils';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(EmailVerificationChallenge)
    private readonly challenges: Repository<EmailVerificationChallenge>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    private readonly notifications: EmailNotificationService,
  ) {}

  private digest(value: string) {
    const pepper = this.config.get<string>('EMAIL_VERIFICATION_PEPPER');
    if (!pepper) throw new BusinessException('邮箱验证服务暂时不可用');
    return createHmac('sha256', pepper).update(value).digest('hex');
  }

  private positiveInt(
    name: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const value = Number(this.config.get(name, fallback));
    return Number.isInteger(value) && value >= min && value <= max
      ? value
      : fallback;
  }

  async create(
    input: CreateEmailVerificationChallengeDto,
    userId?: number,
    sourceIp = '',
  ) {
    const purpose = input.purpose;
    if (purpose !== EmailVerificationPurpose.REGISTER && !userId) {
      throw new BusinessException('请先登录');
    }
    let email: string;
    if (purpose === EmailVerificationPurpose.CHANGE_PASSWORD) {
      const user = await this.users.findOneBy({ id: userId });
      if (!user) throw new BusinessException('用户不存在');
      if (!user.emailVerifiedAt)
        throw new BusinessException('当前邮箱尚未验证');
      email = normalizeEmail(user.email);
    } else {
      if (!input.email) throw new BusinessException('请输入邮箱');
      email = normalizeEmail(input.email);
    }

    const now = new Date();
    const sourceHash = this.digest(`source:${sourceIp || 'unknown'}`);
    const hourlyLimit = this.positiveInt(
      'EMAIL_VERIFICATION_HOURLY_LIMIT',
      20,
      5,
      100,
    );
    const recentCount = await this.challenges.count({
      where: {
        sourceHash,
        createdAt: MoreThan(new Date(now.getTime() - 60 * 60 * 1000)),
      },
    });
    if (recentCount >= hourlyLimit)
      throw new BusinessException('验证码请求过于频繁，请稍后再试');
    const targetHourlyLimit = this.positiveInt(
      'EMAIL_VERIFICATION_TARGET_HOURLY_LIMIT',
      10,
      3,
      50,
    );
    const recentTargetCount = await this.challenges.count({
      where: {
        purpose,
        userId: userId ?? IsNull(),
        email,
        createdAt: MoreThan(new Date(now.getTime() - 60 * 60 * 1000)),
      },
    });
    if (recentTargetCount >= targetHourlyLimit)
      throw new BusinessException('验证码请求过于频繁，请稍后再试');
    const previous = await this.challenges.findOne({
      where: { purpose, userId: userId ?? IsNull(), email },
      order: { createdAt: 'DESC' },
    });
    if (previous && previous.resendAt > now && !previous.consumedAt) {
      throw new BusinessException('验证码发送过于频繁，请稍后再试');
    }

    const ttl = this.positiveInt(
      'EMAIL_VERIFICATION_TTL_SECONDS',
      600,
      60,
      1800,
    );
    const cooldown = this.positiveInt(
      'EMAIL_VERIFICATION_RESEND_SECONDS',
      60,
      10,
      300,
    );
    const maxAttempts = this.positiveInt(
      'EMAIL_VERIFICATION_MAX_ATTEMPTS',
      5,
      3,
      10,
    );
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge = this.challenges.create({
      purpose,
      userId: userId ?? null,
      email,
      sourceHash,
      codeHash: this.digest(code),
      expiresAt: new Date(now.getTime() + ttl * 1000),
      resendAt: new Date(now.getTime() + cooldown * 1000),
      maxAttempts,
    });
    await this.challenges.save(challenge);
    try {
      await this.notifications.sendVerificationCode({
        challengeId: challenge.id,
        email,
        code,
        purpose,
        expiresAt: challenge.expiresAt,
      });
    } catch (error) {
      await this.challenges.delete(challenge.id);
      throw error;
    }
    if (previous && !previous.consumedAt) {
      previous.expiresAt = now;
      await this.challenges.save(previous);
    }
    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      resendAt: challenge.resendAt,
    };
  }

  async verify(id: string, code: string, userId?: number, sourceIp = '') {
    const result = await this.challenges.manager.transaction(
      async (manager) => {
        const repo = manager.getRepository(EmailVerificationChallenge);
        const attempts = manager.getRepository(EmailVerificationAttempt);
        const now = new Date();
        const sourceHash = this.digest(
          `verify-source:${sourceIp || 'unknown'}`,
        );
        const verificationHourlyLimit = this.positiveInt(
          'EMAIL_VERIFICATION_VERIFY_HOURLY_LIMIT',
          50,
          10,
          200,
        );
        const recentAttempts = await attempts.count({
          where: {
            sourceHash,
            createdAt: MoreThan(new Date(now.getTime() - 60 * 60 * 1000)),
          },
        });
        if (recentAttempts >= verificationHourlyLimit) return null;
        await attempts.save(attempts.create({ challengeId: id, sourceHash }));
        const challenge = await repo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !challenge ||
          challenge.consumedAt ||
          challenge.verifiedAt ||
          challenge.expiresAt <= now ||
          challenge.failedAttempts >= challenge.maxAttempts ||
          (challenge.userId !== null && challenge.userId !== (userId ?? null))
        ) {
          throw new BusinessException('验证码无效或已过期');
        }
        const supplied = Buffer.from(this.digest(code), 'hex');
        const expected = Buffer.from(challenge.codeHash, 'hex');
        if (!timingSafeEqual(supplied, expected)) {
          challenge.failedAttempts += 1;
          await repo.save(challenge);
          return null;
        }
        const proof = randomUUID();
        challenge.verifiedAt = now;
        challenge.proofHash = this.digest(proof);
        challenge.proofExpiresAt = new Date(
          now.getTime() +
            this.positiveInt(
              'EMAIL_VERIFICATION_PROOF_TTL_SECONDS',
              300,
              60,
              900,
            ) *
              1000,
        );
        await repo.save(challenge);
        return { verificationProof: proof };
      },
    );
    if (!result) throw new BusinessException('验证码无效或已过期');
    return result;
  }

  async consume(
    manager: EntityManager,
    proof: string,
    purpose: EmailVerificationPurpose,
    userId: number | null,
    email: string,
  ) {
    const repo = manager.getRepository(EmailVerificationChallenge);
    const challenge = await repo.findOne({
      where: {
        proofHash: this.digest(proof),
        purpose,
        userId: userId ?? IsNull(),
        email: normalizeEmail(email),
        consumedAt: IsNull(),
        proofExpiresAt: MoreThan(new Date()),
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!challenge?.verifiedAt)
      throw new BusinessException('邮箱验证证明无效或已过期');
    challenge.consumedAt = new Date();
    await repo.save(challenge);
  }
}
