// Scheduling an article: pick a date and time in India time (IST). Times are always entered and shown in IST,
// whatever time zone the computer is set to, and sent to the server as an exact moment (+05:30).
import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { api } from '../../store/lib/api';
import { Modal } from './Modal';
import { fmtIST, istParts, istToIso as toIso } from './time';

export { fmtIST };

/** Default: the article's current schedule, else tomorrow at 9:00 am IST. */
function initial(post) {
  if (post.status === 'scheduled' && post.publishedAt && new Date(post.publishedAt) > new Date()) return istParts(new Date(post.publishedAt));
  return { date: istParts(new Date(Date.now() + 86_400_000)).date, time: '09:00' };
}

export default function ScheduleDialog({ post, beforeSchedule, onDone, onClose }) {
  const [f, setF] = useState(() => initial(post));
  const [error, setError] = useState('');
  const [clash, setClash] = useState('');
  const [busy, setBusy] = useState(false);
  const today = istParts(new Date()).date;
  const when = f.date && f.time ? new Date(toIso(f.date, f.time)) : null;
  const inPast = when && when.getTime() < Date.now() + 60_000;

  const submit = async (allowClash = false) => {
    if (!when || Number.isNaN(when.getTime())) { setError('Pick a date and a time.'); return; }
    if (inPast) { setError('That time has passed. Pick a later time, or use Publish to publish now.'); return; }
    setBusy(true); setError(''); setClash('');
    try {
      await beforeSchedule?.();                              // save the latest edits first
      const r = await api(`/api/admin/cms/posts/${post.id}/schedule`, { method: 'POST', body: { publishAt: toIso(f.date, f.time), allowClash } });
      onDone(r.post);
    } catch (e) {
      if (e.code === 'clash') setClash(e.message); else setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal title={post.status === 'scheduled' ? 'Change the publish time' : 'Schedule publishing'} onClose={onClose} onSubmit={() => submit(false)}>
      <p className="adm-muted">The article goes live on the website at this time on its own. You can keep editing until then; the latest saved version is what goes live.</p>
      <div className="adm-pair">
        <label>Date<input type="date" required min={today} value={f.date} onChange={(e) => { setF({ ...f, date: e.target.value }); setError(''); setClash(''); }} /></label>
        <label>Time (India, IST)<input type="time" required step={300} value={f.time} onChange={(e) => { setF({ ...f, time: e.target.value }); setError(''); setClash(''); }} /></label>
      </div>
      {when && !Number.isNaN(when.getTime()) && <p className={`cms-note ${inPast ? 'is-warn' : ''}`}><CalendarClock size={14} /> Goes live {fmtIST(when.toISOString())}</p>}
      {error && <p className="adm-error" role="alert">{error}</p>}
      {clash ? (
        <div className="adm-notice" role="alert">
          <p>{clash}</p>
          <div className="adm-actions">
            <button type="button" className="adm-btn is-ghost" onClick={() => setClash('')}>Pick another time</button>
            <button type="button" className="adm-btn is-gold" disabled={busy} onClick={() => submit(true)}>Schedule anyway</button>
          </div>
        </div>
      ) : (
        <div className="adm-actions"><button className="adm-btn is-gold" disabled={busy}><CalendarClock size={16} /> {busy ? 'Scheduling…' : 'Schedule'}</button></div>
      )}
    </Modal>
  );
}
