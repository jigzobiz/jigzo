import React, { useState } from 'react';
import { PageHeader, Card, StatGrid, StatTile, DataTable, BarList, Badge, Loading, ErrorNote, useAdminData, adminGet, formatBHD, formatDate, T } from './adminShared';
import Reconciliation from './Reconciliation';

const TABS = ['Overview', 'Sales', 'Expenses', 'Reconciliation'];

export default function FinanceOverview() {
  const [tab, setTab] = useState('Overview');
  return (
    <>
      <PageHeader title="Finance" explain={EXPLAIN} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 999, border: T.border, cursor: 'pointer', fontSize: 13.5, fontWeight: tab === t ? 700 : 500,
            background: tab === t ? T.ink : T.card, color: tab === t ? T.bg : T.ink66
          }}>{t}</button>
        ))}
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
  const { data, loading, error } = useAdminData(() => adminGet('/finance/sales'));
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: T.ink66, marginBottom: 12 }}>
        {data.capturedCount} captured sale{data.capturedCount === 1 ? '' : 's'} · total {formatBHD(data.totalBHD)}
      </div>
      <DataTable
        columns={[
          { key: 'saleReference', label: 'Reference' },
          { key: 'customerName', label: 'Customer' },
          { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
          { key: 'originalAmount', label: 'Original', render: (r) => `${r.originalAmount} ${r.originalCurrency}` },
          { key: 'netAmountBHD', label: 'BHD', align: 'right', sortable: true, render: (r) => formatBHD(r.netAmountBHD) },
          { key: 'paymentStatus', label: 'Status', render: (r) => <Badge tone={r.paymentStatus === 'captured' ? 'good' : r.paymentStatus === 'refunded' ? 'warn' : 'bad'}>{r.paymentStatus}</Badge> },
          { key: 'reconciliationStatus', label: 'Reconciliation' }
        ]}
        rows={data.list.map((s, i) => ({ ...s, _key: s.saleReference || i }))}
        searchKeys={['saleReference', 'customerName', 'orderId']}
        emptyText="No sales recorded."
      />
    </Card>
  );
}

function ExpensesTab() {
  const { data, loading, error } = useAdminData(() => adminGet('/finance/expenses'));
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 14, color: T.ink, marginBottom: 12, fontWeight: 600 }}>
        {data.count} expenses · total {formatBHD(data.totalBHD)}
      </div>
      <DataTable
        columns={[
          { key: 'expenseId', label: 'ID' },
          { key: 'date', label: 'Date', sortable: true, render: (r) => formatDate(r.date) },
          { key: 'category', label: 'Category', sortable: true },
          { key: 'vendor', label: 'Vendor', sortable: true },
          { key: 'description', label: 'Description', wrap: true },
          { key: 'originalAmount', label: 'Original', align: 'right', render: (r) => `${r.originalAmount} ${r.currency}` },
          { key: 'amountBHD', label: 'BHD', align: 'right', sortable: true, render: (r) => formatBHD(r.amountBHD) },
          { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'Paid' ? 'good' : 'neutral'}>{r.status}</Badge> }
        ]}
        rows={data.list.map((e, i) => ({ ...e, _key: e.expenseId || i }))}
        searchKeys={['expenseId', 'category', 'vendor', 'description', 'currency']}
        pageSize={20}
        emptyText="No expenses recorded."
      />
    </Card>
  );
}

const EXPLAIN =
  'The money view. Overview shows total sales, total expenses and the net result in BHD. Sales lists captured payments (with the original charge currency preserved on each row). Expenses lists every recorded cost. Reconciliation matches JIGZO figures against provider settlements. All totals are single-currency BHD with three decimals.';
