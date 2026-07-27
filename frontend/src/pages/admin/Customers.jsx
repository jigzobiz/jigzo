import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, DataTable, Badge, Button, Loading, ErrorNote, useAdminData, adminGet, formatBHD, formatDate, T } from './adminShared';

const statusTone = (s) => (s === 'Paying customer' ? 'good' : s === 'Abandoned checkout' ? 'warn' : s.startsWith('Archived') ? 'neutral' : 'neutral');

export default function Customers() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('active');
  const { data, loading, error } = useAdminData(() => adminGet(`/customers?filter=${filter}`), [filter]);

  const columns = [
    { key: 'customerId', label: 'Customer ID', sortable: true, render: (r) => <span style={{ fontWeight: 700 }}>{r.customerId}</span> },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'primaryPhone', label: 'Phone', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.primaryPhone || '—'}</span> },
    { key: 'countryName', label: 'Country', sortable: true },
    { key: 'email', label: 'Email', render: (r) => r.email || <span style={{ color: T.ink50 }}>—</span> },
    { key: 'completedOrders', label: 'Completed', align: 'right', sortable: true },
    { key: 'abandonedCheckouts', label: 'Abandoned', align: 'right', sortable: true },
    { key: 'paidPuzzles', label: 'Paid puzzles', align: 'right', sortable: true },
    { key: 'totalSpendBHD', label: 'Total spend', align: 'right', sortable: true, render: (r) => formatBHD(r.totalSpendBHD) },
    { key: 'latestActivity', label: 'Latest activity', sortable: true, render: (r) => formatDate(r.latestActivity) },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> }
  ];

  return (
    <>
      <PageHeader title="Customers" explain={EXPLAIN} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['active', 'archived', 'all'].map((f) => (
          <Button key={f} tone={filter === f ? 'primary' : 'default'} size="sm" onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</Button>
        ))}
      </div>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>{data.count} customer{data.count === 1 ? '' : 's'} · identified by phone · a waitlist email alone is not a customer</div>
          <DataTable
            columns={columns}
            rows={data.list.map((c) => ({ ...c, _key: c.customerId }))}
            searchKeys={['customerId', 'name', 'primaryPhone', 'countryName', 'email', 'status']}
            initialSort={{ key: 'totalSpendBHD', dir: 'desc' }}
            onRowClick={(r) => navigate(`/admin/customers/${r.customerId}`)}
          />
        </Card>
      )}
    </>
  );
}

const EXPLAIN =
  'Everyone who entered their sender details in the create/checkout flow, identified by phone (the primary identity). A customer can exist before paying (abandoned checkout). Waitlist-only emails are NOT customers — they live under Growth. Completed counts only captured payments; total spend is the actual BHD charged. Click a row for full history and archive/delete.';
