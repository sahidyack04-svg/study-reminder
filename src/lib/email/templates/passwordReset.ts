export interface PasswordResetEmailInput {
  resetUrl: string;
  expiryHours: number;
}

export interface PasswordResetEmailOutput {
  subject: string;
  html: string;
  text: string;
}

function expiryPhrase(expiryHours: number): string {
  return expiryHours === 1 ? "1 hour" : `${expiryHours} hours`;
}

export function buildPasswordResetEmail({
  resetUrl,
  expiryHours,
}: PasswordResetEmailInput): PasswordResetEmailOutput {
  const expiry = expiryPhrase(expiryHours);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset your Study Reminder password</title>
  </head>
  <body style="margin:0; padding:0; background-color:#FFF9F4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF9F4; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.08); overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <p style="margin:0 0 24px 0; font-size:18px; font-weight:600; color:#D97BA3;">Study Reminder</p>
                <h1 style="margin:0 0 16px 0; font-size:22px; font-weight:600; color:#D97BA3;">Reset your password</h1>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.5; color:#334155;">
                  We received a request to reset the password for your Study Reminder account.
                  Click the button below to choose a new password.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="border-radius:999px; background-color:#F3A7C5;">
                      <a href="${resetUrl}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:999px;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px 0; font-size:13px; line-height:1.5; color:#64748b;">
                  This link expires in ${expiry}. If the button above doesn't work, copy and paste this URL into your browser:
                  <br />
                  <a href="${resetUrl}" style="color:#A693D6; word-break:break-all;">${resetUrl}</a>
                </p>
                <p style="margin:24px 0 0 0; font-size:13px; line-height:1.5; color:#64748b; border-top:1px solid #FBE4EC; padding-top:16px;">
                  If you didn't request a password reset, you can safely ignore this email — your password will not be changed.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Study Reminder — Reset your password

We received a request to reset the password for your Study Reminder account.

Reset your password here: ${resetUrl}

This link expires in ${expiry}.

If you didn't request a password reset, you can safely ignore this email — your password will not be changed.`;

  return {
    subject: "Reset your Study Reminder password",
    html,
    text,
  };
}
