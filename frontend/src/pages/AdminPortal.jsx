import React, { useState, useEffect } from 'react';
import axios from 'axios';

const T = {
  bg: "#FAF8EC",
  card: "#FFFFFF",
  ink: "#1C1913",
  gold: "#A67C3D",
  goldWarm: "#E6C67F",
  goldDeep: "#8a6d3a",
  ink08: "rgba(28,25,19,0.08)",
  ink15: "rgba(28,25,19,0.15)",
  ink50: "rgba(28,25,19,0.50)",
  ink66: "rgba(28,25,19,0.66)",
  shadow: "0 6px 20px rgba(28,25,19,0.06)",
  border: "1px solid rgba(28,25,19,0.08)"
};

export default function AdminPortal() {
  const [token, setToken] = useState(() => localStorage.getItem('jigzo_admin_token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // API Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [puzzles, setPuzzles] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [whatsapp, setWhatsapp] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Waitlist email composer
  const [emailComposer, setEmailComposer] = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);

  // New WorkItem form state
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemArea, setItemArea] = useState('Backend');
  const [itemPriority, setItemPriority] = useState('medium');
  const [itemOwner, setItemOwner] = useState('');
  const [itemTargetDate, setItemTargetDate] = useState('');
  const [itemStatus, setItemStatus] = useState('todo');
  const [itemPercent, setItemPercent] = useState(0);
  const [itemBlockers, setItemBlockers] = useState('');
  const [itemDesc, setItemDesc] = useState('');

  // Unmask values state cache
  const [unmaskedValues, setUnmaskedValues] = useState({});

  // Reveal Links tracker
  const [revealLinks, setRevealLinks] = useState([]);
  const [revealSearch, setRevealSearch] = useState('');
  const [revealCopiedKey, setRevealCopiedKey] = useState('');
  const [revealBusyKey, setRevealBusyKey] = useState('');

  const getBaseUrl = () =>
    import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true'
      ? 'http://localhost:5000'
      : '';

  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await axios.post(`${getBaseUrl()}/api/admin/auth/login`, { username, password });
      if (res.data.success) {
        localStorage.setItem('jigzo_admin_token', res.data.token);
        setToken(res.data.token);
      }
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Invalid credentials');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jigzo_admin_token');
    setToken('');
  };

  const fetchDataForTab = async (tab) => {
    if (!token) return;
    setLoading(true);
    try {
      const urlMap = {
        overview: '/api/admin/dashboard',
        customers: '/api/admin/customers',
        journeys: '/api/admin/journeys',
        drafts: '/api/admin/drafts',
        orders: '/api/admin/orders',
        payments: '/api/admin/payments',
        puzzles: '/api/admin/puzzles',
        recipients: '/api/admin/recipients',
        whatsapp: '/api/admin/whatsapp',
        notifications: '/api/admin/notifications',
        'reveal-links': '/api/admin/reveal-links',
        recommendations: '/api/admin/recommendations',
        'work-progress': '/api/admin/work-items',
        settings: '/api/admin/settings',
        'audit-log': '/api/admin/audit-logs'
      };

      const path = urlMap[tab];
      if (path) {
        const res = await axios.get(`${getBaseUrl()}${path}`, getAxiosConfig());
        if (tab === 'overview') setDashboardData(res.data);
        else if (tab === 'customers') setCustomers(res.data.list);
        else if (tab === 'journeys') setJourneys(res.data.list);
        else if (tab === 'drafts') setDrafts(res.data.list);
        else if (tab === 'orders') setOrders(res.data.list);
        else if (tab === 'payments') setPayments(res.data.list);
        else if (tab === 'puzzles') setPuzzles(res.data.list);
        else if (tab === 'recipients') setRecipients(res.data.list);
        else if (tab === 'whatsapp') setWhatsapp(res.data.list);
        else if (tab === 'notifications') setNotifications(res.data.list);
        else if (tab === 'reveal-links') setRevealLinks(res.data.list);
        else if (tab === 'recommendations') setRecommendations(res.data.list);
        else if (tab === 'work-progress') setWorkItems(res.data.list);
        else if (tab === 'settings') setSettings(res.data);
        else if (tab === 'audit-log') setAuditLogs(res.data.list);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 400) {
        handleLogout();
      } else {
        console.error('Failed to load tab:', tab, err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDataForTab(activeTab);
    }
  }, [token, activeTab]);

  const handleUnmask = async (modelType, recordId, fieldName) => {
    const key = `${modelType}-${recordId}-${fieldName}`;
    if (unmaskedValues[key]) return; // Already loaded

    if (!window.confirm('This action will be logged to the security audit trail. Continue?')) {
      return;
    }

    try {
      const res = await axios.post(`${getBaseUrl()}/api/admin/audit/unmask`, {
        modelType, recordId, fieldName
      }, getAxiosConfig());
      if (res.data.success) {
        setUnmaskedValues(prev => ({ ...prev, [key]: res.data.value }));
        // Refresh audit log if active
        if (activeTab === 'audit-log') fetchDataForTab('audit-log');
      }
    } catch (err) {
      alert('Unmasking failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatBahrainDateTime = (value) => {
    if (!value) return '--';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bahrain',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const openWaitlistEmailComposer = (notification) => {
    const status = notification.sendStatus ||
      (notification.notified ? 'sent' : 'pending');

    if (!notification.email) {
      window.alert('This waitlist entry does not contain an email address.');
      return;
    }

    if (status === 'sent' || status === 'sending' || status === 'review_required') return;

    setEmailComposer(notification);

    if (status === 'failed') {
      // Retry must reuse the exact stored payload so the idempotency key holds.
      setEmailSubject(notification.emailSubject || '');
      setEmailMessage(notification.emailBody || '');
      setEmailLocked(true);
    } else {
      setEmailSubject('JIGZO is ready');
      setEmailMessage(
        'Hi,\n\n' +
        'Thank you for joining the JIGZO waitlist. JIGZO is now ready for you.\n\n' +
        'Create your reveal at https://jigzo.biz\n\n' +
        'JIGZO'
      );
      setEmailLocked(false);
    }

    setEmailError('');
  };

  const closeWaitlistEmailComposer = () => {
    if (emailSending) return;
    setEmailComposer(null);
    setEmailSubject('');
    setEmailMessage('');
    setEmailError('');
    setEmailLocked(false);
  };

  const handleWaitlistEmailSend = async () => {
    if (!emailComposer || emailSending) return;

    const subject = emailSubject.trim();
    const message = emailMessage.trim();

    if (!subject || !message) {
      setEmailError('Enter both a subject and a message.');
      return;
    }

    const confirmed = window.confirm(
      `Send this email from info@jigzo.biz to ${emailComposer.email}? This cannot be sent twice.`
    );

    if (!confirmed) return;

    setEmailSending(true);
    setEmailError('');

    try {
      const res = await axios.post(
        `${getBaseUrl()}/api/admin/notifications/${emailComposer._id}/send`,
        { subject, message },
        getAxiosConfig()
      );

      if (res.data.success) {
        setNotifications(previous =>
          previous.map(notification =>
            notification._id === emailComposer._id
              ? res.data.notification
              : notification
          )
        );

        setEmailComposer(null);
        setEmailSubject('');
        setEmailMessage('');
        setEmailError('');
        setEmailLocked(false);
      }
    } catch (err) {
      setEmailError(
        err.response?.data?.error ||
        'The email could not be sent. No sent status was recorded.'
      );
    } finally {
      setEmailSending(false);
    }
  };

  const revealRowKey = (row) => `${row.puzzleId}-${row.recipientIndex}`;

  const deriveRevealStatus = (row) => {
    if (row.completedAt) return 'Solved';
    if (row.openedAt) return 'Opened';
    if (row.manualLinkProvidedAt) return 'Manual link provided';
    const s = row.deliveryStatus || 'pending';
    if (s === 'delivered') return 'Delivered';
    if (s === 'sent') return 'Sent';
    if (s === 'failed') return 'Failed';
    return 'Pending';
  };

  const revealStatusColors = {
    Solved: { bg: '#e8f5e9', fg: '#2e7d32' },
    Opened: { bg: '#e3f2fd', fg: '#1565c0' },
    Delivered: { bg: '#e8f5e9', fg: '#2e7d32' },
    Sent: { bg: '#ede7f6', fg: '#5e35b1' },
    Failed: { bg: '#ffebee', fg: '#b42318' },
    'Manual link provided': { bg: '#fff3e0', fg: '#b45309' },
    Pending: { bg: 'rgba(28,25,19,0.06)', fg: '#8a7f6a' }
  };

  const filteredRevealLinks = revealLinks.filter(row => {
    const q = revealSearch.trim().toLowerCase();
    if (!q) return true;
    return [row.senderName, row.senderPhone, row.recipientName, row.receiverContact, row.publicId]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

  const handleCopyRevealLink = async (row) => {
    const key = revealRowKey(row);
    setRevealBusyKey(key);
    try {
      const res = await axios.post(
        `${getBaseUrl()}/api/admin/reveal-links/${row.puzzleId}/${row.recipientIndex}/copy`,
        {},
        getAxiosConfig()
      );
      if (res.data.success && res.data.link) {
        try {
          await navigator.clipboard.writeText(res.data.link);
        } catch (clipErr) {
          window.prompt('Copy this reveal link:', res.data.link);
        }
        setRevealCopiedKey(key);
        setTimeout(() => setRevealCopiedKey(prev => (prev === key ? '' : prev)), 2500);
      }
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not fetch the reveal link.');
    } finally {
      setRevealBusyKey('');
    }
  };

  const handleMarkProvided = async (row) => {
    const key = revealRowKey(row);
    const confirmed = window.confirm(
      `Mark the reveal link for ${row.recipientName || 'this recipient'} as manually provided? This records that you delivered it by hand.`
    );
    if (!confirmed) return;

    setRevealBusyKey(key);
    try {
      const res = await axios.post(
        `${getBaseUrl()}/api/admin/reveal-links/${row.puzzleId}/${row.recipientIndex}/manual-provided`,
        {},
        getAxiosConfig()
      );
      if (res.data.success) {
        setRevealLinks(prev => prev.map(r =>
          revealRowKey(r) === key
            ? {
                ...r,
                manualLinkProvidedAt: res.data.recipient.manualLinkProvidedAt,
                manualLinkProvidedByUsername: res.data.recipient.manualLinkProvidedByUsername
              }
            : r
        ));
      }
    } catch (err) {
      window.alert(err.response?.data?.error || 'Could not update the recipient.');
    } finally {
      setRevealBusyKey('');
    }
  };

  const handleRecommendationStatus = async (id, status) => {
    try {
      const res = await axios.post(`${getBaseUrl()}/api/admin/recommendations/${id}/status`, { status }, getAxiosConfig());
      if (res.data.success) {
        setRecommendations(prev => prev.map(r => r._id === id ? res.data.recommendation : r));
      }
    } catch (err) {
      alert('Update failed');
    }
  };

  const handleWorkItemSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        area: itemArea,
        priority: itemPriority,
        owner: itemOwner,
        targetDate: itemTargetDate ? new Date(itemTargetDate) : undefined,
        status: itemStatus,
        blockers: itemBlockers,
        percentageComplete: itemPercent,
        description: itemDesc
      };
      if (editingItem) {
        payload._id = editingItem._id;
      }
      const res = await axios.post(`${getBaseUrl()}/api/admin/work-items`, payload, getAxiosConfig());
      if (res.data.success) {
        setShowItemForm(false);
        setEditingItem(null);
        setItemArea('Backend');
        setItemPriority('medium');
        setItemOwner('');
        setItemTargetDate('');
        setItemStatus('todo');
        setItemPercent(0);
        setItemBlockers('');
        setItemDesc('');
        fetchDataForTab('work-progress');
      }
    } catch (err) {
      alert('Failed to save roadmap progress item.');
    }
  };

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 20, fontFamily: "Archia, sans-serif" }}>
        <div style={{ maxWidth: 400, width: "100%", padding: 32, borderRadius: 20, background: T.card, border: T.border, boxShadow: T.shadow, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, margin: "0 auto 16px", background: T.ink, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 24 }}>🔑</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>JIGZO Admin</h1>
          <p style={{ fontSize: 13.5, color: T.ink66, marginBottom: 24 }}>Enter credentials to access the analytics portal.</p>
          
          <form onSubmit={handleLogin}>
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
              style={{ width: "100%", padding: 13, border: T.ink15, borderRadius: 10, background: T.bg, marginBottom: 14, fontSize: 14 }} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: "100%", padding: 13, border: T.ink15, borderRadius: 10, background: T.bg, marginBottom: 20, fontSize: 14 }} />
            
            {authError && <div style={{ fontSize: 12.5, color: '#b23b3b', fontWeight: 600, marginBottom: 14 }}>{authError}</div>}
            
            <button type="submit" style={{ width: "100%", padding: "12px", background: T.gold, border: "none", color: "#FFF", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'customers', label: 'Customers' },
    { id: 'journeys', label: 'Journeys' },
    { id: 'drafts', label: 'Drafts' },
    { id: 'orders', label: 'Orders' },
    { id: 'payments', label: 'Payments' },
    { id: 'puzzles', label: 'Puzzles' },
    { id: 'recipients', label: 'Recipients' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'notifications', label: 'Waitlist' },
    { id: 'reveal-links', label: 'Reveal Links' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'recommendations', label: 'Recommendations' },
    { id: 'work-progress', label: 'Roadmap' },
    { id: 'settings', label: 'Settings' },
    { id: 'audit-log', label: 'Audit Log' }
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: T.bg, color: T.ink, fontFamily: "Archia, sans-serif" }}>
      {/* Sidebar navigation */}
      <aside style={{ width: 240, borderRight: T.border, padding: "24px 16px", background: T.card, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32, paddingLeft: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>JIGZO</span>
          <span style={{ fontSize: 11, background: T.goldWarm, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>ADMIN</span>
        </div>
        
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                background: activeTab === t.id ? "rgba(166, 124, 61, 0.08)" : "transparent",
                color: activeTab === t.id ? T.gold : T.ink66,
                fontWeight: activeTab === t.id ? 700 : 500,
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontSize: 13.5
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ borderTop: T.border, paddingTop: 16, marginTop: 16 }}>
          <button onClick={handleLogout} style={{ width: "100%", padding: "10px", background: "none", border: "1px solid rgba(178, 59, 59, 0.2)", color: "#b23b3b", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main dashboard console content */}
      <main style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
          <button onClick={() => fetchDataForTab(activeTab)} className="btn-change" style={{ fontSize: 13, background: "none", border: "none" }}>
            🔄 Refresh
          </button>
        </header>

        {loading && <div style={{ fontSize: 15, fontWeight: 600, color: T.gold }}>Loading details...</div>}

        {!loading && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {/* OVERVIEW PANEL */}
            {activeTab === 'overview' && dashboardData && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 28 }}>
                  <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ fontSize: 12, color: T.ink50, fontWeight: 600, textTransform: "uppercase" }}>Total Visitors</div>
                    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{dashboardData.kpis.visitors}</div>
                  </div>
                  <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ fontSize: 12, color: T.ink50, fontWeight: 600, textTransform: "uppercase" }}>Create Starts</div>
                    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{dashboardData.kpis.createStarts}</div>
                  </div>
                  <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ fontSize: 12, color: T.ink50, fontWeight: 600, textTransform: "uppercase" }}>Completed Orders</div>
                    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{dashboardData.kpis.completedOrders}</div>
                  </div>
                  <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ fontSize: 12, color: T.ink50, fontWeight: 600, textTransform: "uppercase" }}>Total Revenue</div>
                    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: T.gold }}>${dashboardData.kpis.revenue}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 28 }}>
                  <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ fontSize: 12, color: T.ink50, fontWeight: 600, textTransform: "uppercase" }}>Average Order Value</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>${dashboardData.kpis.averageOrderValue}</div>
                  </div>
                  <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ fontSize: 12, color: T.ink50, fontWeight: 600, textTransform: "uppercase" }}>Checkout Conv. Rate</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{dashboardData.kpis.paymentConversion}%</div>
                  </div>
                  <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ fontSize: 12, color: T.ink50, fontWeight: 600, textTransform: "uppercase" }}>Reveal Alert Upsell</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{dashboardData.kpis.revealAlertAdoption}%</div>
                  </div>
                  <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ fontSize: 12, color: T.ink50, fontWeight: 600, textTransform: "uppercase" }}>Avg Reveal Time</div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{dashboardData.kpis.averageCompletionTime}s</div>
                  </div>
                </div>

                {dashboardData.alerts.length > 0 && (
                  <div style={{ padding: 18, background: "#fdf2f2", border: "1px solid #fbd5d5", borderRadius: 16, marginBottom: 28 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#9b1c1c", marginBottom: 10 }}>⚠️ Operational Alerts</h3>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#7f1d1d", display: "flex", flexDirection: "column", gap: 6 }}>
                      {dashboardData.alerts.map((al, idx) => <li key={idx}><strong>[{al.severity.toUpperCase()}]</strong> {al.message}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* CUSTOMERS VIEW */}
            {activeTab === 'customers' && (
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Name</th>
                      <th style={{ padding: 14 }}>Email</th>
                      <th style={{ padding: 14 }}>Phone</th>
                      <th style={{ padding: 14 }}>Converted</th>
                      <th style={{ padding: 14 }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(c => {
                      return (
                        <tr key={c._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14, fontWeight: 600 }}>{c.name || 'Anonymous'}</td>
                          <td style={{ padding: 14 }}>{c.email}</td>
                          <td style={{ padding: 14 }}>{c.phone}</td>
                          <td style={{ padding: 14 }}>{c.converted ? '✅ Converted' : '❌ Draft'}</td>
                          <td style={{ padding: 14 }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* JOURNEY PATH EVENTS VIEW */}
            {activeTab === 'journeys' && (
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Session ID</th>
                      <th style={{ padding: 14 }}>Event Type</th>
                      <th style={{ padding: 14 }}>URL</th>
                      <th style={{ padding: 14 }}>Context metadata</th>
                      <th style={{ padding: 14 }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.map(j => (
                      <tr key={j._id} style={{ borderBottom: T.border }}>
                        <td style={{ padding: 14, fontFamily: "monospace", fontSize: 12 }}>{j.sessionId.slice(-10)}</td>
                        <td style={{ padding: 14 }}><span style={{ padding: "4px 8px", background: "rgba(166, 124, 61, 0.12)", color: T.goldDeep, borderRadius: 6, fontWeight: 600 }}>{j.eventType}</span></td>
                        <td style={{ padding: 14, color: T.ink50 }}>{j.pageUrl ? new URL(j.pageUrl).pathname : '/'}</td>
                        <td style={{ padding: 14, fontFamily: "monospace", fontSize: 12 }}>{JSON.stringify(j.metadata)}</td>
                        <td style={{ padding: 14 }}>{new Date(j.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* DRAFTS & DROP-OFFS */}
            {activeTab === 'drafts' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Incomplete Draft Puzzles</h3>
                <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                    <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                      <tr>
                        <th style={{ padding: 14 }}>Anonymous ID</th>
                        <th style={{ padding: 14 }}>Steps Completed</th>
                        <th style={{ padding: 14 }}>Cached Payload</th>
                        <th style={{ padding: 14 }}>Last Modified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map(d => (
                        <tr key={d._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14, fontFamily: "monospace" }}>{d.anonymousId.slice(-10)}</td>
                          <td style={{ padding: 14, fontWeight: 700 }}>Step {d.stepsCompleted} / 4</td>
                          <td style={{ padding: 14, fontFamily: "monospace", fontSize: 12 }}>{JSON.stringify(d.currentStepData)}</td>
                          <td style={{ padding: 14 }}>{new Date(d.updatedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ORDERS VIEW */}
            {activeTab === 'orders' && (
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Order ID</th>
                      <th style={{ padding: 14 }}>Phone</th>
                      <th style={{ padding: 14 }}>Recipients</th>
                      <th style={{ padding: 14 }}>Amount</th>
                      <th style={{ padding: 14 }}>Status</th>
                      <th style={{ padding: 14 }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      return (
                        <tr key={o._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14, fontFamily: "monospace" }}>{o._id.toString().slice(-8)}</td>
                          <td style={{ padding: 14 }}>{o.customerPhone}</td>
                          <td style={{ padding: 14 }}>{o.recipientCount}</td>
                          <td style={{ padding: 14, fontWeight: 600 }}>${o.amount}</td>
                          <td style={{ padding: 14 }}><span style={{ padding: "4px 8px", background: o.paymentStatus === 'paid' ? '#e1f5fe' : '#ffebee', color: o.paymentStatus === 'paid' ? '#0288d1' : '#c62828', borderRadius: 6, fontWeight: 700 }}>{o.paymentStatus}</span></td>
                          <td style={{ padding: 14 }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAYMENTS TRANSACTIONS VIEW */}
            {activeTab === 'payments' && (
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Transaction Ref</th>
                      <th style={{ padding: 14 }}>Amount</th>
                      <th style={{ padding: 14 }}>Currency</th>
                      <th style={{ padding: 14 }}>Status</th>
                      <th style={{ padding: 14 }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p._id} style={{ borderBottom: T.border }}>
                        <td style={{ padding: 14, fontFamily: "monospace" }}>{p.gatewayReference || p._id.toString().slice(-8)}</td>
                        <td style={{ padding: 14, fontWeight: 600 }}>${p.amount}</td>
                        <td style={{ padding: 14 }}>{p.currency}</td>
                        <td style={{ padding: 14 }}><span style={{ padding: "4px 8px", background: p.status === 'succeeded' ? '#e8f5e9' : '#ffebee', color: p.status === 'succeeded' ? '#2e7d32' : '#c62828', borderRadius: 6, fontWeight: 700 }}>{p.status}</span></td>
                        <td style={{ padding: 14 }}>{new Date(p.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PUZZLES VIEW */}
            {activeTab === 'puzzles' && (
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Public ID</th>
                      <th style={{ padding: 14 }}>Difficulty</th>
                      <th style={{ padding: 14 }}>Occasion</th>
                      <th style={{ padding: 14 }}>Sender</th>
                      <th style={{ padding: 14 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puzzles.map(p => (
                      <tr key={p._id} style={{ borderBottom: T.border }}>
                        <td style={{ padding: 14, fontFamily: "monospace" }}>{p.publicId}</td>
                        <td style={{ padding: 14 }}>{p.pieceCount} pieces</td>
                        <td style={{ padding: 14 }}>{p.occasion || 'None'}</td>
                        <td style={{ padding: 14 }}>{p.senderName || 'Anonymous'}</td>
                        <td style={{ padding: 14 }}><span style={{ padding: "4px 8px", background: p.isPaid ? '#e8f5e9' : '#eceff1', color: p.isPaid ? '#2e7d32' : '#37474f', borderRadius: 6, fontWeight: 700 }}>{p.isPaid ? 'Active' : 'Unpaid'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* RECIPIENTS VIEW */}
            {activeTab === 'recipients' && (
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Name</th>
                      <th style={{ padding: 14 }}>Phone</th>
                      <th style={{ padding: 14 }}>Status</th>
                      <th style={{ padding: 14 }}>Time Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map(r => {
                      return (
                        <tr key={r._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14, fontWeight: 600 }}>{r.name}</td>
                          <td style={{ padding: 14 }}>{r.phone}</td>
                          <td style={{ padding: 14 }}><span style={{ padding: "4px 8px", background: r.status === 'completed' ? '#e8f5e9' : '#fff3e0', color: r.status === 'completed' ? '#2e7d32' : '#e65100', borderRadius: 6, fontWeight: 700 }}>{r.status}</span></td>
                          <td style={{ padding: 14 }}>{r.revealDurationSeconds ? `${r.revealDurationSeconds}s` : '−'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* WHATSAPP LOG VIEW */}
            {activeTab === 'whatsapp' && (
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Recipient Phone</th>
                      <th style={{ padding: 14 }}>Template Category</th>
                      <th style={{ padding: 14 }}>Status</th>
                      <th style={{ padding: 14 }}>Dispatch Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whatsapp.map(w => {
                      return (
                        <tr key={w._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14 }}>{w.recipientPhone}</td>
                          <td style={{ padding: 14, fontFamily: "monospace" }}>{w.messageType}</td>
                          <td style={{ padding: 14 }}><span style={{ padding: "4px 8px", background: w.status === 'sent' || w.status === 'delivered' ? '#e8f5e9' : '#ffebee', color: w.status === 'sent' || w.status === 'delivered' ? '#2e7d32' : '#c62828', borderRadius: 6, fontWeight: 700 }}>{w.status}</span></td>
                          <td style={{ padding: 14 }}>{new Date(w.timestamp).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* WAITLIST INTERESTS VIEW */}
            {activeTab === 'notifications' && (
              <>
                <div style={{
                  background: T.card,
                  border: T.border,
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: T.shadow
                }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{
                      width: "100%",
                      minWidth: 1050,
                      borderCollapse: "collapse",
                      fontSize: 14,
                      textAlign: "left"
                    }}>
                      <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                        <tr>
                          <th style={{ padding: 14 }}>Email</th>
                          <th style={{ padding: 14 }}>Phone</th>
                          <th style={{ padding: 14 }}>Country</th>
                          <th style={{ padding: 14 }}>Interest Type</th>
                          <th style={{ padding: 14 }}>Status</th>
                          <th style={{ padding: 14 }}>Registered At</th>
                          <th style={{ padding: 14 }}>Sent At</th>
                          <th style={{ padding: 14 }}>Sent By</th>
                        </tr>
                      </thead>

                      <tbody>
                        {notifications.map(notification => {
                          const sendStatus =
                            notification.sendStatus ||
                            (notification.notified ? 'sent' : 'pending');

                          const canSend =
                            Boolean(notification.email) &&
                            sendStatus !== 'sent' &&
                            sendStatus !== 'sending' &&
                            sendStatus !== 'review_required';

                          return (
                            <tr
                              key={notification._id}
                              style={{ borderBottom: T.border }}
                            >
                              <td style={{
                                padding: 14,
                                fontWeight: 600,
                                whiteSpace: "nowrap"
                              }}>
                                {notification.email || '--'}
                              </td>

                              <td style={{ padding: 14, whiteSpace: "nowrap" }}>
                                {notification.phone || '--'}
                              </td>

                              <td style={{ padding: 14, whiteSpace: "nowrap" }}>
                                {notification.country || 'Unknown'}
                              </td>

                              <td style={{
                                padding: 14,
                                fontFamily: "monospace",
                                whiteSpace: "nowrap"
                              }}>
                                {notification.interestType}
                              </td>

                              <td style={{ padding: 14 }}>
                                {sendStatus === 'sent' ? (
                                  <span style={{
                                    display: "inline-block",
                                    padding: "6px 10px",
                                    background: "#e8f5e9",
                                    color: "#2e7d32",
                                    borderRadius: 7,
                                    fontWeight: 700
                                  }}>
                                    Sent
                                  </span>
                                ) : sendStatus === 'sending' ? (
                                  <button
                                    type="button"
                                    disabled
                                    style={{
                                      padding: "7px 12px",
                                      border: "none",
                                      borderRadius: 7,
                                      background: T.ink15,
                                      color: T.ink50,
                                      fontWeight: 700
                                    }}
                                  >
                                    Sending...
                                  </button>
                                ) : sendStatus === 'review_required' ? (
                                  <button
                                    type="button"
                                    disabled
                                    title={
                                      notification.lastSendError ||
                                      'The provider accepted the email, but database confirmation failed. Manual review is required.'
                                    }
                                    style={{
                                      padding: "7px 12px",
                                      border: "none",
                                      borderRadius: 7,
                                      background: "#fff3e0",
                                      color: "#b45309",
                                      fontWeight: 700,
                                      cursor: "not-allowed"
                                    }}
                                  >
                                    Review required
                                  </button>
                                ) : canSend ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openWaitlistEmailComposer(notification)
                                    }
                                    title={
                                      sendStatus === 'failed'
                                        ? notification.lastSendError ||
                                          'Previous attempt failed'
                                        : 'Compose and send email'
                                    }
                                    style={{
                                      padding: "7px 12px",
                                      border: "none",
                                      borderRadius: 7,
                                      background:
                                        sendStatus === 'failed'
                                          ? "#fff3e0"
                                          : T.gold,
                                      color:
                                        sendStatus === 'failed'
                                          ? "#b45309"
                                          : "#fff",
                                      fontWeight: 700,
                                      cursor: "pointer"
                                    }}
                                  >
                                    {sendStatus === 'failed'
                                      ? 'Retry'
                                      : 'Pending'}
                                  </button>
                                ) : (
                                  <span style={{
                                    color: T.ink50,
                                    fontSize: 12.5
                                  }}>
                                    No email
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: 14, whiteSpace: "nowrap" }}>
                                {formatBahrainDateTime(notification.createdAt)}
                              </td>

                              <td style={{ padding: 14, whiteSpace: "nowrap" }}>
                                {formatBahrainDateTime(
                                  notification.sentAt ||
                                  notification.notifiedAt
                                )}
                              </td>

                              <td style={{ padding: 14, whiteSpace: "nowrap" }}>
                                {notification.sentByUsername || '--'}
                              </td>
                            </tr>
                          );
                        })}

                        {!notifications.length && (
                          <tr>
                            <td
                              colSpan="8"
                              style={{
                                padding: 30,
                                textAlign: "center",
                                color: T.ink50
                              }}
                            >
                              No waitlist entries yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {emailComposer && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="waitlist-email-title"
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 1000,
                      background: "rgba(28,25,19,0.52)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 20
                    }}
                  >
                    <div style={{
                      width: "100%",
                      maxWidth: 620,
                      maxHeight: "90vh",
                      overflowY: "auto",
                      background: T.card,
                      borderRadius: 18,
                      padding: 26,
                      boxShadow: "0 24px 70px rgba(28,25,19,0.25)"
                    }}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        alignItems: "flex-start",
                        marginBottom: 20
                      }}>
                        <div>
                          <h2
                            id="waitlist-email-title"
                            style={{
                              margin: "0 0 6px",
                              fontSize: 20
                            }}
                          >
                            Send waitlist email
                          </h2>
                          <div style={{
                            fontSize: 13,
                            color: T.ink66,
                            lineHeight: 1.5
                          }}>
                            From: <strong>JIGZO &lt;info@jigzo.biz&gt;</strong>
                            <br />
                            To: <strong>{emailComposer.email}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={closeWaitlistEmailComposer}
                          disabled={emailSending}
                          aria-label="Close"
                          style={{
                            border: "none",
                            background: "transparent",
                            fontSize: 24,
                            cursor: emailSending ? "not-allowed" : "pointer",
                            color: T.ink50
                          }}
                        >
                          X
                        </button>
                      </div>

                      <label style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6
                      }}>
                        Subject
                      </label>

                      <input
                        type="text"
                        value={emailSubject}
                        maxLength={200}
                        onChange={event =>
                          setEmailSubject(event.target.value)
                        }
                        disabled={emailSending || emailLocked}
                        style={{
                          width: "100%",
                          padding: 12,
                          borderRadius: 9,
                          border: T.border,
                          fontSize: 14,
                          marginBottom: 16
                        }}
                      />

                      <label style={{
                        display: "block",
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6
                      }}>
                        Message
                      </label>

                      <textarea
                        value={emailMessage}
                        maxLength={5000}
                        rows={10}
                        onChange={event =>
                          setEmailMessage(event.target.value)
                        }
                        disabled={emailSending || emailLocked}
                        style={{
                          width: "100%",
                          padding: 12,
                          borderRadius: 9,
                          border: T.border,
                          fontSize: 14,
                          lineHeight: 1.55,
                          resize: "vertical"
                        }}
                      />

                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        marginTop: 6,
                        fontSize: 11.5,
                        color: T.ink50
                      }}>
                        <span>
                          {emailLocked
                            ? 'Retry uses the original subject and message (locked).'
                            : 'A confirmation is required before sending.'}
                        </span>
                        <span>{emailMessage.length}/5000</span>
                      </div>

                      {emailError && (
                        <div style={{
                          marginTop: 14,
                          padding: 11,
                          borderRadius: 8,
                          background: "#ffebee",
                          color: "#b42318",
                          fontSize: 13,
                          fontWeight: 600
                        }}>
                          {emailError}
                        </div>
                      )}

                      <div style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 10,
                        marginTop: 22
                      }}>
                        <button
                          type="button"
                          onClick={closeWaitlistEmailComposer}
                          disabled={emailSending}
                          style={{
                            padding: "10px 17px",
                            borderRadius: 9,
                            border: T.border,
                            background: "transparent",
                            fontWeight: 700,
                            cursor: emailSending
                              ? "not-allowed"
                              : "pointer"
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={handleWaitlistEmailSend}
                          disabled={
                            emailSending ||
                            !emailSubject.trim() ||
                            !emailMessage.trim()
                          }
                          style={{
                            padding: "10px 18px",
                            borderRadius: 9,
                            border: "none",
                            background:
                              emailSending ||
                              !emailSubject.trim() ||
                              !emailMessage.trim()
                                ? T.ink15
                                : T.gold,
                            color:
                              emailSending ||
                              !emailSubject.trim() ||
                              !emailMessage.trim()
                                ? T.ink50
                                : "#fff",
                            fontWeight: 700,
                            cursor:
                              emailSending ||
                              !emailSubject.trim() ||
                              !emailMessage.trim()
                                ? "not-allowed"
                                : "pointer"
                          }}
                        >
                          {emailSending ? 'Sending...' : 'Send Email'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* REVEAL LINKS TRACKER */}
            {activeTab === 'reveal-links' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <input
                    type="text"
                    value={revealSearch}
                    onChange={e => setRevealSearch(e.target.value)}
                    placeholder="Search sender, receiver, phone, email, or puzzle ID"
                    style={{
                      width: "100%",
                      maxWidth: 460,
                      padding: 11,
                      borderRadius: 9,
                      border: T.border,
                      fontSize: 14
                    }}
                  />
                </div>

                <div style={{
                  background: T.card,
                  border: T.border,
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: T.shadow
                }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{
                      width: "100%",
                      minWidth: 1500,
                      borderCollapse: "collapse",
                      fontSize: 13.5,
                      textAlign: "left"
                    }}>
                      <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                        <tr>
                          <th style={{ padding: 12 }}>Sender</th>
                          <th style={{ padding: 12 }}>Sender phone</th>
                          <th style={{ padding: 12 }}>Receiver</th>
                          <th style={{ padding: 12 }}>Receiver phone/email</th>
                          <th style={{ padding: 12 }}>Method</th>
                          <th style={{ padding: 12 }}>Status</th>
                          <th style={{ padding: 12 }}>Created At</th>
                          <th style={{ padding: 12 }}>Sent At</th>
                          <th style={{ padding: 12 }}>Opened At</th>
                          <th style={{ padding: 12 }}>Solved At</th>
                          <th style={{ padding: 12 }}>Manual Provided At</th>
                          <th style={{ padding: 12 }}>Manual Provided By</th>
                          <th style={{ padding: 12 }}>Last Error</th>
                          <th style={{ padding: 12 }}>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredRevealLinks.map(row => {
                          const key = revealRowKey(row);
                          const status = deriveRevealStatus(row);
                          const colors = revealStatusColors[status] || revealStatusColors.Pending;
                          const busy = revealBusyKey === key;
                          const provided = Boolean(row.manualLinkProvidedAt);
                          return (
                            <tr key={key} style={{ borderBottom: T.border }}>
                              <td style={{ padding: 12, whiteSpace: "nowrap", fontWeight: 600 }}>{row.senderName || '--'}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{row.senderPhone || '--'}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{row.recipientName || '--'}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{row.receiverContact || '--'}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap", textTransform: "capitalize" }}>
                                {row.deliveryMethod === 'email' ? 'Email' : 'WhatsApp'}
                              </td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                                <span style={{
                                  display: "inline-block",
                                  padding: "5px 9px",
                                  background: colors.bg,
                                  color: colors.fg,
                                  borderRadius: 7,
                                  fontWeight: 700,
                                  fontSize: 12
                                }}>
                                  {status}
                                </span>
                              </td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatBahrainDateTime(row.createdAt)}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatBahrainDateTime(row.sentAt)}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatBahrainDateTime(row.openedAt)}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatBahrainDateTime(row.completedAt)}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{formatBahrainDateTime(row.manualLinkProvidedAt)}</td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{row.manualLinkProvidedByUsername || '--'}</td>
                              <td style={{ padding: 12, maxWidth: 220, color: T.ink66, fontSize: 12.5 }}>
                                {row.lastError || '--'}
                              </td>
                              <td style={{ padding: 12, whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleCopyRevealLink(row)}
                                    style={{
                                      padding: "6px 11px",
                                      border: "none",
                                      borderRadius: 7,
                                      background: revealCopiedKey === key ? "#e8f5e9" : T.gold,
                                      color: revealCopiedKey === key ? "#2e7d32" : "#fff",
                                      fontWeight: 700,
                                      fontSize: 12.5,
                                      cursor: busy ? "not-allowed" : "pointer"
                                    }}
                                  >
                                    {revealCopiedKey === key ? 'Copied' : 'Copy Link'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || provided}
                                    onClick={() => handleMarkProvided(row)}
                                    title={provided ? 'Already marked as manually provided' : 'Mark reveal link as manually provided'}
                                    style={{
                                      padding: "6px 11px",
                                      border: T.border,
                                      borderRadius: 7,
                                      background: "transparent",
                                      color: provided ? T.ink50 : T.ink66,
                                      fontWeight: 700,
                                      fontSize: 12.5,
                                      cursor: (busy || provided) ? "not-allowed" : "pointer"
                                    }}
                                  >
                                    {provided ? 'Provided' : 'Mark Provided'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {!filteredRevealLinks.length && (
                          <tr>
                            <td colSpan="14" style={{ padding: 30, textAlign: "center", color: T.ink50 }}>
                              {revealLinks.length ? 'No matching reveal links.' : 'No reveal links yet.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ANALYTICS CHARTS PANEL */}
            {activeTab === 'analytics' && dashboardData && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Conversion Funnel Stats</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, background: T.card, padding: 24, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                  {Object.entries(dashboardData.funnel).map(([event, count]) => {
                    // Render custom CSS bar charts using percentage widths
                    const maxVal = Math.max(...Object.values(dashboardData.funnel), 1);
                    const pct = (count / maxVal) * 100;
                    return (
                      <div key={event} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 180, fontSize: 13, fontWeight: 600, color: T.ink66 }}>{event}</div>
                        <div style={{ flex: 1, background: "rgba(28,25,19,0.04)", height: 24, borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, background: T.gold, height: "100%", borderRadius: 6, transition: "width 0.4s ease" }} />
                        </div>
                        <div style={{ width: 40, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RECOMMENDATIONS ENGINE VIEW */}
            {activeTab === 'recommendations' && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {recommendations.map(r => (
                  <div key={r._id} style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: r.priority === 'high' ? '#ffebee' : '#fff3e0', color: r.priority === 'high' ? '#c62828' : '#e65100', padding: "3px 8px", borderRadius: 4 }}>
                        {r.priority} priority
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink50 }}>Status: {r.status}</span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{r.finding}</h3>
                    <p style={{ fontSize: 14, color: T.ink66, margin: "0 0 12px", lineHeight: 1.4 }}><strong>Evidence:</strong> {r.evidence}</p>
                    <div style={{ borderTop: T.border, paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13.5, color: T.goldDeep, fontWeight: 600 }}>👉 {r.action}</div>
                      {r.status === 'pending' && (
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => handleRecommendationStatus(r._id, 'implemented')} style={{ padding: "6px 12px", background: T.gold, border: "none", color: "#FFF", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>Apply</button>
                          <button onClick={() => handleRecommendationStatus(r._id, 'dismissed')} style={{ padding: "6px 12px", background: "none", border: "1px solid " + T.ink15, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Dismiss</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ROADMAP / WORK PROGRESS */}
            {activeTab === 'work-progress' && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Execution Roadmap &amp; Tasks</h3>
                  <button onClick={() => { setEditingItem(null); setShowItemForm(true); }} style={{ padding: "8px 16px", background: T.gold, border: "none", color: "#FFF", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    + Add Task
                  </button>
                </div>

                {showItemForm && (
                  <form onSubmit={handleWorkItemSubmit} style={{ background: T.card, border: T.border, borderRadius: 16, padding: 20, marginBottom: 20 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{editingItem ? 'Edit Task' : 'New Task'}</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Area</label>
                        <select value={itemArea} onChange={e => setItemArea(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: T.ink15, marginTop: 4 }}>
                          <option value="Backend">Backend</option>
                          <option value="Frontend">Frontend</option>
                          <option value="WhatsApp Integration">WhatsApp Integration</option>
                          <option value="Branding Design">Branding Design</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Owner</label>
                        <input type="text" value={itemOwner} onChange={e => setItemOwner(e.target.value)} required style={{ width: "100%", padding: 10, borderRadius: 6, border: T.ink15, marginTop: 4 }} />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Priority</label>
                        <select value={itemPriority} onChange={e => setItemPriority(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: T.ink15, marginTop: 4 }}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Status</label>
                        <select value={itemStatus} onChange={e => setItemStatus(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: T.ink15, marginTop: 4 }}>
                          <option value="todo">Todo</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Complete (%)</label>
                        <input type="number" min="0" max="100" value={itemPercent} onChange={e => setItemPercent(parseInt(e.target.value) || 0)} style={{ width: "100%", padding: 10, borderRadius: 6, border: T.ink15, marginTop: 4 }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Blockers Description</label>
                      <input type="text" value={itemBlockers} onChange={e => setItemBlockers(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: T.ink15, marginTop: 4 }} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600 }}>Task Description</label>
                      <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} required style={{ width: "100%", height: 80, padding: 10, borderRadius: 6, border: T.ink15, marginTop: 4, resize: "none" }} />
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => { setShowItemForm(false); setEditingItem(null); }} style={{ padding: "8px 16px", background: "none", border: T.border, borderRadius: 8, cursor: "pointer" }}>Cancel</button>
                      <button type="submit" style={{ padding: "8px 16px", background: T.gold, border: "none", color: "#FFF", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    </div>
                  </form>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {workItems.map(item => (
                    <div key={item._id} style={{ padding: 18, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: "rgba(28,25,19,0.06)", padding: "3px 8px", borderRadius: 4, marginRight: 8 }}>{item.area}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: item.priority === 'high' ? '#ffebee' : '#e8f5e9', color: item.priority === 'high' ? '#c62828' : '#2e7d32', padding: "3px 8px", borderRadius: 4 }}>{item.priority}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => {
                            setEditingItem(item);
                            setItemArea(item.area);
                            setItemPriority(item.priority);
                            setItemOwner(item.owner);
                            setItemStatus(item.status);
                            setItemPercent(item.percentageComplete);
                            setItemBlockers(item.blockers);
                            setItemDesc(item.description);
                            setShowItemForm(true);
                          }} style={{ fontSize: 12, cursor: "pointer" }}>Edit</button>
                        </div>
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>{item.description}</h4>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.ink66, marginTop: 8 }}>
                        <span>Owner: <strong>{item.owner}</strong></span>
                        <span>Complete: <strong>{item.percentageComplete}%</strong></span>
                        <span>Status: <strong style={{ color: item.status === 'blocked' ? '#c62828' : T.gold }}>{item.status}</strong></span>
                      </div>
                      {item.blockers && (
                        <div style={{ marginTop: 8, padding: 8, background: "#fff5f5", borderRadius: 6, fontSize: 12.5, color: "#c62828", borderLeft: "3px solid #c62828" }}>
                          🛑 {item.blockers}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TEMPLATES PREVIEW */}
            {activeTab === 'templates' && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>WhatsApp Template: puzzle_delivery</h3>
                  <div style={{ fontSize: 12, color: T.ink50, marginBottom: 12 }}>Standard notifications trigger on paid orders dispatch.</div>
                  <pre style={{ background: T.bg, padding: 14, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 13.5, margin: 0, fontFamily: "monospace" }}>
                    {`Hey {{1}}! 🧩

{{2}} sent you a JIGZO surprise. 

Solve the puzzle to reveal their hidden message:
👉 https://jigzo.biz/p/{{3}}?r={{4}}`}
                  </pre>
                </div>
                <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>WhatsApp Template: reveal_notification</h3>
                  <div style={{ fontSize: 12, color: T.ink50, marginBottom: 12 }}>Insights Alert triggers to senders when recipients open/solve puzzles.</div>
                  <pre style={{ background: T.bg, padding: 14, borderRadius: 8, whiteSpace: "pre-wrap", fontSize: 13.5, margin: 0, fontFamily: "monospace" }}>
                    {`Great news {{1}}! 🎉

{{2}} just solved your JIGZO puzzle! 

They completed it in {{3}} seconds.`}
                  </pre>
                </div>
              </div>
            )}

            {/* SETTINGS VIEW */}
            {activeTab === 'settings' && settings && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ padding: 20, background: T.card, borderRadius: 16, border: T.border, boxShadow: T.shadow }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Active Deployment Settings</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: T.border, paddingBottom: 8 }}>
                      <span>Checkout Enabled</span>
                      <strong style={{ color: settings.flags.CHECKOUT_ENABLED ? '#2e7d32' : '#c62828' }}>{settings.flags.CHECKOUT_ENABLED ? 'TRUE' : 'FALSE'}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: T.border, paddingBottom: 8 }}>
                      <span>WhatsApp Dispatch Enabled</span>
                      <strong style={{ color: settings.flags.WHATSAPP_ENABLED ? '#2e7d32' : '#c62828' }}>{settings.flags.WHATSAPP_ENABLED ? 'TRUE' : 'FALSE'}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: T.border, paddingBottom: 8 }}>
                      <span>API Server Environment</span>
                      <strong>{settings.hosting.environment}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: T.border, paddingBottom: 8 }}>
                      <span>API Version</span>
                      <strong>{settings.hosting.apiVersion}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Database Status</span>
                      <strong style={{ color: '#2e7d32' }}>{settings.hosting.databaseStatus}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT TRAILS LOG */}
            {activeTab === 'audit-log' && (
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Admin User</th>
                      <th style={{ padding: 14 }}>Action Type</th>
                      <th style={{ padding: 14 }}>IP Address</th>
                      <th style={{ padding: 14 }}>Target Record</th>
                      <th style={{ padding: 14 }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(a => (
                      <tr key={a._id} style={{ borderBottom: T.border }}>
                        <td style={{ padding: 14, fontWeight: 600 }}>{a.adminUserId?.username || 'System'}</td>
                        <td style={{ padding: 14 }}><span style={{ fontFamily: "monospace" }}>{a.action}</span></td>
                        <td style={{ padding: 14, color: T.ink50 }}>{a.ipAddress}</td>
                        <td style={{ padding: 14, fontFamily: "monospace", fontSize: 12 }}>{a.targetModel} / {a.targetId}</td>
                        <td style={{ padding: 14 }}>{new Date(a.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
