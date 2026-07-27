import React, { useState, useMemo } from 'react';
import axios from 'axios';

/* ---------------------------------------------------------------------------
 * JIGZO admin — shared theme, API helper and reusable UI primitives.
 * Cream / ink / gold brand language. BHD shown with three decimals, never "$".
 * ------------------------------------------------------------------------- */

export const T = {
  bg: '#FAF8EC',
  panel: '#F4EDDF',
  card: '#FFFFFF',
  ink: '#1C1913',
  gold: '#B8935A',
  goldWarm: '#E6C67F',
  goldDeep: '#8a6d3a',
  ink08: 'rgba(28,25,19,0.08)',
  ink15: 'rgba(28,25,19,0.15)',
  ink50: 'rgba(28,25,19,0.50)',
  ink66: 'rgba(28,25,19,0.66)',
  ink74: 'rgba(28,25,19,0.74)',
  green: '#3f7a4f',
  greenBg: 'rgba(63,122,79,0.10)',
  red: '#a4442f',
  redBg: 'rgba(164,68,47,0.10)',
  amber: '#8a6d1a',
  amberBg: 'rgba(214,178,58,0.14)',
  shadow: '0 6px 20px rgba(28,25,19,0.06)',
  border: '1px solid rgba(28,25,19,0.08)',
  radius: '14px'
};

export const getBaseUrl = () =>
  import.meta.env.VITE_ENABLE_LOCAL_TEST === 'true' ? 'http://localhost:5000' : '';

export const TOKEN_KEY = 'jigzo_admin_token';

/* Read-only GET against the v2 admin API. Clears the token on 401. */
export async function adminGet(path) {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  try {
    const res = await axios.get(`${getBaseUrl()}/api/admin/v2${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.reload();
    }
    throw err;
  }
}

function authHeaders() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` } };
}
async function mutate(method, base, path, body) {
  try {
    const url = `${getBaseUrl()}${base}${path}`;
    const res = await axios({ method, url, data: body, ...authHeaders() });
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 401) { localStorage.removeItem(TOKEN_KEY); window.location.reload(); }
    throw err;
  }
}
export const adminPost = (path, body) => mutate('post', '/api/admin/v2', path, body);
export const adminPut = (path, body) => mutate('put', '/api/admin/v2', path, body);
export const adminDelete = (path, body) => mutate('delete', '/api/admin/v2', path, body);
/* Reuse of the existing, tested /api/admin routes (reveal links, waitlist email). */
export const adminLegacyGet = (path) => mutate('get', '/api/admin', path);
export const adminLegacyPost = (path, body) => mutate('post', '/api/admin', path, body);

/* Format an amount in its own display currency (2dp, or 3dp for BHD-like). */
const THREE_DP = ['BHD', 'KWD', 'OMR', 'LYD', 'IQD', 'TND'];
export function formatMoney(currency, amount) {
  const n = Number(amount);
  const dp = THREE_DP.includes(String(currency || '').toUpperCase()) ? 3 : 2;
  return `${currency} ${isFinite(n) ? n.toFixed(dp) : (0).toFixed(dp)}`;
}

export function Modal({ title, children, onClose, width = 520 }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,19,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', zIndex: 1000, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, borderRadius: 16, boxShadow: '0 20px 60px rgba(28,25,19,0.3)', width: '100%', maxWidth: width, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: T.ink }}>{title}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: T.ink50, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Button({ children, onClick, tone = 'default', disabled, type = 'button', size }) {
  const map = {
    default: { bg: T.card, fg: T.ink, bd: T.border },
    primary: { bg: T.ink, fg: T.bg, bd: 'none' },
    gold: { bg: T.goldWarm, fg: T.ink, bd: 'none' },
    danger: { bg: T.redBg, fg: T.red, bd: `1px solid ${T.red}` }
  };
  const c = map[tone] || map.default;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ padding: size === 'sm' ? '5px 12px' : '9px 16px', borderRadius: 9, border: c.bd, background: c.bg, color: c.fg, fontSize: size === 'sm' ? 12.5 : 13.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.ink66, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}
export const inputCss = { width: '100%', padding: '9px 11px', borderRadius: 9, border: T.border, background: T.bg, color: T.ink, fontSize: 13.5, outline: 'none', boxSizing: 'border-box' };

/* ---- Money ---------------------------------------------------------------- */
export function formatBHD(value) {
  const n = Number(value);
  if (!isFinite(n)) return 'BHD 0.000';
  return `BHD ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

export function BHD({ value, strong }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : 500, whiteSpace: 'nowrap' }}>
      {formatBHD(value)}
    </span>
  );
}

export function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ---- Layout primitives ---------------------------------------------------- */
export function PageHeader({ title, explain }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: T.ink }}>{title}</h1>
      {explain && (
        <p style={{ margin: '8px 0 0', maxWidth: 760, fontSize: 14.5, lineHeight: 1.6, color: T.ink66 }}>
          {explain}
        </p>
      )}
    </div>
  );
}

export function Card({ children, style, title, subtitle }) {
  return (
    <div style={{ background: T.card, border: T.border, borderRadius: T.radius, boxShadow: T.shadow, padding: 20, ...style }}>
      {title && <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: subtitle ? 2 : 12 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 12.5, color: T.ink50, marginBottom: 12 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

export function StatTile({ label, value, hint, tone }) {
  const color = tone === 'good' ? T.green : tone === 'bad' ? T.red : T.ink;
  return (
    <div style={{ background: T.card, border: T.border, borderRadius: T.radius, boxShadow: T.shadow, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.goldDeep, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: T.ink50, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function StatGrid({ children, min = 180 }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14 }}>{children}</div>;
}

export function Badge({ children, tone = 'neutral' }) {
  const map = {
    good: { bg: T.greenBg, fg: T.green },
    bad: { bg: T.redBg, fg: T.red },
    warn: { bg: T.amberBg, fg: T.amber },
    neutral: { bg: T.ink08, fg: T.ink66 }
  };
  const c = map[tone] || map.neutral;
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <div style={{ padding: 40, textAlign: 'center', color: T.ink50, fontSize: 14 }}>{label}</div>;
}

export function ErrorNote({ error }) {
  return (
    <div style={{ padding: 16, background: T.redBg, color: T.red, borderRadius: 10, fontSize: 13.5 }}>
      {String((error && error.message) || error || 'Something went wrong.')}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div style={{ padding: 32, textAlign: 'center', color: T.ink50, fontSize: 14 }}>{children}</div>;
}

/* ---- Simple horizontal bar chart (no external chart library) -------------- */
export function BarList({ data, valueFormat }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.ink66, marginBottom: 4 }}>
            <span>{d.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{valueFormat ? valueFormat(d.value) : d.value}</span>
          </div>
          <div style={{ height: 8, background: T.ink08, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(Number(d.value) / max) * 100}%`, height: '100%', background: T.goldWarm, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Data table with search / sort / pagination --------------------------- */
export function DataTable({ columns, rows, searchKeys, pageSize = 15, initialSort, onRowClick, emptyText = 'No records found.' }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort || null); // { key, dir }
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim() || !searchKeys) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
  }, [rows, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const an = Number(av);
      const bn = Number(bv);
      let cmp;
      if (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '') cmp = an - bn;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sort.dir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  const toggleSort = (key) => {
    setPage(0);
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  return (
    <div>
      {searchKeys && (
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          placeholder="Search…"
          style={{ width: '100%', maxWidth: 320, padding: '9px 12px', borderRadius: 10, border: T.border, background: T.bg, color: T.ink, fontSize: 13.5, marginBottom: 12, outline: 'none' }}
        />
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  style={{
                    textAlign: c.align || 'left', padding: '10px 12px', borderBottom: `2px solid ${T.ink08}`,
                    color: T.goldDeep, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em',
                    fontWeight: 700, whiteSpace: 'nowrap', cursor: c.sortable ? 'pointer' : 'default', userSelect: 'none'
                  }}
                >
                  {c.label}
                  {sort && sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={columns.length}><EmptyState>{emptyText}</EmptyState></td></tr>
            ) : (
              pageRows.map((r, i) => (
                <tr
                  key={r._key || i}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  style={{ cursor: onRowClick ? 'pointer' : 'default', background: i % 2 ? 'rgba(28,25,19,0.015)' : 'transparent' }}
                >
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align || 'left', padding: '10px 12px', borderBottom: `1px solid ${T.ink08}`, color: T.ink74, whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
                      {c.render ? c.render(r) : (r[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13 }}>
          <span style={{ color: T.ink50 }}>{sorted.length} records</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setPage(Math.max(0, clampedPage - 1))} disabled={clampedPage === 0} style={pagerBtn(clampedPage === 0)}>Prev</button>
            <span style={{ color: T.ink66 }}>Page {clampedPage + 1} / {pageCount}</span>
            <button onClick={() => setPage(Math.min(pageCount - 1, clampedPage + 1))} disabled={clampedPage >= pageCount - 1} style={pagerBtn(clampedPage >= pageCount - 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

const pagerBtn = (disabled) => ({
  padding: '6px 14px', borderRadius: 8, border: T.border, background: disabled ? T.ink08 : T.card,
  color: disabled ? T.ink50 : T.ink, fontSize: 13, cursor: disabled ? 'default' : 'pointer'
});

/* Small hook to load data once on mount. */
export function useAdminData(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  React.useEffect(() => {
    let live = true;
    setState({ data: null, loading: true, error: null });
    loader()
      .then((data) => { if (live) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (live) setState({ data: null, loading: false, error }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
