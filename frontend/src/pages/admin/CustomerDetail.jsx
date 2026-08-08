import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader, Card, StatGrid, StatTile, DataTable, Badge, Button, Modal, Loading, ErrorNote, useAdminData, adminGet, adminPost, adminDelete, formatBHD, formatMoney, formatDate, T } from './adminShared';

const stateTone = (s) => (s === 'solved' ? 'good' : s === 'opened' ? 'warn' : 'neutral');

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [reload, setReload] = useState(0);
  const [action, setAction] = useState(null); // 'archive' | 'delete' | 'restore'
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const { data, loading, error } = useAdminData(() => adminGet(`/customers/${customerId}`), [customerId, reload]);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const { customer, totals, sales, paidHistory, failedAttempts } = data;
  const isPaying = totals.completedOrders > 0;

  const runAction = async () => {
    setBusy(true); setMsg('');
    try {
      if (action === 'archive') await adminPost(`/customers/${customerId}/archive`);
      else if (action === 'restore') await adminPost(`/customers/${customerId}/restore`);
      else if (action === 'delete') {
        await adminDelete(`/customers/${customerId}`);
        navigate('/admin/customers', { replace: true });
        return;
      }
      setAction(null); setReload((n) => n + 1);
    } catch (e) {
      setMsg((e.response && e.response.data && e.response.data.error) || 'Action failed.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <button onClick={() => navigate('/admin/customers')} style={backBtn}>← All customers</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <PageHeader title={customer.name || 'Customer'} explain={`Full history for ${customer.customerId}. All figures in BHD.`} />
        <div style={{ display: 'flex', gap: 8 }}>
          {customer.isArchived
            ? <Button tone="gold" onClick={() => setAction('restore')}>Restore</Button>
            : (<>
                <Button onClick={() => setAction('archive')}>Archive</Button>
                {!isPaying && <Button tone="danger" onClick={() => setAction('delete')}>Delete test customer</Button>}
              </>)}
        </div>
      </div>

      <StatGrid min={170}>
        <StatTile label="Customer ID" value={customer.customerId} />
        <StatTile label="Completed orders" value={totals.completedOrders} tone={isPaying ? 'good' : undefined} />
        <StatTile label="Abandoned" value={totals.abandonedCheckouts} />
        <StatTile label="Paid puzzles" value={totals.paidPuzzles} />
        <StatTile label="Total spend" value={formatBHD(totals.totalSpendBHD)} tone="good" />
      </StatGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 20 }}>
        <Card title="Identity">
          <Row label="Phone" value={customer.primaryPhone} />
          <Row label="Country" value={customer.countryName} />
          <Row label="Email" value={customer.email || '—'} />
          <Row label="Status" value={customer.isArchived ? 'Archived' : (isPaying ? 'Paying customer' : 'No completed purchase')} />
        </Card>
        <Card title="Timeline">
          <Row label="Known since" value={formatDate(customer.createdAt)} />
        </Card>
      </div>

      <Card title="Sales (captured)" style={{ marginTop: 16 }}>
        <DataTable
          columns={[
            { key: 'saleReference', label: 'Reference' },
            { key: 'orderId', label: 'Order' },
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'display', label: 'Displayed price', render: (r) => (r.displayAmount ? formatMoney(r.displayCurrency, r.displayAmount) : '—') },
            { key: 'amountBHD', label: 'Charged (BHD)', align: 'right', render: (r) => formatBHD(r.amountBHD) }
          ]}
          rows={sales.map((s, i) => ({ ...s, _key: s.orderId || i }))}
          emptyText="No captured sales."
        />
      </Card>

      <Card title={`Paid puzzle history (${paidHistory.length})`} style={{ marginTop: 16 }}>
        {paidHistory.length === 0 ? <div style={{ color: T.ink50, fontSize: 13.5, padding: 12 }}>No paid puzzles.</div>
          : paidHistory.map((h) => <PuzzleRow key={h.publicId} h={h} />)}
      </Card>

      {failedAttempts.length > 0 && (
        <Card title={`Failed / abandoned attempts (${failedAttempts.length})`} subtitle="Preserved for reference — not counted as completed puzzles" style={{ marginTop: 16 }}>
          {failedAttempts.map((h) => <PuzzleRow key={h.publicId} h={h} muted />)}
        </Card>
      )}

      {action && (
        <Modal title={action === 'delete' ? 'Delete test customer' : action === 'archive' ? 'Archive customer' : 'Restore customer'} onClose={() => !busy && setAction(null)}>
          <p style={{ fontSize: 14, color: T.ink66, lineHeight: 1.6 }}>
            {action === 'delete' && 'This removes the customer profile and disconnects eligible unpaid test activity from this phone number. Paid and financial records are never deleted.'}
            {action === 'archive' && 'The customer will be hidden from default lists but remains under the Archived filter with a Restore option. Financial and order history is preserved.'}
            {action === 'restore' && 'The customer will be returned to active lists.'}
          </p>
          {msg && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setAction(null)} disabled={busy}>Cancel</Button>
            <Button tone={action === 'delete' ? 'danger' : 'primary'} onClick={runAction} disabled={busy}>{busy ? 'Working…' : action === 'delete' ? 'Delete customer' : 'Confirm'}</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function PuzzleRow({ h, muted }) {
  return (
    <div style={{ borderBottom: `1px solid ${T.ink08}`, padding: '12px 0', opacity: muted ? 0.75 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><span style={{ fontWeight: 700 }}>{h.occasion || 'Puzzle'}</span><span style={{ color: T.ink50, fontSize: 12.5, marginLeft: 8 }}>{formatDate(h.createdAt)} · {h.recipientCount} recipient{h.recipientCount === 1 ? '' : 's'}</span></div>
        <Badge tone={muted ? 'neutral' : 'good'}>{h.status}</Badge>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {h.recipients.map((r, i) => <span key={i} style={{ fontSize: 12.5, color: T.ink66 }}>{r.name} <Badge tone={stateTone(r.state)}>{r.state}</Badge></span>)}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5 }}><span style={{ color: T.ink50 }}>{label}</span><span style={{ color: T.ink, fontWeight: 500, textAlign: 'right' }}>{value}</span></div>);
}
const backBtn = { border: 'none', background: 'none', color: T.goldDeep, fontSize: 13.5, cursor: 'pointer', padding: 0, marginBottom: 8 };
