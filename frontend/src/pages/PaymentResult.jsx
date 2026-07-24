import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';

const T = {
  bg: "#FAF8EC",
  card: "#FFFFFF",
  ink: "#1C1913",
  ink74: "rgba(28,25,19,0.74)",
  ink50: "rgba(28,25,19,0.50)",
  goldDeep: "#A67C3D",
  goldWarm: "#D6B074",
  successGreen: "#2E7D32",
  errorRed: "#D32F2F",
  pendingOrange: "#EF6C00"
};

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  
  const tap_id = searchParams.get('tap_id');
  const orderId = searchParams.get('orderId');

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('verifying'); // verifying, success, pending, failed
  const [errorMsg, setErrorMsg] = useState('');
  const [recipientCount, setRecipientCount] = useState(null);

  const isAr = i18n.language === 'ar';
  const direction = isAr ? 'rtl' : 'ltr';

  useEffect(() => {
    let active = true;
    let attempts = 0;
    const maxAttempts = 30; // 30 * 3s = 90s
    const intervalMs = 3000;

    async function verify() {
      if (!tap_id || !orderId) {
        setStatus('failed');
        setErrorMsg(t('payment.unableToVerify'));
        setLoading(false);
        return;
      }

      setStatus('verifying');
      setLoading(true);

      const runVerify = async () => {
        try {
          const res = await api.verifyPayment(tap_id, orderId);
          if (!active) return;

          if (res.success) {
            if (res.status === 'CAPTURED') {
              setStatus('success');
              if (res.recipientCount !== undefined) {
                setRecipientCount(res.recipientCount);
              }
              setLoading(false);
              return;
            } else if (['INITIATED', 'PENDING', 'IN_PROGRESS'].includes(res.status)) {
              scheduleNext();
            } else if (['DECLINED', 'CANCELLED', 'FAILED', 'ABANDONED', 'VOID'].includes(res.status)) {
              setStatus('failed');
              setErrorMsg(res.status);
              setLoading(false);
            } else {
              setStatus('unresolved');
              setLoading(false);
            }
          } else {
            scheduleNext();
          }
        } catch (err) {
          if (!active) return;
          console.error('Error verifying payment:', err);

          const errStatus = err.response?.status;
          const errorText = err.response?.data?.error;

          const isMismatch = errStatus === 400 && (String(errorText).includes('mismatch') || String(errorText).includes('verification'));
          if (isMismatch) {
            setStatus('unresolved');
            setLoading(false);
            return;
          }

          const isRetryable = !errStatus || errStatus >= 500 || err.code === 'ECONNABORTED' || String(err.message).toLowerCase().includes('timeout') || String(err.message).toLowerCase().includes('network error');
          if (isRetryable) {
            scheduleNext();
          } else {
            setStatus('failed');
            setErrorMsg(errorText || t('payment.unableToVerify'));
            setLoading(false);
          }
        }
      };

      const scheduleNext = () => {
        attempts++;
        if (attempts >= maxAttempts) {
          setStatus('unresolved');
          setLoading(false);
        } else {
          setTimeout(() => {
            if (active) runVerify();
          }, intervalMs);
        }
      };

      runVerify();
    }
    verify();

    return () => {
      active = false;
    };
  }, [tap_id, orderId, t]);

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
          <div className="spinner" style={{
            width: 50, height: 50, border: '4px solid rgba(28,25,19,0.1)',
            borderTop: `4px solid ${T.goldDeep}`, borderRadius: '50%',
            animation: 'spin 1s linear infinite', marginBottom: 20
          }} />
          <h2 style={{ color: T.ink, margin: 0, fontSize: '24px' }}>
            {status === 'verifying' ? t('payment.confirming') : t('payment.verifying')}
          </h2>
        </div>
      );
    }

    let icon, title, description, color;
    switch (status) {
      case 'success':
        icon = (
          <svg style={{ width: 64, height: 64, color: T.successGreen }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
        title = t('payment.successTitle');
        color = T.successGreen;
        break;
      case 'pending':
        icon = (
          <svg style={{ width: 64, height: 64, color: T.pendingOrange }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
        title = t('payment.pending');
        description = t('payment.pendingSub');
        color = T.pendingOrange;
        break;
      case 'unresolved':
        icon = (
          <svg style={{ width: 64, height: 64, color: T.pendingOrange }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
        title = t('payment.unresolvedTitle');
        description = t('payment.unresolvedMessage');
        color = T.pendingOrange;
        break;
      case 'failed':
      default:
        icon = (
          <svg style={{ width: 64, height: 64, color: T.errorRed }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
        
        if (errorMsg === 'CANCELLED') {
          title = t('payment.cancelled');
        } else if (errorMsg === 'DECLINED') {
          title = t('payment.declined');
        } else if (errorMsg === 'FAILED') {
          title = t('payment.failed');
        } else {
          title = t('payment.unableToVerify');
        }
        description = t('payment.failedSub');
        color = T.errorRed;
        break;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px' }}>
        <div style={{ marginBottom: 20 }}>{icon}</div>
        <h1 style={{ fontSize: '28px', color: color, marginBottom: 16, fontWeight: 700 }}>
          {title}
        </h1>
        {status === 'success' ? (
          <>
            <p style={{ color: T.ink, fontSize: '16px', fontWeight: 600, marginBottom: 8, lineHeight: 1.6 }}>
              {t('payment.successFirstLine')}
            </p>
            {recipientCount !== null && recipientCount !== undefined && (
              <p
                style={{ color: T.ink74, fontSize: '16px', marginBottom: 8, lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{
                  __html: recipientCount === 1
                    ? t('payment.successOneRecipient')
                    : t('payment.successMultipleRecipients', { count: recipientCount })
                }}
              />
            )}
            <p style={{ color: T.ink74, fontSize: '16px', marginBottom: 32, lineHeight: 1.6 }}>
              {t('payment.successFinalLine')}
            </p>
          </>
        ) : (
          <p style={{ color: T.ink74, fontSize: '16px', lineHeight: 1.6, maxWidth: '460px', marginBottom: 32 }}>
            {description}
          </p>
        )}
        <Link
          to="/create"
          style={{
            display: 'inline-block',
            backgroundColor: T.goldDeep,
            color: '#FFFFFF',
            padding: '14px 28px',
            borderRadius: '12px',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: '16px',
            transition: 'background-color 0.2s',
            boxShadow: '0 4px 12px rgba(166, 124, 61, 0.2)'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#8c6833'}
          onMouseOut={(e) => e.target.style.backgroundColor = T.goldDeep}
        >
          {t('payment.backToCreate')}
        </Link>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: T.bg,
      direction: direction,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          box-sizing: border-box;
        }
      `}</style>
      <div style={{
        backgroundColor: T.card,
        padding: '48px 32px',
        borderRadius: '24px',
        boxShadow: '0 12px 32px rgba(28, 25, 19, 0.06)',
        width: '100%',
        maxWidth: '540px',
        border: '1px solid rgba(28, 25, 19, 0.04)',
        margin: '20px'
      }}>
        {renderContent()}
      </div>
    </div>
  );
}
