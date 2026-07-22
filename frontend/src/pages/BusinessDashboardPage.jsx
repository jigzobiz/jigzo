import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BizLangSwitcher from '../business/BizLangSwitcher';
import { useBizMeta } from '../business/useBizMeta';
import { analytics } from '../services/analytics';
import '../business/business.css';

// Static, demo-only company dashboard. No auth, no backend — sample data only.
const NAV_KEYS = ['overview', 'campaigns', 'recipients', 'analytics', 'brandKit', 'team', 'billing', 'settings'];
// Structural bar heights for the 7-day solve activity chart (non-translatable).
const CHART_BARS = [42, 58, 50, 68, 61, 75, 72];

export default function BusinessDashboardPage() {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState('overview');
  useBizMeta('business.metaDashboard.title');

  useEffect(() => { analytics.track('business_dashboard_viewed'); }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const kpis = t('business.dashboard.kpis', { returnObjects: true });
  const funnel = t('business.dashboard.funnel', { returnObjects: true });
  const days = t('business.dashboard.days', { returnObjects: true });
  const fastest = t('business.dashboard.fastest', { returnObjects: true });
  const activity = t('business.dashboard.activity', { returnObjects: true });
  const campaigns = t('business.dashboard.campaigns', { returnObjects: true });

  const statusLabel = { active: 'statusActive', scheduled: 'statusScheduled', completed: 'statusCompleted' };
  const typeLabel = { employee: 'typeEmployee', customer: 'typeCustomer' };

  const pickNav = (key) => { setActive(key); setDrawerOpen(false); };

  return (
    <div className="biz">
      <div className="biz-dash">
        {/* Mobile top bar */}
        <div className="biz-dash__topbar">
          <button type="button" className="biz-dash__menubtn" aria-label={t('business.dashboard.openMenu')} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
            <span /><span /><span />
          </button>
          <img src="/assets/JIGZO-Logo-White.png" alt="JIGZO" />
          <Link className="biz-btn biz-btn--on-dark biz-btn--sm" to="/business/campaigns/new">{t('business.dashboard.createCampaign')}</Link>
        </div>

        {/* Drawer backdrop (mobile) */}
        <div className={`biz-dash__drawer-backdrop ${drawerOpen ? 'is-open' : ''}`} onClick={() => setDrawerOpen(false)} aria-hidden="true" />

        {/* Sidebar */}
        <aside className={`biz-dash__sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Dashboard navigation">
          <button type="button" className="biz-dash__sidebar-close" aria-label={t('business.dashboard.closeMenu')} onClick={() => setDrawerOpen(false)}>×</button>
          <div className="biz-dash__brand">
            <img src="/assets/JIGZO-Icon-Beige.png" alt="" style={{ height: 22 }} />
            <img src="/assets/JIGZO-Logo-Beige.png" alt="JIGZO" style={{ height: 12 }} />
          </div>
          <nav className="biz-dash__nav">
            {NAV_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`biz-dash__navitem ${active === key ? 'biz-dash__navitem--active' : ''}`}
                aria-current={active === key ? 'page' : undefined}
                onClick={() => pickNav(key)}
              >
                {t(`business.dashboard.nav.${key}`)}
              </button>
            ))}
          </nav>
          <div className="biz-dash__account">
            <span className="biz-dash__avatar" aria-hidden="true" />
            <div>
              <div className="biz-dash__account-name">{t('business.demoCompany')}</div>
              <div className="biz-dash__account-plan">{t('business.demoPlan')}</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="biz-dash__main">
          <div className="biz-protobar">
            <strong>{t('business.nav.badge')}</strong> · {t('business.proto.dashboard')}
          </div>
          <div className="biz-dash__content">
            <div className="biz-dash__header">
              <div>
                <p className="biz-eyebrow" style={{ marginBottom: 6 }}>{t('business.demoCompany')} · {t('business.demoPlan')}</p>
                <h1 className="biz-dash__title">{t('business.dashboard.title')}</h1>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <BizLangSwitcher location="business_dashboard" />
                <Link className="biz-btn biz-btn--primary biz-btn--sm" to="/business/campaigns/new">{t('business.dashboard.createCampaign')}</Link>
              </div>
            </div>

            {/* KPI cards — remaining credits shown ONCE, as the single gold highlight */}
            <div className="biz-kpis">
              <div className="biz-kpi biz-kpi--feature">
                <div className="biz-kpi__label">{t('business.dashboard.remainingCredits')}</div>
                <div className="biz-kpi__value biz-ltr">{t('business.dashboard.remainingCreditsValue')}</div>
              </div>
              {(Array.isArray(kpis) ? kpis : []).map((k) => (
                <div className="biz-kpi" key={k.label}>
                  <div className="biz-kpi__label">{k.label}</div>
                  <div className="biz-kpi__value biz-ltr">{k.value}</div>
                </div>
              ))}
            </div>

            {/* Funnel + solve activity | fastest solvers + recent activity */}
            <div className="biz-dash__row" style={{ gridTemplateColumns: '1fr' }}>
              <div className="biz-panel">
                <div className="biz-panel__title">{t('business.dashboard.funnelTitle')}</div>
                <div className="biz-funnel">
                  {(Array.isArray(funnel) ? funnel : []).map((f) => (
                    <div className="biz-funnel__row" key={f.label}>
                      <span className="biz-funnel__label">{f.label}</span>
                      <span className="biz-funnel__track"><span className="biz-funnel__fill" style={{ width: `${f.pct}%` }} /></span>
                      <span className="biz-funnel__value biz-ltr">{f.value}</span>
                    </div>
                  ))}
                </div>

                <div className="biz-panel__subtitle">{t('business.dashboard.solveActivityTitle')}</div>
                <div className="biz-barchart" role="img" aria-label={t('business.dashboard.solveActivityTitle')}>
                  {CHART_BARS.map((h, i) => (
                    <div key={i} className="biz-barchart__bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="biz-barchart__labels" aria-hidden="true">
                  {(Array.isArray(days) ? days : []).map((d, i) => <span key={i}>{d}</span>)}
                </div>
              </div>

              <div className="biz-panel">
                <div className="biz-panel__title">{t('business.dashboard.fastestTitle')}</div>
                <div className="biz-list">
                  {(Array.isArray(fastest) ? fastest : []).map((s) => (
                    <div className="biz-list__row" key={s.name}>
                      <div>
                        <div className="biz-list__name">{s.name}</div>
                        <div className="biz-list__sub">{s.dept}</div>
                      </div>
                      <div className="biz-list__meta biz-ltr">{s.time}</div>
                    </div>
                  ))}
                </div>
                <hr className="biz-divider" />
                <div className="biz-panel__title">{t('business.dashboard.activityTitle')}</div>
                <div className="biz-list">
                  {(Array.isArray(activity) ? activity : []).map((a) => (
                    <div className="biz-list__row" key={a.name + a.action}>
                      <div>
                        <div className="biz-list__name">{a.name}</div>
                        <div className="biz-list__sub">{a.action}</div>
                      </div>
                      <div className="biz-list__meta biz-list__meta--muted">{a.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Campaign progress cards */}
            <div className="biz-panel">
              <div className="biz-panel__title">{t('business.dashboard.campaignsTitle')}</div>
              <div className="biz-campaigns">
                {(Array.isArray(campaigns) ? campaigns : []).map((c) => (
                  <div className="biz-campaign" key={c.name}>
                    <div className="biz-campaign__type">{t(`business.dashboard.${typeLabel[c.type]}`)}</div>
                    <div className="biz-campaign__name">{c.name}</div>
                    <span className={`biz-badge biz-badge--${c.status}`}>{t(`business.dashboard.${statusLabel[c.status]}`)}</span>
                    <div className="biz-campaign__track"><span className="biz-campaign__fill" style={{ width: `${c.solved}%` }} /></div>
                    <div className="biz-campaign__status biz-ltr">{t('business.dashboard.solvedLabel', { pct: c.solved })}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
