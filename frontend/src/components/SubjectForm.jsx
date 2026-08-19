import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import ConfirmModal from './ConfirmModal'

const BASE = 'http://localhost:8000'

function Icon({ name, size = 20, stroke = 1.9 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const paths = {
    layers: (
      <>
        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    flask: (
      <>
        <path d="M9 3h6" />
        <path d="M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3" />
        <path d="M7.2 16h9.6" />
      </>
    ),
    school: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V5.5L12 2l7 3.5V21" />
        <path d="M9 21v-5h6v5" />
        <path d="M8 8h1" />
        <path d="M12 8h1" />
        <path d="M16 8h1" />
        <path d="M8 11h1" />
        <path d="M12 11h1" />
        <path d="M16 11h1" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
        <path d="m13.5 7.5 3 3" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <path d="M12 7.5h.01" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

export default function SubjectForm() {
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])

  const [selectedClassId, setSelectedClassId] = useState('')

  const [subjectName, setSubjectName] = useState('')
  const [selectedTypes, setSelectedTypes] = useState({
    theory: true,
    lab: false,
  })

  const [theoryPeriods, setTheoryPeriods] = useState(1)
  const [labPeriods, setLabPeriods] = useState(1)

  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editingType, setEditingType] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      const [cRes, sRes] = await Promise.all([
        axios.get(`${BASE}/classes`),
        axios.get(`${BASE}/subjects`),
      ])

      setClasses(cRes.data)
      setSubjects(sRes.data)
    } catch {
      setError(
        'Could not load data. Make sure the backend is running.'
      )
    }
  }

  function toggleType(type) {
    setSelectedTypes(prev => {
      const next = {
        ...prev,
        [type]: !prev[type],
      }

      if (!next.theory && !next.lab) {
        return prev
      }

      return next
    })
  }

  function handleEdit(subject) {
    setEditingId(subject.subject_id)
    setEditingType(subject.subject_type)

    setSubjectName(subject.subject_name)

    if (subject.subject_type === 'theory') {
      setSelectedTypes({
        theory: true,
        lab: false,
      })

      setTheoryPeriods(subject.periods_per_week)
    } else {
      setSelectedTypes({
        theory: false,
        lab: true,
      })

      setLabPeriods(subject.periods_per_week)
    }

    setMessage('')
    setError('')

    window.scrollTo({
      top: 250,
      behavior: 'smooth',
    })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditingType(null)

    setSubjectName('')
    setTheoryPeriods(1)
    setLabPeriods(1)

    setSelectedTypes({
      theory: true,
      lab: false,
    })

    setMessage('')
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!selectedClassId || !subjectName.trim()) {
      return
    }

    setMessage('')
    setError('')

    try {
      if (editingId) {
        const periods =
          editingType === 'theory'
            ? parseInt(theoryPeriods)
            : parseInt(labPeriods)

        await axios.put(`${BASE}/subjects/${editingId}`, {
          subject_name: subjectName.trim(),
          periods_per_week: periods,
          subject_type: editingType,
          class_id: parseInt(selectedClassId),
        })

        setMessage(
          `"${subjectName.trim()}" updated successfully`
        )

        handleCancelEdit()
      } else {
        const entries = []

        if (selectedTypes.theory) {
          entries.push({
            subject_type: 'theory',
            periods_per_week: parseInt(theoryPeriods),
          })
        }

        if (selectedTypes.lab) {
          entries.push({
            subject_type: 'lab',
            periods_per_week: parseInt(labPeriods),
          })
        }

        for (const entry of entries) {
          await axios.post(`${BASE}/subjects`, {
            subject_name: subjectName.trim(),
            periods_per_week: entry.periods_per_week,
            subject_type: entry.subject_type,
            class_id: parseInt(selectedClassId),
          })
        }

        const both =
          selectedTypes.theory && selectedTypes.lab

        setMessage(
          both
            ? `"${subjectName.trim()}" added as Theory + Lab to ${getClassName(
                parseInt(selectedClassId)
              )}`
            : `"${subjectName.trim()}" added to ${getClassName(
                parseInt(selectedClassId)
              )}`
        )

        setSubjectName('')
        setTheoryPeriods(1)
        setLabPeriods(1)

        setSelectedTypes({
          theory: true,
          lab: false,
        })
      }

      await fetchAll()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Error saving subject'
      )
    }
  }

  function promptDelete(subject) {
    setDeleteTarget(subject)
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)
    setMessage('')
    setError('')

    try {
      await axios.delete(
        `${BASE}/subjects/${deleteTarget.subject_id}`
      )

      setMessage(
        `"${deleteTarget.subject_name}" (${deleteTarget.subject_type}) deleted successfully`
      )

      if (
        editingId === deleteTarget.subject_id
      ) {
        handleCancelEdit()
      }

      await fetchAll()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Error deleting subject.'
      )
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  function handleClassSwitch(id) {
    setSelectedClassId(String(id))

    setFilterType('all')
    setSearch('')

    handleCancelEdit()

    setMessage('')
    setError('')
  }

  function getClassName(id) {
    return (
      classes.find(c => c.class_id === id)?.class_name ||
      `Class ${id}`
    )
  }

  const hasClass = !!selectedClassId

  const selectedClass = classes.find(
    c => c.class_id === parseInt(selectedClassId)
  )

  const classSubjects = hasClass
    ? subjects.filter(
        s => s.class_id === parseInt(selectedClassId)
      )
    : []

  const theoryCount = classSubjects.filter(
    s => s.subject_type === 'theory'
  ).length

  const labCount = classSubjects.filter(
    s => s.subject_type === 'lab'
  ).length

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase()

    return classSubjects
      .filter(s =>
        filterType === 'all' ? true : s.subject_type === filterType
      )
      .filter(s =>
        query ? s.subject_name.toLowerCase().includes(query) : true
      )
  }, [classSubjects, filterType, search])

  const bothTypes =
    selectedTypes.theory && selectedTypes.lab

  const canSubmit =
    hasClass &&
    subjectName.trim() &&
    (selectedTypes.theory || selectedTypes.lab)

  const typeToggleLocked = !!editingId

  const isLabEditing = editingType === 'lab'

  return (
    <div className="subjects-page">

      {/* =========================================================
          PAGE HEADER
      ========================================================= */}

      <section className="subjects-hero">

        <div className="subjects-watermark" aria-hidden="true">
          <svg viewBox="0 0 620 220" fill="none">
            <path d="M60 60h190v130H60z" stroke="currentColor" strokeWidth="2" />
            <path d="M60 95h190M60 130h190M60 165h190" stroke="currentColor" strokeWidth="2" />
            <path d="M310 45 400 20l90 25v135l-90 25-90-25Z" stroke="currentColor" strokeWidth="2" />
            <path d="M400 20v160" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="hero-left">

          <div className="hero-icon">
            <Icon name="layers" size={32} stroke={1.7} />
          </div>

          <div>
            <div className="eyebrow">ACADEMIC SCHEDULING</div>

            <h1>Subjects</h1>

            <div className="hero-subtitle">Subject Configuration</div>

            <p>Configure theory and laboratory subjects for each class.</p>
          </div>

        </div>

        <div className="hero-chip">
          <span>CLASSES</span>
          <strong>{classes.length}</strong>
        </div>

      </section>


      {/* =========================================================
          STATS
      ========================================================= */}

      {hasClass && (
        <section className="stats-grid">

          <div className="stat-card stat-slate">
            <div className="stat-icon">
              <Icon name="layers" size={25} />
            </div>
            <div>
              <div className="stat-label">SUBJECTS</div>
              <div className="stat-number">{classSubjects.length}</div>
            </div>
            <div className="stat-decoration">
              <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
                <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
                <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10 L 120 40 L 0 40 Z" fill="url(#slate-gradient)" style={{ opacity: 0.15 }} />
                <defs>
                  <linearGradient id="slate-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="stat-card stat-blue">
            <div className="stat-icon">
              <Icon name="book" size={25} />
            </div>
            <div>
              <div className="stat-label">THEORY</div>
              <div className="stat-number">{theoryCount}</div>
            </div>
            <div className="stat-decoration">
              <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
                <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
                <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5 L 120 40 L 0 40 Z" fill="url(#blue-gradient)" style={{ opacity: 0.15 }} />
                <defs>
                  <linearGradient id="blue-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <div className="stat-card stat-purple">
            <div className="stat-icon">
              <Icon name="flask" size={25} />
            </div>
            <div>
              <div className="stat-label">LABS</div>
              <div className="stat-number">{labCount}</div>
            </div>
            <div className="stat-decoration">
              <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
                <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
                <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5 L 120 40 L 0 40 Z" fill="url(#purple-gradient)" style={{ opacity: 0.15 }} />
                <defs>
                  <linearGradient id="purple-gradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

        </section>
      )}


      {/* =========================================================
          GLOBAL MESSAGES
      ========================================================= */}

      {message && (
        <div className="message success-message">
          <Icon name="check" size={17} />
          {message}
        </div>
      )}

      {error && (
        <div className="message error-message">
          {error}
        </div>
      )}


      {/* =========================================================
          CLASS SWITCHER
      ========================================================= */}

      <section className="class-switcher">

        <div className="switcher-header">
          <div className="switcher-icon">
            <Icon name="school" size={22} />
          </div>

          <div>
            <div className="switcher-title">ACTIVE CLASS</div>
            <div className="switcher-desc">
              All subjects below belong to the selected class.
            </div>
          </div>
        </div>

        <div className="class-chip-row">
          {classes.map(c => {
            const active = parseInt(selectedClassId) === c.class_id

            return (
              <button
                key={c.class_id}
                type="button"
                className={`class-chip ${active ? 'active' : ''}`}
                onClick={() => handleClassSwitch(c.class_id)}
              >
                <span className="class-chip-label">CLASS</span>
                <span className="class-chip-name">{c.class_name}</span>
              </button>
            )
          })}
        </div>

      </section>


      {/* =========================================================
          CURRENT CLASS BANNER / EMPTY NOTICE
      ========================================================= */}

      {hasClass ? (
        <div className="current-class-banner">
          <div>
            <div className="banner-label">CURRENTLY MANAGING SUBJECTS FOR</div>
            <div className="banner-name">{selectedClass?.class_name}</div>
          </div>

          <div className="banner-badges">
            <span className="badge badge-neutral">
              {classSubjects.length} Subjects
            </span>
            <span className="badge badge-theory">
              {theoryCount} Theory
            </span>
            <span className="badge badge-lab">
              {labCount} Labs
            </span>
          </div>
        </div>
      ) : (
        <div className="no-class-notice">
          <div className="no-class-notice-icon">
            <Icon name="info" size={22} stroke={2} />
          </div>
          <div>
            <strong>Select a class to get started</strong>
            <div>Choose CS-A, CS-B or another class above before adding subjects.</div>
          </div>
        </div>
      )}


      {/* =========================================================
          ADD / EDIT SUBJECT
      ========================================================= */}

      <form
        className={`form-card ${!hasClass ? 'form-card-disabled' : ''} ${editingId ? 'form-card-editing' : ''}`}
        onSubmit={handleSubmit}
      >

        <div className="form-header">
          <div className="form-title-group">
            <div className={`form-icon ${editingId ? 'form-icon-edit' : ''}`}>
              <Icon name={editingId ? 'edit' : 'plus'} size={21} />
            </div>

            <div>
              <div className="form-heading">
                {editingId ? 'Edit Subject' : 'Add Subject'}
              </div>
              <div className="form-sub">
                {editingId
                  ? `Editing ${editingType} subject for ${getClassName(parseInt(selectedClassId))}.`
                  : hasClass
                  ? `Add a subject for ${getClassName(parseInt(selectedClassId))} as theory, lab, or both.`
                  : 'Select a class to start adding subjects.'}
              </div>
            </div>
          </div>

          {hasClass && (
            <div className="class-pill">
              <span>CLASS</span>
              <strong>{getClassName(parseInt(selectedClassId))}</strong>
            </div>
          )}
        </div>

        <div className="form-grid">

          <div className="field-wrap">
            <label htmlFor="subject-name">Subject Name</label>
            <input
              id="subject-name"
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              placeholder="e.g. Programming"
            />
            <span className="field-hint">
              Use the exact subject name you want displayed in the timetable.
            </span>
          </div>

          <div className="field-wrap">
            <label>Subject Type</label>

            <div className="type-selector">
              <button
                type="button"
                className={`type-option type-option-theory ${selectedTypes.theory ? 'selected' : ''}`}
                onClick={() => !typeToggleLocked && toggleType('theory')}
                disabled={typeToggleLocked}
              >
                <div className="type-option-icon">
                  <Icon name="book" size={19} />
                </div>
                <div>
                  <strong>Theory</strong>
                  <span>Lecture session</span>
                </div>
              </button>

              <button
                type="button"
                className={`type-option type-option-lab ${selectedTypes.lab ? 'selected' : ''}`}
                onClick={() => !typeToggleLocked && toggleType('lab')}
                disabled={typeToggleLocked}
              >
                <div className="type-option-icon">
                  <Icon name="flask" size={19} />
                </div>
                <div>
                  <strong>Lab</strong>
                  <span>Practical session</span>
                </div>
              </button>
            </div>

            {bothTypes && !editingId && (
              <div className="dual-info">
                <Icon name="check" size={13} />
                This creates Theory + Lab entries for the same subject.
              </div>
            )}

            {typeToggleLocked && (
              <div className="locked-info">
                <Icon name="info" size={13} />
                Type is locked while editing.
              </div>
            )}
          </div>

          <div className="field-wrap">
            <label>Periods Per Week</label>

            <div className={`periods-grid ${bothTypes ? 'periods-grid-dual' : ''}`}>
              {selectedTypes.theory && (
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="periods-input periods-input-theory"
                  value={theoryPeriods}
                  onChange={e => setTheoryPeriods(e.target.value)}
                  placeholder="Theory"
                />
              )}

              {selectedTypes.lab && (
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="periods-input periods-input-lab"
                  value={labPeriods}
                  onChange={e => setLabPeriods(e.target.value)}
                  placeholder="Lab"
                />
              )}
            </div>

            <span className="field-hint">
              Weekly periods allocated to the selected subject type.
            </span>
          </div>

        </div>

        <div className="form-footer">
          {editingId && (
            <button
              type="button"
              className="secondary-button"
              onClick={handleCancelEdit}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={!canSubmit}
          >
            {editingId ? (
              <>
                <Icon name="check" size={17} />
                Update Subject
              </>
            ) : (
              <>
                <Icon name="plus" size={17} />
                Add Subject{bothTypes ? ' (Theory + Lab)' : ''}
              </>
            )}
          </button>
        </div>

      </form>


      {/* =========================================================
          SUBJECT DIRECTORY
      ========================================================= */}

      <section className="directory-card">

        <div className="directory-header">

          <div className="directory-title-block">
            <div className="directory-eyebrow">SUBJECT DIRECTORY</div>

            <div className="directory-title-row">
              <div className="directory-main-icon">
                <Icon name="layers" size={23} />
              </div>

              <div>
                <h2>Subject Directory</h2>
                <p>
                  Subjects configured for{' '}
                  <strong>
                    {hasClass ? getClassName(parseInt(selectedClassId)) : 'the selected class'}
                  </strong>.
                </p>
              </div>
            </div>
          </div>

          {hasClass && (
            <div className="result-count">
              {filteredSubjects.length}{' '}
              {filteredSubjects.length === 1 ? 'subject' : 'subjects'}
            </div>
          )}

        </div>

        {hasClass && (
          <>
            <div className="filter-row">
              <span className="filter-label">Show:</span>

              {[
                { key: 'all', label: 'All Subjects', count: classSubjects.length },
                { key: 'theory', label: 'Theory', count: theoryCount },
                { key: 'lab', label: 'Labs', count: labCount },
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  className={`filter-button ${filterType === f.key ? 'active' : ''}`}
                  onClick={() => setFilterType(f.key)}
                >
                  {f.label}
                  <span className="filter-count">{f.count}</span>
                </button>
              ))}
            </div>

            <div className="search-wrapper">
              <Icon name="search" size={18} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search subjects by name..."
              />
              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </div>
          </>
        )}

        {!hasClass ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="school" size={27} />
            </div>
            <h3>No class selected</h3>
            <p>Select a class above to view and manage its subjects.</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="empty-state">
            <div className={`empty-icon ${filterType === 'lab' ? 'empty-icon-lab' : ''}`}>
              <Icon name={filterType === 'lab' ? 'flask' : 'layers'} size={27} />
            </div>
            <h3>
              {filterType === 'all'
                ? `No subjects for ${getClassName(parseInt(selectedClassId))} yet`
                : `No ${filterType === 'lab' ? 'lab' : 'theory'} subjects found`}
            </h3>
            <p>
              {search
                ? 'Try a different search term.'
                : filterType === 'all'
                ? 'Use the form above to add the first subject for this class.'
                : 'Try another filter or add a new subject above.'}
            </p>
          </div>
        ) : (
          <div className="subject-table-wrapper">
            <table className="subject-table">
              <thead>
                <tr>
                  <th className="index-column">#</th>
                  <th>SUBJECT</th>
                  <th>TYPE</th>
                  <th className="periods-column">PERIODS / WEEK</th>
                  <th className="actions-column">ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredSubjects.map((subject, index) => (
                  <tr
                    key={subject.subject_id}
                    className={editingId === subject.subject_id ? 'row-editing' : ''}
                  >
                    <td className="index-cell">
                      {String(index + 1).padStart(2, '0')}
                    </td>

                    <td>
                      <div className="subject-name-cell">
                        <div className={`subject-icon ${subject.subject_type === 'lab' ? 'subject-icon-lab' : ''}`}>
                          <Icon name={subject.subject_type === 'lab' ? 'flask' : 'book'} size={19} />
                        </div>
                        <div>
                          <div className="subject-name">{subject.subject_name}</div>
                          <div className="subject-meta">
                            {subject.subject_type === 'lab' ? 'Practical session' : 'Theory session'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`type-badge ${subject.subject_type === 'lab' ? 'type-badge-lab' : 'type-badge-theory'}`}>
                        <Icon name={subject.subject_type === 'lab' ? 'flask' : 'book'} size={12} />
                        {subject.subject_type === 'lab' ? 'Lab' : 'Theory'}
                      </span>
                    </td>

                    <td className="periods-cell">
                      <span className={`period-badge ${subject.subject_type === 'lab' ? 'period-badge-lab' : ''}`}>
                        {subject.periods_per_week}
                      </span>
                    </td>

                    <td className="actions-cell">
                      <button className="edit-button" onClick={() => handleEdit(subject)}>
                        <Icon name="edit" size={15} />
                        Edit
                      </button>
                      <button className="delete-button" onClick={() => promptDelete(subject)}>
                        <Icon name="trash" size={15} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-footer">
              Showing {filteredSubjects.length} of {classSubjects.length} subjects
            </div>
          </div>
        )}

      </section>


      {/* =========================================================
          DELETE MODAL
      ========================================================= */}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Subject"
        itemName={deleteTarget ? `${deleteTarget.subject_name} (${deleteTarget.subject_type})` : ''}
        message="Are you sure you want to delete this subject? This will disassociate any teacher links and timetable entries."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />


      {/* =========================================================
          PAGE STYLES
      ========================================================= */}

      <style>{`

        .subjects-page {
          width: 100%;
          min-height: 100%;
          box-sizing: border-box;
          padding: 8px 4px 48px;
          color: #13203a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        /* =========================
           HERO
        ========================= */

        .subjects-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          min-height: 176px;
          padding: 26px 30px;
          margin-bottom: 22px;
          border: 1px solid #dfe7f4;
          border-radius: 24px;
          background: linear-gradient(135deg, #ffffff 0%, #f8faff 58%, #f2f5ff 100%);
          box-shadow: 0 12px 36px rgba(28, 52, 96, 0.06);
        }

        .hero-left {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hero-icon {
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border: 1px solid #cbdcff;
          border-radius: 19px;
          background: linear-gradient(145deg, #eff5ff, #e0eaff);
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.08);
        }

        .eyebrow {
          margin-bottom: 5px;
          color: #3564bb;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .subjects-hero h1 {
          margin: 0;
          color: #101b35;
          font-size: 32px;
          line-height: 1.08;
          letter-spacing: -0.035em;
          font-weight: 800;
        }

        .hero-subtitle {
          margin-top: 7px;
          color: #4a5d84;
          font-size: 16px;
          line-height: 1.3;
          font-weight: 650;
        }

        .subjects-hero p {
          margin: 7px 0 0;
          color: #71809d;
          font-size: 13px;
          line-height: 1.5;
          max-width: 420px;
        }

        .subjects-watermark {
          position: absolute;
          z-index: 1;
          right: 60px;
          bottom: -6px;
          width: min(42%, 560px);
          color: #8fa8e7;
          opacity: 0.11;
          pointer-events: none;
        }

        .subjects-watermark svg {
          display: block;
          width: 100%;
          height: auto;
        }

        .hero-chip {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          padding: 10px 16px;
          border: 1px solid #d9e3f8;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.7);
        }

        .hero-chip span {
          color: #7483a0;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .hero-chip strong {
          color: #1d2a45;
          font-size: 19px;
          font-weight: 800;
        }

        /* =========================
           BUTTONS
        ========================= */

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          padding: 0 20px;
          border: 1px solid #245de8;
          border-radius: 11px;
          background: linear-gradient(135deg, #326bf0, #2458db);
          color: white;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          box-shadow: 0 9px 20px rgba(37, 99, 235, 0.20);
          transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        }

        .primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.03);
          box-shadow: 0 12px 25px rgba(37, 99, 235, 0.25);
        }

        .primary-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .secondary-button {
          min-height: 44px;
          padding: 0 17px;
          border: 1px solid #d2dce9;
          border-radius: 11px;
          background: white;
          color: #596982;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .secondary-button:hover {
          background: #f5f7fa;
        }

        /* =========================
           STATS
        ========================= */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
          min-height: 96px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 18px 21px;
          border: 1px solid #dfe6f2;
          border-radius: 17px;
          background: white;
          box-shadow: 0 7px 22px rgba(30, 48, 87, 0.045);
        }

        .stat-icon {
          position: relative;
          z-index: 2;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
        }

        .stat-slate .stat-icon { color: #475569; background: #eef2f6; }
        .stat-blue .stat-icon { color: #2563eb; background: #eaf1ff; }
        .stat-purple .stat-icon { color: #7041d9; background: #f0eaff; }

        .stat-label {
          position: relative;
          z-index: 2;
          color: #60708e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }

        .stat-number {
          position: relative;
          z-index: 2;
          margin-top: 2px;
          font-size: 28px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .stat-slate .stat-number { color: #334155; }
        .stat-blue .stat-number { color: #2563eb; }
        .stat-purple .stat-number { color: #7041d9; }

        .stat-decoration {
          position: absolute;
          right: 0;
          bottom: 0;
          opacity: 0.8;
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
        }

        .stat-slate .stat-decoration { }
        .stat-blue .stat-decoration { }
        .stat-purple .stat-decoration { }

        /* =========================
           MESSAGES
        ========================= */

        .message {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 17px;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
        }

        .success-message {
          color: #147447;
          border: 1px solid #bde8d1;
          background: #effbf5;
        }

        .error-message {
          color: #b42318;
          border: 1px solid #f1c5c1;
          background: #fff5f4;
        }

        /* =========================
           CLASS SWITCHER
        ========================= */

        .class-switcher {
          display: flex;
          align-items: center;
          gap: 22px;
          flex-wrap: wrap;
          min-height: 88px;
          margin-bottom: 14px;
          padding: 16px 22px;
          border: 1px solid #dce4f0;
          border-radius: 17px;
          background: white;
          box-shadow: 0 6px 20px rgba(30, 48, 87, 0.04);
        }

        .switcher-header {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .switcher-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 13px;
          background: #edf3ff;
        }

        .switcher-title {
          color: #2563eb;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 3px;
        }

        .switcher-desc {
          color: #71809d;
          font-size: 11px;
        }

        .class-chip-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-left: auto;
        }

        .class-chip {
          min-width: 88px;
          min-height: 54px;
          padding: 7px 15px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 3px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: white;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .class-chip:hover {
          border-color: #93c5fd;
          background: #f8faff;
        }

        .class-chip.active {
          border-color: #2563eb;
          background: #2563eb;
          color: white;
          box-shadow: 0 7px 16px rgba(37, 99, 235, 0.22);
        }

        .class-chip-label {
          font-size: 10px;
          font-weight: 700;
          opacity: 0.6;
        }

        .class-chip.active .class-chip-label {
          opacity: 0.8;
        }

        .class-chip-name {
          font-size: 17px;
          font-weight: 800;
          line-height: 1;
        }

        /* =========================
           CURRENT CLASS BANNER
        ========================= */

        .current-class-banner {
          margin-bottom: 20px;
          padding: 15px 20px;
          border-radius: 14px;
          border: 1px solid #bfdbfe;
          background: linear-gradient(135deg, #f8fbff 0%, #eff6ff 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03);
        }

        .banner-label {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.07em;
          margin-bottom: 2px;
        }

        .banner-name {
          font-size: 21px;
          font-weight: 800;
          color: #1d4ed8;
          line-height: 1.2;
        }

        .banner-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .badge {
          font-size: 11px;
          font-weight: 750;
          border-radius: 999px;
          padding: 7px 12px;
          white-space: nowrap;
        }

        .badge-neutral {
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .badge-theory {
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
        }

        .badge-lab {
          color: #7041d9;
          background: #f0eaff;
          border: 1px solid #d8c7ff;
        }

        .no-class-notice {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 76px;
          margin-bottom: 20px;
          padding: 16px 22px 16px 20px;
          border-radius: 16px;
          border: 1px solid #fde68a;
          border-left: 4px solid #d97706;
          background: linear-gradient(135deg, #fffbeb 0%, #fff7e0 100%);
          color: #78350f;
          font-size: 12px;
          box-shadow: 0 8px 22px rgba(217, 119, 6, 0.08);
        }

        .no-class-notice-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
          color: #b45309;
          background: #fef3c7;
          border: 1px solid #fde68a;
        }

        .no-class-notice strong {
          display: block;
          font-size: 14px;
          font-weight: 800;
          color: #92400e;
          margin-bottom: 3px;
        }

        /* =========================
           ADD / EDIT FORM CARD
        ========================= */

        .form-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          padding: 24px 26px;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
          transition: opacity 0.15s ease;
        }

        .form-card-editing {
          border-color: #93c5fd;
        }

        .form-card-disabled {
          opacity: 0.55;
          pointer-events: none;
        }

        .form-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }

        .form-title-group {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .form-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 13px;
          background: #edf3ff;
        }

        .form-icon-edit {
          color: #7041d9;
          background: #f0eaff;
        }

        .form-heading {
          font-size: 16px;
          font-weight: 800;
          color: #101b35;
          margin-bottom: 3px;
        }

        .form-sub {
          font-size: 12px;
          color: #64748b;
          line-height: 1.5;
        }

        .class-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 13px;
          border-radius: 999px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
        }

        .class-pill span {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          opacity: 0.75;
        }

        .class-pill strong {
          font-size: 12px;
          font-weight: 800;
        }

        .form-grid {
          display: grid;
          grid-template-columns: minmax(240px, 1.4fr) minmax(240px, 1.1fr) minmax(200px, 0.8fr);
          gap: 18px;
          align-items: start;
        }

        .field-wrap label {
          display: block;
          margin-bottom: 8px;
          color: #35445f;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .field-wrap input[type="text"],
        .field-wrap input:not([type]) {
          width: 100%;
          height: 46px;
          box-sizing: border-box;
          padding: 0 14px;
          border: 1px solid #cfd9e7;
          border-radius: 10px;
          outline: none;
          background: #fbfcfe;
          color: #172440;
          font-size: 14px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .field-wrap input:focus {
          border-color: #8eaff2;
          background: white;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }

        .field-hint {
          display: block;
          margin-top: 7px;
          color: #8a97aa;
          font-size: 10px;
          line-height: 1.4;
        }

        .type-selector {
          display: flex;
          gap: 8px;
        }

        .type-option {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 70px;
          padding: 11px;
          border: 1px solid #d7dfeb;
          border-radius: 12px;
          background: #fbfcfe;
          color: #65738e;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }

        .type-option:hover:not(:disabled) {
          background: #f7f9fd;
        }

        .type-option:disabled {
          cursor: not-allowed;
        }

        .type-option.selected {
          box-shadow: 0 5px 14px rgba(30, 48, 90, 0.055);
        }

        .type-option-theory.selected {
          border-color: #7ca4f5;
          background: #f2f6ff;
          color: #245bd2;
        }

        .type-option-lab.selected {
          border-color: #b49ae9;
          background: #f5f1ff;
          color: #7441d6;
        }

        .type-option:disabled:not(.selected) {
          opacity: 0.45;
        }

        .type-option-icon {
          width: 37px;
          height: 37px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.7);
        }

        .type-option strong {
          display: block;
          color: #1d2a45;
          font-size: 12px;
          font-weight: 800;
        }

        .type-option span {
          margin-top: 2px;
          color: #8490a5;
          font-size: 10px;
        }

        .dual-info,
        .locked-info {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 8px;
          padding: 6px 10px;
        }

        .dual-info {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .locked-info {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .periods-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .periods-grid-dual {
          grid-template-columns: 1fr 1fr;
        }

        .periods-input {
          width: 100%;
          height: 46px;
          box-sizing: border-box;
          padding: 0 14px;
          border-radius: 10px;
          outline: none;
          font-size: 14px;
          color: #172440;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .periods-input:focus {
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }

        .periods-input-theory {
          border: 1px solid #93c5fd;
          background: #eff6ff;
        }

        .periods-input-lab {
          border: 1px solid #c9b6ef;
          background: #f5f1ff;
        }

        .form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        /* =========================
           DIRECTORY
        ========================= */

        .directory-card {
          overflow: hidden;
          border: 1px solid #dfe6f1;
          border-radius: 20px;
          background: white;
          box-shadow: 0 10px 30px rgba(28, 48, 90, 0.055);
        }

        .directory-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 24px 25px 18px;
        }

        .directory-eyebrow {
          margin-bottom: 8px;
          color: #7483a0;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .directory-title-row {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .directory-main-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 14px;
          background: #edf3ff;
        }

        .directory-title-row h2 {
          margin: 0;
          color: #15213d;
          font-size: 19px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: -0.025em;
        }

        .directory-title-row p {
          margin: 4px 0 0;
          color: #71809d;
          font-size: 12px;
          line-height: 1.5;
        }

        .result-count {
          color: #3e609d;
          border: 1px solid #cddcff;
          border-radius: 999px;
          background: #f3f7ff;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
        }

        .filter-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          padding: 14px 25px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }

        .filter-label {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-right: 4px;
        }

        .filter-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-button.active {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1d4ed8;
        }

        .filter-count {
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          color: #64748b;
          font-size: 10px;
        }

        .filter-button.active .filter-count {
          background: #dbeafe;
          color: #1d4ed8;
        }

        /* =========================
           SEARCH
        ========================= */

        .search-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 16px 25px;
          min-height: 45px;
          padding: 0 13px;
          border: 1px solid #d4deec;
          border-radius: 11px;
          background: #fbfcfe;
          color: #71809b;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .search-wrapper:focus-within {
          border-color: #8db0f5;
          background: white;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }

        .search-wrapper input {
          flex: 1;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #1a2742;
          font-size: 13px;
        }

        .search-wrapper input::placeholder {
          color: #9aa7bb;
        }

        .clear-search {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 7px;
          background: #edf2f9;
          color: #61718f;
          cursor: pointer;
        }

        /* =========================
           TABLE
        ========================= */

        .subject-table-wrapper {
          margin: 0 14px 14px;
          overflow: hidden;
          border: 1px solid #e1e7f0;
          border-radius: 14px;
        }

        .subject-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .subject-table th {
          height: 44px;
          padding: 0 14px;
          border-bottom: 1px solid #dfe6ef;
          background: #f8faff;
          color: #62718d;
          text-align: left;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.075em;
        }

        .subject-table th.index-column { width: 60px; }
        .subject-table th.periods-column { width: 150px; text-align: center; }
        .subject-table th.actions-column { width: 190px; text-align: center; }

        .subject-table td {
          height: 80px;
          padding: 12px 14px;
          border-bottom: 1px solid #e7ebf2;
          background: white;
          vertical-align: middle;
        }

        .subject-table tbody tr:last-child td { border-bottom: 0; }
        .subject-table tbody tr:hover td { background: #fbfcff; }
        .subject-table tbody tr.row-editing td { background: #eff6ff; }

        .index-cell {
          color: #3566d8;
          font-size: 14px;
          font-weight: 800;
        }

        .subject-name-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .subject-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 12px;
          color: #2563eb;
          background: #edf3ff;
        }

        .subject-icon-lab {
          color: #7441d6;
          background: #f1ebff;
        }

        .subject-name {
          color: #15213d;
          font-size: 13px;
          font-weight: 800;
        }

        .subject-meta {
          margin-top: 3px;
          color: #8a97ab;
          font-size: 10px;
        }

        .type-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 23px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.04em;
        }

        .type-badge-theory {
          color: #245bd2;
          border: 1px solid #c9d9ff;
          background: #edf3ff;
        }

        .type-badge-lab {
          color: #7540d3;
          border: 1px solid #d8c7ff;
          background: #f2edff;
        }

        .periods-cell { text-align: center; }

        .period-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          padding: 5px 10px;
          border-radius: 999px;
          background: #edf3ff;
          border: 1px solid #c9d9ff;
          color: #245bd2;
          font-size: 12px;
          font-weight: 750;
        }

        .period-badge-lab {
          background: #f2edff;
          border: 1px solid #d8c7ff;
          color: #7540d3;
        }

        .actions-cell {
          text-align: center;
        }

        .edit-button,
        .delete-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 34px;
          padding: 0 11px;
          margin-left: 6px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .edit-button {
          color: #2563eb;
          border: 1px solid #cbdcff;
          background: #f4f7ff;
        }

        .edit-button:hover { background: #eaf1ff; }

        .delete-button {
          color: #d12c2c;
          border: 1px solid #f2cccc;
          background: #fff7f7;
        }

        .delete-button:hover { background: #fff0f0; }

        .table-footer {
          padding: 12px 14px;
          border-top: 1px solid #e7ebf2;
          color: #8190a7;
          background: #fbfcfe;
          font-size: 11px;
        }

        /* =========================
           EMPTY STATE
        ========================= */

        .empty-state {
          margin: 16px 14px 14px;
          padding: 50px 25px;
          border: 1px dashed #cad5e5;
          border-radius: 14px;
          background: linear-gradient(180deg, #fbfcff, #f8faff);
          text-align: center;
        }

        .empty-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 13px;
          color: #2563eb;
          border-radius: 16px;
          background: #edf3ff;
        }

        .empty-icon-lab {
          color: #7441d6;
          background: #f1ebff;
        }

        .empty-state h3 {
          margin: 0;
          color: #1a2742;
          font-size: 15px;
          font-weight: 800;
        }

        .empty-state p {
          max-width: 410px;
          margin: 7px auto 0;
          color: #7c899f;
          font-size: 12px;
          line-height: 1.5;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 1000px) {
          .stats-grid { grid-template-columns: 1fr; }
          .form-grid { grid-template-columns: 1fr; }
          .subjects-watermark { display: none; }
        }

        @media (max-width: 720px) {
          .subjects-hero {
            min-height: auto;
            align-items: flex-start;
            flex-direction: column;
            padding: 22px;
          }

          .hero-chip { display: none; }

          .subjects-hero h1 { font-size: 27px; }

          .class-switcher {
            flex-direction: column;
            align-items: flex-start;
          }

          .class-chip-row { margin-left: 0; }

          .current-class-banner {
            align-items: flex-start;
            flex-direction: column;
          }

          .directory-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .form-footer { flex-direction: column-reverse; }
          .form-footer button { width: 100%; }

          .subject-table th:nth-child(1),
          .subject-table td:nth-child(1) { display: none; }

          .edit-button, .delete-button {
            width: 34px;
            padding: 0;
            font-size: 0;
          }

          .edit-button svg, .delete-button svg { margin: 0; }
        }

        /* ── DARK THEME OVERRIDES ── */
        [data-theme='dark'] .subjects-page { color: #ffffff; }
        [data-theme='dark'] .subjects-hero { background: #0d1322 !important; border-color: #1a2338 !important; box-shadow: none !important; }
        [data-theme='dark'] .subjects-hero h1 { color: #ffffff !important; }
        [data-theme='dark'] .hero-subtitle { color: #ffffff !important; }
        [data-theme='dark'] .eyebrow { color: #a855f7 !important; }
        [data-theme='dark'] .hero-left p { color: #8a99ad !important; }
        [data-theme='dark'] .hero-icon { background: #141d33 !important; border-color: #1e2f57 !important; color: #3b82f6 !important; }
        [data-theme='dark'] .primary-button { background: linear-gradient(135deg, #4f46e5, #4338ca) !important; border-color: #3730a3 !important; }
        [data-theme='dark'] .stat-card { background: #0d1322 !important; border-color: #1a2338 !important; }
        [data-theme='dark'] .stat-label { color: #8a99ad !important; }
        [data-theme='dark'] .stat-number { color: #ffffff !important; }
        [data-theme='dark'] .directory-card { background: #0d1322 !important; border-color: #1a2338 !important; }
        [data-theme='dark'] .directory-title-row h2 { color: #ffffff !important; }
        [data-theme='dark'] .directory-title-row p { color: #8a99ad !important; }
        [data-theme='dark'] .directory-main-icon { background: #141d33 !important; color: #3b82f6 !important; }
        [data-theme='dark'] .search-wrapper { background: #090d16 !important; border-color: #1f2b45 !important; }
        [data-theme='dark'] .search-wrapper input { color: #ffffff !important; background: transparent !important; }
        [data-theme='dark'] .search-wrapper input::placeholder { color: #8a99ad !important; }
        [data-theme='dark'] .subject-table-wrapper { border-color: #1a2338 !important; }
        [data-theme='dark'] .subject-table th { background: #090d16 !important; color: #8a99ad !important; border-bottom-color: #1f2b45 !important; }
        [data-theme='dark'] .subject-table td { background: #0d1322 !important; border-bottom-color: #161e30 !important; color: #ffffff !important; }
        [data-theme='dark'] .subject-table tbody tr:hover td { background: #111827 !important; }
        [data-theme='dark'] .subject-name { color: #ffffff !important; }
        [data-theme='dark'] .subject-sub { color: #8a97ab !important; }
        [data-theme='dark'] .avatar-circle { background: #1a2540 !important; color: #3b82f6 !important; border-color: #233763 !important; }
        [data-theme='dark'] .edit-button { background: #16223d !important; color: #3b82f6 !important; border-color: #233763 !important; }
        [data-theme='dark'] .delete-button { background: #2b141d !important; color: #f43f5e !important; border-color: #4a1c29 !important; }
        [data-theme='dark'] .info-card, [data-theme='dark'] .class-switcher, [data-theme='dark'] .current-class-banner, [data-theme='dark'] .subject-form-card { background: #0d1322 !important; border-color: #1a2338 !important; color: #ffffff !important; }
        [data-theme='dark'] .info-card *, [data-theme='dark'] .current-class-banner * { color: #ffffff !important; }
        [data-theme='dark'] .index-cell { color: #3b82f6 !important; }
        [data-theme='dark'] .class-chip { background: #121b2d !important; color: #8a99ad !important; border-color: #1e2f4a !important; }
        [data-theme='dark'] .class-chip.active { background: #2563eb !important; color: #ffffff !important; border-color: #2563eb !important; }
        [data-theme='dark'] .type-card { background: #090d16 !important; border-color: #1f2b45 !important; color: #8a99ad !important; }
        [data-theme='dark'] .type-card.selected { background: #141d33 !important; border-color: #2563eb !important; color: #ffffff !important; }
        [data-theme='dark'] .form-control input { background: #090d16 !important; border-color: #1f2b45 !important; color: #ffffff !important; }

      `}</style>

    </div>
  )
}