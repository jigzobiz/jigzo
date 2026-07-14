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
      const res = await axios.post(`${getBaseUrl()}/api/admin/work-progress`, payload, getAxiosConfig());
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
                      const emailKey = `Customer-${c._id}-email`;
                      const phoneKey = `Customer-${c._id}-phone`;
                      return (
                        <tr key={c._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14, fontWeight: 600 }}>{c.name || 'Anonymous'}</td>
                          <td style={{ padding: 14 }}>
                            {unmaskedValues[emailKey] || c.email}
                            {!unmaskedValues[emailKey] && c.email && (
                              <button onClick={() => handleUnmask('Customer', c._id, 'email')} style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>Show</button>
                            )}
                          </td>
                          <td style={{ padding: 14 }}>
                            {unmaskedValues[phoneKey] || c.phone}
                            {!unmaskedValues[phoneKey] && c.phone && (
                              <button onClick={() => handleUnmask('Customer', c._id, 'phone')} style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>Show</button>
                            )}
                          </td>
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
                      const phoneKey = `Order-${o._id}-customerPhone`;
                      return (
                        <tr key={o._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14, fontFamily: "monospace" }}>{o._id.toString().slice(-8)}</td>
                          <td style={{ padding: 14 }}>
                            {unmaskedValues[phoneKey] || o.customerPhone}
                            {!unmaskedValues[phoneKey] && o.customerPhone && (
                              <button onClick={() => handleUnmask('Order', o._id, 'customerPhone')} style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>Show</button>
                            )}
                          </td>
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
                      const phoneKey = `Recipient-${r._id}-phone`;
                      return (
                        <tr key={r._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14, fontWeight: 600 }}>{r.name}</td>
                          <td style={{ padding: 14 }}>
                            {unmaskedValues[phoneKey] || r.phone}
                            {!unmaskedValues[phoneKey] && r.phone && (
                              <button onClick={() => handleUnmask('Recipient', r._id, 'phone')} style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>Show</button>
                            )}
                          </td>
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
                      const phoneKey = `WhatsAppMessage-${w._id}-recipientPhone`;
                      return (
                        <tr key={w._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14 }}>
                            {unmaskedValues[phoneKey] || w.recipientPhone}
                            {!unmaskedValues[phoneKey] && w.recipientPhone && (
                              <button onClick={() => handleUnmask('WhatsAppMessage', w._id, 'recipientPhone')} style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>Show</button>
                            )}
                          </td>
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
              <div style={{ background: T.card, border: T.border, borderRadius: 16, overflow: "hidden", boxShadow: T.shadow }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                  <thead style={{ background: "rgba(28,25,19,0.04)" }}>
                    <tr>
                      <th style={{ padding: 14 }}>Email</th>
                      <th style={{ padding: 14 }}>Phone</th>
                      <th style={{ padding: 14 }}>Interest Type</th>
                      <th style={{ padding: 14 }}>Notified</th>
                      <th style={{ padding: 14 }}>Registered At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map(n => {
                      const emailKey = `NotificationRequest-${n._id}-email`;
                      const phoneKey = `NotificationRequest-${n._id}-phone`;
                      return (
                        <tr key={n._id} style={{ borderBottom: T.border }}>
                          <td style={{ padding: 14 }}>
                            {unmaskedValues[emailKey] || n.email || '−'}
                            {!unmaskedValues[emailKey] && n.email && (
                              <button onClick={() => handleUnmask('NotificationRequest', n._id, 'email')} style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>Show</button>
                            )}
                          </td>
                          <td style={{ padding: 14 }}>
                            {unmaskedValues[phoneKey] || n.phone || '−'}
                            {!unmaskedValues[phoneKey] && n.phone && (
                              <button onClick={() => handleUnmask('NotificationRequest', n._id, 'phone')} style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", cursor: "pointer" }}>Show</button>
                            )}
                          </td>
                          <td style={{ padding: 14, fontFamily: "monospace" }}>{n.interestType}</td>
                          <td style={{ padding: 14 }}>{n.notified ? '✅ Yes' : '⏳ Pending'}</td>
                          <td style={{ padding: 14 }}>{new Date(n.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
