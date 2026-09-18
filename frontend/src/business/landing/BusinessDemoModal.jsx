import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function BusinessDemoModal({ open, onClose }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const emailRef = useRef(null);
  const previousFocus = useRef(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    setSubmitted(false);
    const focusTimer = window.setTimeout(() => emailRef.current?.focus(), 20);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = [...dialogRef.current.querySelectorAll('button, input')].filter((node) => !node.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('jzb-modal-open');
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('jzb-modal-open');
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="jzb-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="jzb-modal" role="dialog" aria-modal="true" aria-labelledby="jzb-modal-title">
        <button className="jzb-modal__close" type="button" onClick={onClose} aria-label={t('business.form.close')}>×</button>
        {submitted ? (
          <div className="jzb-modal__success">
            <span className="jzb-modal__success-mark">✓</span>
            <h2 id="jzb-modal-title">{t('business.form.previewTitle')}</h2>
            <p>{t('business.form.previewBody')}</p>
            <button className="jzb-button" type="button" onClick={onClose}>{t('business.form.done')}</button>
          </div>
        ) : (
          <>
            <p className="jzb-eyebrow">{t('business.form.eyebrow')}</p>
            <h2 id="jzb-modal-title">{t('business.form.title')}</h2>
            <p className="jzb-modal__intro">{t('business.form.intro')}</p>
            <form onSubmit={submit}>
              <label>{t('business.form.email')}<input ref={emailRef} type="email" required autoComplete="email" placeholder="name@company.com" /></label>
              <label>{t('business.form.company')}<input type="text" required autoComplete="organization" /></label>
              <button className="jzb-button jzb-button--gold" type="submit">{t('business.cta.earlyAccess')}</button>
            </form>
            <p className="jzb-modal__note">{t('business.form.previewNote')}</p>
          </>
        )}
      </section>
    </div>
  );
}
