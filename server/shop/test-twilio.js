// TESTS ONLY. Stands in for Twilio's SMS API during automated tests so they can read the sign-in code
// that would have been texted. Never imported by the app.
export const TEST_TWILIO_ENV = {
  SESSION_SECRET: 'test-session-secret-0123456789abcdef',
  TWILIO_ACCOUNT_SID: 'ACtest',
  TWILIO_AUTH_TOKEN: 'test-token',
  TWILIO_PHONE_NUMBER: '+15005550006',
};

/** Wraps globalThis.fetch: Twilio SMS calls are recorded; everything else passes through. */
export function installTestTwilio() {
  const sent = [];
  const next = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).startsWith('https://api.twilio.com/') && String(url).endsWith('/Messages.json')) {
      const form = Object.fromEntries(new URLSearchParams(opts.body || ''));
      sent.push(form);
      return new Response(JSON.stringify({ sid: `SM${sent.length}`, status: 'queued' }), { status: 201 });
    }
    return next(url, opts);
  };
  return {
    sent,
    /** The last sign-in code texted to a 10-digit mobile. */
    codeFor(phone) {
      const m = [...sent].reverse().find((x) => x.To === `+91${phone}` && /sign-in code/.test(x.Body));
      return m?.Body.match(/^(\d{6})/)?.[1];
    },
    restore() { globalThis.fetch = next; },
  };
}
