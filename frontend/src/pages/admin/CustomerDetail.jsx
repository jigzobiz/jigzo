import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, StatGrid, StatTile, DataTable, Badge, Loading, ErrorNote, useAdminData, adminGet, formatBHD, formatDate, T } from './adminShared';

const deliveryTone = (s) => (s === 'delivered' || s === 'sent' ? 'good' : s === 'failed' ? 'bad' : 'neutral');

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useAdminData(() => adminGet(`/customers/${customerId}`), [customerId]);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const { customer, totals, sales, history } = data;

  return (
    <>
      <button onClick={() => navigate('/admin/customers')} style={backBtn}>← All customers</button>
      <PageHeader title={customer.name || 'Customer'} explain={`Full history for ${customer.customerId}. All figures in BHD.`} />

      <StatGrid min={180}>
        <StatTile label="Customer ID" value={customer.customerId} />
        <StatTile label="Orders" value={totals.orders} />
        <StatTile label="Puzzles" value={totals.puzzles} />
        <StatTile label="Total spend" value={formatBHD(totals.totalSpendBHD)} tone="good" />
      </StatGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 20 }}>
        <Card title="Identity">
          <Row label="Phone" value={customer.primaryPhone} />
          <Row label="Country" value={customer.countryName} />
          <Row label="Email" value={customer.email || '—'} />
          <Row label="Account status" value={customer.accountStatus} />
        </Card>
        <Card title="Timeline">
          <Row label="First order" value={formatDate(customer.firstOrderAt)} />
          <Row label="Latest order" value={formatDate(customer.latestOrderAt)} />
          <Row label="Known since" value={formatDate(customer.createdAt)} />
        </Card>
      </div>

      <Card title="Sales" style={{ marginTop: 16 }}>
        <DataTable
          columns={[
            { key: 'saleReference', label: 'Reference' },
            { key: 'orderId', label: 'Order' },
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'originalAmount', label: 'Original', render: (r) => `${r.originalAmount} ${r.originalCurrency}` },
            { key: 'amountBHD', label: 'BHD', align: 'right', render: (r) => formatBHD(r.amountBHD) },
            { key: 'paymentStatus', label: 'Status', render: (r) => <Badge tone={r.paymentStatus === 'captured' ? 'good' : 'neutral'}>{r.paymentStatus}</Badge> }
          ]}
          rows={sales.map((s, i) => ({ ...s, _key: s.saleReference || i }))}
          pageSize={10}
          emptyText="No sales recorded."
        />
      </Card>

      <Card title="Puzzle history" style={{ marginTop: 16 }}>
        {history.length === 0 ? (
          <div style={{ color: T.ink50, fontSize: 13.5, padding: 12 }}>No puzzles found.</div>
        ) : history.map((h) => (
          <div key={h.publicId} style={{ borderBottom: `1px solid ${T.ink08}`, padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontWeight: 700 }}>{h.occasion || 'Puzzle'}</span>
                <span style={{ color: T.ink50, fontSize: 12.5, marginLeft: 8 }}>{formatDate(h.createdAt)} · {h.recipientCount} recipient{h.recipientCount === 1 ? '' : 's'}</span>
              </div>
              <Badge>{h.status}</Badge>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {h.recipients.map((r, i) => (
                <span key={i} style={{ fontSize: 12.5, color: T.ink66 }}>
                  {r.name} <Badge tone={deliveryTone(r.deliveryStatus)}>{r.deliveryStatus}</Badge>
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5 }}>
      <span style={{ color: T.ink50 }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const backBtn = { border: 'none', background: 'none', color: T.goldDeep, fontSize: 13.5, cursor: 'pointer', padding: 0, marginBottom: 8 };
