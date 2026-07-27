import React, { useState } from 'react';
import { PageHeader, Card, StatGrid, StatTile, DataTable, Badge, Button, Loading, ErrorNote, useAdminData, adminGet, adminLegacyGet, adminLegacyPost, formatDate, T } from './adminShared';

const stateTone = (s) => (s === 'solved' ? 'good' : s === 'opened' ? 'warn' : s === 'delivered' || s === 'sent' ? 'neutral' : 'neutral');

export default function DeliveryCentre() {
  const [tab, setTab] = useState('status');
  return (
    <>
      <PageHeader title="Delivery Centre" explain={EXPLAIN} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <Button tone={tab === 'status' ? 'primary' : 'default'} size="sm" onClick={() => setTab('status')}>Recipient Status</Button>
        <Button tone={tab === 'links' ? 'primary' : 'default'} size="sm" onClick={() => setTab('links')}>Reveal Links</Button>
      </div>
      {tab === 'status' ? <RecipientStatus /> : <RevealLinks />}
    </>
  );
}

function RecipientStatus() {
  const [scope, setScope] = useState('completed');
  const { data, loading, error } = useAdminData(() => adminGet(`/delivery?scope=${scope}`), [scope]);

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['completed', 'abandoned', 'all'].map((s) => (
          <Button key={s} tone={scope === s ? 'primary' : 'default'} size="sm" onClick={() => setScope(s)}>{s[0].toUpperCase() + s.slice(1)}</Button>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <>
          <StatGrid min={140}>
            <StatTile label="Total" value={data.summary.total} />
            <StatTile label="Solved" value={data.summary.solved} tone="good" />
            <StatTile label="Opened" value={data.summary.opened} tone="warn" />
            <StatTile label="Delivered" value={data.summary.delivered} />
            <StatTile label="Pending" value={data.summary.pending} />
            <StatTile label="Conflicts" value={data.summary.conflicts} tone={data.summary.conflicts ? 'bad' : 'good'} />
          </StatGrid>
          <Card style={{ marginTop: 20, padding: 16 }}>
            <DataTable
              columns={[
                { key: 'puzzleId', label: 'Puzzle', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.puzzleId}</span> },
                { key: 'recipientName', label: 'Recipient' },
                { key: 'deliveryMethod', label: 'Channel' },
                { key: 'state', label: 'State', sortable: true, render: (r) => <Badge tone={stateTone(r.state)}>{r.state}</Badge> },
                { key: 'deliveryTracking', label: 'Delivery tracking', render: (r) => <span style={{ color: T.ink66 }}>{r.deliveryTracking}</span> },
                { key: 'completedAt', label: 'Solved', render: (r) => formatDate(r.completedAt) },
                { key: 'conflict', label: 'Conflict', wrap: true, render: (r) => r.conflicts.length ? <Badge tone="bad">conflict</Badge> : <span style={{ color: T.ink50 }}>—</span> }
              ]}
              rows={data.list.map((r, i) => ({ ...r, _key: `${r.puzzleId}-${r.recipientIndex}` }))}
              searchKeys={['puzzleId', 'recipientName', 'state']}
              emptyText="No recipient records for this scope."
            />
          </Card>
          <p style={{ marginTop: 12, fontSize: 12.5, color: T.ink50 }}>
            A solved or opened recipient is authoritative even when the provider never confirmed delivery — that is shown as “Unconfirmed” tracking, not a conflict. Only logically impossible data (e.g. solved before created) is flagged as a conflict.
          </p>
        </>
      )}
    </>
  );
}

function RevealLinks() {
  const { data, loading, error } = useAdminData(() => adminLegacyGet('/reveal-links'));
  const [copiedKey, setCopiedKey] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [note, setNote] = useState('');

  const copyLink = async (r) => {
    const key = `${r.puzzleId}-${r.recipientIndex}`;
    setBusyKey(key); setNote('');
    try {
      const res = await adminLegacyPost(`/reveal-links/${r.puzzleId}/${r.recipientIndex}/copy`);
      if (res && res.link) {
        try { await navigator.clipboard.writeText(res.link); } catch (e) { /* clipboard may be blocked */ }
        setCopiedKey(key); setTimeout(() => setCopiedKey(''), 2500);
      }
    } catch (e) { setNote('Could not fetch reveal link.'); } finally { setBusyKey(''); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>
        Secure reveal links are generated only when you press Copy (never exposed in bulk). Each copy is recorded in the audit log.
      </div>
      {note && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{note}</div>}
      <DataTable
        columns={[
          { key: 'publicId', label: 'Public ID', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.publicId}</span> },
          { key: 'senderName', label: 'Sender' },
          { key: 'recipientName', label: 'Recipient' },
          { key: 'deliveryStatus', label: 'Status', render: (r) => <Badge tone={r.completedAt ? 'good' : 'neutral'}>{r.completedAt ? 'solved' : r.deliveryStatus}</Badge> },
          { key: 'copy', label: '', render: (r) => {
            const key = `${r.puzzleId}-${r.recipientIndex}`;
            return <Button size="sm" tone="gold" disabled={busyKey === key} onClick={() => copyLink(r)}>{copiedKey === key ? 'Copied ✓' : busyKey === key ? '…' : 'Copy link'}</Button>;
          } }
        ]}
        rows={data.list.map((r, i) => ({ ...r, _key: `${r.puzzleId}-${r.recipientIndex}` }))}
        searchKeys={['publicId', 'senderName', 'recipientName', 'deliveryStatus']}
        pageSize={20}
        emptyText="No reveal links."
      />
    </Card>
  );
}

const EXPLAIN =
  'A read-only control tower for deliveries plus secure reveal-link tools. Recipient Status reads existing delivery/opened/solved states (Solved > Opened > Delivered > Sent > Pending) and never changes live records. Reveal Links lets you fetch and copy a recipient’s secure link on demand. Default scope is recipients on completed/paid orders.';
