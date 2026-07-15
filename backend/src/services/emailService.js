/**
 * Email delivery service for JIGZO recipient reveals (Resend).
 *
 * This is separate from the admin waitlist email code (which is on hold) and is
 * used to deliver a secure reveal link to recipients who chose Email delivery.
 * When RESEND_API_KEY is not configured the service reports as unconfigured and
 * the caller keeps the recipient in a non-delivered state.
 */
const { Resend } = require('resend');

const EMAIL_FROM = process.env.EMAIL_FROM || 'JIGZO <info@jigzo.biz>';
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  })[character]);

/**
 * @returns {boolean} whether the provider is configured on this environment.
 */
function isConfigured() {
  return Boolean(resend);
}

/**
 * Send a reveal link to an email recipient.
 * @param {object} params
 * @param {string} params.to            Recipient email (already normalized).
 * @param {string} params.recipientName Recipient display name.
 * @param {string} params.senderName    Sender display name (may be blank/anonymous).
 * @param {string} params.revealLink    Secure reveal URL.
 * @param {string} params.idempotencyKey Stable per-recipient key.
 * @returns {Promise<{ success: boolean, providerMessageId: string, error: string|null }>}
 */
async function sendRevealEmail({ to, recipientName, senderName, revealLink, idempotencyKey }) {
  if (!resend) {
    return {
      success: false,
      providerMessageId: '',
      error: 'Email delivery is not configured on this environment.'
    };
  }

  const safeSender = escapeHtml(senderName || 'Someone');
  const safeRecipient = escapeHtml(recipientName || 'there');
  const safeLink = escapeHtml(revealLink);

  const subject = `${senderName ? senderName + ' sent' : 'You have'} a JIGZO puzzle`;

  const text = [
    `Hi ${recipientName || 'there'},`,
    '',
    `${senderName || 'Someone'} sent you a JIGZO surprise puzzle.`,
    'Solve it to reveal their personal message:',
    revealLink,
    '',
    'JIGZO'
  ].join('\n');

  const html = [
    '<div style="margin:0;padding:32px 20px;background:#faf8ec;">',
    '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid rgba(28,25,19,0.08);border-radius:16px;padding:32px;font-family:Arial,sans-serif;color:#1c1913;line-height:1.65;">',
    '<div style="font-size:22px;font-weight:700;letter-spacing:0.04em;margin-bottom:24px;">JIGZO</div>',
    '<div style="font-size:16px;">Hi ' + safeRecipient + ',</div>',
    '<div style="font-size:16px;margin-top:12px;">' + safeSender + ' sent you a JIGZO surprise puzzle. Solve it to reveal their personal message.</div>',
    '<div style="margin:28px 0;">',
    '<a href="' + safeLink + '" style="display:inline-block;background:#a67c3d;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:700;">Open your puzzle</a>',
    '</div>',
    '<div style="font-size:13px;color:rgba(28,25,19,0.55);">If the button does not work, copy this link:<br>' + safeLink + '</div>',
    '<div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(28,25,19,0.10);font-size:12px;color:rgba(28,25,19,0.55);">',
    'Sent by JIGZO &middot; Every surprise deserves a memorable reveal.',
    '</div></div></div>'
  ].join('');

  try {
    const result = await resend.emails.send(
      {
        from: EMAIL_FROM,
        to: [to],
        subject,
        text,
        html
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );

    if (result.error) {
      return {
        success: false,
        providerMessageId: '',
        error: result.error.message || 'The email provider rejected the message.'
      };
    }

    return {
      success: true,
      providerMessageId: (result.data && result.data.id) || '',
      error: null
    };
  } catch (err) {
    return {
      success: false,
      providerMessageId: '',
      error: String(err.message || 'Email send failed').slice(0, 500)
    };
  }
}

module.exports = { sendRevealEmail, isConfigured, EMAIL_FROM };
