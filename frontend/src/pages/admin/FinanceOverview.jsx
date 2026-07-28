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
  const [repairing, setRepairing] = useState(null); // orderId
  const [msg, setMsg] = useState('');
  const { data, loading, error } = useAdminData(() => adminGet('/finance/sales'), [reload]);
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const needsAny = data.list.some((s) => s.needsRepair);

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>{data.capturedCount} captured sale{data.capturedCount === 1 ? '' : 's'} · total {formatBHD(data.totalBHD)} · BHD figures are the gross amount captured by Tap</div>
      {needsAny && <div style={{ fontSize: 12.5, color: T.amber, background: T.amberBg, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>A captured sale has no resolvable BHD amount. Use “Repair” to review the live Tap charge and confirm the gross captured amount (idempotent; never alters the payment or Tap record).</div>}
      {msg && <div style={{ fontSize: 12.5, color: T.ink, background: T.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>{msg}</div>}
      <DataTable
        columns={[
          { key: 'saleReference', label: 'Reference' },
          { key: 'customerName', label: 'Customer' },
          { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
          { key: 'display', label: 'Displayed price', render: (r) => (r.displayAmount ? formatMoney(r.displayCurrency, r.displayAmount) : '—') },
          { key: 'amountBHD', label: 'Gross captured (BHD)', align: 'right', sortable: true, render: (r) => (r.needsRepair ? <Badge tone="warn">needs repair</Badge> : formatBHD(r.amountBHD)) },
          { key: 'reconciliationStatus', label: 'Reconciliation' },
          { key: 'actions', label: '', render: (r) => (r.needsRepair ? <Button size="sm" tone="gold" onClick={() => setRepairing(r.orderId)}>Repair</Button> : null) }
        ]}
        rows={data.list.map((s, i) => ({ ...s, _key: s.orderId || i }))}
        searchKeys={['saleReference', 'customerName', 'orderId']}
        emptyText="No captured sales."
      />
      {repairing && <RepairSaleModal orderId={repairing} onClose={() => setRepairing(null)} onDone={(m) => { setRepairing(null); setMsg(m); setReload((n) => n + 1); }} />}
    </Card>
  );
}

function RepairSaleModal({ orderId, onClose, onDone }) {
  // Manual confirmation inputs
  const [manual, setManual] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [manualChecked, setManualChecked] = useState(false); // "this is a manual BHD reporting value"
  const [reviewing, setReviewing] = useState(false);         // second review screen
  const [previewArgs, setPreviewArgs] = useState('');        // query string that drives the preview fetch
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { data, loading, error } = useAdminData(() => adminGet(`/finance/repair-sale/${orderId}/preview${previewArgs}`), [orderId, previewArgs]);

  const p = data && data.preview;

  const startReview = () => {
    const params = new URLSearchParams();
    if (manual.trim()) params.set('capturedBhd', manual.trim());
    if (reason.trim()) params.set('reason', reason.trim());
    if (evidence.trim()) params.set('evidence', evidence.trim());
    setPreviewArgs(params.toString() ? `?${params.toString()}` : '');
    setReviewing(true);
  };

  const apply = async () => {
    setBusy(true); setErr('');
    try {
      const body = { confirm: true };
      if (p.manual.required && manual.trim()) { body.capturedBhd = manual.trim(); body.reason = reason.trim(); body.evidence = evidence.trim(); }
      const res = await adminPost(`/finance/repair-sale/${orderId}`, body);
      onDone(`Sale ${orderId} repaired: BHD ${res.capturedBhd} for ${res.customer ? res.customer.name : 'customer'}${res.manual ? ' (manual confirmation)' : ` (source: ${res.source})`}.`);
    } catch (e) { setErr((e.response && e.response.data && e.response.data.error) || 'Repair failed.'); } finally { setBusy(false); }
  };

  const machineBhd = p && p.bhdEvidence && p.bhdEvidence.found;
  const manualValid = /^\d+(\.\d{1,6})?$/.test(manual.trim()) && reason.trim().length > 0 && manualChecked;

  return (
    <Modal title="Repair captured sale" onClose={() => !busy && onClose()} width={580}>
      {loading ? <Loading /> : error ? <ErrorNote error={error} /> : (
        <>
          <p style={{ fontSize: 13, color: T.ink66, marginTop: 0 }}>This records the <b>gross captured customer payment</b> in <code>capturedAmountBHD</code>. The monthly settlement figure stays empty until a Tap statement is reconciled. The order, payment and Tap record are never modified.</p>

          {/* Provider facts — each amount labelled in its own currency */}
          <div style={{ background: T.bg, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <Line label="Order ID" value={p.orderId} />
            <Line label="Customer" value={`${p.customer.name}${p.customer.customerId && p.customer.customerId !== 'Unlinked' ? ` (${p.customer.customerId})` : ''}`} />
            <Line label="Tap reference" value={p.provider.reference || '—'} />
            <Line label="Tap status" value={p.provider.status || (p.provider.reachable ? '—' : 'Tap not reachable')} ok={p.checks.statusCaptured} want="captured" />
            <Line label="Provider captured amount" value={p.provider.label || '—'} strong />
            <Line label="Displayed / local price" value={p.displayLabel || '—'} />
            <div style={{ borderTop: `1px solid ${T.ink08}`, marginTop: 8, paddingTop: 8 }}>
              {machineBhd
                ? <Line label="Actual captured payment (BHD)" value={formatBHD(p.bhdEvidence.amount)} strong badge={<Badge tone="good">from {p.bhdEvidence.fieldPath}</Badge>} />
                : <Line label="BHD reporting amount" value="Unresolved — no BHD field in the Tap charge" strong />}
            </div>
          </div>

          {/* Case B: no machine BHD -> require an explicit manual confirmation */}
          {!machineBhd && !reviewing && (
            <div style={{ border: `1px solid ${T.amberBg}`, background: T.amberBg, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Badge tone="warn">Manual confirmation</Badge>
                <span style={{ fontSize: 12.5, color: T.ink66 }}>Tap captured {p.provider.label || 'a non-BHD amount'}; enter the confirmed BHD reporting amount.</span>
              </div>
              <Field label='Confirmed captured amount, BHD (decimal string, e.g. "3.600")'>
                <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="3.600" style={inputCss} />
              </Field>
              <Field label="Reason (required)">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Confirmed from bank/Tap receipt" style={inputCss} />
              </Field>
              <Field label="Evidence / source description">
                <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Tap settlement receipt #, statement date…" style={inputCss} />
              </Field>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: T.ink74 }}>
                <input type="checkbox" checked={manualChecked} onChange={(e) => setManualChecked(e.target.checked)} style={{ marginTop: 2 }} />
                This is a manual BHD reporting value, confirmed from evidence outside the live Tap charge.
              </label>
            </div>
          )}

          {/* Second review screen before saving (manual path) */}
          {!machineBhd && reviewing && (
            <div style={{ background: T.bg, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.goldDeep, fontWeight: 700, marginBottom: 8 }}>Review before saving</div>
              <Line label="Provider captured amount" value={p.provider.label || '—'} />
              <Line label="Manually confirmed reporting amount" value={p.capturedBhd ? formatBHD(p.capturedBhd) : '—'} strong badge={<Badge tone="warn">Manual confirmation</Badge>} />
              <Line label="Reason / source" value={[p.manual.reason, p.manual.evidence].filter(Boolean).join(' — ') || '—'} />
              <Line label="Customer" value={`${p.customer.name}${p.customer.customerId !== 'Unlinked' ? ` (${p.customer.customerId})` : ''}`} />
              <Line label="Order ID" value={p.orderId} />
              <Line label="Tap reference" value={p.provider.reference || '—'} />
              {p.manualError && <div style={{ color: T.red, fontSize: 12.5, marginTop: 8 }}>{p.manualError}</div>}
            </div>
          )}

          {(machineBhd || reviewing) && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: T.ink74, margin: '8px 0 14px' }}>
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} style={{ marginTop: 3 }} />
              I confirm this is the correct captured payment for {p.customer.name} on order {p.orderId}.
            </label>
          )}

          {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={onClose} disabled={busy}>Cancel</Button>
            {!machineBhd && !reviewing && <Button tone="primary" disabled={!manualValid} onClick={startReview}>Preview</Button>}
            {(machineBhd || reviewing) && <Button tone="primary" disabled={busy || !confirmChecked || !p.capturedBhd} onClick={apply}>{busy ? 'Saving…' : 'Confirm & repair'}</Button>}
          </div>
        </>
      )}
    </Modal>
  );
}

function Line({ label, value, ok, want, strong, badge }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 13.5, gap: 10 }}>
      <span style={{ color: T.ink50 }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: strong ? 700 : 500, display: 'flex', gap: 6, alignItems: 'center', textAlign: 'right' }}>
        {value}
        {badge}
        {want !== undefined && (ok ? <Badge tone="good">✓</Badge> : <Badge tone="warn">expected {want}</Badge>)}
      </span>
    </div>
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
