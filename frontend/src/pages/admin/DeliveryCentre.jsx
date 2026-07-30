import React, { useState, useMemo } from 'react';
import { PageHeader, Card, StatGrid, StatTile, DataTable, Badge, Button, Loading, ErrorNote, useAdminData, adminGet, adminPost, adminLegacyPost, formatDate, formatDateTime, T } from './adminShared';

const stateTone = (s) => (s === 'solved' ? 'good' : s === 'opened' ? 'warn' : s === 'delivered' || s === 'sent' ? 'neutral' : 'neutral');
const SCOPES = [{ id: 'completed', label: 'Completed' }, { id: 'abandoned', label: 'Abandoned' }, { id: 'all', label: 'All' }];
const STATES = ['all', 'pending', 'sent', 'delivered', 'opened', 'solved', 'failed', 'manually provided'];
const CHANNELS = ['all', 'whatsapp', 'email'];

export default function DeliveryCentre() {
  const [tab, setTab] = useState('status');
  return (
    <>
      <PageHeader title="Delivery Centre" explain={EXPLAIN} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <Button tone={tab === 'status' ? 'primary' : 'default'} size="sm" onClick={() => setTab('status')}>Delivery Status</Button>
        <Button tone={tab === 'links' ? 'primary' : 'default'} size="sm" onClick={() => setTab('links')}>Reveal Links</Button>
      </div>
      {tab === 'status' ? <DeliveryStatus /> : <RevealLinks />}
    </>
  );
}

function useDelivery(scope, reloadTick = 0) {
  return useAdminData(() => adminGet(`/delivery?scope=${scope}`), [scope, reloadTick]);
}

function applyFilters(list, stateF, channelF) {
  return list.filter((r) => {
    if (channelF !== 'all' && (r.deliveryMethod || 'whatsapp') !== channelF) return false;
    if (stateF === 'all') return true;
    if (stateF === 'failed') return r.deliveryTracking === 'Failed';
    if (stateF === 'manually provided') return !!r.manualLinkProvidedAt;
    return r.state === stateF;
  });
}

function DeliveryStatus() {
  const [scope, setScope] = useState('completed');
  const [stateF, setStateF] = useState('all');
  const [channelF, setChannelF] = useState('all');
  const [busyKey, setBusyKey] = useState('');
  const [note, setNote] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const { data, loading, error } = useDelivery(scope, reloadTick);
  const rows = useMemo(() => (data ? applyFilters(data.list, stateF, channelF) : []), [data, stateF, channelF]);

  const retryDelivery = async (row) => {
    if (!window.confirm(`Retry the failed WhatsApp delivery to ${row.recipientName}? This sends one new template attempt.`)) return;
    const key = `${row.puzzleId}-${row.recipientIndex}`;
    setBusyKey(key);
    setNote('');
    try {
      const result = await adminPost(`/delivery/${row.puzzleId}/${row.recipientIndex}/retry-whatsapp`);
      setNote(result.result === 'accepted' ? 'Retry accepted by the WhatsApp provider.' : 'Retry completed.');
      setReloadTick((value) => value + 1);
    } catch (err) {
      const result = err.response && err.response.data && err.response.data.result;
      setNote(
        result === 'already_claimed'
          ? 'This delivery retry is already in progress.'
          : result === 'not_retryable'
            ? 'This delivery is no longer safely retryable.'
            : 'The retry failed. Review the delivery state before trying again.'
      );
      setReloadTick((value) => value + 1);
    } finally {
      setBusyKey('');
    }
  };

  return (
    <>
      <FilterBar scope={scope} setScope={setScope} stateF={stateF} setStateF={setStateF} channelF={channelF} setChannelF={setChannelF} />
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <>
          <StatGrid min={130}>
            <StatTile label="Total" value={data.summary.total} />
            <StatTile label="Solved" value={data.summary.solved} tone="good" />
            <StatTile label="Opened" value={data.summary.opened} tone="warn" />
            <StatTile label="Delivered" value={data.summary.delivered} />
            <StatTile label="Failed" value={data.summary.failed} tone={data.summary.failed ? 'bad' : 'neutral'} />
            <StatTile label="Needs reconciliation" value={data.summary.reconciliationRequired || 0} tone={data.summary.reconciliationRequired ? 'bad' : 'good'} />
            <StatTile label="Conflicts" value={data.summary.conflicts} tone={data.summary.conflicts ? 'bad' : 'good'} />
          </StatGrid>
          <Card style={{ marginTop: 20, padding: 16 }}>
            {note && <div style={{ color: note.includes('accepted') ? T.green : T.red, fontSize: 13, marginBottom: 10 }}>{note}</div>}
            <DataTable
              columns={[
                { key: 'orderId', label: 'Order', render: (r) => r.orderId || <span style={{ color: T.ink50 }}>—</span> },
                { key: 'puzzleId', label: 'Puzzle', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.puzzleId}</span> },
                { key: 'senderName', label: 'Sender', render: (r) => <div><div>{r.senderName || '—'}</div><div style={{ fontSize: 11.5, color: T.ink50, fontVariantNumeric: 'tabular-nums' }}>{r.senderPhone || ''}</div></div> },
                { key: 'recipientName', label: 'Recipient', render: (r) => <div><div>{r.recipientName}</div><div style={{ fontSize: 11.5, color: T.ink50, fontVariantNumeric: 'tabular-nums' }}>{r.recipientContact || ''}</div></div> },
                { key: 'deliveryMethod', label: 'Channel' },
                { key: 'state', label: 'State', sortable: true, render: (r) => <Badge tone={stateTone(r.state)}>{r.state}</Badge> },
                { key: 'providerSendStatus', label: 'Provider status', render: (r) => <span style={{ color: T.ink66 }}>{r.providerSendStatus}</span> },
                { key: 'reconciliationStatus', label: 'Reconciliation', render: (r) => r.reconciliationStatus === 'reconciliation_required' ? <Badge tone="bad">required</Badge> : <span style={{ color: T.ink50 }}>—</span> },
                { key: 'deliveryTracking', label: 'Tracking', render: (r) => <span style={{ color: r.deliveryTracking === 'Failed' ? T.red : T.ink66 }}>{r.deliveryTracking}</span> },
                { key: 'sentAt', label: 'Sent', render: (r) => <TimeCell v={r.sentAt} /> },
                { key: 'deliveredAt', label: 'Delivered', render: (r) => <TimeCell v={r.deliveredAt} /> },
                { key: 'openedAt', label: 'Opened', render: (r) => <TimeCell v={r.openedAt} /> },
                { key: 'completedAt', label: 'Solved', render: (r) => <TimeCell v={r.completedAt} /> },
                { key: 'completionSeconds', label: 'Duration', render: (r) => r.completionSeconds != null ? `${r.completionSeconds}s` : 'Not recorded' },
                { key: 'manualLinkProvidedAt', label: 'Manual link', render: (r) => r.manualLinkProvidedAt ? <Badge tone="good">provided</Badge> : <span style={{ color: T.ink50 }}>—</span> },
                { key: 'lastError', label: 'Last error', wrap: true, render: (r) => r.lastError ? <span style={{ color: T.red, fontSize: 12 }}>{r.lastError}</span> : <span style={{ color: T.ink50 }}>—</span> },
                { key: 'retry', label: '', render: (r) => {
                  const key = `${r.puzzleId}-${r.recipientIndex}`;
                  return r.canRetryInitialDelivery
                    ? <Button size="sm" tone="danger" disabled={busyKey === key} onClick={() => retryDelivery(r)}>{busyKey === key ? 'Retrying…' : 'Retry'}</Button>
                    : null;
                } }
              ]}
              rows={rows.map((r, i) => ({ ...r, _key: `${r.puzzleId}-${r.recipientIndex}` }))}
              searchKeys={['orderId', 'puzzleId', 'senderName', 'senderPhone', 'recipientName', 'recipientContact', 'tapReference']}
              pageSize={20}
              emptyText="No recipient records for these filters."
            />
          </Card>
          <p style={{ marginTop: 12, fontSize: 12.5, color: T.ink50 }}>
            A solved/opened recipient is authoritative even when provider delivery was never confirmed — shown as “Unconfirmed” tracking, not a conflict. Times are Bahrain local; only logically impossible data (e.g. solved before created) is a conflict.
          </p>
        </>
      )}
    </>
  );
}

function RevealLinks() {
  const [scope, setScope] = useState('completed');
  const [copiedKey, setCopiedKey] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [note, setNote] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const { data, loading, error } = useAdminData(() => adminGet(`/delivery?scope=${scope}`), [scope, reloadTick]);

  const copyLink = async (r) => {
    const key = `${r.puzzleId}-${r.recipientIndex}`;
    setBusyKey(key); setNote('');
    try {
      const res = await adminLegacyPost(`/reveal-links/${r.puzzleMongoId}/${r.recipientIndex}/copy`);
      if (res && res.link) {
        try { await navigator.clipboard.writeText(res.link); } catch (e) { /* clipboard may be blocked */ }
        setCopiedKey(key); setTimeout(() => setCopiedKey(''), 2500);
      }
    } catch (e) { setNote('Could not fetch reveal link.'); } finally { setBusyKey(''); }
  };
  const markProvided = async (r) => {
    if (!window.confirm(`Mark the reveal link for ${r.recipientName} as manually provided?`)) return;
    const key = `mp-${r.puzzleId}-${r.recipientIndex}`;
    setBusyKey(key); setNote('');
    try { await adminLegacyPost(`/reveal-links/${r.puzzleMongoId}/${r.recipientIndex}/manual-provided`); setReloadTick((n) => n + 1); }
    catch (e) { setNote((e.response && e.response.data && e.response.data.error) || 'Could not update.'); }
    finally { setBusyKey(''); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {SCOPES.map((s) => <Button key={s.id} tone={scope === s.id ? 'primary' : 'default'} size="sm" onClick={() => setScope(s.id)}>{s.label}</Button>)}
      </div>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>
            Default scope is completed/paid orders — abandoned duplicate attempts are excluded. Secure links are generated only when you press Copy (never returned in bulk), and each copy is audit-logged.
          </div>
          {note && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{note}</div>}
          <DataTable
            columns={[
              { key: 'orderId', label: 'Order', render: (r) => r.orderId || <span style={{ color: T.ink50 }}>—</span> },
              { key: 'puzzleId', label: 'Public ID', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.puzzleId}</span> },
              { key: 'senderName', label: 'Sender', render: (r) => <div><div>{r.senderName || '—'}</div><div style={{ fontSize: 11.5, color: T.ink50, fontVariantNumeric: 'tabular-nums' }}>{r.senderPhone || ''}</div></div> },
              { key: 'recipientName', label: 'Recipient', render: (r) => <div><div>{r.recipientName}</div><div style={{ fontSize: 11.5, color: T.ink50, fontVariantNumeric: 'tabular-nums' }}>{r.recipientContact || ''}</div></div> },
              { key: 'state', label: 'State', render: (r) => <Badge tone={stateTone(r.state)}>{r.state}</Badge> },
              { key: 'sentAt', label: 'Sent', render: (r) => <TimeCell v={r.sentAt} /> },
              { key: 'openedAt', label: 'Opened', render: (r) => <TimeCell v={r.openedAt} /> },
              { key: 'completedAt', label: 'Solved', render: (r) => <TimeCell v={r.completedAt} /> },
              { key: 'manualLinkProvidedAt', label: 'Manual', render: (r) => r.manualLinkProvidedAt ? <Badge tone="good">provided</Badge> : <span style={{ color: T.ink50 }}>—</span> },
              { key: 'copy', label: '', render: (r) => {
                const key = `${r.puzzleId}-${r.recipientIndex}`;
                const mpKey = `mp-${key}`;
                return (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Button size="sm" tone="gold" disabled={busyKey === key} onClick={() => copyLink(r)}>{copiedKey === key ? 'Copied ✓' : busyKey === key ? '…' : 'Copy link'}</Button>
                    {!r.manualLinkProvidedAt && <Button size="sm" disabled={busyKey === mpKey} onClick={() => markProvided(r)}>{busyKey === mpKey ? '…' : 'Mark provided'}</Button>}
                  </div>
                );
              } }
            ]}
            rows={data.list.map((r) => ({ ...r, _key: `${r.puzzleId}-${r.recipientIndex}` }))}
            searchKeys={['orderId', 'puzzleId', 'senderName', 'senderPhone', 'recipientName', 'recipientContact', 'tapReference']}
            pageSize={20}
            emptyText="No reveal links for this scope."
          />
        </Card>
      )}
    </>
  );
}

function FilterBar({ scope, setScope, stateF, setStateF, channelF, setChannelF }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6 }}>{SCOPES.map((s) => <Button key={s.id} tone={scope === s.id ? 'primary' : 'default'} size="sm" onClick={() => setScope(s.id)}>{s.label}</Button>)}</div>
      <Select label="State" value={stateF} onChange={setStateF} options={STATES} />
      <Select label="Channel" value={channelF} onChange={setChannelF} options={CHANNELS} />
    </div>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: T.ink66 }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: T.border, background: T.bg, color: T.ink, fontSize: 12.5 }}>
        {options.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
      </select>
    </label>
  );
}
function TimeCell({ v }) {
  return <span title={v ? new Date(v).toISOString() : 'Not recorded'} style={{ fontSize: 12, color: v ? T.ink74 : T.ink50 }}>{formatDateTime(v)}</span>;
}

const EXPLAIN =
  'A read-only operational control tower for deliveries plus secure reveal-link tools. Delivery Status shows sender/recipient names and phone numbers, provider send status, and full Bahrain-local timestamps for sent/delivered/opened/solved, with search and filters. Reveal Links lets you copy a recipient’s secure link on demand. Priority: Solved > Opened > Delivered > Sent > Pending. Default scope is completed/paid orders.';
