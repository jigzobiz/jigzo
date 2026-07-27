import React from 'react';
import { PageHeader, Card, StatGrid, StatTile, DataTable, Badge, Loading, ErrorNote, useAdminData, adminGet, formatDate, T } from './adminShared';

const contactTone = (s) => (s === 'converted' ? 'good' : s === 'contacted' ? 'warn' : s === 'ignored' ? 'neutral' : 'neutral');

export default function Growth() {
  const { data, loading, error } = useAdminData(() => adminGet('/growth'));
  if (loading) return <><PageHeader title="Growth" explain={EXPLAIN} /><Loading /></>;
  if (error) return <><PageHeader title="Growth" explain={EXPLAIN} /><ErrorNote error={error} /></>;

  const { count, byContactStatus, list } = data;

  return (
    <>
      <PageHeader title="Growth" explain={EXPLAIN} />
      <StatGrid min={160}>
        <StatTile label="Waitlist total" value={count} />
        {byContactStatus.map((s) => <StatTile key={s.status} label={s.status} value={s.count} />)}
      </StatGrid>
      <Card style={{ marginTop: 20, padding: 16 }}>
        <DataTable
          columns={[
            { key: 'email', label: 'Email', render: (r) => r.email || <span style={{ color: T.ink50 }}>—</span> },
            { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
            { key: 'country', label: 'Country' },
            { key: 'createdAt', label: 'Joined', sortable: true, render: (r) => formatDate(r.createdAt) },
            { key: 'contactStatus', label: 'Contact status', render: (r) => <Badge tone={contactTone(r.contactStatus)}>{r.contactStatus}</Badge> },
            { key: 'lastContactedDate', label: 'Last contacted', render: (r) => formatDate(r.lastContactedDate) },
            { key: 'converted', label: 'Converted', render: (r) => r.converted ? <Badge tone="good">yes</Badge> : <span style={{ color: T.ink50 }}>no</span> }
          ]}
          rows={list.map((r, i) => ({ ...r, _key: r.id || i }))}
          searchKeys={['email', 'phone', 'country', 'contactStatus']}
          pageSize={20}
          emptyText="No waitlist entries."
        />
      </Card>
      <p style={{ marginTop: 14, fontSize: 12.5, color: T.ink50 }}>
        The original waitlist is read only here. Contact status and notes come from a separate admin metadata store, so viewing this page never changes signup records.
      </p>
    </>
  );
}

const EXPLAIN =
  'The people who signed up to hear about JIGZO. Shows the existing waitlist together with admin-only follow-up metadata (contact status, last contacted, whether they converted) held in a separate collection. The original waitlist records are never written to from here.';
