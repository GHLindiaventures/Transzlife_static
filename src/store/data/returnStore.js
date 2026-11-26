// Customer returns (server: server/shop/returns.js). The server applies the policy; the browser only shows it.
import { api, ApiError } from '../lib/api';
import { compressImage } from './reviewStore';

export { compressImage };

/** Policy for one order (which lines can be returned and why not), plus the returns already made on it. */
export const loadOrderReturns = (orderNumber) => api(`/api/orders/${encodeURIComponent(orderNumber)}/returns`);

/** All of my returns, newest first. */
export const loadMyReturns = () => api('/api/returns').then((d) => d.returns).catch(() => []);

/** Creates a return request. Returns { number }. */
export const requestReturn = (orderNumber, { items, reason, note, photoIds }) =>
  api(`/api/orders/${encodeURIComponent(orderNumber)}/returns`, { method: 'POST', body: { items, reason, note, photoIds } });

/** Uploads one (already compressed) photo and returns { id, url, thumbUrl }. */
export async function uploadReturnPhoto(blob) {
  let res;
  try {
    res = await fetch('/api/returns/photos', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob });
  } catch {
    throw new ApiError('Could not upload the photo. Check your connection and try again.', 0, 'network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Could not upload the photo.', res.status, data.code);
  return data;
}

/** Colour family of a return's status chip. */
export const returnTone = (r) => (r.status === 'rejected' ? 'is-off' : r.status === 'resolved' || r.status === 'received' ? 'is-ok' : r.status === 'requested' ? 'is-warn' : '');
