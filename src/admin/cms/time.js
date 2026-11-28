// India-time (IST) helpers for the blog dashboard. Kept tiny and free of the editor, so list pages can use them
// without loading the article editor.
const IST = 'Asia/Kolkata';

/** "27 Nov 2026, 9:00 am IST" */
export const fmtIST = (iso) => (iso ? `${new Date(iso).toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })} IST` : '');

/** { date: 'YYYY-MM-DD', time: 'HH:MM' } of a moment, in IST */
export function istParts(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

/** A date and time typed as India time -> an exact moment ("2026-12-01T09:00:00+05:30"). */
export const istToIso = (date, time) => `${date}T${time}:00+05:30`;
