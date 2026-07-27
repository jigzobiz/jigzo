import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, StatGrid, StatTile, Badge, Loading, ErrorNote, useAdminData, adminGet, formatBHD, formatDate, T } from './adminShared';

const deliveryTone = (s) => (s === 'delivered' || s === 'sent' ? 'good' : s === 'failed' ? 'bad' : 'neutral');

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useAdminData(() => adminGet(`/orders/${orderId}`), [orderId]);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const { order, payment, puzzles } = data;

  return (
    <>
      <button onClick={() => navigate('/admin/orders')} style={backBtn}>← All orders</button>
      <PageHeader title={`Order ${order.orderId}`} explain="Read-only detail: payment summary and every recipient puzzle in this order. Amounts in BHD; the original charge currency is shown too." />

      <StatGrid min={180}>
        <StatTile label="Payment" value={order.paymentStatus} tone={order.paymentStatus === 'paid' ? 'good' : 'neutral'} />
        <StatTile label="Amount (BHD)" value={payment.amountBHD ? formatBHD(payment.amountBHD) : '—'} tone="good" />
        <StatTile label="Puzzles" value={puzzles.length} />
        <StatTile label="Created" value={formatDate(order.createdAt)} />
      </StatGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 20 }}>
        <Card title="Payment summary">
          <Row label="Amount (BHD)" value={payment.amountBHD ? formatBHD(payment.amountBHD) : '—'} />
          <Row label="Original charge" value={payment.originalAmount ? `${payment.originalAmount} ${payment.originalCurrency}` : '—'} />
          <Row label="Sale reference" value={payment.saleReference || '—'} />
          <Row label="Payment status" value={payment.paymentStatus || '—'} />
          <Row label="Provider status" value={payment.providerStatus || '—'} />
        </Card>
        <Card title="Order">
          <Row label="Order ID" value={order.orderId} />
          <Row label="Puzzle ID" value={order.puzzleId} />
          <Row label="Package" value={order.packageId} />
          <Row label="Recipients" value={order.recipientCount} />
          <Row label="Paid at" value={formatDate(order.paidAt)} />
        </Card>
      </div>

      <Card title={`Puzzles in this order (${puzzles.length})`} style={{ marginTop: 16 }}>
        {puzzles.length === 0 ? (
          <div style={{ color: T.ink50, fontSize: 13.5, padding: 12 }}>No puzzle recipients found.</div>
        ) : puzzles.map((p) => (
          <div key={p.index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${T.ink08}`, padding: '12px 0' }}>
            <div>
              <span style={{ fontWeight: 700 }}>Puzzle {p.index + 1} · {p.recipientName}</span>
              <span style={{ color: T.ink50, fontSize: 12.5, marginLeft: 8 }}>via {p.deliveryMethod}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: T.ink66 }}>
              <Badge tone={deliveryTone(p.deliveryStatus)}>{p.deliveryStatus}</Badge>
              {p.openedAt && <span>opened {formatDate(p.openedAt)}</span>}
              {p.completedAt && <Badge tone="good">solved</Badge>}
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
