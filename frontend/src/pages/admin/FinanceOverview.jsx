import React, { useState, useEffect } from 'react';
import { PageHeader, Card, StatGrid, StatTile, DataTable, BarList, Badge, Button, Modal, Field, inputCss, Loading, ErrorNote, useAdminData, adminGet, adminPost, adminPut, adminDelete, formatBHD, formatMoney, formatDate, T } from './adminShared';
import Reconciliation from './Reconciliation';

const TABS = ['Overview', 'Sales', 'Expenses', 'Reconciliation'];

export default function FinanceOverview() {
  const [tab, setTab] = useState('Overview');
  return (
    <>
      <PageHeader title="Finance" explain={EXPLAIN} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => <Button key={t} tone={tab === t ? 'primary' : 'default'} size="sm" onClick={() => setTab(t)}>{t}</Button>)}
      </div>
      {tab === 'Overview' && <OverviewTab />}
      {tab === 'Sales' && <SalesTab />}
      {tab === 'Expenses' && <ExpensesTab />}
      {tab === 'Reconciliation' && <Reconciliation />}
    </>
  );
}

function OverviewTab() {
  const { data, loading, error } = useAdminData(() => adminGet('/finance/overview'));
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  return (
    <>
      <StatGrid min={200}>
        <StatTile label="Sales" value={formatBHD(data.salesBHD)} hint={`${data.capturedSaleCount} captured`} tone="good" />
        <StatTile label="Expenses" value={formatBHD(data.expensesBHD)} hint={`${data.expenseCount} expenses`} tone="bad" />
        <StatTile label="Net result" value={formatBHD(data.netBHD)} tone={Number(data.netBHD) >= 0 ? 'good' : 'bad'} />
      </StatGrid>
      <Card title="Expenses by category" subtitle="BHD" style={{ marginTop: 20, maxWidth: 620 }}>
        <BarList data={data.expensesByCategory.map((c) => ({ label: c.category, value: c.amountBHD }))} valueFormat={formatBHD} />
      </Card>
    </>
  );
}

function SalesTab() {
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const { data, loading, error } = useAdminData(() => adminGet('/finance/sales'), [reload]);
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const repair = async (orderId) => {
    setBusy(orderId); setMsg('');
    try {
      const res = await adminPost(`/finance/repair-sale/${orderId}`);
      setMsg(`Sale ${orderId} repaired: captured ${formatBHD(res.capturedBhd)} (source: ${res.source}).`);
      setReload((n) => n + 1);
    } catch (e) {
      setMsg((e.response && e.response.data && e.response.data.error) || 'Repair failed.');
    } finally { setBusy(''); }
  };

  const needsAny = data.list.some((s) => s.needsRepair);

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>{data.capturedCount} captured sale{data.capturedCount === 1 ? '' : 's'} · total {formatBHD(data.totalBHD)} · BHD figures are the amount actually captured by Tap</div>
      {needsAny && <div style={{ fontSize: 12.5, color: T.amber, background: T.amberBg, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>A captured sale has no resolvable BHD amount. Use “Repair” to confirm the captured amount from the live Tap charge (idempotent; never alters the payment).</div>}
      {msg && <div style={{ fontSize: 12.5, color: T.ink, background: T.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>{msg}</div>}
      <DataTable
        columns={[
          { key: 'saleReference', label: 'Reference' },
          { key: 'customerName', label: 'Customer' },
          { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
          { key: 'display', label: 'Displayed price', render: (r) => (r.displayAmount ? formatMoney(r.displayCurrency, r.displayAmount) : '—') },
          { key: 'amountBHD', label: 'Charged (BHD)', align: 'right', sortable: true, render: (r) => (r.needsRepair ? <Badge tone="warn">needs repair</Badge> : formatBHD(r.amountBHD)) },
          { key: 'reconciliationStatus', label: 'Reconciliation' },
          { key: 'actions', label: '', render: (r) => (r.needsRepair ? <Button size="sm" tone="gold" disabled={busy === r.orderId} onClick={() => repair(r.orderId)}>{busy === r.orderId ? '…' : 'Repair'}</Button> : null) }
        ]}
        rows={data.list.map((s, i) => ({ ...s, _key: s.orderId || i }))}
        searchKeys={['saleReference', 'customerName', 'orderId']}
        emptyText="No captured sales."
      />
    </Card>
  );
}

const EMPTY_EXPENSE = { date: '', category: '', vendor: '', description: '', originalAmount: '', currency: 'BHD', fxRateToBHD: '1.000', fxRateSource: 'manual', paymentMethod: '', paidBy: 'JIGZO', status: 'Paid', comments: '', fxRateWasOverridden: false, overrideReason: '', isRecurring: false, nextRenewalDate: '' };

function ExpensesTab() {
  const [reload, setReload] = useState(0);
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data, loading, error } = useAdminData(() => adminGet(`/finance/expenses?includeArchived=${includeArchived}`), [reload, includeArchived]);
  const [editing, setEditing] = useState(null); // expense object or 'new'
  const [confirmArchive, setConfirmArchive] = useState(null);

  const refresh = () => setReload((n) => n + 1);

  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>{data.count} expenses · total {formatBHD(data.totalBHD)}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12.5, color: T.ink66, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> Show archived
          </label>
          <Button tone="gold" size="sm" onClick={() => setEditing('new')}>+ Add expense</Button>
        </div>
      </div>
      <DataTable
        columns={[
          { key: 'expenseId', label: 'ID' },
          { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
          { key: 'category', label: 'Category', sortable: true },
          { key: 'vendor', label: 'Vendor', sortable: true },
          { key: 'description', label: 'Description', wrap: true },
          { key: 'original', label: 'Original', align: 'right', render: (r) => formatMoney(r.currency, r.originalAmount) },
          { key: 'amountBHD', label: 'BHD', align: 'right', sortable: true, render: (r) => formatBHD(r.amountBHD) },
          { key: 'status', label: 'Status', render: (r) => <Badge tone={r.isArchived ? 'neutral' : r.status === 'Paid' ? 'good' : r.status === 'Refunded' || r.status === 'Cancelled' ? 'warn' : 'neutral'}>{r.isArchived ? 'Archived' : r.status}</Badge> },
          { key: 'actions', label: '', render: (r) => (
            <div style={{ display: 'flex', gap: 6 }}>
              {r.isArchived
                ? <Button size="sm" onClick={() => adminPost(`/finance/expenses/${r.expenseId}/restore`).then(refresh)}>Restore</Button>
                : (<>
                    <Button size="sm" onClick={() => setEditing(r)}>Edit</Button>
                    <Button size="sm" onClick={() => setEditing({ ...r, expenseId: undefined, _dupOf: r.expenseId, date: '' })}>Duplicate</Button>
                    <Button size="sm" tone="danger" onClick={() => setConfirmArchive(r)}>Archive</Button>
                  </>)}
            </div>
          ) }
        ]}
        rows={data.list.map((e, i) => ({ ...e, _key: e.expenseId || i }))}
        searchKeys={['expenseId', 'category', 'vendor', 'description', 'currency']}
        pageSize={20}
        emptyText="No expenses."
      />

      {editing && <ExpenseForm expense={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {confirmArchive && (
        <Modal title="Archive expense" onClose={() => setConfirmArchive(null)} width={440}>
          <p style={{ fontSize: 14, color: T.ink66, lineHeight: 1.6 }}>Archiving soft-deletes <b>{confirmArchive.expenseId}</b> ({formatBHD(confirmArchive.amountBHD)}). Financial history is preserved and it can be restored.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setConfirmArchive(null)}>Cancel</Button>
            <Button tone="danger" onClick={() => adminDelete(`/finance/expenses/${confirmArchive.expenseId}`).then(() => { setConfirmArchive(null); refresh(); })}>Archive</Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function ExpenseForm({ expense, onClose, onSaved }) {
  const isEdit = !!(expense && expense.expenseId);
  const [f, setF] = useState(() => {
    if (!expense) return { ...EMPTY_EXPENSE };
    return {
      ...EMPTY_EXPENSE, ...expense,
      date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : '',
      originalAmount: String(expense.originalAmount || ''), fxRateToBHD: String(expense.fxRateToBHD || '1.000'),
      overrideReason: ''
    };
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const isBHD = String(f.currency).toUpperCase() === 'BHD';
  const previewBHD = (() => {
    const amt = Number(f.originalAmount); const rate = isBHD ? 1 : Number(f.fxRateToBHD);
    if (!isFinite(amt) || !isFinite(rate)) return null;
    return (amt * rate).toFixed(3);
  })();

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = { ...f, currency: String(f.currency).toUpperCase() };
      if (isEdit) await adminPut(`/finance/expenses/${expense.expenseId}`, body);
      else await adminPost('/finance/expenses', body);
      onSaved();
    } catch (e2) { setErr((e2.response && e2.response.data && e2.response.data.error) || 'Save failed.'); } finally { setBusy(false); }
  };

  return (
    <Modal title={isEdit ? `Edit ${expense.expenseId}` : 'Add expense'} onClose={() => !busy && onClose()} width={560}>
      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Date"><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} style={inputCss} required /></Field>
          <Field label="Category"><input value={f.category} onChange={(e) => set('category', e.target.value)} style={inputCss} required /></Field>
          <Field label="Vendor"><input value={f.vendor} onChange={(e) => set('vendor', e.target.value)} style={inputCss} required /></Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set('status', e.target.value)} style={inputCss}>
              {['Paid', 'Pending', 'Refunded', 'Partially Refunded', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description"><input value={f.description} onChange={(e) => set('description', e.target.value)} style={inputCss} required /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Original amount"><input type="number" step="0.000001" value={f.originalAmount} onChange={(e) => set('originalAmount', e.target.value)} style={inputCss} required /></Field>
          <Field label="Currency"><input value={f.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} style={inputCss} required /></Field>
          <Field label="FX rate → BHD"><input type="number" step="0.000001" value={isBHD ? '1.000' : f.fxRateToBHD} disabled={isBHD} onChange={(e) => set('fxRateToBHD', e.target.value)} style={{ ...inputCss, opacity: isBHD ? 0.6 : 1 }} /></Field>
        </div>
        <div style={{ background: T.bg, borderRadius: 9, padding: '10px 12px', fontSize: 13.5, color: T.ink, marginBottom: 12 }}>
          Calculated BHD: <b>{previewBHD ? `BHD ${previewBHD}` : '—'}</b>
          {!isBHD && <span style={{ color: T.ink50 }}> ({f.originalAmount || '0'} {f.currency} × {f.fxRateToBHD || '0'})</span>}
        </div>
        {!isBHD && (
          <label style={{ fontSize: 12.5, color: T.ink66, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
            <input type="checkbox" checked={f.fxRateWasOverridden} onChange={(e) => set('fxRateWasOverridden', e.target.checked)} /> Manual FX-rate override
          </label>
        )}
        {f.fxRateWasOverridden && <Field label="Reason for override (required)"><input value={f.overrideReason} onChange={(e) => set('overrideReason', e.target.value)} style={inputCss} required /></Field>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Payment method"><input value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} style={inputCss} /></Field>
          <Field label="Paid by"><input value={f.paidBy} onChange={(e) => set('paidBy', e.target.value)} style={inputCss} /></Field>
        </div>
        <label style={{ fontSize: 12.5, color: T.ink66, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
          <input type="checkbox" checked={f.isRecurring} onChange={(e) => set('isRecurring', e.target.checked)} /> Recurring expense
        </label>
        {f.isRecurring && <Field label="Next renewal date"><input type="date" value={f.nextRenewalDate || ''} onChange={(e) => set('nextRenewalDate', e.target.value)} style={inputCss} /></Field>}
        <Field label="Comments"><input value={f.comments} onChange={(e) => set('comments', e.target.value)} style={inputCss} /></Field>
        {isEdit && <div style={{ fontSize: 12, color: T.ink50, marginBottom: 10 }}>Editing records a before/after audit entry. Once saved, the historical BHD amount and rate are locked.</div>}
        {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" tone="primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}</Button>
        </div>
      </form>
    </Modal>
  );
}

const EXPLAIN =
  'The money view. Overview shows total sales, expenses and net in BHD. Sales lists captured payments with the localised displayed price and the exact BHD charged. Expenses supports full management (add, edit, duplicate, archive, restore) — non-BHD expenses show the exact BHD calculation before saving and lock the historical rate. All BHD totals are single-currency, three decimals.';
