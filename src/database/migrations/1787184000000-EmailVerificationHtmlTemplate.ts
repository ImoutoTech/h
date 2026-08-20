import type { MigrationInterface, QueryRunner } from 'typeorm';

export const EMAIL_VERIFICATION_TEMPLATE_KEY = 'account.email.verify';

export const EMAIL_VERIFICATION_TEMPLATE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <title>邮箱验证码</title>
  <style type="text/css">
    @media only screen and (max-width: 480px) {
      .page-padding { padding: 16px 8px !important; }
      .card-content { padding: 28px 20px !important; }
      .verification-code { font-size: 32px !important; letter-spacing: 5px !important; }
      .detail-label, .detail-value { display: block !important; width: 100% !important; text-align: left !important; }
      .detail-value { padding-top: 4px !important; }
    }
    @media only screen and (max-width: 340px) {
      .verification-code { font-size: 28px !important; letter-spacing: 3px !important; }
    }
  </style>
</head>
<body bgcolor="#f3f5f5" style="margin: 0; padding: 0; width: 100%; background-color: #f3f5f5; color: #24302f; font-family: Arial, 'Helvetica Neue', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f5f5" style="width: 100%; border-collapse: collapse; table-layout: fixed; background-color: #f3f5f5;">
    <tr>
      <td class="page-padding" align="center" style="padding: 32px 16px;">
        <table class="email-card" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width: 100%; max-width: 600px; border-collapse: separate; background-color: #ffffff; border: 1px solid #dfe7e6; border-radius: 12px;">
          <tr>
            <td style="height: 6px; line-height: 6px; font-size: 0; background-color: #08736a; border-radius: 12px 12px 0 0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="card-content" style="padding: 36px 40px 32px;">
              <p style="margin: 0 0 12px; color: #08736a; font-size: 13px; font-weight: 700; letter-spacing: 1.4px; line-height: 20px;">SAFE HOUSE</p>
              <h1 style="margin: 0 0 12px; color: #172321; font-size: 26px; font-weight: 700; line-height: 36px;">邮箱验证码</h1>
              <p style="margin: 0 0 24px; color: #53615f; font-size: 16px; line-height: 26px;">请使用下方验证码完成账号操作。</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e9f5f3" style="width: 100%; border-collapse: separate; background-color: #e9f5f3; border: 1px solid #c5e2df; border-radius: 10px;">
                <tr>
                  <td align="center" style="padding: 22px 12px;">
                    <p style="margin: 0 0 6px; color: #50615f; font-size: 12px; font-weight: 700; letter-spacing: 1px; line-height: 18px;">您的验证码</p>
                    <p class="verification-code" style="margin: 0; color: #08736a; font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 700; letter-spacing: 8px; line-height: 48px; white-space: nowrap; word-break: keep-all;">{{code}}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin-top: 24px; border-collapse: collapse;">
                <tr>
                  <td class="detail-label" valign="top" style="width: 84px; padding: 0 12px 12px 0; color: #71807e; font-size: 14px; line-height: 22px;">用途</td>
                  <td class="detail-value" valign="top" style="padding: 0 0 12px; color: #24302f; font-size: 14px; font-weight: 600; line-height: 22px; word-break: break-word;">{{purpose}}</td>
                </tr>
                <tr>
                  <td class="detail-label" valign="top" style="width: 84px; padding: 0 12px 0 0; color: #71807e; font-size: 14px; line-height: 22px;">过期时间</td>
                  <td class="detail-value" valign="top" style="padding: 0; color: #24302f; font-size: 14px; font-weight: 600; line-height: 22px; word-break: break-word;">{{expiresAt}}</td>
                </tr>
              </table>

              <div style="margin-top: 24px; padding: 14px 16px; background-color: #f7f9f9; border-left: 3px solid #08736a;">
                <p style="margin: 0; color: #596765; font-size: 13px; line-height: 21px;">如果这不是您发起的操作，请忽略本邮件。请勿将验证码告诉他人。</p>
              </div>
            </td>
          </tr>
        </table>
        <p style="margin: 18px 0 0; color: #87928f; font-size: 12px; line-height: 18px;">这是一封自动发送的事务邮件，无需回复。</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

export class EmailVerificationHtmlTemplate1787184000000
  implements MigrationInterface
{
  name = 'EmailVerificationHtmlTemplate1787184000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'UPDATE `notification_templates` SET `html` = ? WHERE `key` = ? AND `html` IS NULL',
      [EMAIL_VERIFICATION_TEMPLATE_HTML, EMAIL_VERIFICATION_TEMPLATE_KEY],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'UPDATE `notification_templates` SET `html` = NULL WHERE `key` = ? AND BINARY `html` = BINARY ?',
      [EMAIL_VERIFICATION_TEMPLATE_KEY, EMAIL_VERIFICATION_TEMPLATE_HTML],
    );
  }
}
