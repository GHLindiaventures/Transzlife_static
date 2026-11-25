// Twilio: sign-in codes (Verify), SMS and WhatsApp messages, through Twilio's REST API (no SDK).
//
// Settings (.env.local on your machine, Environment on Render). Never commit them.
//   TWILIO_ACCOUNT_SID            AC…  (Console > Account info)
//   TWILIO_AUTH_TOKEN             (Console > Account info)
//   TWILIO_VERIFY_SERVICE_SID     VA…  sign-in codes; Twilio creates, sends and checks them (recommended)
//   TWILIO_MESSAGING_SERVICE_SID  MG…  or TWILIO_PHONE_NUMBER (+1…): sender for plain SMS
//   TWILIO_WHATSAPP_FROM          +1… / +91…  WhatsApp-enabled sender, for order updates
//   ORDER_NOTIFICATIONS           off | sms | whatsapp   order updates to customers (default off)
const API = 'https://api.twilio.com/2010-04-01';
const VERIFY = 'https://verify.twilio.com/v2';

export class TwilioError extends Error {
  constructor(message, { status = 503, twilioCode, httpStatus } = {}) {
    super(message); this.status = status; this.twilioCode = twilioCode; this.httpStatus = httpStatus;
  }
}

/** +91 for 10-digit Indian mobiles; anything already in +E.164 is kept. */
export const toE164 = (phone) => (String(phone).startsWith('+') ? String(phone) : `+91${String(phone).replace(/\D/g, '').slice(-10)}`);

export function createTwilio(env = process.env, { log = console } = {}) {
  const sid = env.TWILIO_ACCOUNT_SID?.trim();
  const token = env.TWILIO_AUTH_TOKEN?.trim();
  const verifySid = env.TWILIO_VERIFY_SERVICE_SID?.trim();
  const messagingSid = env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber = env.TWILIO_PHONE_NUMBER?.trim();
  const whatsappFrom = env.TWILIO_WHATSAPP_FROM?.trim();
  const configured = !!(sid && token);

  async function call(url, params, method = 'POST') {
    if (!configured) throw new TwilioError('Twilio is not configured.');
    let res, body;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        body: params ? new URLSearchParams(params).toString() : undefined,
        signal: AbortSignal.timeout(15000),
      });
      body = await res.json().catch(() => ({}));
    } catch (e) {
      log.error?.(`[twilio] network error: ${e.message}`);
      throw new TwilioError("We couldn't send the code right now. Please try again in a minute.");
    }
    if (!res.ok) {
      log.error?.(`[twilio] ${res.status} code=${body.code} ${body.message}`);
      throw new TwilioError(friendly(body.code, res.status), { twilioCode: body.code, httpStatus: res.status, status: body.code === 60200 || body.code === 21211 || body.code === 21614 ? 400 : 503 });
    }
    return body;
  }

  // Twilio error codes -> messages a customer can act on
  function friendly(code, httpStatus) {
    switch (code) {
      case 60200: case 21211: case 21614: return 'That mobile number does not look right. Please check it.';
      case 60203: return 'Too many codes sent to this number. Please try again later.';
      case 60202: return 'Too many wrong tries. Please request a new code.';
      case 20404: return 'This code has expired. Please request a new one.';
      case 21408: case 60205: return 'We cannot send SMS to this number yet. Please contact us on WhatsApp.';
      case 20003: return 'Sign-in is temporarily unavailable. Please try again shortly.';   // bad credentials
      default: return httpStatus === 429 ? 'Too many requests. Please wait a moment and try again.' : "We couldn't send the code right now. Please try again in a minute.";
    }
  }

  // ---- Verify: Twilio generates, sends and checks the sign-in code ------
  const verifyReady = configured && !!verifySid;

  /** Sends a sign-in code by SMS. */
  const startVerification = (phone) =>
    call(`${VERIFY}/Services/${verifySid}/Verifications`, { To: toE164(phone), Channel: 'sms' });

  /** true if the code is right; false if wrong. Throws if expired / not found. */
  async function checkVerification(phone, code) {
    try {
      const r = await call(`${VERIFY}/Services/${verifySid}/VerificationCheck`, { To: toE164(phone), Code: String(code) });
      return r.status === 'approved';
    } catch (e) {
      // 20404 = no pending verification (expired, already used, or too many checks)
      if (e.twilioCode === 20404) throw new TwilioError('This code has expired. Please request a new one.', { status: 400, twilioCode: 20404 });
      throw e;
    }
  }

  // ---- Plain SMS and WhatsApp --------------------------------------------
  const smsReady = configured && !!(messagingSid || fromNumber);
  const whatsappReady = configured && !!whatsappFrom;

  const sendSms = (to, body) => call(`${API}/Accounts/${sid}/Messages.json`, {
    To: toE164(to), Body: body, ...(messagingSid ? { MessagingServiceSid: messagingSid } : { From: fromNumber }),
  });

  const sendWhatsApp = (to, body) => call(`${API}/Accounts/${sid}/Messages.json`, {
    To: `whatsapp:${toE164(to)}`, From: `whatsapp:${whatsappFrom.replace(/^whatsapp:/, '')}`, Body: body,
  });

  /** Checks the credentials (and Verify service) without sending anything. */
  async function status() {
    if (!configured) return { configured: false };
    const out = { configured: true, verify: verifyReady, sms: smsReady, whatsapp: whatsappReady };
    try {
      const acct = await call(`${API}/Accounts/${sid}.json`, null, 'GET');
      out.account = { status: acct.status, type: acct.type, name: acct.friendly_name };
      if (verifyReady) {
        const svc = await call(`${VERIFY}/Services/${verifySid}`, null, 'GET');
        out.verifyService = { name: svc.friendly_name, codeLength: svc.code_length };
      }
      out.ok = true;
    } catch (e) {
      out.ok = false; out.error = e.message; out.twilioCode = e.twilioCode;
    }
    return out;
  }

  return { configured, verifyReady, smsReady, whatsappReady, startVerification, checkVerification, sendSms, sendWhatsApp, status };
}
