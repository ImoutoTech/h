import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException, HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import {
  EmailVerificationChallenge,
  type EmailVerificationPurpose,
  User,
} from '@/entity';
import {
  activeEmailChallengeKey,
  digestEmailOtp,
  emailOtpMatches,
  generateEmailOtp,
  normalizeEmail,
} from './email-verification-code';
import { EmailVerificationNotifier } from './email-verification-notifier';

interface ConsumeExpectation {
  purpose: EmailVerificationPurpose;
  normalizedEmail?: string;
  userId?: number;
}

type VerifyOutcome = 'verified' | 'wrong_code';

@Injectable()
export class EmailVerificationService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly notifier: EmailVerificationNotifier,
  ) {}

  async requestRegistration(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.dataSource.manager
      .getRepository(User)
      .findOneBy({ email: normalizedEmail });
    if (existing) throw new BusinessException('邮箱已被注册');
    return this.createChallenge('register', normalizedEmail);
  }

  async requestChangeEmail(userId: number, email: string) {
    const normalizedEmail = normalizeEmail(email);
    const users = this.dataSource.manager.getRepository(User);
    const [user, existing] = await Promise.all([
      users.findOneBy({ id: userId }),
      users.findOneBy({ email: normalizedEmail }),
    ]);
    if (!user) throw new BusinessException('用户不存在');
    if (existing) throw new BusinessException('邮箱已被注册');
    return this.createChallenge('change_email', normalizedEmail, userId);
  }

  private async createChallenge(
    purpose: EmailVerificationPurpose,
    normalizedEmail: string,
    userId?: number,
  ) {
    const now = new Date();
    const ttlSeconds = this.positiveConfig(
      'EMAIL_VERIFICATION_TTL_SECONDS',
      600,
    );
    const cooldownSeconds = this.positiveConfig(
      'EMAIL_VERIFICATION_COOLDOWN_SECONDS',
      60,
    );
    const maxAttempts = this.positiveConfig(
      'EMAIL_VERIFICATION_MAX_ATTEMPTS',
      5,
    );
    const id = randomUUID();
    const code = generateEmailOtp();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const resendAvailableAt = new Date(now.getTime() + cooldownSeconds * 1000);
    const pepper = this.config.get<string>('EMAIL_VERIFICATION_PEPPER', '');

    let challenge: EmailVerificationChallenge;
    try {
      challenge = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(EmailVerificationChallenge);
        const previous = await repo.find({
          where: {
            purpose,
            normalizedEmail,
            userId: userId ?? IsNull(),
            consumedAt: IsNull(),
            invalidatedAt: IsNull(),
          },
          order: { createdAt: 'DESC' },
          lock: { mode: 'pessimistic_write' },
        });
        const latest = previous[0];
        if (latest && latest.resendAvailableAt > now)
          throw new BusinessException('验证码发送过于频繁');
        for (const item of previous) {
          item.invalidatedAt = now;
          item.activeKey = null;
        }
        if (previous.length) await repo.save(previous);
        return repo.save(
          repo.create({
            id,
            purpose,
            userId,
            normalizedEmail,
            activeKey: activeEmailChallengeKey(
              purpose,
              normalizedEmail,
              userId,
            ),
            codeHash: digestEmailOtp(
              pepper,
              id,
              purpose,
              normalizedEmail,
              code,
            ),
            expiresAt,
            failedAttempts: 0,
            maxAttempts,
            resendAvailableAt,
          }),
        );
      });
    } catch (reason) {
      if (reason instanceof BusinessException) throw reason;
      if (this.isDuplicate(reason))
        throw new BusinessException('验证码发送过于频繁');
      throw reason;
    }

    try {
      const notificationId = await this.notifier.send({
        challengeId: challenge.id,
        email: normalizedEmail,
        code,
        expiresAt,
      });
      await this.dataSource.manager
        .getRepository(EmailVerificationChallenge)
        .update({ id: challenge.id }, { notificationId });
    } catch {
      await this.dataSource.manager
        .getRepository(EmailVerificationChallenge)
        .update(
          { id: challenge.id },
          { invalidatedAt: new Date(), activeKey: null },
        );
      throw new BusinessException('验证邮件暂时无法发送');
    }

    this.logger.log(
      `邮箱验证挑战#${challenge.id}已创建 purpose=${purpose}`,
      EmailVerificationService.name,
    );
    return {
      challengeId: challenge.id,
      expiresAt,
      resendAvailableAt,
    };
  }

  async verify(challengeId: string, code: string) {
    const now = new Date();
    const pepper = this.config.get<string>('EMAIL_VERIFICATION_PEPPER', '');
    const outcome = await this.dataSource.transaction<VerifyOutcome>(
      async (manager) => {
        const repo = manager.getRepository(EmailVerificationChallenge);
        const challenge = await repo.findOne({
          where: { id: challengeId },
          lock: { mode: 'pessimistic_write' },
        });
        this.assertUsable(challenge, now, false);
        if (challenge.verifiedAt) return 'verified';
        const actual = digestEmailOtp(
          pepper,
          challenge.id,
          challenge.purpose,
          challenge.normalizedEmail,
          code,
        );
        if (!emailOtpMatches(challenge.codeHash, actual)) {
          challenge.failedAttempts += 1;
          await repo.save(challenge);
          return 'wrong_code';
        }
        challenge.verifiedAt = now;
        await repo.save(challenge);
        return 'verified';
      },
    );
    if (outcome === 'wrong_code') {
      this.logger.warn(
        `邮箱验证挑战#${challengeId}校验失败`,
        EmailVerificationService.name,
      );
      throw new BusinessException('验证码错误');
    }
    return { challengeId, verified: true };
  }

  async consume(
    manager: EntityManager,
    challengeId: string,
    expectation: ConsumeExpectation,
    now = new Date(),
  ): Promise<EmailVerificationChallenge> {
    const repo = manager.getRepository(EmailVerificationChallenge);
    const challenge = await repo.findOne({
      where: { id: challengeId },
      lock: { mode: 'pessimistic_write' },
    });
    this.assertUsable(challenge, now, true);
    if (
      challenge.purpose !== expectation.purpose ||
      (expectation.normalizedEmail !== undefined &&
        challenge.normalizedEmail !== expectation.normalizedEmail) ||
      (challenge.userId ?? undefined) !== expectation.userId
    ) {
      throw new BusinessException('邮箱验证挑战与当前操作不匹配');
    }
    challenge.consumedAt = now;
    challenge.activeKey = null;
    return repo.save(challenge);
  }

  private assertUsable(
    challenge: EmailVerificationChallenge | null,
    now: Date,
    requireVerified: boolean,
  ): asserts challenge is EmailVerificationChallenge {
    if (!challenge) throw new BusinessException('邮箱验证挑战不存在');
    if (challenge.invalidatedAt)
      throw new BusinessException('邮箱验证挑战已失效');
    if (challenge.consumedAt) throw new BusinessException('邮箱验证挑战已使用');
    if (challenge.expiresAt <= now)
      throw new BusinessException('邮箱验证挑战已过期');
    if (challenge.failedAttempts >= challenge.maxAttempts)
      throw new BusinessException('邮箱验证失败次数过多');
    if (requireVerified && !challenge.verifiedAt)
      throw new BusinessException('邮箱尚未验证');
  }

  private positiveConfig(name: string, fallback: number): number {
    const value = Number(this.config.get(name, fallback));
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`${name} must be a positive integer`);
    return value;
  }

  private isDuplicate(reason: any) {
    return (
      reason?.code === 'ER_DUP_ENTRY' ||
      reason?.driverError?.code === 'ER_DUP_ENTRY'
    );
  }
}
