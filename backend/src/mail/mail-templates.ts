/** Templates simples de e-mail (texto + HTML). */

export function passwordResetEmail(opts: {
  name: string;
  businessName?: string;
  resetLink: string;
  role: 'account' | 'employee';
}) {
  const who =
    opts.role === 'account'
      ? 'painel Sof'
      : `agenda Sof${opts.businessName ? ` (${opts.businessName})` : ''}`;
  const subject = 'Redefinir senha — Sof';
  const text = [
    `Olá, ${opts.name}!`,
    '',
    `Recebemos um pedido para redefinir a senha do ${who}.`,
    '',
    `Abra o link (válido por 2 horas, uso único):`,
    opts.resetLink,
    '',
    'Se você não pediu isso, ignore este e-mail.',
    '',
    '— Sof',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1f2623;max-width:520px">
      <p>Olá, <strong>${escapeHtml(opts.name)}</strong>!</p>
      <p>Recebemos um pedido para redefinir a senha do ${escapeHtml(who)}.</p>
      <p style="margin:24px 0">
        <a href="${escapeAttr(opts.resetLink)}"
           style="display:inline-block;background:#3D4743;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">
          Redefinir senha
        </a>
      </p>
      <p style="font-size:13px;color:#5a635f">O link vale por 2 horas e é de uso único.</p>
      <p style="font-size:13px;color:#5a635f">Se você não pediu isso, ignore este e-mail.</p>
      <p style="font-size:13px;color:#5a635f">— Sof</p>
    </div>
  `.trim();

  return { subject, text, html };
}

export function welcomeEmail(opts: {
  name: string;
  businessName: string;
  email: string;
  loginUrl: string;
  planName: string;
}) {
  const subject = `Bem-vindo à Sof — ${opts.businessName}`;
  const text = [
    `Olá, ${opts.name}!`,
    '',
    `Sua conta Sof (${opts.businessName}) está ativa no plano ${opts.planName}.`,
    '',
    `E-mail de acesso: ${opts.email}`,
    `Entrar: ${opts.loginUrl}`,
    '',
    'No painel você configura WhatsApp, profissionais, serviços e a agenda.',
    '',
    '— Equipe Sof',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1f2623;max-width:520px">
      <p>Olá, <strong>${escapeHtml(opts.name)}</strong>!</p>
      <p>Sua conta Sof (<strong>${escapeHtml(opts.businessName)}</strong>) está ativa no plano <strong>${escapeHtml(opts.planName)}</strong>.</p>
      <p>E-mail de acesso: <strong>${escapeHtml(opts.email)}</strong></p>
      <p style="margin:24px 0">
        <a href="${escapeAttr(opts.loginUrl)}"
           style="display:inline-block;background:#3D4743;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">
          Abrir painel
        </a>
      </p>
      <p style="font-size:13px;color:#5a635f">Configure WhatsApp, profissionais, serviços e a agenda no painel.</p>
      <p style="font-size:13px;color:#5a635f">— Equipe Sof</p>
    </div>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
