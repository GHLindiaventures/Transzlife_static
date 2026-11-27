// Lightweight SSE + BroadcastChannel client for real-time updates without manual refreshes.

const CHANNEL_NAME = 'tranzlife-sync';
const seen = new Set();
const seenOrder = [];

function remember(id) {
  if (!id) return true;
  const key = String(id);
  if (seen.has(key)) return false;
  seen.add(key);
  seenOrder.push(key);
  if (seenOrder.length > 120) seen.delete(seenOrder.shift());
  return true;
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

export function emitLocalSync(type, payload = {}) {
  if (!channel) return;
  try {
    channel.postMessage({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, ts: Date.now(), ...payload });
  } catch { /* ignore */ }
}

function subscribeSse(url, eventTypes, { onEvent, onStatus } = {}) {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => {};
  let closed = false;
  let es = null;

  onStatus?.('connecting');

  const handlePayload = (ev) => {
    try {
      const data = JSON.parse(ev.data || '{}');
      if (data.id && !remember(`sse:${data.id}`)) return;
      onEvent?.(data);
    } catch { /* ignore malformed frame */ }
  };

  const connect = () => {
    if (closed) return;
    es = new EventSource(url, { withCredentials: true });
    es.addEventListener('ready', () => { if (!closed) onStatus?.('live'); });
    es.onopen = () => { if (!closed) onStatus?.('live'); };
    es.onerror = () => {
      if (closed) return;
      // EventSource automatically reconnects with backoff; surface reconnecting state to UI
      onStatus?.(navigator.onLine === false ? 'offline' : 'reconnecting');
    };
    for (const type of eventTypes) {
      es.addEventListener(type, handlePayload);
    }
  };

  connect();

  const onLocal = (msg) => {
    const data = msg?.data;
    if (!data?.type) return;
    if (data.id && !remember(`bc:${data.id}`)) return;
    if (eventTypes.includes(data.type)) onEvent?.(data);
  };
  channel?.addEventListener('message', onLocal);

  return () => {
    closed = true;
    es?.close();
    channel?.removeEventListener('message', onLocal);
  };
}

export const subscribePublicEvents = ({ trackId, onEvent, onStatus } = {}) => {
  const qs = trackId ? `?track=${encodeURIComponent(trackId)}` : '';
  return subscribeSse(`/api/events/public${qs}`, ['site_content', 'catalog', 'order'], { onEvent, onStatus });
};

export const subscribeCustomerEvents = ({ onEvent, onStatus } = {}) =>
  subscribeSse('/api/events/customer', ['site_content', 'catalog', 'order', 'payment', 'shipment', 'return', 'customer'], { onEvent, onStatus });

export const subscribeAdminEvents = ({ onEvent, onStatus } = {}) =>
  subscribeSse('/api/admin/events', [
    'order', 'payment', 'shipment', 'customer', 'return', 'review', 'enquiry', 'product', 'inventory', 'settings', 'site_content',
  ], { onEvent, onStatus });
