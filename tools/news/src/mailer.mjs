import nodemailer from 'nodemailer';

/**
 * SMTP でメールを送る。既定は Gmail SMTP（アプリパスワード）。
 * SMTP_HOST / SMTP_PORT を変えれば他のプロバイダにも向けられる。
 */

export function mailerConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function mailConfig() {
  const user = process.env.SMTP_USER;
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    user,
    to: (process.env.MAIL_TO || 'eiken.tezuka@sonymusic.co.jp')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    from: process.env.MAIL_FROM || (user ? `Daily Brief <${user}>` : undefined),
  };
}

export async function sendMail({ subject, html, text }) {
  const cfg = mailConfig();
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER / SMTP_PASS が未設定です');
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: process.env.SMTP_PASS },
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from: cfg.from,
    to: cfg.to.join(', '),
    subject,
    text,
    html,
  });

  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}
