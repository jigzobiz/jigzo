import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, DataTable, Badge, Loading, ErrorNote, useAdminData, adminGet, formatBHD, formatDate, T } from './adminShared';

const payTone = (s) => (s === 'paid' ? 'good' : s === 'failed' ? 'bad' : s === 'refunded' ? 'warn' : 'neutral');

export default function Orders() {
  const navigate = useNavigate();
  const { data, loading, error } = useAdminData(() => adminGet('/orders'));

  if (loading) return <><PageHeader title="Orders & Puzzles" explain={EXPLAIN} /><Loading /></>;
  if (error) return <><PageHeader title="Orders & Puzzles" explain={EXPLAIN} /><ErrorNote error={error} /></>;

  const rows = data.list.map((o) => ({ ...o, _key: o.orderId }));
  const totalPuzzles = data.list.reduce((n, o) => n + (o.puzzleCount || 0), 0);

  const columns = [
    { key: 'orderId', label: 'Order ID', sortable: true, render: (r) => <span style={{ fontWeight: 700 }}>{r.orderId}</span> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (r) => formatDate(r.createdAt) },
    { key: 'paymentStatus', label: 'Payment', render: (r) => <Badge tone={payTone(r.paymentStatus)}>{r.paymentStatus}</Badge> },
    { key: 'puzzleCount', label: 'Puzzles', align: 'right', sortable: true, render: (r) => <span style={{ fontWeight: 700 }}>{r.puzzleCount}</span> },
    { key: 'amountBHD', label: 'Amount', align: 'right', render: (r) => (r.amountBHD ? formatBHD(r.amountBHD) : <span style={{ color: T.ink50 }}>—</span>) },
    { key: 'recipients', label: 'Recipients', wrap: true, render: (r) => (
      <span style={{ fontSize: 12.5, color: T.ink66 }}>{r.puzzles.map((p) => p.recipientName).join(', ') || '—'}</span>
    ) }
  ];

  return (
    <>
      <PageHeader title="Orders & Puzzles" explain={EXPLAIN} />
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>
          {data.count} order{data.count === 1 ? '' : 's'} · {totalPuzzles} recipient puzzle{totalPuzzles === 1 ? '' : 's'} — one order with two recipients counts as one order and two puzzles.
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={['orderId', 'puzzleId', 'paymentStatus']}
          initialSort={{ key: 'createdAt', dir: 'desc' }}
          onRowClick={(r) => navigate(`/admin/orders/${r.orderId}`)}
        />
      </Card>
    </>
  );
}

const EXPLAIN =
  'Read-only operational view of orders and the recipient-specific puzzles inside them. A single order can contain several puzzles — one per recipient — so an order for two people shows as one order and two puzzles. Includes payment summary and per-recipient delivery status.';
