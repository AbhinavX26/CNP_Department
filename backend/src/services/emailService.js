/**
 * Email for material requests (Gmail SMTP through nodemailer).
 *
 * Fail-safe, like the notification service: a mail problem is logged and never
 * stops the request that triggered it. If SMTP_USER / SMTP_PASS are not set the
 * mailer is simply off.
 *
 * Gmail needs an App Password (Google account → Security → 2-Step Verification →
 * App passwords), not the normal account password.
 */

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function isEmailConfigured(env = process.env) {
  return Boolean(env.SMTP_USER && env.SMTP_PASS);
}

function formatMoney(value, currency = '₹') {
  if (value === null || value === undefined) return 'Not priced';
  return `${currency}${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatWhen(date, env = process.env) {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: env.MAIL_TIMEZONE || 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const ROUTE_TEXT = {
  within_budget: (limit) => `Within the ${formatMoney(limit)} budget limit, so it comes to you as the project's faculty mentor.`,
  over_budget: (limit) => `Above the ${formatMoney(limit)} budget limit, so it needs the project admin's approval.`,
  unpriced_item: () => 'One or more items have no price on file, so it needs the project admin.',
  no_mentor: () => 'The project has no faculty mentor assigned, so it comes to the project admin.',
};

/**
 * Build the subject, plain text and HTML for one submission.
 *
 * @param {object} d
 * @param {string} d.projectName
 * @param {{name:string,email?:string,department?:string,semester?:string|number}} d.requester
 * @param {Date|string} d.submittedAt
 * @param {Array<{name:string,quantity:number,unitCost:number|null,lineTotal:number|null,specifications?:string}>} d.items
 * @param {number|null} d.total
 * @param {'mentor'|'admin'} d.route
 * @param {string} d.routeReason
 * @param {number} d.limit
 * @param {string} d.reason          the team's explanation
 * @param {string} d.reviewUrl
 * @param {{name?:string}} d.recipient
 */
export function buildMaterialRequestEmail(d, env = process.env) {
  const toAdmin = d.route === 'admin';
  const greeting = d.recipient?.name ? `Dear ${d.recipient.name},` : 'Hello,';
  const itemCount = d.items.length;
  const unitsTotal = d.items.reduce((sum, item) => sum + item.quantity, 0);
  const subject = `[CNP] Material request — ${d.projectName}: ${itemCount} item${itemCount === 1 ? '' : 's'}${
    d.total === null ? '' : `, ${formatMoney(d.total)}`
  } — your approval needed`;
  const routeLine = (ROUTE_TEXT[d.routeReason] || ROUTE_TEXT.over_budget)(d.limit);
  const when = formatWhen(d.submittedAt, env);
  const requesterLine = [d.requester.name, d.requester.department, d.requester.semester ? `Semester ${d.requester.semester}` : '']
    .filter(Boolean)
    .join(' · ');
  const reasonLabel = toAdmin ? 'Justification from the project team' : 'Purpose';

  const text = [
    greeting,
    '',
    `${d.requester.name} (Team Leader) has requested materials for the project "${d.projectName}" and it is waiting for your decision.`,
    '',
    `Project:        ${d.projectName}`,
    `Requested by:   ${requesterLine}${d.requester.email ? ` <${d.requester.email}>` : ''}`,
    `Submitted:      ${when}`,
    `Items / units:  ${itemCount} / ${unitsTotal}`,
    `Estimated total: ${formatMoney(d.total)}`,
    `Why you:        ${routeLine}`,
    '',
    'ITEMS',
    ...d.items.map(
      (item, index) =>
        `${index + 1}. ${item.name} — qty ${item.quantity} × ${formatMoney(item.unitCost)} = ${formatMoney(item.lineTotal)}${
          item.specifications ? `\n   Specs: ${item.specifications}` : ''
        }`,
    ),
    '',
    `${reasonLabel.toUpperCase()}`,
    d.reason,
    '',
    `Review and decide: ${d.reviewUrl}`,
    '',
    'This message was sent automatically by the CNP Department platform.',
  ].join('\n');

  const rows = d.items
    .map(
      (item, index) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e4ebf7;color:#8a97b2">${index + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e4ebf7;color:#122549">
          <strong>${escapeHtml(item.name)}</strong>${
            item.specifications
              ? `<div style="color:#5f6f8d;font-size:12px;margin-top:2px">${escapeHtml(item.specifications)}</div>`
              : ''
          }
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e4ebf7;text-align:right;color:#122549">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e4ebf7;text-align:right;color:#5f6f8d">${escapeHtml(formatMoney(item.unitCost))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e4ebf7;text-align:right;color:#122549"><strong>${escapeHtml(formatMoney(item.lineTotal))}</strong></td>
      </tr>`,
    )
    .join('');

  const fact = (label, value) => `
    <tr>
      <td style="padding:4px 16px 4px 0;color:#8a97b2;font-size:12px;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;vertical-align:top">${label}</td>
      <td style="padding:4px 0;color:#122549;font-size:14px">${value}</td>
    </tr>`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#f3f7ff;font-family:Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4ebf7">
    <div style="padding:22px 28px;background:linear-gradient(135deg,#0c1a47,#0b3a86 55%,#0462d3);background-color:#0b3a86;color:#ffffff">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8">CNP Department · Material request</div>
      <div style="font-size:20px;font-weight:600;margin-top:6px">${escapeHtml(d.projectName)}</div>
      <div style="font-size:13px;opacity:.85;margin-top:4px">Waiting for your decision</div>
    </div>
    <div style="padding:24px 28px">
      <p style="margin:0 0 14px;color:#122549;font-size:15px">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 18px;color:#5f6f8d;font-size:14px;line-height:1.55">
        <strong style="color:#122549">${escapeHtml(d.requester.name)}</strong> (Team Leader) has requested materials for this project.
      </p>
      <table role="presentation" style="border-collapse:collapse;margin-bottom:20px">
        ${fact('Requested by', escapeHtml(requesterLine) + (d.requester.email ? ` &lt;${escapeHtml(d.requester.email)}&gt;` : ''))}
        ${fact('Submitted', escapeHtml(when))}
        ${fact('Items', `${itemCount} item${itemCount === 1 ? '' : 's'} · ${unitsTotal} unit${unitsTotal === 1 ? '' : 's'}`)}
        ${fact('Estimated total', `<strong>${escapeHtml(formatMoney(d.total))}</strong>`)}
        ${fact('Why you', escapeHtml(routeLine))}
      </table>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e4ebf7;border-radius:12px">
        <thead>
          <tr style="background:#f3f7ff;color:#8a97b2;font-size:11px;text-transform:uppercase;letter-spacing:.04em">
            <th style="padding:8px 12px;text-align:left">#</th>
            <th style="padding:8px 12px;text-align:left">Item</th>
            <th style="padding:8px 12px;text-align:right">Qty</th>
            <th style="padding:8px 12px;text-align:right">Unit</th>
            <th style="padding:8px 12px;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}
          <tr>
            <td colspan="4" style="padding:10px 12px;text-align:right;color:#5f6f8d">Estimated total</td>
            <td style="padding:10px 12px;text-align:right;color:#0462d3;font-size:15px"><strong>${escapeHtml(formatMoney(d.total))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div style="margin:22px 0 6px;color:#8a97b2;font-size:12px;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(reasonLabel)}</div>
      <div style="padding:14px 16px;background:#f3f7ff;border-radius:12px;color:#122549;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(d.reason)}</div>
      <div style="margin-top:26px">
        <a href="${escapeHtml(d.reviewUrl)}" style="display:inline-block;padding:12px 22px;background:#0462d3;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600">Review and decide</a>
      </div>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #e4ebf7;color:#8a97b2;font-size:12px">
      Sent automatically by the CNP Department platform. Please do not reply to this message.
    </div>
  </div>
</body></html>`;

  return { subject, text, html };
}

let transporterPromise = null;

async function getTransporter(env = process.env) {
  if (!transporterPromise) {
    transporterPromise = import('nodemailer').then((mod) => {
      const nodemailer = mod.default || mod;
      return nodemailer.createTransport({
        host: env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(env.SMTP_PORT) || 465,
        secure: (Number(env.SMTP_PORT) || 465) === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
    });
  }
  return transporterPromise;
}

/** Test hook: swap or reset the transport. */
export function __setTransporterForTests(transporter) {
  transporterPromise = transporter ? Promise.resolve(transporter) : null;
}

/**
 * Send one message. Never throws; returns { sent, reason? }.
 */
export async function sendMail({ to, subject, text, html }, env = process.env) {
  if (!to) return { sent: false, reason: 'no_recipient' };
  if (!isEmailConfigured(env) && !transporterPromise) {
    return { sent: false, reason: 'not_configured' };
  }
  try {
    const transporter = await getTransporter(env);
    await transporter.sendMail({
      from: env.MAIL_FROM || `CNP Department <${env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error('[Email] send failed:', error.message);
    return { sent: false, reason: 'send_failed' };
  }
}

/**
 * Email every recipient of a submission individually (so nobody sees who else got it).
 * @param {Array<{name?:string,email?:string}>} recipients
 */
export async function sendMaterialRequestEmails(details, recipients, env = process.env) {
  const results = [];
  for (const recipient of recipients) {
    if (!recipient?.email) continue;
    const content = buildMaterialRequestEmail({ ...details, recipient }, env);
    results.push(await sendMail({ to: recipient.email, ...content }, env));
  }
  return results;
}
