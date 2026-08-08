import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Card, DataTable, Badge, Button, Modal, Loading, ErrorNote, useAdminData, adminGet, adminDelete, formatBHD, formatDate, T } from './adminShared';

const statusTone = (s) => (s === 'Paying customer' ? 'good' : s === 'Abandoned checkout' ? 'warn' : s.startsWith('Archived') ? 'neutral' : 'neutral');

export default function Customers() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('active');
  const [reload, setReload] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const { data, loading, error } = useAdminData(() => adminGet(`/customers?filter=${filter}`), [filter, reload]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true); setActionError(''); setSuccess('');
    try {
      await adminDelete(`/customers/${deleteTarget.customerId}`);
      setDeleteTarget(null);
      setSuccess('Test customer deleted and unpaid history disconnected.');
      setReload((value) => value + 1);
    } catch (requestError) {
      const response = requestError.response && requestError.response.data;
      setActionError(response && response.code === 'CUSTOMER_HAS_PAID_HISTORY'
        ? 'Customers with payment history cannot be permanently deleted.'
        : (response && response.error) || 'Delete failed.');
    } finally { setDeleting(false); }
  };

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
    { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: 'actions', label: 'Actions', render: (r) => (
      r.completedOrders === 0 && Number(r.totalSpendBHD) === 0
        ? <span onClick={(event) => event.stopPropagation()}><Button tone="danger" size="sm" onClick={() => { setActionError(''); setDeleteTarget(r); }}>Delete</Button></span>
        : <span style={{ color: T.ink50 }}>—</span>
    ) }
  ];

  return (
    <>
      <PageHeader title="Customers" explain={EXPLAIN} />
      {success && <div role="status" style={{ color: T.green, background: T.greenBg, padding: '9px 12px', borderRadius: 9, fontSize: 13, marginBottom: 12 }}>{success}</div>}
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
      {deleteTarget && (
        <Modal title="Delete this test customer?" onClose={() => !deleting && setDeleteTarget(null)}>
          <p style={{ fontSize: 14, color: T.ink66, lineHeight: 1.6 }}>
            This removes the customer profile and disconnects eligible unpaid test activity from this phone number. Paid and financial records are never deleted.
          </p>
          {actionError && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{actionError}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button tone="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete customer'}</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

const EXPLAIN =
  'Everyone who entered their sender details in the create/checkout flow, identified by phone (the primary identity). A customer can exist before paying (abandoned checkout). Waitlist-only emails are NOT customers — they live under Growth. Completed counts only captured payments; total spend is the actual BHD charged. Click a row for full history and archive/delete.';
