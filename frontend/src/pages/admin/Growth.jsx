import React, { useState, useMemo } from 'react';
import { PageHeader, Card, StatGrid, StatTile, Badge, Button, Modal, Field, inputCss, Loading, ErrorNote, useAdminData, adminGet, adminLegacyPost, formatDate, T } from './adminShared';

const contactTone = (s) => (s === 'converted' ? 'good' : s === 'contacted' ? 'warn' : 'neutral');

export default function Growth() {
  const [reload, setReload] = useState(0);
  const { data, loading, error } = useAdminData(() => adminGet('/growth'), [reload]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState({});
  const [compose, setCompose] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return data.list.filter((r) => {
      if (!q) return true;
      if ([r.email, r.phone, r.country, r.contactStatus, r.signupSource, r.interestType, r.linkedCustomerId].some((v) => String(v || '').toLowerCase().includes(q))) return true;
      if (qDigits.length >= 3 && String(r.phone || '').replace(/\D/g, '').includes(qDigits)) return true;
      return false;
    });
  }, [data, query]);

  if (loading) return <><PageHeader title="Growth" explain={EXPLAIN} /><Loading /></>;
  if (error) return <><PageHeader title="Growth" explain={EXPLAIN} /><ErrorNote error={error} /></>;

  const selectableFiltered = filtered.filter((r) => r.email);
  const allSelected = selectableFiltered.length > 0 && selectableFiltered.every((r) => selected[r.id]);
  const toggleAll = () => {
    if (allSelected) setSelected({});
    else { const next = {}; selectableFiltered.forEach((r) => { next[r.id] = true; }); setSelected(next); }
  };
  const selectedRows = filtered.filter((r) => selected[r.id] && r.email);

  return (
    <>
      <PageHeader title="Waitlist & Interest Signups" explain={EXPLAIN} />
      <StatGrid min={160}>
        <StatTile label="Total signups" value={data.count} />
        {data.byContactStatus.map((s) => <StatTile key={s.status} label={s.status} value={s.count} />)}
        {data.duplicateEmails > 0 && <StatTile label="Duplicate emails" value={data.duplicateEmails} tone="warn" />}
      </StatGrid>
      {data.bySource && data.bySource.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {data.bySource.map((s) => <Badge key={s.source}>{s.source}: {s.count}</Badge>)}
        </div>
      )}

      <Card style={{ marginTop: 20, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" style={{ ...inputCss, maxWidth: 280 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: T.ink66 }}>{selectedRows.length} selected</span>
            <Button tone="gold" size="sm" disabled={selectedRows.length === 0} onClick={() => setCompose(true)}>Send email to selected</Button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>
                <th style={th}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                {['Email', 'Phone', 'Country', 'Signup source', 'Interest type', 'Joined', 'Contact status', 'Last contacted', 'Linked customer', 'Converted'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: T.ink50 }}>No signup entries.</td></tr>
                : filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={td}><input type="checkbox" disabled={!r.email} checked={!!selected[r.id]} onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} /></td>
                    <td style={td}>{r.email || <span style={{ color: T.ink50 }}>—</span>}{r.isDuplicate && <Badge tone="warn">duplicate</Badge>}</td>
                    <td style={td}>{r.phone || '—'}</td>
                    <td style={td}>{r.country || '—'}</td>
                    <td style={td}>{r.signupSource}</td>
                    <td style={td}>{r.interestType || <span style={{ color: T.ink50 }}>—</span>}</td>
                    <td style={td}>{formatDate(r.createdAt)}</td>
                    <td style={td}><Badge tone={contactTone(r.contactStatus)}>{r.contactStatus}</Badge></td>
                    <td style={td}>{formatDate(r.lastContactedDate)}</td>
                    <td style={td}>{r.linkedCustomerId || <span style={{ color: T.ink50 }}>—</span>}</td>
                    <td style={td}>{r.converted ? <Badge tone="good">yes</Badge> : <span style={{ color: T.ink50 }}>no</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p style={{ marginTop: 14, fontSize: 12.5, color: T.ink50 }}>
        The original waitlist is read-only here; contact status/notes come from a separate admin metadata store. Sending records each recipient in the audit log and skips anyone already marked sent, so repeated clicks never double-send.
      </p>

      {compose && <ComposeModal rows={selectedRows} onClose={() => setCompose(false)} onDone={() => { setCompose(false); setSelected({}); setReload((n) => n + 1); }} />}
    </>
  );
}

function ComposeModal({ rows, onClose, onDone }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState(null); // { sent, skipped, failed }

  const send = async () => {
    setSending(true);
    let sent = 0, skipped = 0, failed = 0;
    for (const r of rows) {
      if (r.contactStatus === 'contacted' || r.contactStatus === 'converted') { skipped++; continue; } // idempotent skip
      try {
        await adminLegacyPost(`/notifications/${r.id}/send`, { subject, message });
        sent++;
      } catch (e) { failed++; }
    }
    setReport({ sent, skipped, failed });
    setSending(false);
  };

  return (
    <Modal title={report ? 'Send report' : `Send email to ${rows.length} contact${rows.length === 1 ? '' : 's'}`} onClose={() => !sending && onClose()} width={560}>
      {report ? (
        <>
          <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.8 }}>
            <div>✅ Sent: <b>{report.sent}</b></div>
            <div>⏭️ Skipped (already contacted): <b>{report.skipped}</b></div>
            <div>⚠️ Failed: <b style={{ color: report.failed ? T.red : T.ink }}>{report.failed}</b></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><Button tone="primary" onClick={onDone}>Done</Button></div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: T.ink66, marginTop: 0 }}>This will email {rows.length} selected contact{rows.length === 1 ? '' : 's'}. Contacts already marked contacted/converted are skipped automatically.</p>
          <Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputCss} maxLength={200} /></Field>
          <Field label="Message"><textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...inputCss, minHeight: 140, resize: 'vertical' }} maxLength={5000} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={onClose} disabled={sending}>Cancel</Button>
            <Button tone="primary" disabled={sending || !subject.trim() || !message.trim()} onClick={send}>{sending ? 'Sending…' : `Confirm & send (${rows.length})`}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

const th = { textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${T.ink08}`, color: T.goldDeep, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', borderBottom: `1px solid ${T.ink08}`, color: T.ink74, whiteSpace: 'nowrap' };

const EXPLAIN =
  'These are people who submitted their email through JIGZO’s pre-launch, waitlist or product-interest forms. Each row shows its signup source and interest type from the actual record (never guessed — unknown values show “Unknown source”), plus admin-only follow-up metadata. Repeated emails are flagged as duplicates but never auto-merged or deleted. You can email selected contacts using the existing approved send flow; sends are idempotent and audit-logged, and the original signup records are never written to from here.';
