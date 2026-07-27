import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, DataTable, Loading, ErrorNote, useAdminData, adminGet, formatBHD, formatDate, T } from './adminShared';

export default function Customers() {
  const navigate = useNavigate();
  const { data, loading, error } = useAdminData(() => adminGet('/customers'));

  if (loading) return <><PageHeader title="Customers" explain={EXPLAIN} /><Loading /></>;
  if (error) return <><PageHeader title="Customers" explain={EXPLAIN} /><ErrorNote error={error} /></>;

  const rows = data.list.map((c) => ({ ...c, _key: c.customerId }));

  const columns = [
    { key: 'customerId', label: 'Customer ID', sortable: true, render: (r) => <span style={{ fontWeight: 700 }}>{r.customerId}</span> },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'primaryPhone', label: 'Phone', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.primaryPhone || '—'}</span> },
    { key: 'countryName', label: 'Country', sortable: true },
    { key: 'email', label: 'Email', render: (r) => r.email || <span style={{ color: T.ink50 }}>—</span> },
    { key: 'orderCount', label: 'Orders', align: 'right', sortable: true },
    { key: 'puzzleCount', label: 'Puzzles', align: 'right', sortable: true },
    { key: 'totalSpendBHD', label: 'Total spend', align: 'right', sortable: true, render: (r) => formatBHD(r.totalSpendBHD) }
  ];

  return (
    <>
      <PageHeader title="Customers" explain={EXPLAIN} />
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>{data.count} customer{data.count === 1 ? '' : 's'} · phone is the primary identity</div>
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={['customerId', 'name', 'primaryPhone', 'countryName', 'email']}
          initialSort={{ key: 'totalSpendBHD', dir: 'desc' }}
          onRowClick={(r) => navigate(`/admin/customers/${r.customerId}`)}
        />
      </Card>
    </>
  );
}

const EXPLAIN =
  'Every known customer, identified by their phone number (the primary identity) with a unique Customer ID. Shows name, country, email when available, how many orders and puzzles they have, and their total spend in BHD. Click a row for full history.';
