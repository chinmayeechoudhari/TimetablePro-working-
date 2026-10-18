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
  const [preview, setPreview] = useState(null)
  const [weeklyProgress, setWeeklyProgress] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState(null)
  const [events, setEvents] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showTermSettings, setShowTermSettings] = useState(false)

  async function refresh(id = termId) {
    if (!id) return
    const [v, d, p, w] = await Promise.all([axios.get(API + '/semester/terms/' + id + '/versions'), axios.get(API + '/semester/terms/' + id + '/dashboard'), axios.post(API + '/semester/terms/' + id + '/preview').catch(() => ({ data: null })), axios.get(API + '/semester/terms/' + id + '/weekly-progress').catch(() => ({ data: [] }))])
    setVersions(v.data); setDashboard(d.data); setPreview(p.data); setWeeklyProgress(Array.isArray(w.data) ? w.data : (w.data?.shortfalls || w.data?.weeks || w.data?.rows || []))
    const eventResponse = await axios.get(API + '/calendar/terms/' + id + '/events').catch(() => ({ data: [] }))
    setEvents(Array.isArray(eventResponse.data) ? eventResponse.data : [])
  }
  useEffect(() => {
    axios.get(API + '/calendar/terms').then(r => {
      setTerms(r.data)
      const term = r.data.find(t => t.status === 'active') || r.data[0]
      if (term) setTermId(String(term.term_id))
    }).catch(e => setError(e.response?.data?.detail || 'Could not load terms.'))
  }, [])
  useEffect(() => { if (termId) refresh(termId).then(() => setSelected(null)).catch(e => setError(e.response?.data?.detail || 'Could not load semester data.')) }, [termId])

  const activeTerm = terms.find(t => String(t.term_id) === String(termId))
  const workingDays = activeTerm?.working_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  async function updateWorkingDays(nextDays) {
    if (!activeTerm || !nextDays.length) return
    setBusy(true); setError(''); setNotice('')
    try { const response = await axios.patch(API + '/calendar/terms/' + termId, { working_days: nextDays }); setTerms(old => old.map(t => t.term_id === response.data.term_id ? response.data : t)); setNotice('Teaching days updated. Run semester optimization again to apply changes to a new draft.') }
    catch (e) { setError(e.response?.data?.detail || 'Could not update teaching days.') }
    finally { setBusy(false) }
  }

  async function importInstitutionCalendar() {
    if (!termId || !window.confirm('Import the built-in academic calendar for this term?')) return
    setBusy(true); setError(''); setNotice('')
    try { await axios.post(API + '/calendar/terms/' + termId + '/holidays/import'); await refresh(termId); setNotice('Calendar import completed. Review the events and optimize a new draft.') }
    catch (e) { setError(e.response?.data?.detail || 'Could not import the academic calendar.') }
    finally { setBusy(false) }
  }
  async function openVersion(item) {
    setError('')
    try {
      const response = await axios.get(API + '/semester/versions/' + item.version_id)
      setSelected(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load version sessions.')
    }
  }

  async function refreshPreview() {
    if (!termId) return
    setBusy(true); setError(''); setNotice('')
    try { const r = await axios.post(API + '/semester/terms/' + termId + '/preview'); setPreview(r.data); setNotice('Calendar-aware semester preview refreshed. No timetable version was changed.') }
    catch (e) { setError(e.response?.data?.detail || 'Could not preview this semester. Generate a weekly timetable first.') }
    finally { setBusy(false) }
  }

  async function optimizeSemester() {
    if (!termId) return
    setBusy(true); setError(''); setNotice(''); setOptimizationResult(null)
    try {
      const response = await axios.post(API + '/semester/terms/' + termId + '/optimize')
      const result = response.data
      setOptimizationResult({
        status: result.status,
        objective_value: result.objective_value,
        session_count: result.session_count,
        version_number: result.version_number,
        message: result.message || 'Draft saved. Review it before publishing.',
      })
      await refresh(termId)
      const versionResponse = await axios.get(API + '/semester/versions/' + result.version_id)
      setSelected(versionResponse.data)
      setNotice('Semester optimization completed. Draft version ' + result.version_number + ' is saved; the published timetable has not changed.')
    } catch (e) {
      const detail = e.response?.data?.detail
      if (detail && typeof detail === 'object') {
        const conflictCount = Array.isArray(detail.locked_conflicts) ? detail.locked_conflicts.length : 0
        const reason = detail.reason ? ' Reason: ' + detail.reason : ''
        const conflicts = conflictCount ? ' Locked-session conflicts: ' + conflictCount + '.' : ''
        setError((detail.message || 'Semester optimization could not create a valid schedule.') + reason + conflicts)
      } else {
        setError(typeof detail === 'string' ? detail : 'Semester optimization failed. Check the term, weekly subject targets, teacher assignments, room setup, calendar and saved constraints.')
      }
    } finally {
      setBusy(false)
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
  async function suggestReplacement(s) {
    const replacementDate = window.prompt('Replacement date (YYYY-MM-DD):')
    if (!replacementDate) return
    const period = Number(window.prompt('Replacement period number:'))
    if (!Number.isInteger(period) || period < 1) {
      setError('Enter a valid period number.')
      return
    }
    try {
      await axios.post(API + '/semester/sessions/' + s.session_id + '/replacement', {
        replacement_date: replacementDate,
        period_number: period,
        approved: false,
        note: 'Suggested replacement awaiting administrator approval.',
      })
      await refresh()
      setNotice('Replacement suggestion created. Approve it from the pending replacement row.')
    } catch (e) { setError(e.response?.data?.detail || 'Could not create replacement suggestion.') }
  }

  async function approveReplacement(s) {
    try {
      await axios.post(API + '/semester/sessions/' + s.session_id + '/replacement/approve')
      await refresh()
      setNotice('Replacement approved.')
    } catch (e) { setError(e.response?.data?.detail || 'Could not approve replacement.') }
  }

  async function outcome(s, status) {
    try { const r = await axios.patch(API + '/semester/sessions/' + s.session_id + '/outcome', { status }); if (selected) setSelected({ ...selected, sessions: selected.sessions.map(x => x.session_id === s.session_id ? r.data : x) }); await refresh(); setNotice('Session marked ' + status + '.') }
    catch (e) { setError(e.response?.data?.detail || 'Could not update outcome.') }
  }
  const version = selected || versions[0]
  const summary = dashboard?.summary || {}
  const metrics = [['Required periods', summary.required_periods || 0], ['Scheduled', summary.scheduled || 0], ['Completed', summary.completed || 0], ['Cancelled', summary.cancelled || 0], ['Rescheduled', summary.rescheduled || 0], ['Outstanding', summary.outstanding || 0]]
  const filteredSessions = (version?.sessions || []).filter(s => (!dateFrom || s.date >= dateFrom) && (!dateTo || s.date <= dateTo) && (classFilter === 'all' || String(s.class_id) === classFilter) && (statusFilter === 'all' || (s.closure_conflict ? 'closure_conflict' : s.status) === statusFilter))
  const classIds = [...new Set((version?.sessions || []).map(s => String(s.class_id)))]
  const approvedEvents = events.filter(e => e.approval_status === 'approved')
  const closures = approvedEvents.filter(e => e.is_closure)
  const versionIsDraft = version?.status === 'draft'

  return <main style={{ padding: 28, maxWidth: 1500, margin: '0 auto', color: 'var(--text-primary, #111827)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}><div><div style={{ color: '#2563eb', fontSize: 12, fontWeight: 800 }}>SEMESTER SCHEDULING WORKSPACE</div><h1>Semester Planner</h1><p>Configure the academic calendar, optimize actual dated sessions, validate teaching requirements, then review and publish a draft.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={button} disabled={!termId || busy} onClick={() => setShowTermSettings(v => !v)}>{showTermSettings ? 'Hide term settings' : 'Configure term'}</button><button style={button} disabled={!termId || busy} onClick={refreshPreview}>Preview calendar impact</button><button style={{ ...button, background: '#2563eb', color: 'white', borderColor: '#2563eb', fontWeight: 700 }} disabled={!termId || busy} onClick={optimizeSemester}>{busy ? 'Optimizing…' : 'Run semester optimizer'}</button></div></header>
    {error && <p role='alert' style={{ color: '#b91c1c', padding: 12, border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 8 }}>{String(error)}</p>}{notice && <p role='status' style={{ color: '#166534', padding: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 8 }}>{notice}</p>}
    {optimizationResult && <section aria-live="polite" style={{ padding: 16, border: '1px solid #bfdbfe', borderRadius: 12, marginBottom: 16, background: '#eff6ff' }}>
      <strong>Optimization result · Draft version {optimizationResult.version_number}</strong>
      <p style={{ margin: '8px 0' }}>{optimizationResult.message}</p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', color: '#1e3a8a', fontSize: 13 }}>
        <span>Solver status: <strong>{optimizationResult.status}</strong></span>
        <span>Sessions scheduled: <strong>{optimizationResult.session_count}</strong></span>
        <span>Objective value: <strong>{optimizationResult.objective_value ?? '—'}</strong></span>
      </div>
      <p style={{ marginBottom: 0, fontSize: 12, color: '#1e40af' }}>This is a draft only. Review the dated sessions below before publishing; the current published version remains unchanged.</p>
    </section>}
    <section style={{ padding: 18, border: '1px solid #e2e8f0', borderRadius: 14, marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><div><h2>1 · Academic term</h2><p style={{ color: '#64748b', margin: 0 }}>The selected term defines the date range used by the optimizer.</p></div><select aria-label='Select academic term' value={termId} onChange={e => setTermId(e.target.value)} style={{ padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }}>{terms.map(t => <option key={t.term_id} value={t.term_id}>{t.academic_year} · {t.term_name} ({t.start_date} — {t.end_date})</option>)}</select></div>{activeTerm && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 14 }}>{[['Start date',activeTerm.start_date],['End date',activeTerm.end_date],['Holiday region',activeTerm.holiday_region],['Timezone',activeTerm.timezone],['Reschedule policy',activeTerm.reschedule_policy]].map(([label,value])=><div key={label} style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9 }}><div style={{ color: '#64748b', fontSize: 12 }}>{label}</div><strong>{value || 'Not set'}</strong></div>)}</div>}{showTermSettings && <div style={{ marginTop: 16 }}><strong>Normal teaching days</strong><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{weekdays.map(day=><label key={day} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 8 }}><input type='checkbox' checked={workingDays.includes(day)} disabled={busy || (workingDays.length === 1 && workingDays.includes(day))} onChange={e=>updateWorkingDays(e.target.checked ? [...workingDays,day] : workingDays.filter(d=>d!==day))}/> {day}</label>)}</div><div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><button style={button} disabled={busy} onClick={importInstitutionCalendar}>Import institution calendar</button><button style={button} onClick={()=>window.location.assign('/calendar')}>Manage calendar events ↗</button></div></div>}</section>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 16 }}>{metrics.map(([label, value]) => <div key={label} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}><div style={{ color: '#6b7280', fontSize: 12 }}>{label}</div><strong style={{ fontSize: 26 }}>{value}</strong></div>)}</section>
    {dashboard && <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 16 }}><strong>{dashboard.incomplete ? 'Completion needs attention' : 'No recorded outstanding work'}</strong><p>{summary.unresolved_locked_conflicts || 0} unresolved locked-session closure conflict(s). Drafts do not replace the published timetable until published.</p></section>}
    {preview && <section style={{ padding: 16, border: '1px solid #bfdbfe', borderRadius: 12, marginBottom: 16, background: '#eff6ff' }}>
      <h2>Calendar impact preview</h2><p>{preview.note}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {[['Planned sessions', preview.planned_sessions], ['Holiday cancellations', preview.closure_cancellations], ['Changed sessions', preview.changed_sessions_vs_published], ['Locked conflicts', preview.locked_conflicts], ['Weeks', preview.weeks_touched]].map(([label, value]) => <div key={label} style={{ padding: 10, borderRadius: 8, background: 'white', border: '1px solid #dbeafe' }}><div style={{ fontSize: 12, color: '#475569' }}>{label}</div><strong style={{ fontSize: 22 }}>{value ?? 0}</strong></div>)}
      </div>
      {preview.affected_dates?.length > 0 && <p><strong>Dates affected:</strong> {preview.affected_dates.join(', ')}</p>}
      {preview.weekly_template_shortfalls?.length > 0 && <div><strong>Weekly template shortfalls</strong><ul>{preview.weekly_template_shortfalls.slice(0, 8).map((x, i) => <li key={i}>Class {x.class_id}, subject {x.subject_id}: template has {x.weekly_template_periods}, target {x.required_per_week} periods/week.</li>)}</ul></div>}
      {preview.locked_conflicts > 0 && <p role="alert" style={{ color: '#b91c1c' }}>Resolve locked sessions affected by closures before publishing.</p>}
    </section>}
    {weeklyProgress.length > 0 && <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 16 }}>
      <h2>Weekly progress</h2><p>Progress for the selected semester, based on the current semester version and approved calendar events.</p>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr>{Object.keys(weeklyProgress[0] || {}).map(key => <th key={key} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>{key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{weeklyProgress.slice(0, 30).map((row, i) => <tr key={i}>{Object.values(row).map((value, j) => <td key={j} style={{ padding: 8, borderBottom: '1px solid #eee' }}>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</td>)}</tr>)}</tbody></table></div>
    </section>}
    <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 16 }}><h2>Version history</h2>{!versions.length ? <p>No versioned semester timetable yet.</p> : versions.map(v => <div key={v.version_id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 9, borderBottom: '1px solid #eee' }}><button style={button} onClick={() => openVersion(v)}>Version {v.version_number} · {v.status}</button><span>{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</span>{v.status === 'draft' && <button style={{ ...button, background: '#2563eb', color: 'white' }} disabled={busy} onClick={() => publish(v)}>Publish</button>}</div>)}</section>
    <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}><h2>{version ? 'Version ' + version.version_number + ' sessions' : 'Semester sessions'}</h2><p style={{ color: '#6b7280' }}>Locks carry forward when the same class, subject and date exist. Closure conflicts require manual resolution.</p>{!version?.sessions?.length ? <p>Select a version to inspect sessions.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800, fontSize: 13 }}><thead><tr>{['Date','Period','Class','Subject','Teacher','Room','Status','Lock','Actions'].map(x => <th key={x} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ddd' }}>{x}</th>)}</tr></thead><tbody>{version.sessions.slice(0,250).map(s => <tr key={s.session_id}><td style={{ padding: 8 }}>{s.date}</td><td style={{ padding: 8 }}>{s.period_number}</td><td style={{ padding: 8 }}>{s.class_id}</td><td style={{ padding: 8 }}>{s.subject_id}</td><td style={{ padding: 8 }}>{s.teacher_id}</td><td style={{ padding: 8 }}>{s.room_id}</td><td style={{ padding: 8, color: s.closure_conflict ? '#b91c1c' : 'inherit' }}>{s.closure_conflict ? 'Closure conflict' : s.status}</td><td style={{ padding: 8 }}>{s.is_locked ? 'Locked' : 'Open'}</td><td style={{ padding: 8, whiteSpace: 'nowrap' }}>{version.status !== 'archived' && <><button style={button} onClick={() => lock(s)}>{s.is_locked ? 'Unlock' : 'Lock'}</button> {s.status === 'scheduled' && <button style={button} onClick={() => outcome(s,'completed')}>Conducted</button>} {s.status === 'scheduled' && <button style={button} onClick={() => outcome(s,'missed')}>Missed</button>}{s.status === 'cancelled' && !s.is_locked && <button style={button} onClick={() => suggestReplacement(s)}>Suggest replacement</button>}{s.status === 'outstanding' && s.original_session_id && <button style={button} onClick={() => approveReplacement(s)}>Approve replacement</button>}</>}</td></tr>)}</tbody></table>{version.sessions.length > 250 && <p>Showing first 250 of {version.sessions.length} sessions.</p>}</div>}</section>
  </main>
}
