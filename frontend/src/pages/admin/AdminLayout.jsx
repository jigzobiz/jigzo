import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import axios from 'axios';
import { T, TOKEN_KEY, getBaseUrl } from './adminShared';

const NAV = [
  { to: '/admin', label: 'Home', end: true },
  { to: '/admin/customers', label: 'Customers' },
  { to: '/admin/orders', label: 'Orders & Puzzles' },
  { to: '/admin/delivery', label: 'Delivery Centre' },
  { to: '/admin/finance', label: 'Finance' },
  { to: '/admin/growth', label: 'Growth' },
  { to: '/admin/system', label: 'System' }
];

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await axios.post(`${getBaseUrl()}/api/admin/auth/login`, { username, password });
      if (res.data && res.data.success) {
        localStorage.setItem(TOKEN_KEY, res.data.token);
        onLogin(res.data.token);
      } else {
        setError('Login failed.');
      }
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || 'Invalid username or password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Archia, sans-serif', padding: 20 }}>
      <form onSubmit={submit} style={{ background: T.card, border: T.border, borderRadius: 18, boxShadow: T.shadow, padding: 32, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.goldDeep, fontWeight: 700 }}>JIGZO</div>
        <h1 style={{ margin: '6px 0 4px', fontSize: 22, color: T.ink }}>Admin Portal</h1>
        <p style={{ margin: '0 0 22px', fontSize: 13.5, color: T.ink50 }}>Sign in to view live operations and finances.</p>
        <label style={labelStyle}>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus style={inputStyle} />
        <label style={labelStyle}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: T.ink, color: T.bg, fontWeight: 700, fontSize: 15, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: T.ink66, marginBottom: 6 };
const inputStyle = { width: '100%', padding: '11px 12px', borderRadius: 10, border: T.border, background: T.bg, color: T.ink, fontSize: 14, marginBottom: 16, outline: 'none', boxSizing: 'border-box' };

export default function AdminLayout() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const location = useLocation();

  if (!token) return <LoginScreen onLogin={setToken} />;

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, fontFamily: 'Archia, sans-serif', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 232, background: T.panel, borderRight: T.border, padding: '24px 16px', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 8px 20px' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.goldDeep, fontWeight: 700 }}>JIGZO</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.ink }}>Admin</div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                padding: '10px 12px', borderRadius: 10, textDecoration: 'none', fontSize: 14.5, fontWeight: isActive ? 700 : 500,
                color: isActive ? T.ink : T.ink66, background: isActive ? T.goldWarm : 'transparent'
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} style={{ marginTop: 16, padding: '10px 12px', borderRadius: 10, border: T.border, background: T.card, color: T.ink66, fontSize: 13.5, cursor: 'pointer', textAlign: 'left' }}>
          Sign out
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px', maxWidth: 1240 }} key={location.pathname}>
        <Outlet />
      </main>
    </div>
  );
}
