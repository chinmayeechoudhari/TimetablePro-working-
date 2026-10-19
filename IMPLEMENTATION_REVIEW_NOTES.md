# TimetablePro workflow implementation notes

Branch: `feature/date-aware-semester-solver`

This file is a temporary inspection artifact containing source snapshots used to plan the requested edits. It should be removed after implementation.

===== frontend/src/components/CalendarPage.jsx =====
import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [terms, setTerms] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [termForm, setTermForm] = useState(DEFAULT_TERM)
  const [eventForm, setEventForm] = useState({
    title: '', event_type: 'holiday', start_date: '', end_date: '',
    is_closure: true, approval_status: 'pending', source: 'manual', notes: '',
    preferred_replacement_date: '', preferred_replacement_period: ''
  })
  const [events, setEvents] = useState([])
  const [semesterVersions, setSemesterVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [versionSessions, setVersionSessions] = useState([])
  const [optimizingSemester, setOptimizingSemester] = useState(false)
  const [versionError, setVersionError] = useState('')
  const [loadValidation, setLoadValidation] = useState(null)

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
    if (!selectedId) { setSemesterVersions([]); setSelectedVersionId(''); setVersionSessions([]); return }
    let active = true
    axios.get(API + '/semester/terms/' + selectedId + '/versions')
      .then(r => {
        if (!active) return
        const versions = Array.isArray(r.data) ? r.data : []
        setSemesterVersions(versions)
        setSelectedVersionId(current => current && versions.some(v => String(v.version_id) === current) ? current : (versions.find(v => v.status === 'draft') || versions[0] ? String((versions.find(v => v.status === 'draft') || versions[0]).version_id) : ''))
      })
      .catch(() => { if (active) { setSemesterVersions([]); setVersionSessions([]) } })
    return () => { active = false }
  }, [selectedId])

  useEffect(() => {
    if (!selectedId || !selectedVersionId) { setLoadValidation(null); return }
    let active = true
    axios.get(API + '/semester/terms/' + selectedId + '/dashboard', { params: { version_id: selectedVersionId } })
      .then(r => { if (active) setLoadValidation(r.data) })
      .catch(() => { if (active) setLoadValidation(null) })
    return () => { active = false }
  }, [selectedId, selectedVersionId])

  useEffect(() => {
    if (!selectedVersionId) { setVersionSessions([]); return }
    let active = true
    axios.get(API + '/semester/versions/' + selectedVersionId)
      .then(r => { if (active) setVersionSessions(r.data.sessions || []) })
      .catch(() => { if (active) setVersionSessions([]) })
    return () => { active = false }
  }, [selectedVersionId])

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
      setNotice(response.data.message + (response.data.overlaps?.length ? ` Review ${response.data.overlaps.length} overlapping date pair(s) before approving entries.` : '') + (response.data.problems?.length ? ` Issues: ${response.data.problems.join(' ')}` : '') + ' Review imported entries and approve valid closures; then regenerate the timetable to apply calendar changes.')
      setCalendarFile(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not import the calendar file.')
    } finally { setImportingHolidays(false) }
  }

  async function approveImportedEvent(event) {
    try {
      await axios.patch(`${API}/calendar/events/${event.event_id}`, {
        title: event.title, event_type: event.event_type, start_date: event.start_date,
        end_date: event.end_date, is_closure: event.is_closure,
        is_working_day_override: event.is_working_day_override,
        preferred_replacement_date: event.preferred_replacement_date || null,
        preferred_replacement_period: event.preferred_replacement_period || null,
        source: event.source, approval_status: 'approved', notes: event.notes,
      })
      await loadEvents(selectedTerm.term_id)
      setNotice(`Approved "${event.title}". If this is a closure, regenerate the timetable to reschedule affected sessions.`)
    } catch (err) { setError(err.response?.data?.detail || 'Could not approve this event.') }
  }

  async function saveEvent(event) {
    event.preventDefault()
    if (!selectedTerm) return
    setError(''); setNotice(''); setSavingEvent(true)
    try {
      const payload = { ...eventForm, preferred_replacement_date: eventForm.preferred_replacement_date || null, preferred_replacement_period: eventForm.preferred_replacement_period ? Number(eventForm.preferred_replacement_period) : null, is_working_day_override: eventForm.event_type === 'working_day' ? true : null }
      await axios.post(`${API}/calendar/terms/${selectedTerm.term_id}/events`, payload)
      await loadEvents(selectedTerm.term_id)
      setEventForm({ title: '', event_type: 'holiday', start_date: '', end_date: '', is_closure: true, approval_status: 'pending', source: 'manual', notes: '', preferred_replacement_date: '', preferred_replacement_period: '' })
      setShowEventForm(false)
      setNotice('Calendar event saved for review. After approving a closure, regenerate the timetable to apply calendar changes.')
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
      