import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, DataTable, Badge, Button, Loading, ErrorNote, useAdminData, adminGet, formatBHD, formatMoney, formatDate, T } from './adminShared';

const payTone = (s) => (s === 'paid' ? 'good' : s === 'failed' ? 'bad' : s === 'refunded' ? 'warn' : 'neutral');
const TABS = [{ id: 'completed', label: 'Completed Orders' }, { id: 'abandoned', label: 'Abandoned / Incomplete' }, { id: 'all', label: 'All Activity' }];

export default function Orders() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('completed');
  const { data, loading, error } = useAdminData(() => adminGet(`/orders?status=${status}`), [status]);

  const columns = [
    { key: 'orderId', label: 'Order ID', sortable: true, render: (r) => <span style={{ fontWeight: 700 }}>{r.orderId}</span> },
    { key: 'createdAt', label: 'Created', sortable: true, render: (r) => formatDate(r.createdAt) },
    { key: 'paymentStatus', label: 'Payment', render: (r) => <Badge tone={payTone(r.paymentStatus)}>{r.paymentStatus}</Badge> },
    { key: 'puzzleCount', label: status === 'completed' ? 'Paid puzzles' : 'Puzzles', align: 'right', sortable: true, render: (r) => <span style={{ fontWeight: 700 }}>{r.puzzleCount}</span> },
    { key: 'display', label: 'Displayed price', render: (r) => (r.displayAmount ? formatMoney(r.displayCurrency, r.displayAmount) : '—') },
    { key: 'amountBHD', label: 'Charged (BHD)', align: 'right', render: (r) => (r.amountBHD ? formatBHD(r.amountBHD) : <span style={{ color: T.ink50 }}>—</span>) },
    { key: 'recipients', label: 'Recipients', wrap: true, render: (r) => <span style={{ fontSize: 12.5, color: T.ink66 }}>{r.recipients.join(', ') || '—'}</span> }
  ];

  return (
    <>
      <PageHeader title="Orders & Puzzles" explain={EXPLAIN} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Button key={t.id} tone={status === t.id ? 'primary' : 'default'} size="sm" onClick={() => setStatus(t.id)}>
            {t.label}{data && data.counts ? ` (${data.counts[t.id]})` : ''}
          </Button>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>
            {status === 'completed' && 'Only captured, paid orders. One paid order with five recipients = 1 order and 5 puzzles.'}
            {status === 'abandoned' && 'Checkout attempts that never captured payment. These are not counted as orders in business metrics.'}
            {status === 'all' && 'Every order record regardless of payment status.'}
          </div>
          <DataTable
            columns={columns}
            rows={data.list.map((o) => ({ ...o, _key: o.orderId }))}
            searchKeys={['orderId', 'puzzleId', 'paymentStatus']}
            initialSort={{ key: 'createdAt', dir: 'desc' }}
            onRowClick={(r) => navigate(`/admin/orders/${r.orderId}`)}
            emptyText={status === 'completed' ? 'No completed orders.' : 'None.'}
          />
        </Card>
      )}
    </>
  );
}

const EXPLAIN =
  'Read-only view of orders and the recipient-specific puzzles inside them. Only captured/paid orders are completed orders — pending, failed and abandoned checkout attempts are separated into their own tab and never inflate business metrics. Displayed price shows the localised amount; charged shows the exact BHD captured.';
