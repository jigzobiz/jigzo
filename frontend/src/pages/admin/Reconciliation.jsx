import React from 'react';
import { Card, DataTable, Badge, StatGrid, StatTile, Loading, ErrorNote, useAdminData, adminGet, formatBHD, formatDate, T } from './adminShared';

export default function Reconciliation() {
  const { data, loading, error } = useAdminData(() => adminGet('/finance/reconciliation'));
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;

  const { batches, salesByStatus, awaiting } = data;

  return (
    <>
      <p style={{ fontSize: 13.5, color: T.ink66, margin: '0 0 16px', maxWidth: 720 }}>
        Reconciliation compares what JIGZO calculated against what the payment provider actually settled. Sales awaiting a bank statement are listed until a settlement is matched.
      </p>

      <StatGrid min={180}>
        {salesByStatus.map((s) => <StatTile key={s.status} label={s.status} value={s.count} />)}
      </StatGrid>

      <Card title="Settlement batches" style={{ marginTop: 20 }}>
        <DataTable
          columns={[
            { key: 'settlementPeriod', label: 'Period' },
            { key: 'settlementReference', label: 'Reference' },
            { key: 'totalCalculatedBHD', label: 'Calculated', align: 'right', render: (r) => formatBHD(r.totalCalculatedBHD) },
            { key: 'totalSettledBHD', label: 'Settled', align: 'right', render: (r) => formatBHD(r.totalSettledBHD) },
            { key: 'differenceBHD', label: 'Difference', align: 'right', render: (r) => formatBHD(r.differenceBHD) },
            { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'closed' || r.status === 'matched' ? 'good' : r.status === 'mismatch' ? 'bad' : 'neutral'}>{r.status}</Badge> }
          ]}
          rows={batches.map((b, i) => ({ ...b, _key: b.reconciliationId || i }))}
          emptyText="No settlement batches yet."
        />
      </Card>

      <Card title={`Awaiting statement (${awaiting.length})`} style={{ marginTop: 16 }}>
        <DataTable
          columns={[
            { key: 'saleReference', label: 'Sale reference' },
            { key: 'orderId', label: 'Order' },
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'amountBHD', label: 'Amount', align: 'right', render: (r) => formatBHD(r.amountBHD) }
          ]}
          rows={awaiting.map((a, i) => ({ ...a, _key: a.saleReference || i }))}
          emptyText="Nothing awaiting reconciliation."
        />
      </Card>
    </>
  );
}
