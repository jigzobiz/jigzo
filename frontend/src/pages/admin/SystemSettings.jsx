import React from 'react';
import { PageHeader, Card, DataTable, Badge, Loading, ErrorNote, useAdminData, adminGet, formatDate, T } from './adminShared';

const svcTone = (s) => (s === 'enabled' || s === 'configured' ? 'good' : s === 'disabled' ? 'neutral' : 'warn');

export default function SystemSettings() {
  const { data, loading, error } = useAdminData(() => adminGet('/system'));
  if (loading) return <><PageHeader title="System" explain={EXPLAIN} /><Loading /></>;
  if (error) return <><PageHeader title="System" explain={EXPLAIN} /><ErrorNote error={error} /></>;

  const { services, expenseReferenceRates, liveCheckoutPricing, categories, vendors, auditLogs } = data;

  return (
    <>
      <PageHeader title="System" explain={EXPLAIN} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Card title="Service status">
          {services.map((s) => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 13.5, borderBottom: `1px solid ${T.ink08}` }}>
              <span style={{ color: T.ink74 }}>{s.name}</span>
              <Badge tone={svcTone(s.status)}>{s.status}</Badge>
            </div>
          ))}
        </Card>

        <Card title="Live checkout pricing" subtitle="Authoritative BHD charge engine">
          <div style={{ fontSize: 13.5, color: T.ink74, lineHeight: 1.6 }}>{liveCheckoutPricing.engine}</div>
          <div style={{ fontSize: 12.5, color: T.ink50, marginTop: 8, lineHeight: 1.6 }}>{liveCheckoutPricing.note}</div>
        </Card>
      </div>

      <Card title="Expense / reference FX rates" subtitle="Historical workbook defaults for expense records — NOT the live checkout pricing source. Editing a reference rate must never change historical sales or expenses." style={{ marginTop: 16 }}>
        <DataTable
          columns={[
            { key: 'currency', label: 'Currency', render: (r) => <span style={{ fontWeight: 700 }}>{r.currency}</span> },
            { key: 'rateToBHD', label: 'Rate → BHD', align: 'right' },
            { key: 'pegType', label: 'Peg', render: (r) => <span style={{ color: T.ink66 }}>{r.pegType}</span> },
            { key: 'pegged', label: 'Pegged', render: (r) => <Badge tone={r.pegged ? 'good' : 'neutral'}>{r.pegged ? 'pegged' : 'floating'}</Badge> },
            { key: 'source', label: 'Source' }
          ]}
          rows={expenseReferenceRates.map((f, i) => ({ ...f, _key: f.currency || i }))}
          emptyText="No FX rates."
        />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
        <Card title={`Categories (${categories.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{categories.length ? categories.map((c) => <Badge key={c}>{c}</Badge>) : <span style={{ color: T.ink50, fontSize: 13 }}>None</span>}</div>
        </Card>
        <Card title={`Vendors (${vendors.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{vendors.length ? vendors.map((v) => <Badge key={v}>{v}</Badge>) : <span style={{ color: T.ink50, fontSize: 13 }}>None</span>}</div>
        </Card>
      </div>

      <Card title="Audit log" subtitle="Most recent 100 admin & migration events" style={{ marginTop: 16 }}>
        <DataTable
          columns={[
            { key: 'timestamp', label: 'When', sortable: true, render: (r) => formatDate(r.timestamp) },
            { key: 'action', label: 'Action' },
            { key: 'targetModel', label: 'Target' },
            { key: 'reason', label: 'Detail', wrap: true }
          ]}
          rows={auditLogs.map((a, i) => ({ ...a, _key: i }))}
          searchKeys={['action', 'targetModel', 'reason']}
          pageSize={15}
          emptyText="No audit entries."
        />
      </Card>
    </>
  );
}

const EXPLAIN =
  'The technical health of JIGZO: which services are enabled, the live checkout pricing engine versus the historical expense/reference FX rates (clearly separated, with peg relationships), expense categories and vendors, and a read-only audit log of admin and migration events.';
