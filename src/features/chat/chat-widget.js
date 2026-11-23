// "Tulsi" wellness chat, ported from the old site (Tranz_Life_zip/src/features/chat/chat-widget.js).
// A chat panel that talks to the chat API (server/chat-api.js): Gemini answers first (4-key rotation);
// when every Gemini key is out of quota the server silently switches to the local Ollama bot, and back
// to Gemini as soon as a key works again. The widget is the same for both engines.
//
// Changes from the old site, all presentation only (chat logic, prompts, headers and storage are unchanged):
//   - product cards use this site's store data (current price, image, product page link) instead of the
//     old catalogue's prices; the old catalogue is still used to accept the product ids the server sends
//   - "Enquire" / "Contact our team" navigate inside the React app (/products/..., /contact) instead of #contact
//   - opened from the site's "Talk to us" button (openChat); the old round button is kept for the
//     minimized state only
import { CATALOG } from '../../data/catalog.js';
import { getProduct } from '../../store/data/products.js';

const API = (import.meta.env.VITE_CHAT_API || '') + '/api/chat';
const STORE = 'tl-chat-v1';
const WELCOME = 'Hi, I\'m Tulsi, TranzLife\'s wellness assistant 🌿 Tell me what\'s been bothering you, and I\'ll suggest the TranzLife product that may help, along with simple, natural care tips. You can also ask me about our products, prices or how to order. Type in English, Tamil or Tanglish, and I\'ll reply in simple English. I share general wellness guidance, not medical advice.';
const CHIPS = ['Period cramps', 'Stressed at work', 'Dry, cracked feet', 'Always tired', 'Liver care', 'Can\'t sleep well'];

// chat catalogue id -> this site's store product id (/products/<id>)
const STORE_IDS = {
  pulmoclear: 'pulmoclear-gummies',
  breathefree: 'breathefree-inhaler',
  'liver-booster': 'liver-booster',
  cyclerelief: 'cyclerelief-roll-on',
  reviva: 'reviva-roll-on',
  'energy-booster': 'energy-booster',
};

const LEAF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19c3-4 6-7 10-9"/></svg>';
const SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';

let msgs = [], busy = false, els, go = (path) => { location.href = path; };

const $ = (s, r = document) => r.querySelector(s);
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = s => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const asset = (src) => `${import.meta.env.BASE_URL}${String(src).replace(/^\//, '')}`;

// light formatting: **bold**, "- " lists, paragraphs. Any [[tags]] or stray brackets from the model are dropped.
function format(text){
  const clean = text.replace(/\[\[[^\]]*\]?\]?/g, '').replace(/\[\[?$/, '').trim();
  return clean.split(/\n{2,}/).map(block => {
    const lines = block.split('\n').map(l => esc(l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'));
    if (lines.every(l => /^\s*[-*•]\s/.test(l))) return `<ul>${lines.map(l => `<li>${l.replace(/^\s*[-*•]\s/, '')}</li>`).join('')}</ul>`;
    return `<p>${lines.join('<br>')}</p>`;
  }).join('');
}

// quick replies suggested by the server with a clarifying question
const suggestRow = list => list && list.length ? `<div class="ch-chips ch-suggest" style="padding:2px 0 0">${list.map(s => `<button type="button" data-say="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '';

// buttons the server asks for under a reply: open the contact form, or start a new chat
const ACTIONS = {
  // the official TranzLife WhatsApp number for enquiries and orders (client, 13 Nov 2026)
  whatsapp:'<a class="ch-action ch-wa" href="https://wa.me/919150394443" target="_blank" rel="noopener">WhatsApp us</a>',
  contact:'<a class="ch-action ch-enquire" href="/contact" data-product="" data-id="">Contact our team</a>',
  new:'<button type="button" class="ch-action ch-restart">Start a new chat</button>'
};
const actionRow = list => list && list.length ? `<div class="ch-actions">${list.map(k => ACTIONS[k] || '').join('')}</div>` : '';

function productCard(id){
  const c = CATALOG.find(x => x.id === id); if (!c) return '';
  const storeId = STORE_IDS[id], p = storeId && getProduct(storeId);
  const name = p ? p.name : c.name;
  const meta = p
    ? [p.format, p.size, inr(p.price)].filter(Boolean).join(' · ')
    : [c.form, c.size, 'Price on request'].filter(Boolean).join(' · ');
  const icon = p?.images?.[0]
    ? `<span class="ch-prod-ic ch-prod-img"><img src="${esc(asset(p.images[0]))}" alt="" loading="lazy"></span>`
    : `<span class="ch-prod-ic">${LEAF}</span>`;
  const href = storeId ? `/products/${storeId}` : '/shop';
  return `<div class="ch-prod">${icon}
    <div><b>${esc(name)}</b>${c.pitch ? `<span class="ch-prod-pitch">${esc(c.pitch)}</span>` : ''}<small>${esc(meta)}</small></div>
    <a class="ch-enquire" href="${href}" data-product="${esc(name)}" data-id="${esc(c.id)}" data-href="${href}">View product</a></div>`;
}

function bubble(m){
  const row = document.createElement('div');
  row.className = `ch-msg ${m.role === 'user' ? 'me' : 'bot'}`;
  row.innerHTML = m.role === 'user' ? `<div class="ch-b"><p>${esc(m.content)}</p></div>`
    : `<span class="ch-av">${LEAF}</span><div class="ch-b">${format(m.content)}${(m.products || []).map(productCard).join('')}${actionRow(m.actions)}${suggestRow(m.suggest)}</div>`;
  return row;
}

function save(){ try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30))); } catch(e){} }
function load(){ try { const v = JSON.parse(sessionStorage.getItem(STORE) || '[]'); return Array.isArray(v) ? v : []; } catch(e){ return []; } }

function scrollDown(){ els.list.scrollTop = els.list.scrollHeight; }

function render(){
  els.list.innerHTML = '';
  els.list.append(bubble({ role:'assistant', content:WELCOME }));
  msgs.forEach(m => els.list.append(bubble(m)));
  els.chips.hidden = msgs.length > 0;
  scrollDown();
}

async function send(text){
  text = text.trim(); if (!text || busy) return;
  busy = true; els.send.disabled = true; els.input.value = ''; autosize(); els.chips.hidden = true;
  msgs.push({ role:'user', content:text }); els.list.append(bubble(msgs[msgs.length - 1]));
  const reply = { role:'assistant', content:'', products:[] };
  const row = bubble(reply); row.classList.add('typing'); row.querySelector('.ch-b').innerHTML = '<i class="ch-dots"><span></span><span></span><span></span></i>';
  els.list.append(row); scrollDown();
  const body = row.querySelector('.ch-b');
  try {
    const res = await fetch(API, { method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ messages:msgs.map(({ role, content }) => ({ role, content })) }) });
    if (!res.ok || !res.body) throw new Error(res.status);
    reply.products = (res.headers.get('X-Products') || '').split(',').filter(id => CATALOG.some(p => p.id === id));
    reply.suggest = (res.headers.get('X-Suggest') || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 6);
    reply.actions = (res.headers.get('X-Actions') || '').split(',').filter(k => k in ACTIONS);
    const reader = res.body.getReader(), dec = new TextDecoder();
    for (;;){
      const { done, value } = await reader.read(); if (done) break;
      reply.content += dec.decode(value, { stream:true });
      if (reply.content.trim()){ row.classList.remove('typing'); body.innerHTML = format(reply.content); scrollDown(); }
    }
    if (!reply.content.trim()) throw new Error('empty');
    body.innerHTML = format(reply.content) + reply.products.map(productCard).join('') + actionRow(reply.actions) + suggestRow(reply.suggest);
    msgs.push(reply);
  } catch(err){
    row.classList.remove('typing');
    body.innerHTML = '<p>Sorry, I can\'t connect right now. Please try again in a minute, or reach the team through the Contact page.</p>';
    msgs.pop();     // let them resend the same message
  }
  save(); scrollDown();
  busy = false; els.send.disabled = false; els.input.focus();
}

function autosize(){ els.input.style.height = 'auto'; els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px'; }

// minimized: the chat stays on screen as a small header bar; the conversation is kept
function minimize(on){
  els.root.classList.toggle('min', on);
  els.min.setAttribute('aria-label', on ? 'Expand chat' : 'Minimize chat');
  els.min.title = on ? 'Expand' : 'Minimize';
  els.min.setAttribute('aria-expanded', !on);
  if (!on){ scrollDown(); setTimeout(() => els.input.focus(), 250); }
}

function open(on){
  els.root.classList.remove('min'); els.min.setAttribute('aria-label', 'Minimize chat'); els.min.title = 'Minimize'; els.min.setAttribute('aria-expanded', true);
  els.root.classList.toggle('open', on);
  els.fab.setAttribute('aria-expanded', on);
  els.panel.setAttribute('aria-hidden', !on);
  document.body.classList.toggle('chat-open', on);   // hides the "Talk to us" tab while the panel is up
  // closing: don't leave focus inside the now-hidden panel (browsers warn, and screen readers lose their place)
  if (!on && els.panel.contains(document.activeElement)) (document.querySelector('.float-widget') || document.body).focus?.();
  if (on){ scrollDown(); setTimeout(() => els.input.focus(), 250); }
}

/** Open (or expand) the chat panel. Used by the site's "Talk to us" button. */
function openChat(){
  if (!els) return;
  if (els.root.classList.contains('min')) minimize(false);
  else open(true);
}

/** Mount the chat once. `navigate` is react-router's navigate, so links stay inside the app. */
function initChat({ navigate } = {}){
  if (navigate) go = navigate;
  if (els && document.body.contains(els.root)) return;

  const root = document.createElement('div');
  root.className = 'chat t-cream'; root.id = 'chat';
  root.innerHTML = `
    <section class="ch-panel" id="chatPanel" role="dialog" aria-label="Chat with Tulsi, TranzLife wellness advisor" aria-hidden="true">
      <header class="ch-head">
        <span class="ch-av big">${LEAF}</span>
        <div><b>Tulsi</b><small><i></i>TranzLife wellness friend</small></div>
        <button class="ch-new" type="button" title="Start a new chat">New chat</button>
        <button class="ch-min" type="button" aria-label="Minimize chat" title="Minimize" aria-expanded="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="ch-min-dash" d="M6 12h12"/><path class="ch-min-up" d="M6 15l6-6 6 6"/></svg></button>
        <button class="ch-x" type="button" aria-label="Close chat">×</button>
      </header>
      <div class="ch-list" data-lenis-prevent aria-live="polite"></div>
      <div class="ch-chips">${CHIPS.map(c => `<button type="button">${c}</button>`).join('')}</div>
      <form class="ch-form">
        <textarea rows="1" placeholder="Tell me how you're feeling…" aria-label="Your message" maxlength="1500"></textarea>
        <button class="ch-send" type="submit" aria-label="Send">${SEND}</button>
      </form>
      <p class="ch-note">General wellness tips, not medical advice. In an emergency, call 112. We count common topics anonymously to improve our products; your messages are not stored.</p>
    </section>
    <button class="ch-fab" type="button" aria-controls="chatPanel" aria-expanded="false">
      <span class="ch-fab-ic">${LEAF}</span><b>Ask Tulsi</b>
    </button>`;
  document.body.append(root);
  els = { root, panel:$('.ch-panel', root), list:$('.ch-list', root), chips:$('.ch-chips', root), input:$('textarea', root), send:$('.ch-send', root), fab:$('.ch-fab', root) };

  msgs = load(); render();
  els.min = $('.ch-min', root);
  // the round button: opens the chat, expands it if minimized, or closes it
  els.fab.addEventListener('click', () => root.classList.contains('min') ? minimize(false) : open(!root.classList.contains('open')));
  $('.ch-x', root).addEventListener('click', () => open(false));
  els.min.addEventListener('click', e => { e.stopPropagation(); minimize(!root.classList.contains('min')); });
  // tapping the minimized bar (anywhere but its buttons) expands it again
  $('.ch-head', root).addEventListener('click', e => { if (root.classList.contains('min') && !e.target.closest('button')) minimize(false); });
  const restart = () => { if (busy) return; msgs = []; save(); render(); els.input.focus(); };
  $('.ch-new', root).addEventListener('click', restart);
  els.list.addEventListener('click', e => { const s = e.target.closest('.ch-suggest button'); if (s) send(s.dataset.say); });
  els.list.addEventListener('click', e => { if (e.target.closest('.ch-restart')) restart(); });
  // "View product" on a card, or "Contact our team": go to that page inside the app.
  // Contact gets a pre-filled message, like the old "Enquire" button did.
  els.list.addEventListener('click', e => {
    const a = e.target.closest('.ch-enquire'); if (!a) return;
    e.preventDefault();
    // count the enquiry anonymously (only the product id)
    if (a.dataset.id) try { navigator.sendBeacon?.(API.replace(/chat$/, 'insight'), new Blob([JSON.stringify({ enquire:a.dataset.id })], { type:'application/json' })); } catch {}
    if (a.dataset.href){
      go(a.dataset.href);
      if (innerWidth < 620) open(false); else minimize(true);
    } else {
      go('/contact', { state:{ chatMessage:'Hi, I\'d like to know more about your products, prices and how to order.' } });
      open(false);
    }
  });
  els.chips.addEventListener('click', e => { const b = e.target.closest('button'); if (b) send(b.textContent); });
  $('.ch-form', root).addEventListener('submit', e => { e.preventDefault(); send(els.input.value); });
  els.input.addEventListener('input', autosize);
  els.input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); send(els.input.value); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('open')) open(false); });
}

export { initChat, openChat };
