import React from 'react';
import { PageHeader, Card, StatTile, StatGrid, BarList, Loading, ErrorNote, EmptyState, useAdminData, adminGet, formatBHD, T } from './adminShared';

export default function Home() {
  const { data, loading, error } = useAdminData(() => adminGet('/home'));

  if (loading) return <><PageHeader title="Home" explain={EXPLAIN} /><Loading /></>;
  if (error) return <><PageHeader title="Home" explain={EXPLAIN} /><ErrorNote error={error} /></>;

  const { totals, counts, charts } = data;

  return (
    <>
      <PageHeader title="Home" explain={EXPLAIN} />

      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.goldDeep, fontWeight: 700, marginBottom: 10 }}>Money (all in BHD)</div>
      <StatGrid min={200}>
        <StatTile label="Sales" value={formatBHD(totals.salesBHD)} hint={`${totals.capturedSales} captured sale${totals.capturedSales === 1 ? '' : 's'}`} tone="good" />
        <StatTile label="Expenses" value={formatBHD(totals.expensesBHD)} hint={`${totals.expenseCount} recorded expenses`} tone="bad" />
        <StatTile label="Net result" value={formatBHD(totals.netBHD)} hint="Sales minus expenses" tone={Number(totals.netBHD) >= 0 ? 'good' : 'bad'} />
      </StatGrid>

      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.goldDeep, fontWeight: 700, margin: '24px 0 10px' }}>Operations</div>
      <StatGrid min={170}>
        <StatTile label="Orders" value={counts.orders} hint="Paid & pending orders" />
        <StatTile label="Puzzles" value={counts.puzzles} hint="Recipient puzzles created" />
        <StatTile label="Customers" value={counts.customers} hint="Known customers" />
      </StatGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 24 }}>
        <Card title="Expenses by category" subtitle="Where the money has gone (BHD)">
          {charts.expensesByCategory.length ? (
            <BarList data={charts.expensesByCategory.map((c) => ({ label: c.category, value: c.amountBHD }))} valueFormat={formatBHD} />
          ) : <EmptyState>No expense data.</EmptyState>}
        </Card>
        <Card title="Expense trend" subtitle="Total expenses per month (BHD)">
          {charts.expenseTrend.length ? (
            <BarList data={charts.expenseTrend.map((c) => ({ label: c.month, value: c.amountBHD }))} valueFormat={formatBHD} />
          ) : <EmptyState>No dated expenses.</EmptyState>}
        </Card>
      </div>

      <p style={{ marginTop: 20, fontSize: 12.5, color: T.ink50 }}>
        All monetary figures are shown in Bahraini Dinar (BHD) with three decimals. Sales and expenses are never mixed with other currencies in a total.
      </p>
    </>
  );
}

const EXPLAIN =
  'A plain-language snapshot of the whole business from live production data: how much you have sold, how much you have spent, the net result, and how many orders, puzzles and customers exist. Use it as your daily starting point.';
