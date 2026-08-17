import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { businessApi } from '../../services/businessApi';
import { consumeBusinessReturnTo } from '../../business/auth/businessAccess';
import '../../business/studio/business-studio.css';

export default function BusinessAuthVerifyPage() {
  const navigate = useNavigate(); const { i18n } = useTranslation(); const [failed, setFailed] = useState(false); const ar = i18n.language.startsWith('ar');
  useEffect(() => { const params = new URLSearchParams(window.location.hash.slice(1)); const token = params.get('token') || ''; window.history.replaceState({}, '', '/business/auth/verify'); if (!token) { setFailed(true); return; } businessApi.verifyMagicLink(token).then(() => navigate(consumeBusinessReturnTo(), { replace: true })).catch(() => setFailed(true)); }, [navigate]);
  return <main className="jzs-page" dir={ar ? 'rtl' : 'ltr'} style={{ display: 'grid', placeItems: 'center', padding: 24 }}><section className="jzs-composer-card" style={{ width: 'min(100%, 480px)', textAlign: 'center' }}><img src="/assets/JIGZO-Logo-Black.png" alt="JIGZO" style={{ width: 100 }} /><h1>{failed ? (ar ? 'تعذّر تسجيل الدخول' : 'This link is no longer valid') : (ar ? 'جارٍ تسجيل الدخول…' : 'Signing you in…')}</h1>{failed && <p>{ar ? 'اطلب رابطاً جديداً من مسؤول النسخة التجريبية.' : 'Request a new link from your Business beta administrator.'}</p>}</section></main>;
}
