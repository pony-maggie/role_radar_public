export const VERIFICATION_CODE_EXPIRES_IN_MINUTES = 10;

export function renderVerificationCodeEmail(input: {
  code: string;
  expiresInMinutes?: number;
}) {
  const expiresInMinutes = input.expiresInMinutes ?? VERIFICATION_CODE_EXPIRES_IN_MINUTES;
  const subject = `Your Role Radar sign-in code: ${input.code}`;
  const text = [
    "Use this Role Radar verification code to sign in:",
    "",
    input.code,
    "",
    `This code expires in ${expiresInMinutes} minutes.`
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Use this Role Radar verification code to sign in:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.25em;">${input.code}</p>
      <p>This code expires in ${expiresInMinutes} minutes.</p>
    </div>
  `;

  return { subject, text, html };
}
