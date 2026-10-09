import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'
const DEFAULT_TERM = {
  academic_year: '2026–27',
  term_name: 'Semester 1',
  start_date: '2026-07-01',
  end_date: '2026-12-30',
  holiday_region: 'Maharashtra, India',
  timezone: 'Asia/Kolkata',
  working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  reschedule_policy: 'suggest',
  status: 'active',
}
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const EVENT_TYPES = [
  { value: 'holiday', label: 'Public / college holiday' },
  { value: 'vacation', label: 'Vacation / break' },
  { value: 'exam', label: 'Examination' },
  { value: 'event', label: 'College event' },
  { value: 'closure', label: 'Institution closure' },
  { value: 'working_day', label: 'Special working day' },
]
const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--border-color, #dbe2ea)', borderRadius: 9, padding: '10px 11px', background: 'var(--bg-card, #fff)', color: 'var(--text-primary, #172033)', font: 'inherit', fontSize: 13 }
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 6, color: 'var(--text-secondary, #475569)' }
const buttonStyle = { border: 0, borderRadius: 9, padding: '10px 14px', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 650, cursor: 'pointer' }

function Field({ label, children }) {
  return <label style={{ display: 'block', minWidth: 0 }}><span style={labelStyle}>{label}</span>{children}</label>
}
function Notice({ children, error = false }) {
  return <div role="status" style={{ padding: '10px 12px', borderRadius: 9, background: error ? '#fff1f2' : '#eff6ff', color: error ? '#be123c' : '#1d4ed8', fontSize: 13 }}>{children}</div>
}
function toDate(value) {
  return new Date(value + 'T12:00:00')
}
function dateLabel(value) {
  return toDate(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function localDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

export default function CalendarPage() {
  const [terms, setTerms] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [termForm, setTermForm] = useState(DEFAULT_TERM)
  const [eventForm, setEventForm] = useState({ title: '', event_type: 'holiday', start_date: '', end_date: '', is_closure: true, approval_status: 'approved', source: 'manual', notes: '' })
  const [events, setEvents] = useState([])
  const [calendarMonth, setCalendarMonth] = useState('2026-07')
  const [loading, setLoading] = useState(true)
  const [savingTerm, setSavingTerm] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [showTermForm, setShowTermForm] = useState(false)
  const [editingTerm, setEditingTerm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const selectedTerm = useMemo(() => terms.find(term => String(term.term_id) === String(selectedId)), [terms, selectedId])
  const monthDate = useMemo(() => toDate(`${calendarMonth}-01`), [calendarMonth])
  const monthDays = useMemo(() => {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12)
    const offset = (first.getDay() + 6) % 7
    const count = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 12).getDate()
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1, 12))]
  }, [monthDate])
  const eventsByDate = useMemo(() => {
    const result = {}
    for (const event of events) {
      let day = toDate(event.start_date)
      const end = toDate(event.end_date)
      while (day <= end) {
        const key = localDateKey(day)
        ;(result[key] ||= []).push(event)
        day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12)
      }
    }
    return result
  }, [events])
  const setTermField = (key, value) => setTermForm(current => ({ ...current, [key]: value }))
  const setEventField = (key, value) => setEventForm(current => ({ ...current, [key]: value }))

  async function loadTerms(preferId = selectedId) {
    const response = await axios.get(`${API}/calendar/terms`)
    setTerms(response.data)
    const preferred = response.data.find(term => String(term.term_id) === String(preferId))
    const active = response.data.find(term => term.status === 'active')
    const next = preferred || active || response.data[0]
    setSelectedId(next ? String(next.term_id) : '')
    if (next) setCalendarMonth(next.start_date.slice(0, 7))
    return next
  }

  async function loadEvents(termId = selectedId) {
    if (!termId) { setEvents([]); return }
    const response = await axios.get(`${API}/calendar/terms/${termId}/events`)
    setEvents(response.data)
  }

  useEffect(() => {
    let alive = true
    axios.get(`${API}/calendar/terms`)
      .then(response => {
        if (!alive) return
        const list = response.data
        setTerms(list)
        const chosen = list.find(term => term.status === 'active') || list[0]
        if (chosen) setSelectedId(String(chosen.term_id))
        else setShowTermForm(true)
      })
      .catch(() => { if (alive) setError('Could not load the academic calendar. Check that the backend is running.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!selectedId) { setEvents([]); return }
    let alive = true
    axios.get(`${API}/calendar/terms/${selectedId}/events`)
      .then(response => { if (alive) setEvents(response.data) })
      .catch(() => { if (alive) setError('Could not load calendar events for this term.') })
    return () => { alive = false }
  }, [selectedId])

  async function createTerm(event) {
    event.preventDefault()
    setError(''); setNotice(''); setSavingTerm(true)
    try {
      const response = editingTerm && selectedTerm
        ? await axios.patch(`${API}/calendar/terms/${selectedTerm.term_id}`, termForm)
        : await axios.post(`${API}/calendar/terms`, termForm)
      const saved = response.data
      await loadTerms(saved.term_id)
      setShowTermForm(false)
      setEditingTerm(false)
      setNotice(editingTerm ? 'Academic term updated.' : 'Academic term created. You can now add holidays and other calendar events.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create the academic term.')
    } finally { setSavingTerm(false) }
  }

  async function saveEvent(event) {
    event.preventDefault()
    if (!selectedTerm) return
    setError(''); setNotice(''); setSavingEvent(true)
    try {
      const payload = { ...eventForm, is_working_day_override: eventForm.event_type === 'working_day' ? true : null }
      await axios.post(`${API}/calendar/terms/${selectedTerm.term_id}/events`, payload)
      await loadEvents(selectedTerm.term_id)
      setEventForm({ title: '', event_type: 'holiday', start_date: '', end_date: '', is_closure: true, approval_status: 'approved', source: 'manual', notes: '' })
      setShowEventForm(false)
      setNotice('Calendar event saved.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save this calendar event.')
    } finally { setSavingEvent(false) }
  }

  async function removeEvent(eventId) {
    if (!window.confirm('Delete this calendar event?')) return
    setError(''); setNotice('')
    try {
      await axios.delete(`${API}/calendar/events/${eventId}`)
      await loadEvents()
      setNotice('Calendar event deleted.')
    } catch (err) { setError(err.response?.data?.detail || 'Could not delete this event.') }
  }

  function toggleWorkingDay(day) {
    setTermField('working_days', termForm.working_days.includes(day)
      ? termForm.working_days.filter(item => item !== day)
      : [...termForm.working_days, day])
  }

  const groupedEvents = useMemo(() => {
    const map = new Map()
    for (const event of events) {
      const key = event.start_date.slice(0, 7)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  return <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px clamp(16px, 3vw, 36px) 48px', color: 'var(--text-primary, #172033)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 11, letterSpacing: '.12em', fontWeight: 750, color: '#2563eb', marginBottom: 8 }}>SCHEDULE · CALENDAR</div>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 3vw, 32px)', letterSpacing: '-.03em' }}>Academic Calendar</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--text-secondary, #64748b)', fontSize: 14, maxWidth: 680, lineHeight: 1.6 }}>Configure a semester, manage holidays and exceptions, and prepare the calendar foundation for date-aware timetables.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...buttonStyle, background: 'var(--bg-card, #fff)', color: 'var(--text-primary, #172033)', border: '1px solid var(--border-color, #dbe2ea)' }} onClick={() => { setEditingTerm(false); setTermForm(DEFAULT_TERM); setShowTermForm(value => !value) }}>+ New term</button>
        <button type="button" style={{ ...buttonStyle, background: 'var(--bg-card, #fff)', color: 'var(--text-primary, #172033)', border: '1px solid var(--border-color, #dbe2ea)' }} disabled={!selectedTerm} onClick={() => { setEditingTerm(true); setTermForm({ ...selectedTerm }); setShowTermForm(true) }}>Edit term</button>
        <button type="button" style={buttonStyle} disabled={!selectedTerm} onClick={() => setShowEventForm(value => !value)}>+ Add event</button>
      </div>
    </div>

    {notice && <div style={{ marginBottom: 14 }}><Notice>{notice}</Notice></div>}
    {error && <div style={{ marginBottom: 14 }}><Notice error>{error}</Notice></div>}

    {showTermForm && <section style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 16, padding: 20, marginBottom: 22, boxShadow: '0 4px 18px rgba(15,23,42,.04)' }}>
      <h2 style={{ fontSize: 18, margin: '0 0 5px' }}>{editingTerm ? 'Edit term configuration' : 'Term configuration'}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary, #64748b)', margin: '0 0 18px' }}>The first term is prefilled with your proposed Semester 1 dates. Adjust any field before saving.</p>
      <form onSubmit={createTerm}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          <Field label="Academic year"><input style={inputStyle} value={termForm.academic_year} onChange={e => setTermField('academic_year', e.target.value)} required /></Field>
          <Field label="Term name"><input style={inputStyle} value={termForm.term_name} onChange={e => setTermField('term_name', e.target.value)} required /></Field>
          <Field label="Start date"><input style={inputStyle} type="date" value={termForm.start_date} onChange={e => setTermField('start_date', e.target.value)} required /></Field>
          <Field label="End date"><input style={inputStyle} type="date" min={termForm.start_date} value={termForm.end_date} onChange={e => setTermField('end_date', e.target.value)} required /></Field>
          <Field label="Holiday region"><input style={inputStyle} value={termForm.holiday_region} onChange={e => setTermField('holiday_region', e.target.value)} required /></Field>
          <Field label="Time zone"><select style={inputStyle} value={termForm.timezone} onChange={e => setTermField('timezone', e.target.value)}><option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option><option value="UTC">UTC</option><option value="Asia/Dubai">Asia/Dubai</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></Field>
          <Field label="Rescheduling policy"><select style={inputStyle} value={termForm.reschedule_policy} onChange={e => setTermField('reschedule_policy', e.target.value)}><option value="cancel">Mark cancelled; no replacement</option><option value="suggest">Suggest replacements for approval</option><option value="automatic">Automatic rescheduling (future capability)</option></select></Field>
          <Field label="Term status"><select style={inputStyle} value={termForm.status} onChange={e => setTermField('status', e.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></Field>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={labelStyle}>Weekly working days</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{WEEKDAYS.map(day => <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--border-color, #dbe2ea)', borderRadius: 9, padding: '8px 10px', fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={termForm.working_days.includes(day)} onChange={() => toggleWorkingDay(day)} />{day.slice(0, 3)}</label>)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" style={{ ...buttonStyle, background: 'transparent', color: 'var(--text-secondary, #475569)', border: '1px solid var(--border-color, #dbe2ea)' }} onClick={() => { setShowTermForm(false); setEditingTerm(false) }}>Cancel</button>
          <button type="submit" style={buttonStyle} disabled={savingTerm}>{savingTerm ? 'Saving…' : editingTerm ? 'Save changes' : 'Save term'}</button>
        </div>
      </form>
    </section>}

    {selectedTerm && <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 22 }}>
      {[
        ['Selected term', selectedTerm.term_name, selectedTerm.academic_year],
        ['Term dates', dateLabel(selectedTerm.start_date), `Through ${dateLabel(selectedTerm.end_date)}`],
        ['Holiday region', selectedTerm.holiday_region, selectedTerm.timezone],
        ['Calendar events', String(events.length), 'Manual entries currently'],
      ].map(([title, value, sub]) => <div key={title} style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 14, padding: 15, background: 'var(--bg-card, #fff)' }}><div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginBottom: 8 }}>{title}</div><div style={{ fontSize: 18, fontWeight: 750, overflowWrap: 'anywhere' }}>{value}</div><div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 5 }}>{sub}</div></div>)}
    </section>}

    {showEventForm && selectedTerm && <section style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 16, padding: 20, marginBottom: 22 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Add calendar event</h2>
      <form onSubmit={saveEvent}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
          <Field label="Event title"><input style={inputStyle} value={eventForm.title} onChange={e => setEventField('title', e.target.value)} placeholder="e.g. College Foundation Day" required /></Field>
          <Field label="Event type"><select style={inputStyle} value={eventForm.event_type} onChange={e => { setEventField('event_type', e.target.value); setEventField('is_closure', e.target.value !== 'exam' && e.target.value !== 'event' && e.target.value !== 'working_day') }} >{EVENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
          <Field label="Start date"><input style={inputStyle} type="date" min={selectedTerm.start_date} max={selectedTerm.end_date} value={eventForm.start_date} onChange={e => { setEventField('start_date', e.target.value); if (!eventForm.end_date || eventForm.end_date < e.target.value) setEventField('end_date', e.target.value) }} required /></Field>
          <Field label="End date"><input style={inputStyle} type="date" min={eventForm.start_date || selectedTerm.start_date} max={selectedTerm.end_date} value={eventForm.end_date} onChange={e => setEventField('end_date', e.target.value)} required /></Field>
          <Field label="Status"><select style={inputStyle} value={eventForm.approval_status} onChange={e => setEventField('approval_status', e.target.value)}><option value="approved">Approved</option><option value="pending">Pending review</option></select></Field>
          <Field label="Notes (optional)"><input style={inputStyle} value={eventForm.notes} onChange={e => setEventField('notes', e.target.value)} placeholder="Additional details" /></Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 14 }}><input type="checkbox" checked={eventForm.is_closure} disabled={eventForm.event_type === 'working_day'} onChange={e => setEventField('is_closure', e.target.checked)} /> No regular classes on these dates</label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" style={{ ...buttonStyle, background: 'transparent', color: 'var(--text-secondary, #475569)', border: '1px solid var(--border-color, #dbe2ea)' }} onClick={() => setShowEventForm(false)}>Cancel</button>
          <button type="submit" style={buttonStyle} disabled={savingEvent || !eventForm.start_date || !eventForm.end_date}>{savingEvent ? 'Saving…' : 'Save event'}</button>
        </div>
      </form>
    </section>}

    <section style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 16, background: 'var(--bg-card, #fff)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 18, borderBottom: '1px solid var(--border-color, #e2e8f0)', flexWrap: 'wrap' }}>
        <div><h2 style={{ margin: 0, fontSize: 18 }}>Term calendar</h2><p style={{ margin: '5px 0 0', color: 'var(--text-secondary, #64748b)', fontSize: 12 }}>Holidays, closures, exams and special working days</p></div>
        <select aria-label="Select academic term" style={{ ...inputStyle, width: 'auto', minWidth: 210 }} value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={!terms.length}>{terms.length ? terms.map(term => <option key={term.term_id} value={term.term_id}>{term.academic_year} · {term.term_name}</option>) : <option value="">No terms created</option>}</select>
      </div>
      {selectedTerm && <div style={{ padding: 18, borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <button type="button" aria-label="Previous month" onClick={() => setCalendarMonth(localDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1, 12)).slice(0, 7))} style={{ ...buttonStyle, background: 'transparent', color: 'var(--text-primary, #172033)', border: '1px solid var(--border-color, #dbe2ea)' }}>←</button>
          <h3 style={{ margin: 0, fontSize: 16 }}>{monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
          <button type="button" aria-label="Next month" onClick={() => setCalendarMonth(localDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1, 12)).slice(0, 7))} style={{ ...buttonStyle, background: 'transparent', color: 'var(--text-primary, #172033)', border: '1px solid var(--border-color, #dbe2ea)' }}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 5 }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} style={{ padding: '7px 2px', textAlign: 'center', fontSize: 11, fontWeight: 750, color: 'var(--text-secondary, #64748b)' }}>{day}</div>)}
          {monthDays.map((day, index) => {
            const key = day ? localDateKey(day) : `empty-${index}`
            const dayEvents = day ? (eventsByDate[localDateKey(day)] || []) : []
            const insideTerm = day && day >= toDate(selectedTerm.start_date) && day <= toDate(selectedTerm.end_date)
            return <div key={key} style={{ minHeight: 76, minWidth: 0, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 5, background: !day ? 'transparent' : insideTerm ? 'var(--bg-card, #fff)' : 'var(--bg-subtle, #f8fafc)', opacity: insideTerm ? 1 : .48 }}>
              {day && <><div style={{ fontSize: 11, fontWeight: dayEvents.length ? 800 : 550, marginBottom: 4 }}>{day.getDate()}</div><div style={{ display: 'grid', gap: 3 }}>{dayEvents.slice(0, 2).map((event, i) => <div key={`${event.event_id}-${i}`} title={event.title} style={{ background: event.is_closure ? '#ffe4e6' : event.event_type === 'exam' ? '#ede9fe' : '#dbeafe', color: event.is_closure ? '#9f1239' : event.event_type === 'exam' ? '#5b21b6' : '#1d4ed8', fontSize: 9, lineHeight: 1.25, borderRadius: 4, padding: '3px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>)}{dayEvents.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-secondary, #64748b)' }}>+{dayEvents.length - 2} more</div>}</div></>}
            </div>
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, fontSize: 10, color: 'var(--text-secondary, #64748b)' }}><span>🟥 Closure / holiday</span><span>🟪 Exam</span><span>🟦 Other event</span><span>Faded dates are outside this term</span></div>
      </div>}
      {loading ? <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-secondary, #64748b)', fontSize: 13 }}>Loading calendar…</div>
      : !terms.length ? <div style={{ padding: 40, textAlign: 'center' }}><div style={{ fontSize: 30, marginBottom: 10 }}>▦</div><h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Create your first academic term</h3><p style={{ color: 'var(--text-secondary, #64748b)', fontSize: 13, margin: '0 auto 18px', maxWidth: 430 }}>Use the prefilled Semester 1 configuration or enter a different academic term to start managing its calendar.</p><button type="button" style={buttonStyle} onClick={() => setShowTermForm(true)}>Configure first term</button></div>
      : !events.length ? <div style={{ padding: 38, textAlign: 'center' }}><h3 style={{ margin: '0 0 8px', fontSize: 16 }}>No events added yet</h3><p style={{ color: 'var(--text-secondary, #64748b)', fontSize: 13, margin: '0 auto 18px', maxWidth: 430 }}>Add public holidays, college closures, vacations or exam dates. Automatic official-holiday imports will be a later phase.</p><button type="button" style={buttonStyle} onClick={() => setShowEventForm(true)}>Add first event</button></div>
      : <div>{groupedEvents.map(([month, monthEvents]) => <div key={month}><div style={{ background: 'var(--bg-subtle, #f8fafc)', padding: '10px 18px', fontSize: 12, fontWeight: 750, color: 'var(--text-secondary, #475569)' }}>{toDate(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>{monthEvents.map(event => <div key={event.event_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: '1px solid var(--border-color, #edf2f7)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 82, fontSize: 12, color: 'var(--text-secondary, #64748b)' }}>{dateLabel(event.start_date)}{event.end_date !== event.start_date ? ` – ${dateLabel(event.end_date)}` : ''}</div>
        <div style={{ width: 4, alignSelf: 'stretch', minHeight: 34, borderRadius: 9, background: event.event_type === 'holiday' || event.event_type === 'closure' ? '#e11d48' : event.event_type === 'exam' ? '#7c3aed' : event.event_type === 'working_day' ? '#059669' : '#2563eb' }} />
        <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{event.title}</div><div style={{ fontSize: 11, color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>{EVENT_TYPES.find(type => type.value === event.event_type)?.label || event.event_type} · {event.source}{event.is_closure ? ' · No regular classes' : ''}</div>{event.notes && <div style={{ fontSize: 12, marginTop: 4 }}>{event.notes}</div>}</div>
        <span style={{ borderRadius: 20, padding: '4px 8px', background: event.approval_status === 'approved' ? '#dcfce7' : '#fef3c7', color: event.approval_status === 'approved' ? '#166534' : '#92400e', fontSize: 10, fontWeight: 750 }}>{event.approval_status}</span>
        <button type="button" aria-label={`Delete ${event.title}`} onClick={() => removeEvent(event.event_id)} style={{ border: '1px solid var(--border-color, #e2e8f0)', background: 'transparent', color: '#be123c', borderRadius: 8, padding: '7px 9px', cursor: 'pointer', fontSize: 12 }}>Delete</button>
      </div>)}</div>)}</div>}
    </section>
    <p style={{ marginTop: 16, color: 'var(--text-secondary, #64748b)', fontSize: 12, lineHeight: 1.6 }}>Current scope: term configuration and manual calendar events. Official holiday synchronization, dated class occurrences and replacement-slot approval will be integrated in subsequent phases. No existing weekly timetable data is changed by this page.</p>
  </main>
}
