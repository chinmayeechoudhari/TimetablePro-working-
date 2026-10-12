import React, { useState, useMemo, useEffect } from 'react'

function toDate(value) {
  return new Date(value + 'T12:00:00')
}

function dateLabel(value) {
  if (!value) return ''
  return toDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getEventTypeConfig(evt) {
  const isClosure = evt.is_closure || evt.event_type === 'holiday' || evt.event_type === 'closure'
  if (isClosure) {
    return {
      label: evt.event_type === 'holiday' ? 'Public / College Holiday' : 'Institution Closure',
      pillBg: '#fef2f2',
      pillBorder: '#fecaca',
      pillColor: '#b91c1c',
      accentColor: '#ef4444',
      icon: '🏖️',
    }
  }
  if (evt.event_type === 'exam') {
    return {
      label: 'Examination',
      pillBg: '#fffbeb',
      pillBorder: '#fde68a',
      pillColor: '#b45309',
      accentColor: '#f59e0b',
      icon: '📝',
    }
  }
  if (evt.event_type === 'vacation') {
    return {
      label: 'Vacation / Break',
      pillBg: '#f5f3ff',
      pillBorder: '#ddd6fe',
      pillColor: '#6d28d9',
      accentColor: '#8b5cf6',
      icon: '🌴',
    }
  }
  if (evt.event_type === 'working_day') {
    return {
      label: 'Special Working Day',
      pillBg: '#f0fdf4',
      pillBorder: '#bbf7d0',
      pillColor: '#15803d',
      accentColor: '#10b981',
      icon: '💼',
    }
  }
  return {
    label: 'College Event',
    pillBg: '#eff6ff',
    pillBorder: '#bfdbfe',
    pillColor: '#1d4ed8',
    accentColor: '#3b82f6',
    icon: '🎓',
  }
}

export default function UpcomingEventsModal({
  isOpen,
  onClose,
  events = [],
  selectedTerm,
  onApproveEvent,
  onDeleteEvent,
  onOpenAddEvent,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [timeHorizon, setTimeHorizon] = useState('all') // 'all' | 'upcoming' | 'pending'
  const [layoutMode, setLayoutMode] = useState('grid') // 'grid' | 'list'
  const [collapsedMonths, setCollapsedMonths] = useState(new Set())

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    // Lock background scroll
    const origOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = origOverflow
    }
  }, [isOpen, onClose])

  const todayStr = useMemo(() => localDateKey(new Date()), [])
  const currentMonthKey = useMemo(() => todayStr.slice(0, 7), [todayStr])

  // Extract all distinct months sorted chronologically
  const availableMonths = useMemo(() => {
    const set = new Set()
    for (const evt of events) {
      if (evt.start_date) set.add(evt.start_date.slice(0, 7))
    }
    return [...set].sort()
  }, [events])

  // Summary counts
  const stats = useMemo(() => {
    const total = events.length
    const holidays = events.filter(e => e.is_closure || e.event_type === 'holiday' || e.event_type === 'closure').length
    const exams = events.filter(e => e.event_type === 'exam').length
    const pending = events.filter(e => e.approval_status === 'pending').length
    const upcoming = events.filter(e => (e.end_date || e.start_date) >= todayStr).length
    return { total, holidays, exams, pending, upcoming }
  }, [events, todayStr])

  // Filter events according to search, category, horizon, and selected month
  const filteredAndGroupedEvents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    const filtered = events.filter(evt => {
      // Search query filter
      if (q) {
        const titleMatch = (evt.title || '').toLowerCase().includes(q)
        const notesMatch = (evt.notes || '').toLowerCase().includes(q)
        const sourceMatch = (evt.source || '').toLowerCase().includes(q)
        const dateMatch = (evt.start_date || '').includes(q) || (evt.end_date || '').includes(q)
        const typeMatch = (evt.event_type || '').toLowerCase().includes(q)
        if (!titleMatch && !notesMatch && !sourceMatch && !dateMatch && !typeMatch) {
          return false
        }
      }

      // Time horizon filter
      if (timeHorizon === 'upcoming') {
        if ((evt.end_date || evt.start_date) < todayStr) return false
      } else if (timeHorizon === 'pending') {
        if (evt.approval_status !== 'pending') return false
      }

      // Category / Type filter
      if (selectedType === 'holidays') {
        if (!evt.is_closure && evt.event_type !== 'holiday' && evt.event_type !== 'closure') return false
      } else if (selectedType === 'exams') {
        if (evt.event_type !== 'exam') return false
      } else if (selectedType === 'events') {
        if (evt.event_type !== 'event') return false
      } else if (selectedType === 'vacations') {
        if (evt.event_type !== 'vacation') return false
      } else if (selectedType === 'working_day') {
        if (evt.event_type !== 'working_day') return false
      } else if (selectedType === 'pending') {
        if (evt.approval_status !== 'pending') return false
      }

      // Specific month filter
      if (selectedMonth !== 'all') {
        if (!evt.start_date.startsWith(selectedMonth)) return false
      }

      return true
    })

    // Group filtered results by YYYY-MM
    const map = new Map()
    for (const evt of filtered) {
      const monthKey = evt.start_date.slice(0, 7)
      if (!map.has(monthKey)) map.set(monthKey, [])
      map.get(monthKey).push(evt)
    }

    const sortedGroups = [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
    for (const [, evts] of sortedGroups) {
      evts.sort((a, b) => a.start_date.localeCompare(b.start_date))
    }
    return sortedGroups
  }, [events, searchQuery, selectedMonth, selectedType, timeHorizon, todayStr])

  const totalFilteredCount = useMemo(() => {
    return filteredAndGroupedEvents.reduce((acc, [, evts]) => acc + evts.length, 0)
  }, [filteredAndGroupedEvents])

  // Collapsible months helpers
  const toggleMonthCollapse = (monthKey) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev)
      if (next.has(monthKey)) {
        next.delete(monthKey)
      } else {
        next.add(monthKey)
      }
      return next
    })
  }

  const allVisibleMonths = useMemo(() => {
    return filteredAndGroupedEvents.map(([m]) => m)
  }, [filteredAndGroupedEvents])

  const allAreCollapsed = useMemo(() => {
    if (allVisibleMonths.length === 0) return false
    return allVisibleMonths.every(m => collapsedMonths.has(m))
  }, [allVisibleMonths, collapsedMonths])

  const toggleAllCollapse = () => {
    if (allAreCollapsed) {
      // Expand all visible
      setCollapsedMonths(prev => {
        const next = new Set(prev)
        allVisibleMonths.forEach(m => next.delete(m))
        return next
      })
    } else {
      // Collapse all visible
      setCollapsedMonths(prev => {
        const next = new Set(prev)
        allVisibleMonths.forEach(m => next.add(m))
        return next
      })
    }
  }

  // When jumping to a month pill, auto-expand that month
  const handleSelectMonth = (monthKey) => {
    if (selectedMonth === monthKey) {
      setSelectedMonth('all')
    } else {
      setSelectedMonth(monthKey)
      if (monthKey !== 'all') {
        setCollapsedMonths(prev => {
          const next = new Set(prev)
          next.delete(monthKey)
          return next
        })
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="cal-em-overlay" onClick={onClose}>
      <div className="cal-em-dialog" onClick={e => e.stopPropagation()}>
        {/* ─── Modal Header ─── */}
        <div className="cal-em-header">
          <div className="cal-em-header-left">
            <div className="cal-em-icon-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="m9 16 2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="cal-em-title-line">
                <h2 className="cal-em-title">Academic Schedule & Upcoming Events</h2>
                <span className="cal-em-term-badge">
                  {selectedTerm?.academic_year || 'Academic Year'} • {selectedTerm?.term_name || 'Semester'}
                </span>
                <span className="cal-em-count-badge-top">
                  {events.length} Total Events
                </span>
              </div>
              <p className="cal-em-subtitle">
                Categorized by month • Collapsible month sections • {availableMonths.length} months covered across term
              </p>
            </div>
          </div>

          <div className="cal-em-header-right">
            {/* View layout toggle: 2-Col Grid vs Full-Width List */}
            <div className="cal-em-layout-toggle" title="Switch view layout">
              <button
                type="button"
                className={`cal-em-layout-btn ${layoutMode === 'grid' ? 'active' : ''}`}
                onClick={() => setLayoutMode('grid')}
                title="2-Column Dashboard Grid"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`cal-em-layout-btn ${layoutMode === 'list' ? 'active' : ''}`}
                onClick={() => setLayoutMode('list')}
                title="Full-Width Linear List"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span>List</span>
              </button>
            </div>

            {onOpenAddEvent && (
              <button
                type="button"
                className="cal-em-btn-add"
                onClick={() => {
                  onClose()
                  onOpenAddEvent()
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>Add Event</span>
              </button>
            )}

            <button
              type="button"
              className="cal-em-close-btn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ─── Summary Quick Metric Chips ─── */}
        <div className="cal-em-metrics-bar">
          <div
            className={`cal-em-metric-chip ${timeHorizon === 'all' && selectedType === 'all' && selectedMonth === 'all' ? 'active' : ''}`}
            onClick={() => { setTimeHorizon('all'); setSelectedType('all'); setSelectedMonth('all'); }}
          >
            <div className="cal-em-metric-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              📅
            </div>
            <div>
              <div className="cal-em-metric-num">{stats.total}</div>
              <div className="cal-em-metric-lbl">Total Events</div>
            </div>
          </div>

          <div
            className={`cal-em-metric-chip ${timeHorizon === 'upcoming' ? 'active' : ''}`}
            onClick={() => setTimeHorizon(timeHorizon === 'upcoming' ? 'all' : 'upcoming')}
          >
            <div className="cal-em-metric-icon-box" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              ⚡
            </div>
            <div>
              <div className="cal-em-metric-num">{stats.upcoming}</div>
              <div className="cal-em-metric-lbl">Upcoming / Active</div>
            </div>
          </div>

          <div
            className={`cal-em-metric-chip ${selectedType === 'holidays' ? 'active' : ''}`}
            onClick={() => setSelectedType(selectedType === 'holidays' ? 'all' : 'holidays')}
          >
            <div className="cal-em-metric-icon-box" style={{ background: '#fef2f2', color: '#dc2626' }}>
              🛑
            </div>
            <div>
              <div className="cal-em-metric-num">{stats.holidays}</div>
              <div className="cal-em-metric-lbl">Holidays & Closures</div>
            </div>
          </div>

          <div
            className={`cal-em-metric-chip ${selectedType === 'exams' ? 'active' : ''}`}
            onClick={() => setSelectedType(selectedType === 'exams' ? 'all' : 'exams')}
          >
            <div className="cal-em-metric-icon-box" style={{ background: '#fffbeb', color: '#d97706' }}>
              📝
            </div>
            <div>
              <div className="cal-em-metric-num">{stats.exams}</div>
              <div className="cal-em-metric-lbl">Examinations</div>
            </div>
          </div>

          <div
            className={`cal-em-metric-chip ${timeHorizon === 'pending' || selectedType === 'pending' ? 'active' : ''}`}
            onClick={() => {
              if (timeHorizon === 'pending') {
                setTimeHorizon('all')
                setSelectedType('all')
              } else {
                setTimeHorizon('pending')
                setSelectedType('all')
              }
            }}
          >
            <div className="cal-em-metric-icon-box" style={{ background: stats.pending > 0 ? '#fef3c7' : '#f8fafc', color: stats.pending > 0 ? '#b45309' : '#64748b' }}>
              ⏳
            </div>
            <div>
              <div className="cal-em-metric-num" style={{ color: stats.pending > 0 ? '#b45309' : 'inherit' }}>
                {stats.pending}
              </div>
              <div className="cal-em-metric-lbl">Pending Review</div>
            </div>
          </div>
        </div>

        {/* ─── Search & Category Filter Toolbar ─── */}
        <div className="cal-em-controls">
          <div className="cal-em-search-row">
            <div className="cal-em-search-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                className="cal-em-search-input"
                placeholder="Search events by title, type, notes, date (e.g. Diwali, Exam, 2026-10)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="cal-em-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="cal-em-horizon-toggle">
              <button
                type="button"
                className={`cal-em-horizon-btn ${timeHorizon === 'all' ? 'active' : ''}`}
                onClick={() => setTimeHorizon('all')}
              >
                All Timeline
              </button>
              <button
                type="button"
                className={`cal-em-horizon-btn ${timeHorizon === 'upcoming' ? 'active' : ''}`}
                onClick={() => setTimeHorizon('upcoming')}
              >
                Upcoming Only
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="cal-em-pills-row">
            <div className="cal-em-pills-label">Category:</div>
            <button
              type="button"
              className={`cal-em-pill ${selectedType === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedType('all')}
            >
              All Types ({events.length})
            </button>
            <button
              type="button"
              className={`cal-em-pill ${selectedType === 'holidays' ? 'active' : ''}`}
              onClick={() => setSelectedType('holidays')}
            >
              🏖️ Holidays & Closures ({stats.holidays})
            </button>
            <button
              type="button"
              className={`cal-em-pill ${selectedType === 'exams' ? 'active' : ''}`}
              onClick={() => setSelectedType('exams')}
            >
              📝 Examinations ({stats.exams})
            </button>
            <button
              type="button"
              className={`cal-em-pill ${selectedType === 'events' ? 'active' : ''}`}
              onClick={() => setSelectedType('events')}
            >
              🎓 College Events ({events.filter(e => e.event_type === 'event').length})
            </button>
            <button
              type="button"
              className={`cal-em-pill ${selectedType === 'vacations' ? 'active' : ''}`}
              onClick={() => setSelectedType('vacations')}
            >
              🌴 Vacations ({events.filter(e => e.event_type === 'vacation').length})
            </button>
            <button
              type="button"
              className={`cal-em-pill ${selectedType === 'working_day' ? 'active' : ''}`}
              onClick={() => setSelectedType('working_day')}
            >
              💼 Working Days ({events.filter(e => e.event_type === 'working_day').length})
            </button>
          </div>

          {/* Month Jump / Filter Bar + Collapse All button */}
          <div className="cal-em-months-bar-row">
            <div className="cal-em-months-bar">
              <div className="cal-em-months-label">Jump to Month:</div>
              <button
                type="button"
                className={`cal-em-month-pill ${selectedMonth === 'all' ? 'active' : ''}`}
                onClick={() => handleSelectMonth('all')}
              >
                <span>All Months</span>
                <span className="cal-em-count-tag">{events.length}</span>
              </button>

              {availableMonths.map(monthKey => {
                const count = events.filter(e => e.start_date.startsWith(monthKey)).length
                const d = toDate(monthKey + '-01')
                const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                const isCurrent = monthKey === currentMonthKey
                return (
                  <button
                    key={monthKey}
                    type="button"
                    className={`cal-em-month-pill ${selectedMonth === monthKey ? 'active' : ''} ${isCurrent ? 'current-month-pill' : ''}`}
                    onClick={() => handleSelectMonth(monthKey)}
                    title={`${monthLabel} (${count} events)`}
                  >
                    {isCurrent && <span className="cal-em-dot-now" />}
                    <span>{monthLabel}</span>
                    <span className="cal-em-count-tag">{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Bulk Collapse / Expand All toggle */}
            {allVisibleMonths.length > 0 && (
              <button
                type="button"
                className="cal-em-bulk-collapse-btn"
                onClick={toggleAllCollapse}
                title={allAreCollapsed ? 'Expand all month groups' : 'Collapse all month groups'}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: allAreCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .2s' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span>{allAreCollapsed ? 'Expand All Months' : 'Collapse All Months'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Scrollable Body Categorized by Month ─── */}
        <div className="cal-em-body">
          {filteredAndGroupedEvents.length === 0 ? (
            <div className="cal-em-empty-box">
              <div className="cal-em-empty-icon">📅</div>
              <h3 className="cal-em-empty-title">No events found matching your criteria</h3>
              <p className="cal-em-empty-desc">
                {searchQuery
                  ? `No events matched "${searchQuery}". Try a different keyword.`
                  : 'There are no calendar events matching the selected filters.'}
              </p>
              <button
                type="button"
                className="cal-em-empty-reset-btn"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedMonth('all')
                  setSelectedType('all')
                  setTimeHorizon('all')
                }}
              >
                Reset all filters
              </button>
            </div>
          ) : (
            filteredAndGroupedEvents.map(([monthKey, monthEvents]) => {
              const monthDate = toDate(monthKey + '-01')
              const monthTitle = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              const isCurrent = monthKey === currentMonthKey
              const isPast = monthKey < currentMonthKey
              const isCollapsed = collapsedMonths.has(monthKey)

              const monthHolidays = monthEvents.filter(e => e.is_closure || e.event_type === 'holiday' || e.event_type === 'closure').length
              const monthExams = monthEvents.filter(e => e.event_type === 'exam').length
              const monthOther = monthEvents.length - monthHolidays - monthExams

              return (
                <div key={monthKey} className="cal-em-month-section" id={`month-${monthKey}`}>
                  {/* Collapsible Month Header Banner */}
                  <div
                    className={`cal-em-month-header ${isCollapsed ? 'is-collapsed' : ''}`}
                    onClick={() => toggleMonthCollapse(monthKey)}
                    title={isCollapsed ? `Click to expand ${monthTitle}` : `Click to collapse ${monthTitle}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleMonthCollapse(monthKey)
                      }
                    }}
                  >
                    <div className="cal-em-month-title-wrap">
                      <div className={`cal-em-collapse-chevron ${isCollapsed ? 'collapsed' : ''}`}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>

                      <div className="cal-em-month-cal-icon">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>

                      <h3 className="cal-em-month-name">{monthTitle}</h3>

                      {isCurrent && (
                        <span className="cal-em-status-badge current">Current Month</span>
                      )}
                      {!isCurrent && isPast && (
                        <span className="cal-em-status-badge past">Past Month</span>
                      )}
                      {!isCurrent && !isPast && (
                        <span className="cal-em-status-badge upcoming">Upcoming</span>
                      )}
                    </div>

                    <div className="cal-em-month-stats">
                      {isCollapsed && (
                        <span className="cal-em-collapsed-hint">Click to expand</span>
                      )}
                      <span className="cal-em-month-count-pill">{monthEvents.length} {monthEvents.length === 1 ? 'Event' : 'Events'}</span>
                      {monthHolidays > 0 && (
                        <span className="cal-em-mini-tag holiday">{monthHolidays} Holiday{monthHolidays > 1 ? 's' : ''}</span>
                      )}
                      {monthExams > 0 && (
                        <span className="cal-em-mini-tag exam">{monthExams} Exam{monthExams > 1 ? 's' : ''}</span>
                      )}
                      {monthOther > 0 && (
                        <span className="cal-em-mini-tag other">{monthOther} Activity</span>
                      )}

                      <div className="cal-em-collapse-indicator">
                        <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {isCollapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* List/Grid of Event Cards for this Month (Collapsed when isCollapsed is true) */}
                  {!isCollapsed && (
                    <div className={`cal-em-cards-container ${layoutMode === 'grid' ? 'grid-layout' : 'list-layout'}`}>
                      {monthEvents.map(evt => {
                        const startDate = toDate(evt.start_date)
                        const endDate = toDate(evt.end_date)
                        const isSameDay = evt.start_date === evt.end_date
                        const dayNumber = startDate.getDate()
                        const monthShort = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
                        const weekdayStr = startDate.toLocaleDateString('en-US', { weekday: 'short' })
                        const config = getEventTypeConfig(evt)
                        const isClosure = evt.is_closure || evt.event_type === 'holiday' || evt.event_type === 'closure'
                        const isPending = evt.approval_status === 'pending'

                        const diffDays = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1)
                        const endWeekdayStr = endDate.toLocaleDateString('en-US', { weekday: 'short' })

                        return (
                          <div
                            key={evt.event_id}
                            className={`cal-em-card ${isPending ? 'is-pending-card' : ''}`}
                            style={{ '--accent-color': config.accentColor }}
                          >
                            {/* Colored Accent Strip */}
                            <div
                              className="cal-em-card-stripe"
                              style={{ background: config.accentColor }}
                            />

                            {/* Left: Date Display Box */}
                            <div className="cal-em-date-box" style={{ borderColor: config.accentColor }}>
                              <div className="cal-em-date-num">{dayNumber}</div>
                              <div className="cal-em-date-mon">{monthShort}</div>
                              <div className="cal-em-date-day">{weekdayStr}</div>
                            </div>

                            {/* Middle: Content & Badges */}
                            <div className="cal-em-card-content">
                              <div className="cal-em-card-title-row">
                                <span className="cal-em-card-icon">{config.icon}</span>
                                <h4 className="cal-em-card-title">{evt.title}</h4>
                              </div>

                              <div className="cal-em-card-badges-row">
                                {/* Type badge */}
                                <span
                                  className="cal-em-badge-type"
                                  style={{
                                    background: config.pillBg,
                                    borderColor: config.pillBorder,
                                    color: config.pillColor,
                                  }}
                                >
                                  {config.label}
                                </span>

                                {/* Multi-day badge */}
                                {isSameDay ? (
                                  <span className="cal-em-badge-date">
                                    {dateLabel(evt.start_date)}
                                  </span>
                                ) : (
                                  <span className="cal-em-badge-date multiday">
                                    🗓️ {dateLabel(evt.start_date)} ({weekdayStr}) → {dateLabel(evt.end_date)} ({endWeekdayStr}) • {diffDays} Days
                                  </span>
                                )}

                                {/* Closure badge */}
                                {isClosure && (
                                  <span className="cal-em-badge-closure">
                                    🛑 Campus Closed
                                  </span>
                                )}

                                {/* Source badge */}
                                <span className="cal-em-badge-source">
                                  📌 {evt.source?.includes('.xlsx') || evt.source?.includes('.csv')
                                    ? 'Calendar Import'
                                    : evt.source || 'Manual Entry'}
                                </span>
                              </div>

                              {/* Optional notes */}
                              {evt.notes && (
                                <p className="cal-em-card-notes">
                                  📝 {evt.notes}
                                </p>
                              )}
                            </div>

                            {/* Right: Status Pill & Actions */}
                            <div className="cal-em-card-actions">
                              <span className={`cal-em-status-pill ${evt.approval_status}`}>
                                {isPending ? '⏳ Pending Review' : '✓ Approved'}
                              </span>

                              {isPending && onApproveEvent && (
                                <button
                                  type="button"
                                  className="cal-em-action-btn-approve"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onApproveEvent(evt)
                                  }}
                                  title="Approve this imported entry into academic schedule"
                                >
                                  ✓ Approve
                                </button>
                              )}

                              {onDeleteEvent && (
                                <button
                                  type="button"
                                  className="cal-em-action-btn-delete"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteEvent(evt.event_id)
                                  }}
                                  title="Delete this event"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ─── Modal Footer ─── */}
        <div className="cal-em-footer">
          <div className="cal-em-footer-info">
            Showing <strong>{totalFilteredCount}</strong> of <strong>{events.length}</strong> events scheduled
            {selectedMonth !== 'all' && <span> for selected month</span>}
            <span style={{ marginLeft: 10, color: '#94a3b8' }}>•</span>
            <span style={{ marginLeft: 10, color: '#64748b' }}>
              {allVisibleMonths.length} months visible ({allVisibleMonths.length - collapsedMonths.size} expanded, {collapsedMonths.size} collapsed)
            </span>
          </div>

          <div className="cal-em-footer-actions">
            <button
              type="button"
              className="cal-em-footer-btn-close"
              onClick={onClose}
            >
              Done & Close
            </button>
          </div>
        </div>
      </div>

      {/* Embedded CSS Styling for Wide Rectangular Modal */}
      <style>{`
        .cal-em-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px 20px;
          animation: calModalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* ─── Extra Large Widescreen Landscape Rectangle (covering ~3/4th+ screen) ─── */
        .cal-em-dialog {
          background: #ffffff;
          border-radius: 20px;
          width: 95vw;
          max-width: 1720px;
          height: 92vh;
          max-height: 94vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 35px 85px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(226, 232, 240, 0.85);
          overflow: hidden;
          animation: calModalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        @keyframes calModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes calModalSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ─── Header ─── */
        .cal-em-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 32px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border-bottom: 1px solid #e2e8f0;
          gap: 16px;
        }
        .cal-em-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .cal-em-icon-badge {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
          flex-shrink: 0;
        }
        .cal-em-title-line {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .cal-em-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.25;
        }
        .cal-em-term-badge {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          padding: 3px 9px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 750;
        }
        .cal-em-count-badge-top {
          background: #f1f5f9;
          color: #475569;
          padding: 3px 9px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
        }
        .cal-em-subtitle {
          font-size: 12.5px;
          color: #64748b;
          margin: 4px 0 0 0;
        }
        .cal-em-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        /* Layout Switcher */
        .cal-em-layout-toggle {
          display: flex;
          background: #f1f5f9;
          border-radius: 9px;
          padding: 3px;
          gap: 2px;
        }
        .cal-em-layout-btn {
          border: none;
          background: transparent;
          color: #64748b;
          padding: 5px 9px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cal-em-layout-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .cal-em-btn-add {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 15px;
          border-radius: 9px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.2);
        }
        .cal-em-btn-add:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }
        .cal-em-close-btn {
          background: #f1f5f9;
          border: 1px solid transparent;
          color: #64748b;
          border-radius: 10px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cal-em-close-btn:hover {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fca5a5;
          transform: rotate(90deg);
        }

        /* ─── Metrics Bar ─── */
        .cal-em-metrics-bar {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          padding: 12px 32px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .cal-em-metric-chip {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 9px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cal-em-metric-chip:hover {
          border-color: #93c5fd;
          transform: translateY(-1px);
        }
        .cal-em-metric-chip.active {
          border-color: #3b82f6;
          background: #eff6ff;
          box-shadow: 0 0 0 1px #3b82f6;
        }
        .cal-em-metric-icon-box {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          flex-shrink: 0;
        }
        .cal-em-metric-num {
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1;
        }
        .cal-em-metric-lbl {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          margin-top: 2px;
        }

        /* ─── Controls Toolbar ─── */
        .cal-em-controls {
          padding: 14px 32px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .cal-em-search-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cal-em-search-wrap {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }
        .cal-em-search-wrap svg {
          position: absolute;
          left: 14px;
          color: #94a3b8;
          pointer-events: none;
        }
        .cal-em-search-input {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 36px 9px 38px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          font-size: 13px;
          outline: none;
          background: #f8fafc;
          transition: all 0.15s;
          font-family: inherit;
        }
        .cal-em-search-input:focus {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .cal-em-search-clear {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 13px;
        }
        .cal-em-horizon-toggle {
          display: flex;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 9px;
          gap: 3px;
          flex-shrink: 0;
        }
        .cal-em-horizon-btn {
          border: none;
          background: transparent;
          color: #475569;
          font-size: 11.5px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cal-em-horizon-btn.active {
          background: #ffffff;
          color: #1e293b;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .cal-em-pills-row {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: thin;
        }
        .cal-em-pills-label {
          font-size: 11.5px;
          font-weight: 750;
          color: #64748b;
          white-space: nowrap;
          margin-right: 4px;
        }
        .cal-em-pill {
          padding: 4.5px 11px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 650;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .cal-em-pill:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .cal-em-pill.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
          box-shadow: 0 2px 5px rgba(37, 99, 235, 0.2);
        }

        .cal-em-months-bar-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .cal-em-months-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          padding: 3px 0 2px;
          scrollbar-width: thin;
          flex: 1;
        }
        .cal-em-months-label {
          font-size: 11.5px;
          font-weight: 750;
          color: #64748b;
          white-space: nowrap;
          margin-right: 4px;
        }
        .cal-em-month-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4.5px 11px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .cal-em-month-pill:hover {
          border-color: #93c5fd;
          color: #2563eb;
        }
        .cal-em-month-pill.active {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #1d4ed8;
          font-weight: 800;
        }
        .cal-em-month-pill.current-month-pill {
          border-color: #bfdbfe;
        }
        .cal-em-dot-now {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #2563eb;
        }
        .cal-em-count-tag {
          background: rgba(0, 0, 0, 0.06);
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 10px;
        }
        .cal-em-month-pill.active .cal-em-count-tag {
          background: #bfdbfe;
          color: #1e40af;
        }

        .cal-em-bulk-collapse-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .cal-em-bulk-collapse-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
          border-color: #94a3b8;
        }

        /* ─── Scrollable Body ─── */
        .cal-em-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Month Section */
        .cal-em-month-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Collapsible Month Header Banner */
        .cal-em-month-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 18px;
          background: #ffffff;
          border-radius: 13px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          flex-wrap: wrap;
          gap: 10px;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cal-em-month-header:hover {
          background: #fbfcfe;
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        .cal-em-month-header.is-collapsed {
          background: #f8fafc;
          border-color: #e2e8f0;
        }
        .cal-em-month-header.is-collapsed:hover {
          background: #f1f5f9;
        }

        .cal-em-month-title-wrap {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .cal-em-collapse-chevron {
          color: #64748b;
          display: flex;
          align-items: center;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cal-em-collapse-chevron.collapsed {
          transform: rotate(-90deg);
        }
        .cal-em-month-cal-icon {
          color: #2563eb;
          display: flex;
          align-items: center;
        }
        .cal-em-month-name {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .cal-em-status-badge {
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
          padding: 2.5px 7px;
          border-radius: 6px;
          letter-spacing: 0.03em;
        }
        .cal-em-status-badge.current {
          background: #dbeafe;
          color: #1d4ed8;
        }
        .cal-em-status-badge.upcoming {
          background: #dcfce7;
          color: #166534;
        }
        .cal-em-status-badge.past {
          background: #f1f5f9;
          color: #64748b;
        }

        .cal-em-month-stats {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cal-em-collapsed-hint {
          font-size: 11px;
          font-weight: 600;
          color: #2563eb;
          background: #eff6ff;
          padding: 2px 7px;
          border-radius: 6px;
        }
        .cal-em-month-count-pill {
          background: #f1f5f9;
          color: #334155;
          padding: 3.5px 9px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 750;
        }
        .cal-em-mini-tag {
          font-size: 10.5px;
          font-weight: 650;
          padding: 2.5px 7px;
          border-radius: 6px;
        }
        .cal-em-mini-tag.holiday {
          background: #fee2e2;
          color: #b91c1c;
        }
        .cal-em-mini-tag.exam {
          background: #fef3c7;
          color: #92400e;
        }
        .cal-em-mini-tag.other {
          background: #eff6ff;
          color: #1e40af;
        }
        .cal-em-collapse-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          padding: 2px 6px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
        }

        /* ─── Cards Containers (Grid / List) ─── */
        .cal-em-cards-container.grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(580px, 1fr));
          gap: 12px;
          animation: calCardsFadeIn 0.2s ease;
        }
        .cal-em-cards-container.list-layout {
          display: flex;
          flex-direction: column;
          gap: 9px;
          animation: calCardsFadeIn 0.2s ease;
        }

        @keyframes calCardsFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Event Card */
        .cal-em-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 13px 18px 13px 16px;
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          position: relative;
          overflow: hidden;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cal-em-card:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
          border-color: #cbd5e1;
        }
        .cal-em-card.is-pending-card {
          background: #fffdf5;
          border-color: #fde68a;
        }
        .cal-em-card-stripe {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4.5px;
        }

        /* Date Box */
        .cal-em-date-box {
          width: 52px;
          height: 54px;
          border-radius: 11px;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-left: 2px solid;
          line-height: 1;
        }
        .cal-em-date-num {
          font-size: 19px;
          font-weight: 850;
          color: #0f172a;
        }
        .cal-em-date-mon {
          font-size: 9.5px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 2px;
          letter-spacing: 0.04em;
        }
        .cal-em-date-day {
          font-size: 9px;
          font-weight: 700;
          color: #94a3b8;
          margin-top: 2px;
        }

        /* Content */
        .cal-em-card-content {
          min-width: 0;
          flex: 1;
        }
        .cal-em-card-title-row {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .cal-em-card-icon {
          font-size: 14px;
        }
        .cal-em-card-title {
          font-size: 14.5px;
          font-weight: 750;
          color: #0f172a;
          margin: 0;
          line-height: 1.3;
        }
        .cal-em-card-badges-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 5px;
        }
        .cal-em-badge-type {
          display: inline-flex;
          align-items: center;
          padding: 2.5px 7.5px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid;
        }
        .cal-em-badge-date {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }
        .cal-em-badge-date.multiday {
          background: #f1f5f9;
          color: #334155;
          padding: 2px 7px;
          border-radius: 6px;
          font-weight: 700;
        }
        .cal-em-badge-closure {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 2px 7px;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 750;
        }
        .cal-em-badge-source {
          font-size: 10.5px;
          color: #94a3b8;
        }
        .cal-em-card-notes {
          margin: 5px 0 0 0;
          font-size: 11.5px;
          color: #64748b;
          font-style: italic;
        }

        /* Actions & Status */
        .cal-em-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .cal-em-status-pill {
          padding: 3.5px 9px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }
        .cal-em-status-pill.approved {
          background: #dcfce7;
          color: #166534;
        }
        .cal-em-status-pill.pending {
          background: #fef3c7;
          color: #92400e;
        }
        .cal-em-action-btn-approve {
          border: 1px solid #86efac;
          background: #f0fdf4;
          color: #166534;
          border-radius: 7px;
          padding: 5px 10px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cal-em-action-btn-approve:hover {
          background: #16a34a;
          color: #ffffff;
          border-color: #16a34a;
        }
        .cal-em-action-btn-delete {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #dc2626;
          border-radius: 7px;
          padding: 5px 9px;
          font-size: 11.5px;
          font-weight: 650;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s;
        }
        .cal-em-action-btn-delete:hover {
          background: #dc2626;
          color: #ffffff;
          border-color: #dc2626;
        }

        /* Empty state */
        .cal-em-empty-box {
          background: #ffffff;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 44px 24px;
          text-align: center;
          margin: 20px 0;
        }
        .cal-em-empty-icon {
          font-size: 38px;
          margin-bottom: 12px;
        }
        .cal-em-empty-title {
          font-size: 16px;
          font-weight: 750;
          color: #0f172a;
          margin: 0 0 6px 0;
        }
        .cal-em-empty-desc {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 16px 0;
        }
        .cal-em-empty-reset-btn {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 7px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        /* ─── Footer ─── */
        .cal-em-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 32px;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          font-size: 12.5px;
          color: #64748b;
        }
        .cal-em-footer-btn-close {
          background: #0f172a;
          color: #ffffff;
          border: none;
          padding: 8px 20px;
          border-radius: 9px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cal-em-footer-btn-close:hover {
          background: #334155;
        }

        /* ─── Dark Mode Support ─── */
        html[data-theme="dark"] .cal-em-overlay { background: rgba(0, 0, 0, 0.78); }
        html[data-theme="dark"] .cal-em-dialog { background: #0f172a; border-color: #1e293b; box-shadow: 0 30px 75px -15px rgba(0,0,0,0.85); }
        html[data-theme="dark"] .cal-em-header { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-em-title { color: #f8fafc; }
        html[data-theme="dark"] .cal-em-subtitle { color: #94a3b8; }
        html[data-theme="dark"] .cal-em-count-badge-top { background: #1e293b; color: #cbd5e1; }
        html[data-theme="dark"] .cal-em-layout-toggle { background: #1e293b; }
        html[data-theme="dark"] .cal-em-layout-btn { color: #94a3b8; }
        html[data-theme="dark"] .cal-em-layout-btn.active { background: #0f172a; color: #f8fafc; }
        html[data-theme="dark"] .cal-em-close-btn { background: #1e293b; color: #94a3b8; }
        html[data-theme="dark"] .cal-em-close-btn:hover { background: #450a0a; color: #f87171; border-color: #7f1d1d; }
        html[data-theme="dark"] .cal-em-metrics-bar { background: #090e1a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-em-metric-chip { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-em-metric-chip.active { background: #1e293b; border-color: #3b82f6; }
        html[data-theme="dark"] .cal-em-metric-num { color: #f8fafc; }
        html[data-theme="dark"] .cal-em-metric-lbl { color: #94a3b8; }
        html[data-theme="dark"] .cal-em-controls { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-em-search-input { background: #1e293b; border-color: #334155; color: #f8fafc; }
        html[data-theme="dark"] .cal-em-search-input:focus { border-color: #3b82f6; background: #090e1a; }
        html[data-theme="dark"] .cal-em-horizon-toggle { background: #1e293b; }
        html[data-theme="dark"] .cal-em-horizon-btn { color: #94a3b8; }
        html[data-theme="dark"] .cal-em-horizon-btn.active { background: #0f172a; color: #f8fafc; }
        html[data-theme="dark"] .cal-em-pill { background: #1e293b; border-color: #334155; color: #94a3b8; }
        html[data-theme="dark"] .cal-em-pill:hover { background: #334155; color: #f8fafc; }
        html[data-theme="dark"] .cal-em-pill.active { background: #2563eb; color: #ffffff; }
        html[data-theme="dark"] .cal-em-month-pill { background: #0f172a; border-color: #1e293b; color: #94a3b8; }
        html[data-theme="dark"] .cal-em-month-pill:hover { border-color: #3b82f6; color: #60a5fa; }
        html[data-theme="dark"] .cal-em-month-pill.active { background: #1e3a8a; border-color: #3b82f6; color: #bfdbfe; }
        html[data-theme="dark"] .cal-em-bulk-collapse-btn { background: #1e293b; border-color: #334155; color: #94a3b8; }
        html[data-theme="dark"] .cal-em-bulk-collapse-btn:hover { background: #334155; color: #f8fafc; }
        html[data-theme="dark"] .cal-em-body { background: #090e1a; }
        html[data-theme="dark"] .cal-em-month-header { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-em-month-header:hover { background: #131d31; }
        html[data-theme="dark"] .cal-em-month-header.is-collapsed { background: #090e1a; }
        html[data-theme="dark"] .cal-em-month-name { color: #f8fafc; }
        html[data-theme="dark"] .cal-em-month-count-pill { background: #1e293b; color: #cbd5e1; }
        html[data-theme="dark"] .cal-em-collapse-indicator { background: #0f172a; border-color: #1e293b; color: #94a3b8; }
        html[data-theme="dark"] .cal-em-card { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-em-card:hover { border-color: #334155; }
        html[data-theme="dark"] .cal-em-card.is-pending-card { background: #1a1607; border-color: #854d0e; }
        html[data-theme="dark"] .cal-em-date-box { background: #1e293b; }
        html[data-theme="dark"] .cal-em-date-num { color: #f8fafc; }
        html[data-theme="dark"] .cal-em-date-mon { color: #94a3b8; }
        html[data-theme="dark"] .cal-em-date-day { color: #64748b; }
        html[data-theme="dark"] .cal-em-card-title { color: #f8fafc; }
        html[data-theme="dark"] .cal-em-badge-date.multiday { background: #1e293b; color: #cbd5e1; }
        html[data-theme="dark"] .cal-em-card-notes { color: #94a3b8; }
        html[data-theme="dark"] .cal-em-empty-box { background: #0f172a; border-color: #1e293b; }
        html[data-theme="dark"] .cal-em-empty-title { color: #f8fafc; }
        html[data-theme="dark"] .cal-em-empty-desc { color: #94a3b8; }
        html[data-theme="dark"] .cal-em-footer { background: #0f172a; border-color: #1e293b; color: #94a3b8; }
        html[data-theme="dark"] .cal-em-footer-btn-close { background: #1e293b; color: #f8fafc; }
        html[data-theme="dark"] .cal-em-footer-btn-close:hover { background: #334155; }
      `}</style>
    </div>
  )
}
