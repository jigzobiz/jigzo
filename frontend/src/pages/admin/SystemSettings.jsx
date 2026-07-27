import React from 'react';
import { PageHeader, Card, DataTable, Badge, Loading, ErrorNote, useAdminData, adminGet, formatDate, T } from './adminShared';

const svcTone = (s) => (s === 'enabled' || s === 'configured' ? 'good' : s === 'disabled' ? 'neutral' : 'warn');

export default function SystemSettings() {
  const { data, loading, error } = useAdminData(() => adminGet('/system'));
  if (loading) return <><PageHeader title="System" explain={EXPLAIN} /><Loading /></>;
  if (error) return <><PageHeader title="System" explain={EXPLAIN} /><ErrorNote error={error} /></>;

  const { services, fxRates, categories, vendors, auditLogs } = data;

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

        <Card title="FX rates" subtitle="Reference rates to BHD">
          <DataTable
            columns={[
              { key: 'currency', label: 'Currency' },
              { key: 'rateToBHD', label: 'Rate → BHD', align: 'right' },
              { key: 'isPegged', label: 'Pegged', render: (r) => r.isPegged ? 'yes' : 'no' },
              { key: 'source', label: 'Source' }
            ]}
            rows={fxRates.map((f, i) => ({ ...f, _key: f.currency || i }))}
            emptyText="No FX rates."
          />
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 16 }}>
        <Card title={`Categories (${categories.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {categories.length ? categories.map((c) => <Badge key={c}>{c}</Badge>) : <span style={{ color: T.ink50, fontSize: 13 }}>None</span>}
          </div>
        </Card>
        <Card title={`Vendors (${vendors.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {vendors.length ? vendors.map((v) => <Badge key={v}>{v}</Badge>) : <span style={{ color: T.ink50, fontSize: 13 }}>None</span>}
          </div>
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
  'The technical health of JIGZO in one place: which services are enabled (checkout, WhatsApp, email), the reference FX rates used to convert to BHD, the expense categories and vendors, and a read-only audit log of admin and migration events.';
