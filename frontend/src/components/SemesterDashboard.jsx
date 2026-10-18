import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE } from '../lib/config'

const API = API_BASE
const button = { padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', cursor: 'pointer' }

export default function SemesterDashboard() {
  const [terms, setTerms] = useState([])
  const [termId, setTermId] = useState('')
  const [versions, setVersions] = useState([])
  const [selected, setSelected] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh(id = termId) {
    if (!id) return
    const [v, d] = await Promise.all([axios.get(API + '/semester/terms/' + id + '/versions'), axios.get(API + '/semester/terms/' + id + '/dashboard')])
    setVersions(v.data); setDashboard(d.data)
  }
  useEffect(() => {
    axios.get(API + '/calendar/terms').then(r => {
      setTerms(r.data)
      const term = r.data.find(t => t.status === 'active') || r.data[0]
      if (term) setTermId(String(term.term_id))
    }).catch(e => setError(e.response?.data?.detail || 'Could not load terms.'))
  }, [])
  useEffect(() => { if (termId) refresh(termId).then(() => setSelected(null)).catch(e => setError(e.response?.data?.detail || 'Could not load semester data.')) }, [termId])

  async function openVersion(item) {
    setError('')
    try {
      const response = await axios.get(API + '/semester/versions/' + item.version_id)
      setSelected(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load version sessions.')
    }
  }

  async function createDraft() {
    setBusy(true); setError(''); setNotice('')
    try { const r = await axios.post(API + '/semester/terms/' + termId + '/versions/draft'); await refresh(); setSelected(r.data); setNotice('Draft version ' + r.data.version_number + ' created. Published timetable is unchanged.') }
    catch (e) { const d = e.response?.data?.detail; setError(typeof d === 'string' ? d : d?.message || 'Could not create draft.') }
    finally { setBusy(false) }
  }
  async function publish(v) {
    setBusy(true); setError(''); setNotice('')
    try { await axios.post(API + '/semester/versions/' + v.version_id + '/publish'); await refresh(); setSelected(null); setNotice('Version published.') }
    catch (e) { const d = e.response?.data?.detail; setError(typeof d === 'string' ? d : d?.message || 'Could not publish version.') }
    finally { setBusy(false) }
  }
  async function lock(s) {
    try { const r = await axios.patch(API + '/semester/sessions/' + s.session_id + '/lock', { locked: !s.is_locked, reason: !s.is_locked ? 'Preserve assignment during regeneration' : null }); if (selected) setSelected({ ...selected, sessions: selected.sessions.map(x => x.session_id === s.session_id ? r.data : x) }); await refresh() }
    catch (e) { setError(e.response?.data?.detail || 'Could not change lock.') }
  }
  async function outcome(s, status) {
    try { const r = await axios.patch(API + '/semester/sessions/' + s.session_id + '/outcome', { status }); if (selected) setSelected({ ...selected, sessions: selected.sessions.map(x => x.session_id === s.session_id ? r.data : x) }); await refresh(); setNotice('Session marked ' + status + '.') }
    catch (e) { setError(e.response?.data?.detail || 'Could not update outcome.') }
  }
  const version = selected || versions[0]
  const summary = dashboard?.summary || {}
  const metrics = [['Required periods', summary.required_periods || 0], ['Scheduled', summary.scheduled || 0], ['Completed', summary.completed || 0], ['Cancelled', summary.cancelled || 0], ['Rescheduled', summary.rescheduled || 0], ['Outstanding', summary.outstanding || 0]]

  return <main style={{ padding: 28, maxWidth: 1500, margin: '0 auto', color: 'var(--text-primary, #111827)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}><div><div style={{ color: '#2563eb', fontSize: 12, fontWeight: 800 }}>SCHEDULING OPERATIONS</div><h1>Semester timetable</h1><p>Review dated sessions, protect locked assignments, and publish versions.</p></div><button style={{ ...button, background: '#2563eb', color: 'white' }} disabled={!termId || busy} onClick={createDraft}>{busy ? 'Working…' : 'Generate draft from weekly template'}</button></header>
    {error && <p role='alert' style={{ color: '#b91c1c' }}>{String(error)}</p>}{notice && <p role='status' style={{ color: '#166534' }}>{notice}</p>}
    <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 16 }}><label>Academic term <select value={termId} onChange={e => setTermId(e.target.value)} style={{ marginLeft: 12, padding: 8 }}>{terms.map(t => <option key={t.term_id} value={t.term_id}>{t.academic_year} · {t.term_name} ({t.start_date} — {t.end_date})</option>)}</select></label></section>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 16 }}>{metrics.map(([label, value]) => <div key={label} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}><div style={{ color: '#6b7280', fontSize: 12 }}>{label}</div><strong style={{ fontSize: 26 }}>{value}</strong></div>)}</section>
    {dashboard && <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 16 }}><strong>{dashboard.incomplete ? 'Completion needs attention' : 'No recorded outstanding work'}</strong><p>{summary.unresolved_locked_conflicts || 0} unresolved locked-session closure conflict(s). Drafts do not replace the published timetable until published.</p></section>}
    <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 16 }}><h2>Version history</h2>{!versions.length ? <p>No versioned semester timetable yet.</p> : versions.map(v => <div key={v.version_id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 9, borderBottom: '1px solid #eee' }}><button style={button} onClick={() => openVersion(v)}>Version {v.version_number} · {v.status}</button><span>{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</span>{v.status === 'draft' && <button style={{ ...button, background: '#2563eb', color: 'white' }} disabled={busy} onClick={() => publish(v)}>Publish</button>}</div>)}</section>
    <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}><h2>{version ? 'Version ' + version.version_number + ' sessions' : 'Semester sessions'}</h2><p style={{ color: '#6b7280' }}>Locks carry forward when the same class, subject and date exist. Closure conflicts require manual resolution.</p>{!version?.sessions?.length ? <p>Select a version to inspect sessions.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800, fontSize: 13 }}><thead><tr>{['Date','Period','Class','Subject','Teacher','Room','Status','Lock','Actions'].map(x => <th key={x} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>{x}</th>)}</tr></thead><tbody>{version.sessions.slice(0,250).map(s => <tr key={s.session_id}><td style={{ padding: 8 }}>{s.date}</td><td style={{ padding: 8 }}>{s.period_number}</td><td style={{ padding: 8 }}>{s.class_id}</td><td style={{ padding: 8 }}>{s.subject_id}</td><td style={{ padding: 8 }}>{s.teacher_id}</td><td style={{ padding: 8 }}>{s.room_id}</td><td style={{ padding: 8, color: s.closure_conflict ? '#b91c1c' : 'inherit' }}>{s.closure_conflict ? 'Closure conflict' : s.status}</td><td style={{ padding: 8 }}>{s.is_locked ? 'Locked' : 'Open'}</td><td style={{ padding: 8, whiteSpace: 'nowrap' }}>{version.status !== 'archived' && <><button style={button} onClick={() => lock(s)}>{s.is_locked ? 'Unlock' : 'Lock'}</button> {s.status === 'scheduled' && <button style={button} onClick={() => outcome(s,'completed')}>Conducted</button>} {s.status === 'scheduled' && <button style={button} onClick={() => outcome(s,'missed')}>Missed</button>}</>}</td></tr>)}</tbody></table>{version.sessions.length > 250 && <p>Showing first 250 of {version.sessions.length} sessions.</p>}</div>}</section>
  </main>
}
