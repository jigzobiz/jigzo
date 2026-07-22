import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Static demo-request modal. No backend: submitting swaps to a thank-you state.
// Handles Esc, backdrop click, initial focus, a simple focus trap, and restores
// focus to the element that opened it.
export default function DemoModal({ open, onClose }) {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement;
      setSubmitted(false);
      // focus the first field after paint
      const id = window.setTimeout(() => firstFieldRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
    // restore focus to opener when closed
    if (openerRef.current && typeof openerRef.current.focus === 'function') {
      openerRef.current.focus();
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') {
        const nodes = dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!nodes || nodes.length === 0) return;
        const list = Array.from(nodes);
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const field = (name, type = 'text', ref) => (
    <div className={`biz-field ${name === 'message' ? 'biz-field--full' : ''}`}>
      <label htmlFor={`biz-demo-${name}`}>{t(`business.demoModal.${name}`)}</label>
      {name === 'message' ? (
        <textarea id={`biz-demo-${name}`} name={name} rows={3} />
      ) : (
        <input id={`biz-demo-${name}`} name={name} type={type} ref={ref} inputMode={name === 'recipients' ? 'numeric' : undefined} />
      )}
    </div>
  );

  return (
    <div className="biz-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="biz-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="biz-demo-title"
        ref={dialogRef}
      >
        {submitted ? (
          <div className="biz-modal__success">
            <div className="biz-modal__success-ico" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 id="biz-demo-title">{t('business.demoModal.successTitle')}</h3>
            <p>{t('business.demoModal.successBody')}</p>
            <div className="biz-modal__actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="biz-btn biz-btn--primary" onClick={onClose} autoFocus>
                {t('common.ok')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="biz-modal__head">
              <h2 className="biz-modal__title" id="biz-demo-title">{t('business.demoModal.title')}</h2>
              <button type="button" className="biz-modal__close" aria-label={t('business.demoModal.cancel')} onClick={onClose}>×</button>
            </div>
            <p className="biz-modal__sub">{t('business.demoModal.sub')}</p>
            <form className="biz-form" onSubmit={handleSubmit}>
              {field('name', 'text', firstFieldRef)}
              {field('company')}
              {field('email', 'email')}
              {field('phone', 'tel')}
              {field('team')}
              {field('recipients', 'text')}
              {field('message')}
              <div className="biz-field--full">
                <div className="biz-modal__actions">
                  <button type="button" className="biz-btn biz-btn--secondary" onClick={onClose}>
                    {t('business.demoModal.cancel')}
                  </button>
                  <button type="submit" className="biz-btn biz-btn--primary">
                    {t('business.demoModal.submit')}
                  </button>
                </div>
                <p className="biz-modal__note">{t('business.demoModal.note')}</p>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
