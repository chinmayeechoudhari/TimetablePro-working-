import { useEffect, useMemo, useState, useRef } from 'react'
import axios from 'axios'
import UpcomingEventsModal from './UpcomingEventsModal'
import { API_BASE } from '../lib/config'

const API = API_BASE
const DEFAULT_TERM = {
  academic_year: '2026–27',
  term_name: 'Semester 1',
  start_date: '2026-07-01',
  end_date: '2026-12-30',
  holiday_region: 'Maharashtra, India',
  timezone: 'Asia/Kolkata',
  reschedule_policy: 'suggest',
  status: 'active',
}
const EVENT_TYPES = [
  { value: 'holiday', label: 'Public / college holiday' },
  { value: 'vacation', label: 'Vacation / break' },
  { value: 'exam', label: 'Examination' },
  { value: 'event', label: 'College event' },
  { value: 'closure', label: 'Institution closure' },
  { value: 'working_day', label: 'Special working day' },
]

function toDate(value) {
  return new Date(value + 'T12:00:00')
}
function dateLabel(value) {
  if (!value) return ''
  return toDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function localDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

/* ─── SVG Icons ─── */
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const SparklesIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/></svg>
const CapIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 6 3 6 3s6-1 6-3v-5"/></svg>
const CalendarIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const PinIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
const ChevronDown = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
const ChevronLeft = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
const ChevronRight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
const BookIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
const CheckCalendarIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
const TagCalendarIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15" r="2"/></svg>
const ClockIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const UploadIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const FileDocIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
const EditIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
const RefreshIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
const TemplateIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
const TrashIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
const CheckCircleIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#10b981"><circle cx="12" cy="12" r="10" fill="#10b981"/><path d="m8.5 12 2.5 2.5 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
const AlertTriangleIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b"><path d="m10.29 3.86-8.6 15A2 2 0 0 0 3.43 22h17.14a2 2 0 0 0 1.74-3.14l-8.6-15a2 2 0 0 0-3.42 0z" fill="#f59e0b"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>
const ArrowRightIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>

/* ─── Field Input Helper ─── */
function FieldInput({ label, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{
        display: 'block', fontSize: 11, fontWeight: 700,
        letterSpacing: '.04em', marginBottom: 6,
        color: 'var(--text-muted, #64748b)',
      }}>{label}</span>
      {children}
    </label>
  )
}

const inputCls = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #dbe2ea', borderRadius: 9,
  padding: '9px 12px', background: '#fff',
  color: 'var(--text-main, #172033)', font: 'inherit', fontSize: 13,
  outline: 'none', transition: 'border-color .15s',
}

export default function CalendarPage() {
  const [terms, setTerms] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [termForm, setTermForm] = useState(DEFAULT_TERM)
  const [eventForm, setEventForm] = useState({
    title: '', event_type: 'holiday', start_date: '', end_date: '',
    is_closure: true, approval_status: 'pending', source: 'manual', notes: '',
    preferred_replacement_date: '', preferred_replacement_period: ''
  })
  const [events, setEvents] = useState([])
  const [rescheduleReport, setRescheduleReport] = useState(null)

  const [calendarMonth, setCalendarMonth] = useState('2026-10')
  const [viewMode, setViewMode] = useState('month') // 'month' | 'week' | 'agenda'
  const [loading, setLoading] = useState(true)
  const [savingTerm, setSavingTerm] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [importingHolidays, setImportingHolidays] = useState(false)
  const [calendarFile, setCalendarFile] = useState(null)
  const [showTermForm, setShowTermForm] = useState(false)
  const [editingTerm, setEditingTerm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [showAllEventsModal, setShowAllEventsModal] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const selectedTerm = useMemo(() => terms.find(term => String(term.term_id) === String(selectedId)), [terms, selectedId])
  const monthDate = useMemo(() => toDate(`${calendarMonth}-01`), [calendarMonth])

  // Full calendar grid with previous and next month dates to fill complete weeks
  const monthDays = useMemo(() => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const firstDay = new Date(year, month, 1, 12)
    const offset = (firstDay.getDay() + 6) % 7 // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0, 12).getDate()
    const daysInPrevMonth = new Date(year, month, 0, 12).getDate()

    const days = []
    // Previous month padding
    for (let i = offset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i, 12),
        isCurrentMonth: false,
      })
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i, 12),
        isCurrentMonth: true,
      })
    }
    // Next month padding to complete 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i, 12),
        isCurrentMonth: false,
      })
    }
    return days
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

  const upcomingEvents = useMemo(() => {
    const todayStr = localDateKey(new Date())
    const future = events
      .filter(e => (e.end_date || e.start_date) >= todayStr)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
    if (future.length > 0) {
      return future.slice(0, 5)
    }
    return [...events]
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5)
  }, [events])

  const holidaysClosuresCount = useMemo(() => {
    return events.filter(e => e.is_closure || e.event_type === 'holiday' || e.event_type === 'closure').length
  }, [events])

  const pendingReviewsCount = useMemo(() => {
    return events.filter(e => e.approval_status === 'pending').length
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
    if (next) {
      const today = localDateKey(new Date())
      setCalendarMonth(today >= next.start_date && today <= next.end_date ? today.slice(0, 7) : next.start_date.slice(0, 7))
    }
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
        if (chosen) {
          setSelectedId(String(chosen.term_id))
          const today = localDateKey(new Date())
          setCalendarMonth(today >= chosen.start_date && today <= chosen.end_date ? today.slice(0, 7) : chosen.start_date.slice(0, 7))
        } else {
          setShowTermForm(true)
        }
      })
      .catch(() => {
        if (alive) setError('Could not load the academic calendar. Check that the backend is running.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
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

  async function importHolidays() {
    if (!selectedTerm) return
    setError(''); setNotice(''); setImportingHolidays(true)
    try {
      const response = await axios.post(`${API}/calendar/terms/${selectedTerm.term_id}/holidays/import`)
      await loadEvents(selectedTerm.term_id)
      setNotice(`Imported ${response.data.imported} college calendar entries. ${response.data.skipped} duplicates or out-of-region entries were skipped.`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not import public holidays.')
    } finally { setImportingHolidays(false) }
  }

  async function importRegionalHolidays() {
    if (!selectedTerm) return
    setError(''); setNotice(''); setImportingHolidays(true)
    try {
      const response = await axios.post(`${API}/calendar/terms/${selectedTerm.term_id}/holidays/region`)
      await loadEvents(selectedTerm.term_id)
      setNotice((response.data.message || `Loaded ${response.data.imported} regional holiday suggestions.`) + (response.data.overlaps?.length ? ` Review ${response.data.overlaps.length} overlapping date pair(s) before approving entries.` : ''))
    } catch (err) {
      setError(err.response?.data?.detail || 'Regional holiday import failed.')
    } finally { setImportingHolidays(false) }
  }

  async function uploadCalendar(event) {
    if (event) event.preventDefault()
    if (!selectedTerm || !calendarFile) return
    setError(''); setNotice(''); setImportingHolidays(true)
    try {
      const form = new FormData()
      form.append('file', calendarFile)
      const response = await axios.post(`${API}/calendar/terms/${selectedTerm.term_id}/holidays/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      await loadEvents(selectedTerm.term_id)
      setNotice(response.data.message + (response.data.overlaps?.length ? ` Review ${response.data.overlaps.length} overlapping date pair(s) before approving entries.` : '') + (response.data.problems?.length ? ` Issues: ${response.data.problems.join(' ')}` : '') + ' Approve each valid entry. Approved closures will start date-aware rescheduling automatically.')
      setCalendarFile(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not import the calendar file.')
    } finally { setImportingHolidays(false) }
  }

  async function optimizeAfterCalendarApproval(eventTitle) {
    if (!selectedTerm) return
    setRescheduleReport(null)
    try {
      const response = await axios.post(`${API}/semester/terms/${selectedTerm.term_id}/optimize`)
      const report = response.data.calendar_reschedule_report
      const reportText = report
        ? ` ${report.affected_sessions} affected session(s), ${report.replacements_found} replacement(s) identified, ${report.unresolved_sessions?.length || 0} unresolved.`
        : ''
      setNotice(`Approved "${eventTitle}". Date-aware CP-SAT created draft v${response.data.version_number} with ${response.data.session_count} dated sessions.${reportText} Review the latest draft in Weekly Timetable before publishing.`)
    } catch (err) {
      const detail = err.response?.data?.detail
      const diagnostic = typeof detail === 'string'
        ? detail
        : [detail?.message, detail?.diagnostic, detail?.reason ? `Reason: ${detail.reason}` : ''].filter(Boolean).join(' ')
      setError(`"${eventTitle}" was approved, but automatic rescheduling could not create a semester draft: ${diagnostic || 'Check semester subjects, faculty assignments, rooms, time slots and constraints.'}`)
    }
  }

  async function approveImportedEvent(event) {
    try {
      const savedEvent = await axios.patch(`${API}/calendar/events/${event.event_id}`, {
        title: event.title, event_type: event.event_type, start_date: event.start_date,
        end_date: event.end_date, is_closure: event.is_closure,
        is_working_day_override: event.is_working_day_override,
        preferred_replacement_date: event.preferred_replacement_date || null,
        preferred_replacement_period: event.preferred_replacement_period || null,
        source: event.source, approval_status: 'approved', notes: event.notes,
      })
      await loadEvents(selectedTerm.term_id)
      if (savedEvent.data.approval_status !== 'approved') {
        setNotice(`"${event.title}" remains pending because overlapping calendar entries need review first.`)
        return
      }
      setNotice(`Approved "${event.title}".`)
      if (savedEvent.data.is_closure) await optimizeAfterCalendarApproval(event.title)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : detail?.message || 'Could not approve this event. Resolve any overlapping calendar entries and try again.')
    }
  }

  async function saveEvent(event) {
    event.preventDefault()
    if (!selectedTerm) return
    setError(''); setNotice(''); setSavingEvent(true)
    try {
      const payload = { ...eventForm, preferred_replacement_date: eventForm.preferred_replacement_date || null, preferred_replacement_period: eventForm.preferred_replacement_period ? Number(eventForm.preferred_replacement_period) : null, is_working_day_override: eventForm.event_type === 'working_day' ? true : null }
      const createdEvent = await axios.post(`${API}/calendar/terms/${selectedTerm.term_id}/events`, payload)
      await loadEvents(selectedTerm.term_id)
      setEventForm({ title: '', event_type: 'holiday', start_date: '', end_date: '', is_closure: true, approval_status: 'pending', source: 'manual', notes: '', preferred_replacement_date: '', preferred_replacement_period: '' })
      setShowEventForm(false)
      setNotice(createdEvent.data.approval_status === 'pending' ? 'Calendar event saved for review. Approve a closure to start date-aware rescheduling.' : 'Calendar event saved.')
      if (createdEvent.data.approval_status === 'approved' && createdEvent.data.is_closure) {
        await optimizeAfterCalendarApproval(createdEvent.data.title || payload.title)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save this calendar event.')
    } finally { setSavingEvent(false) }
  }

  async function deleteSelectedTerm() {
    if (!selectedTerm) return
    if (!window.confirm('Permanently remove ' + selectedTerm.term_name + ' (' + selectedTerm.academic_year + ')? This also clears all generated timetable versions, subject definitions, teaching assignments, legacy timetable rows, and semester-scoped constraints because the current database stores these outside a semester-specific boundary. Departments, classes/divisions, global faculty, rooms, time slots, and global constraints will be kept. This cannot be undone.')) return
    setError(''); setNotice('')
    try {
      await axios.delete(API + '/calendar/terms/' + selectedTerm.term_id)
      const preferred = await loadTerms('')
      if (!preferred) setShowTermForm(true)
      setNotice(preferred
        ? 'Semester removed. The next remaining semester is now active.'
        : 'Semester removed. Create a new semester to continue.')
    } catch (e) {
      const d = e.response?.data?.detail
      setError(typeof d === 'string' ? d : d?.message || 'This semester could not be deleted. Preserve semesters that already have timetable history.')
    }
  }

  async function removeImportedEvents() {
    if (!selectedTerm) return
    const confirmed = window.confirm('Remove all imported regional, college-template, and uploaded calendar entries for this term? Manually added events will be kept.')
    if (!confirmed) return
    setError(''); setNotice('')
    try {
      const response = await axios.delete(`${API}/calendar/terms/${selectedTerm.term_id}/events/imported`)
      await loadEvents(selectedTerm.term_id)
      setNotice(response.data.message || `Removed ${response.data.deleted} imported entries.`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not remove imported calendar entries.')
    }
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


  function handleFileDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file && ['.xlsx', '.csv', '.pdf'].some(ext => file.name.toLowerCase().endsWith(ext))) {
      setCalendarFile(file)
    }
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

  return (
    <>
      <style>{`
        .cal-page-wrap {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px 32px 50px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: var(--text-main, #172033);
        }

        /* ─── Breadcrumb & Header ─── */
        .cal-breadcrumb {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .08em;
          color: #2563eb;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .cal-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }
        .cal-title {
          margin: 0;
          font-size: 29px;
          font-weight: 800;
          letter-spacing: -.03em;
          color: var(--text-main, #111827);
          line-height: 1.2;
        }
        .cal-subtitle {
          margin: 5px 0 0;
          font-size: 13.5px;
          color: var(--text-muted, #64748b);
          line-height: 1.45;
        }
        .cal-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cal-btn-add {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #1f2937;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all .15s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
        }
        .cal-btn-add:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }
        .cal-btn-generate {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 18px;
          border-radius: 8px;
          border: none;
          background: #2563eb;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all .15s ease;
          box-shadow: 0 2px 8px rgba(37,99,235,.28);
        }
        .cal-btn-generate:hover {
          background: #1d4ed8;
          box-shadow: 0 4px 12px rgba(37,99,235,.35);
        }

        /* ─── Filter & View Switcher Row ─── */
        .cal-filter-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .cal-pills-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .cal-pill {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 9px 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main, #1e293b);
          box-shadow: 0 1px 3px rgba(15,23,42,.03);
          cursor: pointer;
          transition: all .15s;
          user-select: none;
        }
        .cal-pill:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 6px rgba(15,23,42,.06);
        }
        .cal-pill select {
          border: none;
          background: transparent;
          font: inherit;
          color: inherit;
          font-weight: 600;
          outline: none;
          cursor: pointer;
          appearance: none;
          padding-right: 4px;
        }
        .cal-view-tabs {
          display: inline-flex;
          align-items: center;
          padding: 3px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(15,23,42,.03);
        }
        .cal-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 15px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-muted, #64748b);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all .15s;
        }
        .cal-tab-btn.active {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 1px 4px rgba(37,99,235,.25);
        }

        /* ─── Info Cards ─── */
        .cal-metric-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }
        @media (max-width: 1024px) {
          .cal-metric-cards { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .cal-metric-cards { grid-template-columns: 1fr; }
        }
        .cal-metric-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          background: #ffffff;
          border: 1px solid #e8edf3;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(15,23,42,.02);
        }
        .cal-metric-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cal-metric-label {
          font-size: 11.5px;
          color: var(--text-muted, #64748b);
          margin-bottom: 2px;
          font-weight: 500;
        }
        .cal-metric-value {
          font-size: 17px;
          font-weight: 800;
          color: var(--text-main, #111827);
          line-height: 1.25;
        }
        .cal-metric-sub {
          font-size: 11px;
          color: var(--text-muted, #94a3b8);
          margin-top: 2px;
        }

        /* ─── Import & Management Box ─── */
        .cal-import-card {
          background: #ffffff;
          border: 1px solid #e8edf3;
          border-radius: 14px;
          padding: 18px 22px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          box-shadow: 0 1px 3px rgba(15,23,42,.02);
          flex-wrap: wrap;
        }
        .cal-import-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 280px;
        }
        .cal-import-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cal-import-title {
          font-size: 14.5px;
          font-weight: 700;
          color: var(--text-main, #111827);
        }
        .cal-import-desc {
          font-size: 11.5px;
          color: var(--text-muted, #64748b);
          margin-top: 3px;
          line-height: 1.4;
        }
        .cal-dropzone {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 8px 14px;
          border: 1.5px dashed #bfdbfe;
          border-radius: 12px;
          background: #f8fafc;
          transition: all .15s;
          flex-wrap: wrap;
        }
        .cal-dropzone.active {
          border-color: #2563eb;
          background: #eff6ff;
        }
        .cal-dropzone-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .cal-dropzone-text {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-main, #1e293b);
        }
        .cal-dropzone-sub {
          font-size: 10.5px;
          color: #94a3b8;
        }
        .cal-btn-choose {
          padding: 6px 12px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          font-size: 11.5px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
        }
        .cal-btn-upload {
          padding: 7px 14px;
          background: #2563eb;
          border: none;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          transition: all .15s;
        }
        .cal-btn-upload:hover {
          background: #1d4ed8;
        }
        .cal-btn-upload:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        /* ─── Actions Row ─── */
        .cal-actions-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }
        .cal-action-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-main, #1e293b);
          cursor: pointer;
          transition: all .15s;
          box-shadow: 0 1px 2px rgba(15,23,42,.03);
        }
        .cal-action-pill:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .cal-action-pill.regional {
          background: #f0fdf4;
          border-color: #86efac;
          color: #166534;
        }
        .cal-action-pill.regional:hover {
          background: #dcfce7;
        }
        .cal-action-pill.danger {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }
        .cal-action-pill.danger:hover {
          background: #fee2e2;
        }

        /* ─── Main Two-Column Layout ─── */
        .cal-main-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 350px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1080px) {
          .cal-main-layout { grid-template-columns: 1fr; }
        }

        /* ─── Left: Calendar Box ─── */
        .cal-calendar-box {
          background: #ffffff;
          border: 1px solid #e8edf3;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(15,23,42,.02);
        }
        .cal-month-nav-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-bottom: 1px solid #f1f5f9;
        }
        .cal-nav-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cal-nav-arrow {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 8px;
          color: #475569;
          cursor: pointer;
          transition: all .15s;
        }
        .cal-nav-arrow:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .cal-btn-today {
          padding: 6px 14px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
        }
        .cal-btn-today:hover {
          background: #f8fafc;
        }
        .cal-current-month-label {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-main, #111827);
          letter-spacing: -.02em;
        }
        .cal-month-term-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          background: #ffffff;
        }

        /* Calendar Grid */
        .cal-grid-table {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          border-bottom: 1px solid #f1f5f9;
        }
        .cal-th {
          padding: 10px 4px;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          background: #f8fafc;
          border-bottom: 1px solid #edf2f7;
        }
        .cal-td {
          min-height: 84px;
          padding: 6px 7px;
          border-right: 1px solid #f1f5f9;
          border-bottom: 1px solid #f1f5f9;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: background .12s;
        }
        .cal-td:nth-child(7n) {
          border-right: none;
        }
        .cal-td.faded {
          background: #fbfcfe;
          opacity: .5;
        }
        .cal-td.today-cell {
          background: #eff6ff;
          box-shadow: inset 0 0 0 1.5px #2563eb;
        }
        .cal-date-top {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .cal-date-num {
          font-size: 12px;
          font-weight: 600;
          color: #1e293b;
        }
        .cal-td.faded .cal-date-num {
          color: #94a3b8;
        }
        .cal-td.today-cell .cal-date-num {
          color: #1d4ed8;
          font-weight: 800;
        }
        .cal-badge-today {
          font-size: 9.5px;
          font-weight: 800;
          color: #2563eb;
          letter-spacing: .03em;
        }

        /* Chips inside days */
        .cal-chip {
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          line-height: 1.35;
          margin-bottom: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border-left: 3px solid #dc2626;
          background: #fee2e2;
          color: #991b1b;
        }
        .cal-chip.exam {
          border-left-color: #7c3aed;
          background: #ede9fe;
          color: #5b21b6;
        }
        .cal-chip.other {
          border-left-color: #2563eb;
          background: #dbeafe;
          color: #1e40af;
        }
        .cal-chip.working {
          border-left-color: #059669;
          background: #dcfce7;
          color: #065f46;
        }

        /* Legend */
        .cal-legend-bar {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 12px 20px;
          font-size: 11.5px;
          color: #64748b;
          flex-wrap: wrap;
        }
        .cal-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .cal-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        /* ─── Right Sidebar ─── */
        .cal-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .cal-side-card {
          background: #ffffff;
          border: 1px solid #e8edf3;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(15,23,42,.02);
        }
        .cal-side-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .cal-side-title {
          font-size: 14px;
          font-weight: 750;
          color: var(--text-main, #111827);
        }
        .cal-view-all-link {
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .cal-view-all-link:hover {
          text-decoration: underline;
        }

        /* Readiness Progress Section */
        .cal-readiness-box {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
          padding-bottom: 14px;
          border-bottom: 1px solid #f1f5f9;
        }
        .cal-checklist {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .cal-check-item {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 12.5px;
          font-weight: 500;
          color: #334155;
        }

        /* Upcoming events list */
        .cal-upcoming-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .cal-upcoming-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .cal-upcoming-date-box {
          width: 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-right: 2px solid #2563eb;
          padding-right: 8px;
          flex-shrink: 0;
        }
        .cal-upcoming-day {
          font-size: 15px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
        }
        .cal-upcoming-mon {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .cal-upcoming-info {
          flex: 1;
          min-width: 0;
        }
        .cal-upcoming-name {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--text-main, #111827);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cal-upcoming-meta {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .cal-upcoming-meta.closure {
          color: #dc2626;
        }
        .cal-badge-status {
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 10.5px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .cal-badge-status.approved {
          background: #dcfce7;
          color: #166534;
        }
        .cal-badge-status.pending {
          background: #fef3c7;
          color: #92400e;
        }

        /* ─── Modals / Overlay Forms ─── */
        .cal-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,.45);
          backdrop-filter: blur(3px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .cal-modal-content {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px 28px;
          width: 100%;
          max-width: 580px;
          box-shadow: 0 20px 40px rgba(0,0,0,.15);
          max-height: 90vh;
          overflow-y: auto;
        }

        /* Dark mode */
        html[data-theme="dark"] .cal-page-wrap { color: #f1f5f9; }
        html[data-theme="dark"] .cal-title { color: #f8fafc; }
        html[data-theme="dark"] .cal-btn-add { background: #0f172a; border-color: #334155; color: #f1f5f9; }
        html[data-theme="dark"] .cal-pill { background: #0f172a; border-color: #334155; color: #f1f5f9; }
        html[data-theme="dark"] .cal-view-tabs { background: #0f172a; border-color: #334155; }
        html[data-theme="dark"] .cal-metric-card { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-import-card { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-action-pill { background: #0f172a; border-color: #334155; color: #f1f5f9; }
        html[data-theme="dark"] .cal-calendar-box { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-side-card { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-month-nav-bar { border-color: #1e293b; }
        html[data-theme="dark"] .cal-th { background: #1e293b; border-color: #334155; color: #94a3b8; }
        html[data-theme="dark"] .cal-td { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-td.faded { background: #090e1a; }
        html[data-theme="dark"] .cal-td.today-cell { background: #1e293b; box-shadow: inset 0 0 0 1.5px #3b82f6; }
        html[data-theme="dark"] .cal-grid-table { border-color: #1e293b; }
        html[data-theme="dark"] .cal-modal-content { background: #0f172a; color: #f1f5f9; }
        html[data-theme="dark"] .cal-dropzone { background: #1e293b; border-color: #3b82f6; }
        html[data-theme="dark"] .cal-btn-choose { background: #0f172a; border-color: #475569; color: #f1f5f9; }
        html[data-theme="dark"] .cal-upcoming-item { border-color: #1e293b; }
        html[data-theme="dark"] .cal-readiness-box { border-color: #1e293b; }
        html[data-theme="dark"] .cal-date-num { color: #f1f5f9; }
        html[data-theme="dark"] .cal-upcoming-day { color: #f8fafc; }
      `}</style>

      <div className="cal-page-wrap">
        {/* ─── Top Breadcrumb & Header ─── */}
        <div className="cal-breadcrumb">SCHEDULE &gt; ACADEMIC CALENDAR</div>
        <div className="cal-header-row">
          <div>
            <h1 className="cal-title">Academic Calendar</h1>
            <p className="cal-subtitle">Manage semester dates, import institutional calendars, and review holidays. Approved closures trigger date-aware rescheduling automatically.</p>
          </div>
          <div className="cal-header-actions">
            <button type="button" className="cal-btn-add" onClick={() => setShowEventForm(true)}>
              <PlusIcon /> Add event
            </button>

          </div>
        </div>

        {rescheduleReport?.unresolved_sessions?.length > 0 && (
          <div role="alert" style={{margin:'12px 0 16px',padding:14,border:'1px solid #fbbf24',background:'#fffbeb',color:'#78350f',borderRadius:10}}>
            <div style={{fontWeight:800,fontSize:13,marginBottom:8}}>Unresolved makeup sessions</div>
            <div style={{fontSize:12,lineHeight:1.55,marginBottom:8}}>
              The solver preserved hard constraints but could not place every makeup session inside this semester. Review these items and adjust availability, rooms, assignments or preferences before optimizing again.
            </div>
            <div style={{display:'grid',gap:6}}>
              {rescheduleReport.unresolved_sessions.map((item,index) => (
                <div key={`${item.original_session_id ?? 'new'}-${item.class_id}-${item.subject_id}-${index}`} style={{padding:'7px 9px',background:'rgba(255,255,255,.65)',borderRadius:7}}>
                  <strong>{item.date ? `Original date ${item.date}` : 'Makeup session'} · Class {item.class_id} · Subject {item.subject_id}</strong>
                  {item.period_number ? ` · Period ${item.period_number}` : ''}
                  <div>{item.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ─── Filter & View Switcher Row ─── */}
        <div className="cal-filter-row">
          <div className="cal-pills-group">
            {/* Pill 1: Academic Year & Term */}
            <div className="cal-pill">
              <CapIcon />
              {selectedTerm ? (
                <span>{selectedTerm.academic_year} · {selectedTerm.term_name}</span>
              ) : (
                <span>No active semester — create one</span>
              )}
            </div>

            {/* Pill 2: Term Date Range */}
            <div className="cal-pill">
              <CalendarIcon />
              <span>
                {selectedTerm
                  ? `${toDate(selectedTerm.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${toDate(selectedTerm.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : '1 Jul – 30 Dec 2026'}
              </span>
              <ChevronDown />
            </div>

            {/* Pill 3: Region */}
            <div className="cal-pill">
              <PinIcon />
              <span>{selectedTerm?.holiday_region || 'Maharashtra, India'}</span>
              <ChevronDown />
            </div>
          </div>

          {/* Right: View Toggle */}
          <div className="cal-view-tabs">
            <button
              type="button"
              className={`cal-tab-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              <CalendarIcon /> Month
            </button>
            <button
              type="button"
              className={`cal-tab-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              <TemplateIcon /> Week
            </button>
            <button
              type="button"
              className={`cal-tab-btn ${viewMode === 'agenda' ? 'active' : ''}`}
              onClick={() => setViewMode('agenda')}
            >
              <BookIcon /> Agenda
            </button>
          </div>
        </div>

        {/* ─── Metric Cards ─── */}
        <div className="cal-metric-cards">
          {/* Card 1: Semester period */}
          <div className="cal-metric-card">
            <div className="cal-metric-icon-box" style={{ background: '#eff6ff' }}>
              <BookIcon />
            </div>
            <div>
              <div className="cal-metric-label">Semester period</div>
              <div className="cal-metric-value">
                {selectedTerm
                  ? `${toDate(selectedTerm.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${toDate(selectedTerm.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : '1 Jul – 30 Dec 2026'}
              </div>
              <div className="cal-metric-sub">
                {selectedTerm ? `${selectedTerm.term_name} · ${selectedTerm.academic_year}` : 'Semester 1 · 2026 – 27'}
              </div>
            </div>
          </div>

          {/* Card 2: Total events */}
          <div className="cal-metric-card">
            <div className="cal-metric-icon-box" style={{ background: '#ecfdf5' }}>
              <CheckCalendarIcon />
            </div>
            <div>
              <div className="cal-metric-label">Total events</div>
              <div className="cal-metric-value">{events.length}</div>
              <div className="cal-metric-sub">College calendar and additions</div>
            </div>
          </div>

          {/* Card 3: Holidays / closures */}
          <div className="cal-metric-card">
            <div className="cal-metric-icon-box" style={{ background: '#fef2f2' }}>
              <TagCalendarIcon />
            </div>
            <div>
              <div className="cal-metric-label">Holidays / closures</div>
              <div className="cal-metric-value">{holidaysClosuresCount}</div>
              <div className="cal-metric-sub">Holidays, closures and breaks</div>
            </div>
          </div>

          {/* Card 4: Pending reviews */}
          <div className="cal-metric-card">
            <div className="cal-metric-icon-box" style={{ background: '#fef3c7' }}>
              <ClockIcon />
            </div>
            <div>
              <div className="cal-metric-label">Pending reviews</div>
              <div className="cal-metric-value">{pendingReviewsCount}</div>
              <div className="cal-metric-sub">Events awaiting approval</div>
            </div>
          </div>
        </div>

        {/* ─── Import Section ─── */}
        <div className="cal-import-card">
          <div className="cal-import-left">
            <div className="cal-import-icon-box">
              <UploadIcon />
            </div>
            <div>
              <div className="cal-import-title">Import your institution calendar</div>
              <div className="cal-import-desc">
                Upload an Excel (.xlsx) or CSV file with Date and Title/Event columns. Optional columns: End Date, Type, Closure.
              </div>
            </div>
          </div>

          <div
            className={`cal-dropzone ${dragOver ? 'active' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            <div className="cal-dropzone-info">
              <FileDocIcon />
              <div>
                <div className="cal-dropzone-text">
                  {calendarFile ? calendarFile.name : 'Drag and drop your file here'}
                </div>
                <div className="cal-dropzone-sub">PDF, Excel (.xlsx) or CSV (.csv)</div>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.xlsx,.csv"
              style={{ display: 'none' }}
              onChange={e => setCalendarFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="cal-btn-choose"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </button>
            <button
              type="button"
              className="cal-btn-upload"
              disabled={!calendarFile || importingHolidays}
              onClick={uploadCalendar}
            >
              {importingHolidays ? 'Uploading…' : 'Upload & preview'}
            </button>
          </div>
        </div>

        {/* ─── Action Pills Row ─── */}
        <div className="cal-actions-row">
          <button
            type="button"
            className="cal-action-pill"
            onClick={() => { setEditingTerm(false); setTermForm(DEFAULT_TERM); setShowTermForm(true) }}
          >
            <PlusIcon /> New term
          </button>
          <button
            type="button"
            className="cal-action-pill"
            disabled={!selectedTerm}
            onClick={() => { setEditingTerm(true); setTermForm({ ...selectedTerm }); setShowTermForm(true) }}
          >
            <EditIcon /> Edit term
          </button>
          <button
            type="button"
            className="cal-action-pill regional"
            disabled={!selectedTerm || importingHolidays}
            onClick={importRegionalHolidays}
          >
            <RefreshIcon /> {importingHolidays ? 'Loading…' : 'Load regional holidays'}
          </button>
          <button
            type="button"
            className="cal-action-pill"
            disabled={!selectedTerm || importingHolidays}
            onClick={importHolidays}
          >
            <TemplateIcon /> {importingHolidays ? 'Loading…' : 'Load college template'}
          </button>
          <button
            type="button"
            className="cal-action-pill danger"
            disabled={!selectedTerm}
            onClick={removeImportedEvents}
          >
            <TrashIcon /> Remove imported entries
          </button>
          <button
            type="button"
            className="cal-action-pill danger"
            disabled={!selectedTerm}
            onClick={deleteSelectedTerm}
            title="Permanently remove this semester and its semester-specific data; shared structure and global faculty are preserved"
          >
            <TrashIcon /> Delete semester
          </button>
        </div>

        {/* Notices */}
        {notice && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 13, marginBottom: 16 }}>
            {notice}
          </div>
        )}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ─── Two-Column Main Content Layout ─── */}
        <div className="cal-main-layout">
          {/* Left Column: Calendar Grid or Agenda */}
          <div className="cal-calendar-box">
            {/* Header with nav buttons */}
            <div className="cal-month-nav-bar">
              <div className="cal-nav-controls">
                <button
                  type="button"
                  className="cal-nav-arrow"
                  aria-label="Previous month"
                  onClick={() => setCalendarMonth(localDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1, 12)).slice(0, 7))}
                >
                  <ChevronLeft />
                </button>
                <button
                  type="button"
                  className="cal-nav-arrow"
                  aria-label="Next month"
                  onClick={() => setCalendarMonth(localDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1, 12)).slice(0, 7))}
                >
                  <ChevronRight />
                </button>
                <button
                  type="button"
                  className="cal-btn-today"
                  onClick={() => setCalendarMonth(localDateKey(new Date()).slice(0, 7))}
                >
                  Today
                </button>
              </div>

              <div className="cal-current-month-label">
                {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>

              <div className="cal-month-term-badge">
                <CapIcon />
                <span>{selectedTerm ? `${selectedTerm.academic_year} · ${selectedTerm.term_name}` : '2026 – 27 · Semester 1'}</span>
                <ChevronDown />
              </div>
            </div>

            {/* View Mode: Month Grid */}
            {viewMode === 'month' && (
              <>
                <div className="cal-grid-table">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="cal-th">{day}</div>
                  ))}
                  {monthDays.map((item, index) => {
                    const { date, isCurrentMonth } = item
                    const key = localDateKey(date)
                    const dayEvents = eventsByDate[key] || []
                    const isToday = key === localDateKey(new Date())
                    const isOutsideTerm = selectedTerm && (date < toDate(selectedTerm.start_date) || date > toDate(selectedTerm.end_date))

                    let cls = 'cal-td'
                    if (!isCurrentMonth || isOutsideTerm) cls += ' faded'
                    if (isToday) cls += ' today-cell'

                    return (
                      <div key={key + '-' + index} className={cls}>
                        <div className="cal-date-top">
                          <span className="cal-date-num">{date.getDate()}</span>
                          {isToday && <span className="cal-badge-today">TODAY</span>}
                        </div>
                        <div>
                          {dayEvents.slice(0, 2).map((evt, i) => {
                            let chipCls = 'cal-chip'
                            if (evt.event_type === 'exam') chipCls += ' exam'
                            else if (evt.event_type === 'working_day') chipCls += ' working'
                            else if (!evt.is_closure && evt.event_type !== 'holiday') chipCls += ' other'

                            return (
                              <div
                                key={evt.event_id || i}
                                className={chipCls}
                                title={`${evt.title} (${evt.event_type})`}
                              >
                                {evt.title}
                              </div>
                            )
                          })}
                          {dayEvents.length > 2 && (
                            <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 600, paddingLeft: 2 }}>
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="cal-legend-bar">
                  <div className="cal-legend-item">
                    <span className="cal-dot" style={{ background: '#dc2626' }} />
                    <span>Holiday / closure</span>
                  </div>
                  <div className="cal-legend-item">
                    <span className="cal-dot" style={{ background: '#7c3aed' }} />
                    <span>Exam</span>
                  </div>
                  <div className="cal-legend-item">
                    <span className="cal-dot" style={{ background: '#2563eb' }} />
                    <span>Other event</span>
                  </div>
                  <div className="cal-legend-item" style={{ color: '#94a3b8' }}>
                    <span className="cal-dot" style={{ background: '#cbd5e1' }} />
                    <span>Faded dates are outside this term</span>
                  </div>
                </div>
              </>
            )}

            {/* View Mode: Week or Agenda */}
            {(viewMode === 'week' || viewMode === 'agenda') && (
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {viewMode === 'agenda' ? 'All Scheduled Calendar Events' : 'Weekly View Events'}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="cal-btn-add"
                      style={{ fontSize: 12, padding: '5px 12px', background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
                      onClick={() => setShowAllEventsModal(true)}
                    >
                      ⤢ Open in Pop-Up Screen
                    </button>
                    <button
                      type="button"
                      className="cal-btn-add"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => setViewMode('month')}
                    >
                      Back to Month Grid
                    </button>
                  </div>
                </div>
                {groupedEvents.map(([month, monthEvents]) => (
                  <div key={month} style={{ marginBottom: 20 }}>
                    <div style={{ background: '#f8fafc', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 750, color: '#475569', marginBottom: 8 }}>
                      {toDate(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </div>
                    {monthEvents.map(evt => (
                      <div key={evt.event_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ minWidth: 80, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                            {dateLabel(evt.start_date)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{evt.title}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {EVENT_TYPES.find(t => t.value === evt.event_type)?.label || evt.event_type} · {evt.source}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`cal-badge-status ${evt.approval_status}`}>{evt.approval_status}</span>
                          {evt.approval_status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => approveImportedEvent(evt)}
                              style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeEvent(evt.event_id)}
                            style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Sidebar */}
          <div className="cal-sidebar">
            {/* 1. Scheduling Readiness */}
            <div className="cal-side-card">
              <div className="cal-side-header">
                <div className="cal-side-title">Scheduling readiness</div>
              </div>

              <div className="cal-readiness-box">
                {/* 75% Circular Ring */}
                <div style={{ width: 62, height: 62, flexShrink: 0, position: 'relative' }}>
                  <svg width="62" height="62" viewBox="0 0 62 62">
                    <circle cx="31" cy="31" r="24" stroke="#e2e8f0" strokeWidth="5.5" fill="none" />
                    <circle
                      cx="31"
                      cy="31"
                      r="24"
                      stroke="#0d9488"
                      strokeWidth="5.5"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={2 * Math.PI * 24 * (1 - 0.75)}
                      strokeLinecap="round"
                      transform="rotate(-90 31 31)"
                    />
                    <text x="31" y="36" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f766e">
                      75%
                    </text>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 750, color: '#d97706' }}>Almost ready</div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, lineHeight: 1.35 }}>
                    Complete the remaining items to generate the timetable.
                  </div>
                </div>
              </div>

              {/* Checklist */}
              <div className="cal-checklist">
                <div className="cal-check-item">
                  <CheckCircleIcon />
                  <span>Calendar synced</span>
                </div>
                <div className="cal-check-item">
                  <CheckCircleIcon />
                  <span>Faculty availability configured</span>
                </div>
                <div className="cal-check-item">
                  <CheckCircleIcon />
                  <span>Rooms configured</span>
                </div>
                <div className="cal-check-item">
                  <AlertTriangleIcon />
                  <span style={{ color: '#b45309', fontWeight: 600 }}>Constraints active</span>
                </div>
              </div>
            </div>

            {/* 2. Upcoming events */}
            <div className="cal-side-card">
              <div className="cal-side-header">
                <div className="cal-side-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>Upcoming events</span>
                  <span style={{
                    background: '#eff6ff',
                    color: '#2563eb',
                    padding: '1.5px 7px',
                    borderRadius: 10,
                    fontSize: 10.5,
                    fontWeight: 800,
                  }}>
                    {events.length}
                  </span>
                </div>
                <div
                  className="cal-view-all-link"
                  onClick={() => setShowAllEventsModal(true)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Open upcoming & scheduled events in a pop-up screen"
                >
                  View all <ArrowRightIcon />
                </div>
              </div>

              <div>
                {upcomingEvents.length === 0 ? (
                  <div style={{ padding: '16px 4px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    No upcoming events scheduled
                  </div>
                ) : (
                  upcomingEvents.map(evt => {
                    const d = toDate(evt.start_date)
                    const isClosure = evt.is_closure || evt.event_type === 'holiday' || evt.event_type === 'closure'
                    return (
                      <div
                        key={evt.event_id}
                        className="cal-upcoming-item"
                        onClick={() => setShowAllEventsModal(true)}
                        style={{ cursor: 'pointer' }}
                        title="Click to view all events pop-up"
                      >
                        <div className="cal-upcoming-date-box" style={{ borderRightColor: isClosure ? '#dc2626' : '#2563eb' }}>
                          <div className="cal-upcoming-day">{d.getDate()}</div>
                          <div className="cal-upcoming-mon">
                            {d.toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                        </div>
                        <div className="cal-upcoming-info">
                          <div className="cal-upcoming-name" title={evt.title}>{evt.title}</div>
                          <div className={`cal-upcoming-meta ${isClosure ? 'closure' : ''}`}>
                            {isClosure ? 'Holiday / closure' : (EVENT_TYPES.find(t => t.value === evt.event_type)?.label || 'College event')}
                          </div>
                        </div>
                        <span className={`cal-badge-status ${evt.approval_status}`}>
                          {evt.approval_status === 'approved' ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              {events.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllEventsModal(true)}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 9,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#2563eb',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd' }}
                  onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                >
                  <span>Browse all {events.length} events categorized by month</span>
                  <ArrowRightIcon />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modal: Add / Edit Event ─── */}
      {showEventForm && selectedTerm && (
        <div className="cal-modal-overlay" onClick={() => setShowEventForm(false)}>
          <div className="cal-modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add Calendar Event</h2>
              <button
                type="button"
                onClick={() => setShowEventForm(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveEvent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldInput label="Event title">
                    <input
                      style={inputCls}
                      value={eventForm.title}
                      onChange={e => setEventField('title', e.target.value)}
                      placeholder="e.g. College Foundation Day"
                      required
                    />
                  </FieldInput>
                </div>
                <FieldInput label="Event type">
                  <select
                    style={inputCls}
                    value={eventForm.event_type}
                    onChange={e => {
                      setEventField('event_type', e.target.value)
                      setEventField('is_closure', e.target.value !== 'exam' && e.target.value !== 'event' && e.target.value !== 'working_day')
                    }}
                  >
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </FieldInput>
                <FieldInput label="Status">
                  <select
                    style={inputCls}
                    value={eventForm.approval_status}
                    onChange={e => setEventField('approval_status', e.target.value)}
                  >
                    <option value="pending">Pending review</option>
                    <option value="approved">Approved</option>
                  </select>
                </FieldInput>
                <FieldInput label="Start date">
                  <input
                    style={inputCls}
                    type="date"
                    min={selectedTerm.start_date}
                    max={selectedTerm.end_date}
                    value={eventForm.start_date}
                    onChange={e => {
                      setEventField('start_date', e.target.value)
                      if (!eventForm.end_date || eventForm.end_date < e.target.value) {
                        setEventField('end_date', e.target.value)
                      }
                    }}
                    required
                  />
                </FieldInput>
                <FieldInput label="End date">
                  <input
                    style={inputCls}
                    type="date"
                    min={eventForm.start_date || selectedTerm.start_date}
                    max={selectedTerm.end_date}
                    value={eventForm.end_date}
                    onChange={e => setEventField('end_date', e.target.value)}
                    required
                  />
                </FieldInput>
                <FieldInput label="Preferred replacement date (optional)">
                  <input style={inputCls} type="date" min={selectedTerm.start_date} max={selectedTerm.end_date} value={eventForm.preferred_replacement_date || ''} onChange={e => setEventField('preferred_replacement_date', e.target.value)} />
                </FieldInput>
                <FieldInput label="Preferred replacement period (optional)">
                  <input style={inputCls} type="number" min="1" max="20" value={eventForm.preferred_replacement_period || ''} onChange={e => setEventField('preferred_replacement_period', e.target.value)} placeholder="e.g. 3" />
                </FieldInput>
                <div style={{ gridColumn: '1 / -1', marginTop: -6, fontSize: 11.5, lineHeight: 1.45, color: '#64748b' }}>
                  Preferred date and period are optional soft preferences. Leave them blank and the solver will choose a valid replacement slot, preferring the same week and then later weeks within this semester.
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldInput label="Notes (optional)">
                    <input
                      style={inputCls}
                      value={eventForm.notes}
                      onChange={e => setEventField('notes', e.target.value)}
                      placeholder="Additional details"
                    />
                  </FieldInput>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={eventForm.is_closure}
                  disabled={eventForm.event_type === 'working_day'}
                  onChange={e => setEventField('is_closure', e.target.checked)}
                  style={{ accentColor: '#2563eb' }}
                />
                <span>No regular classes on these dates (Closure)</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  className="cal-btn-add"
                  onClick={() => setShowEventForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cal-btn-upload"
                  disabled={savingEvent || !eventForm.start_date || !eventForm.end_date}
                >
                  {savingEvent ? 'Saving…' : 'Save event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: New / Edit Term ─── */}
      {showTermForm && (
        <div className="cal-modal-overlay" onClick={() => setShowTermForm(false)}>
          <div className="cal-modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {editingTerm ? 'Edit Academic Term' : 'Configure New Academic Term'}
              </h2>
              <button
                type="button"
                onClick={() => setShowTermForm(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={createTerm}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <FieldInput label="Academic year">
                  <input style={inputCls} value={termForm.academic_year} onChange={e => setTermField('academic_year', e.target.value)} required />
                </FieldInput>
                <FieldInput label="Term name">
                  <input style={inputCls} value={termForm.term_name} onChange={e => setTermField('term_name', e.target.value)} required />
                </FieldInput>
                <FieldInput label="Start date">
                  <input style={inputCls} type="date" value={termForm.start_date} onChange={e => setTermField('start_date', e.target.value)} required />
                </FieldInput>
                <FieldInput label="End date">
                  <input style={inputCls} type="date" min={termForm.start_date} value={termForm.end_date} onChange={e => setTermField('end_date', e.target.value)} required />
                </FieldInput>
                <FieldInput label="Holiday region">
                  <input style={inputCls} value={termForm.holiday_region} onChange={e => setTermField('holiday_region', e.target.value)} required />
                </FieldInput>
                <FieldInput label="Time zone">
                  <select style={inputCls} value={termForm.timezone} onChange={e => setTermField('timezone', e.target.value)}>
                    <option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                  </select>
                </FieldInput>
                <FieldInput label="Rescheduling policy">
                  <select style={inputCls} value={termForm.reschedule_policy} onChange={e => setTermField('reschedule_policy', e.target.value)}>
                    <option value="cancel">Mark cancelled; no replacement</option>
                    <option value="suggest">Suggest replacements for approval</option>
                    <option value="automatic">Automatic rescheduling</option>
                  </select>
                </FieldInput>
                <FieldInput label="Term status">
                  <select style={inputCls} value={termForm.status} onChange={e => setTermField('status', e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </FieldInput>
              </div>


              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                <button
                  type="button"
                  className="cal-btn-add"
                  onClick={() => setShowTermForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cal-btn-upload"
                  disabled={savingTerm}
                >
                  {savingTerm ? 'Saving…' : editingTerm ? 'Save changes' : 'Save term'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: All Upcoming Events (Categorized by Month) ─── */}
      <UpcomingEventsModal
        isOpen={showAllEventsModal}
        onClose={() => setShowAllEventsModal(false)}
        events={events}
        selectedTerm={selectedTerm}
        onApproveEvent={approveImportedEvent}
        onDeleteEvent={removeEvent}
        onOpenAddEvent={() => setShowEventForm(true)}
      />
    </>
  )
}
