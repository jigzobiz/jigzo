import React from 'react';
import { PageHeader, Card, StatGrid, StatTile, DataTable, Badge, Loading, ErrorNote, useAdminData, adminGet, formatDate, T } from './adminShared';

const stateTone = (s) => (s === 'solved' ? 'good' : s === 'opened' ? 'warn' : s === 'delivered' ? 'neutral' : 'neutral');

export default function DeliveryCentre() {
  const { data, loading, error } = useAdminData(() => adminGet('/delivery'));

  if (loading) return <><PageHeader title="Delivery Centre" explain={EXPLAIN} /><Loading /></>;
  if (error) return <><PageHeader title="Delivery Centre" explain={EXPLAIN} /><ErrorNote error={error} /></>;

  const { summary, list } = data;
  const rows = list.map((r, i) => ({ ...r, _key: `${r.puzzleId}-${r.recipientIndex}`, conflictText: r.conflicts.join(' ') }));
  const conflicts = rows.filter((r) => r.conflicts.length);

  const columns = [
    { key: 'puzzleId', label: 'Puzzle', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.puzzleId}</span> },
    { key: 'recipientName', label: 'Recipient' },
    { key: 'deliveryMethod', label: 'Channel' },
    { key: 'state', label: 'State', sortable: true, render: (r) => <Badge tone={stateTone(r.state)}>{r.state}</Badge> },
    { key: 'deliveryStatus', label: 'Delivery status' },
    { key: 'openedAt', label: 'Opened', render: (r) => formatDate(r.openedAt) },
    { key: 'completedAt', label: 'Solved', render: (r) => formatDate(r.completedAt) },
    { key: 'conflictText', label: 'Conflict', wrap: true, render: (r) => r.conflicts.length ? <Badge tone="bad">conflict</Badge> : <span style={{ color: T.ink50 }}>—</span> }
  ];

  return (
    <>
      <PageHeader title="Delivery Centre" explain={EXPLAIN} />

      <StatGrid min={150}>
        <StatTile label="Total" value={summary.total} />
        <StatTile label="Pending" value={summary.pending} />
        <StatTile label="Delivered" value={summary.delivered} />
        <StatTile label="Opened" value={summary.opened} tone="neutral" />
        <StatTile label="Solved" value={summary.solved} tone="good" />
        <StatTile label="Conflicts" value={summary.conflicts} tone={summary.conflicts ? 'bad' : 'good'} />
      </StatGrid>

      {conflicts.length > 0 && (
        <Card title="Data conflicts" subtitle="Where delivery, open and solved states disagree. These records are shown for review only and are never modified here." style={{ marginTop: 20 }}>
          {conflicts.map((r) => (
            <div key={r._key} style={{ borderBottom: `1px solid ${T.ink08}`, padding: '10px 0', fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>{r.recipientName}</span>
              <span style={{ color: T.ink50, marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{r.puzzleId}</span>
              <div style={{ color: T.red, marginTop: 4 }}>{r.conflicts.join(' ')}</div>
            </div>
          ))}
        </Card>
      )}

      <Card style={{ marginTop: 20, padding: 16 }}>
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={['puzzleId', 'recipientName', 'state', 'deliveryStatus']}
          emptyText="No recipient records found."
        />
      </Card>
    </>
  );
}

const EXPLAIN =
  'A read-only control tower for deliveries. It reads the existing delivery, opened and solved states for every recipient puzzle and never changes live records. Where the underlying data sources disagree (for example, marked solved but never opened), the conflict is surfaced for you to investigate.';
