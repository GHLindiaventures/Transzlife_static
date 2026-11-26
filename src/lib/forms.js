// Website forms -> our own API (server-side validation, rate limits, honeypot; see server/shop/enquiries.js).
// VITE_CONTACT_ENDPOINT / VITE_NEWSLETTER_ENDPOINT can still point the forms at an outside service.

export const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || '/api/contact';
export const NEWSLETTER_ENDPOINT = import.meta.env.VITE_NEWSLETTER_ENDPOINT || '/api/newsletter';

/** Hidden "website" field: people never see it, spam bots fill it in. Spread onto an <input>. */
export const honeypotProps = {
  name: 'website',
  type: 'text',
  tabIndex: -1,
  autoComplete: 'off',
  'aria-hidden': true,
  className: 'hp-field',
  style: { position: 'absolute', left: '-10000px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' },
};

export const isEmail = (s) => /^\S+@\S+\.\S+$/.test(String(s).trim());

/** POST JSON; resolves on 2xx, otherwise throws an Error with the server's message (if any). */
export async function postForm(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  }
  return res.json().catch(() => ({}));
}

/** Newsletter sign-up shared by the footer and the home page. */
export const subscribe = (email, source, website = '') =>
  postForm(NEWSLETTER_ENDPOINT, { email: String(email).trim(), source, website });
