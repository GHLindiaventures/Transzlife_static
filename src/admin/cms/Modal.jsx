// Small centred dialog in the dashboard's style (no editor code, so any page can use it).
import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, onSubmit, wide = false }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <>
      <div className="adm-overlay" onClick={onClose} />
      <form className={`adm-palette adm-modal ${wide ? 'cms-modal--wide' : ''}`} role="dialog" aria-label={title}
        onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); onSubmit?.(e); }}>
        <div className="adm-drawer__head"><h2 style={{ flex: 1 }}>{title}</h2><button type="button" className="adm-icon" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="adm-form adm-pad">{children}</div>
      </form>
    </>
  );
}
export default Modal;
