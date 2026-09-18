import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessApi } from '../../services/businessApi';
import { rememberBusinessReturnTo, safeBusinessReturnTo } from '../../business/auth/businessAccess';
import '../../business/studio/business-studio.css';

export default function BusinessLoginPage() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const [params] = useSearchParams();
  const ar = i18n.language.startsWith('ar');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const returnTo = safeBusinessReturnTo(params.get('returnTo'));

  useEffect(() => { rememberBusinessReturnTo(returnTo); }, [returnTo]);

  const submit = async event => {
    event.preventDefault(); setState('sending'); setError('');
    try { await businessApi.requestMagicLink(email); setState('sent'); }
    catch { setState('error'); setError(ar ? 'تعذّر إرسال رابط تسجيل الدخول. حاول مرة أخرى.' : 'Could not send the sign-in link. Please try again.'); }
  };

  return <main className="jzs-page jzs-login" dir={ar ? 'rtl' : 'ltr'}>
    <section className="jzs-login__card">
      <Link to="/business" aria-label="JIGZO Business"><img src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" /></Link>
      {location.state?.reason === 'session-expired' && <p className="jzs-login__expired" role="status">{ar ? 'انتهت الجلسة. سجّل الدخول للمتابعة.' : 'Session expired. Sign in to continue.'}</p>}
      <span className="jzs-eyebrow">{ar ? 'استوديو JIGZO للأعمال' : 'JIGZO Business Studio'}</span>
      <h1>{ar ? 'سجّل الدخول إلى الأعمال' : 'Sign in to Business'}</h1>
      <p>{ar ? 'سنرسل رابطاً آمناً لمرة واحدة إلى بريدك الإلكتروني.' : 'We’ll email you a secure, single-use sign-in link.'}</p>
      {state === 'sent' ? <div className="jzs-login__success" role="status"><strong>{ar ? 'تحقّق من بريدك الإلكتروني للحصول على رابط تسجيل الدخول الآمن.' : 'Check your email for your secure sign-in link.'}</strong></div> : <form onSubmit={submit}>
        <label><span>{ar ? 'البريد الإلكتروني' : 'Email'}</span><input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <button className="jzs-action" type="submit" disabled={state === 'sending'}>{state === 'sending' ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'أرسل رابط تسجيل الدخول' : 'Send sign-in link')}</button>
        {error && <small role="alert">{error}</small>}
      </form>}
      <button className="jzs-lang" type="button" onClick={() => i18n.changeLanguage(ar ? 'en' : 'ar')}>{ar ? 'English' : 'العربية'}</button>
    </section>
  </main>;
}
