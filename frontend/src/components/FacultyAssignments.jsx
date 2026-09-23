import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import ConfirmModal from './ConfirmModal.jsx'
import SubjectTypeBadge from './SubjectTypeBadge.jsx'
import './AcademicStructureModern.css'
import './FacultyAssignmentsModern.css'

const BASE = 'http://localhost:8000'
const yearLabel = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y] || `Year ${y}`)

/* ─────────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────────── */
function Icon({ name, size = 18, stroke = 1.9 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    faculty: <><circle cx="9" cy="8" r="3.4" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="8.5" r="2.6" /><path d="M15.2 14.2c2.6.4 4.6 2.6 4.8 5.8" /></>,
    link: <><path d="M9 15 15 9" /><path d="M10.5 6.5 12 5a3.7 3.7 0 0 1 5.2 5.2l-1.5 1.5" /><path d="M13.5 17.5 12 19a3.7 3.7 0 0 1-5.2-5.2l1.5-1.5" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m13.5 7.5 3 3" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.5v.01" /></>,
    book: <><path d="M5 4.5C5 4 5.5 3.5 6 3.5h10c.6 0 1 .4 1 1V19c0 .6-.4 1-1 1H7c-1 0-2 .8-2 2V4.5Z" /><path d="M5 18.5c0-1 .9-1.7 2-1.7h10" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1.4" /><rect x="14" y="4" width="6" height="6" rx="1.4" /><rect x="4" y="14" width="6" height="6" rx="1.4" /><rect x="14" y="14" width="6" height="6" rx="1.4" /></>,
    filter: <path d="M4 5h16M7 12h10M10 19h4" />,
    building: <><path d="M3 21h18" /><path d="M5 21V6l7-3 7 3v15" /><path d="M8 9h1M12 9h1M16 9h1M8 12h1M12 12h1M16 12h1M8 15h1M12 15h1M16 15h1" /></>,
    alert: <><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

/* Subtle faculty-themed line-art watermark for the hero */
function FacultyWatermark(props) {
  return (
    <svg className="fac-hero-watermark" viewBox="0 0 640 220" fill="none" aria-hidden="true" {...props}>
      {/* mortarboard */}
      <path d="M120 70 220 35l100 35-100 35Z" stroke="currentColor" strokeWidth="2" />
      <path d="M170 88v34c0 10 22 18 50 18s50-8 50-18V88" stroke="currentColor" strokeWidth="2" />
      <path d="M300 78v40" stroke="currentColor" strokeWidth="2" />
      <circle cx="300" cy="122" r="4" stroke="currentColor" strokeWidth="2" />
      {/* connected nodes: faculty -> subjects */}
      <circle cx="410" cy="60" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="470" cy="110" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="410" cy="150" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="530" cy="70" r="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="540" cy="150" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M410 60 470 110M410 60 410 150M470 110 530 70M470 110 540 150" stroke="currentColor" strokeWidth="1.6" />
      {/* books */}
      <path d="M40 185h90M45 175h80M50 165h70" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   SMALL FIELD WRAPPER (matches .field styling from AcademicStructureModern.css)
───────────────────────────────────────────────────────────────────── */
function Field({ label, children, hint }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   Group assignments (flat, per-division rows) into a nested
   teacher -> subject -> divisions structure for display.
───────────────────────────────────────────────────────────────────── */
function buildTeacherAssignmentTree(assignments) {
  const teacherMap = new Map()
  assignments.forEach(a => {
    const tKey = a.teacher_id
    if (!teacherMap.has(tKey)) {
      teacherMap.set(tKey, { teacherId: a.teacher_id, teacherName: a.teacher_name, subjects: new Map() })
    }
    const teacherEntry = teacherMap.get(tKey)
    const sKey = `${a.definition_id}-${a.department}-${a.year_of_study}`
    if (!teacherEntry.subjects.has(sKey)) {
      teacherEntry.subjects.set(sKey, {
        key: sKey,
        subjectName: a.subject_name,
        subjectType: a.subject_type,
        department: a.department,
        yearOfStudy: a.year_of_study,
        definitionId: a.definition_id,
        divisions: [],
      })
    }
    teacherEntry.subjects.get(sKey).divisions.push({
      assignmentId: a.assignment_id,
      divisionId: a.division_id,
      divisionName: a.division_name,
    })
  })
  return Array.from(teacherMap.values()).map(t => ({
    ...t,
    subjects: Array.from(t.subjects.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
  })).sort((a, b) => a.teacherName.localeCompare(b.teacherName))
}

function initials(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?'
}

/* =========================================================================
   FACULTY DIRECTORY MODAL — view / search / edit / delete teachers
========================================================================= */
function FacultyDirectoryModal({ teachers, assignmentCountByTeacher, onClose, onRequestEdit, onRequestDelete }) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter(t => t.teacher_name.toLowerCase().includes(q))
  }, [teachers, search])

  return (
    <div className="modal-backdrop faculty-modal-root" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="academic-modal fac-modal-lg">
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-icon"><Icon name="faculty" size={20} /></div>
            <div>
              <div className="academic-eyebrow">FACULTY</div>
              <h2>Faculty Directory</h2>
              <p>Manage all globally configured teachers</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div className="fac-search">
          <Icon name="search" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teachers..." autoFocus />
          {search && <button onClick={() => setSearch('')}><Icon name="close" size={13} /></button>}
        </div>

        {filtered.length ? (
          <div className="fac-table-wrap">
            <table className="fac-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Max Periods/Day</th>
                  <th>Assignments</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.teacher_id}>
                    <td className="name-cell">{t.teacher_name}</td>
                    <td><span className="fac-max-badge">{t.max_periods_per_day} / day</span></td>
                    <td>{assignmentCountByTeacher.get(t.teacher_id) || 0}</td>
                    <td>
                      <div className="fac-row-actions">
                        <button className="fac-icon-btn" title="Edit" onClick={() => onRequestEdit(t)}><Icon name="edit" size={14} /></button>
                        <button className="fac-icon-btn danger" title="Delete" onClick={() => onRequestDelete(t)}><Icon name="trash" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fac-empty">
            <div className="fac-empty-icon"><Icon name="search" size={18} /></div>
            <h3>No faculty members found.</h3>
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   TEACHER EDIT MODAL (also reused for "add" is inline on the page)
========================================================================= */
function TeacherEditModal({ teacher, onSave, onClose, error }) {
  const [name, setName] = useState(teacher.teacher_name)
  const [max, setMax] = useState(teacher.max_periods_per_day)

  return (
    <div className="modal-backdrop faculty-modal-root" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="academic-modal" style={{ width: 'min(440px, 100%)' }}>
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-icon edit"><Icon name="edit" size={19} /></div>
            <div>
              <div className="academic-eyebrow">FACULTY</div>
              <h2>Edit Faculty Member</h2>
              <p>Update this teacher's details</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <Field label="Teacher name">
          <input value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Maximum periods / day">
          <input type="number" min="1" max="8" value={max} onChange={e => setMax(e.target.value)} />
        </Field>

        {error && <div className="notice error">{error}</div>}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button modal-primary" onClick={() => onSave({ teacher_name: name.trim(), max_periods_per_day: Number(max) })}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   ADD ASSIGNMENT WIZARD — Teacher -> Departments -> Subjects/Divisions -> Review
========================================================================= */
function AddAssignmentWizardModal({ teachers, groups, onClose, onSubmit, submitError }) {
  const [step, setStep] = useState(1)
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teacherId, setTeacherId] = useState(null)
  const [depts, setDepts] = useState([])                 // selected department names
  // selection[groupId] = { defIds: Set, divIds: Set }
  const [selection, setSelection] = useState({})

  const departments = useMemo(() => [...new Set(groups.map(g => g.department))].sort(), [groups])
  const selectedTeacher = teachers.find(t => t.teacher_id === teacherId)

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter(t => t.teacher_name.toLowerCase().includes(q))
  }, [teachers, teacherSearch])

  // groups relevant to the selected departments, keyed by group_id
  const relevantGroups = useMemo(() => groups.filter(g => depts.includes(g.department)), [groups, depts])

  function toggleDept(d) {
    setDepts(prev => {
      const removing = prev.includes(d)
      const next = removing ? prev.filter(x => x !== d) : [...prev, d]
      if (removing) {
        setSelection(sel => {
          const copy = { ...sel }
          groups.filter(g => g.department === d).forEach(g => delete copy[g.group_id])
          return copy
        })
      }
      return next
    })
  }

  function ensureGroupSelection(groupId, allDivisionIds) {
    setSelection(sel => {
      if (sel[groupId]) return sel
      return { ...sel, [groupId]: { defIds: new Set(), divIds: new Set(allDivisionIds) } }
    })
  }

  function toggleSubject(group, definitionId) {
    setSelection(sel => {
      const current = sel[group.group_id] || { defIds: new Set(), divIds: new Set(group.divisions.map(d => d.division_id)) }
      const defIds = new Set(current.defIds)
      if (defIds.has(definitionId)) defIds.delete(definitionId); else defIds.add(definitionId)
      return { ...sel, [group.group_id]: { ...current, defIds } }
    })
  }

  function toggleDivision(group, divisionId) {
    setSelection(sel => {
      const current = sel[group.group_id] || { defIds: new Set(), divIds: new Set(group.divisions.map(d => d.division_id)) }
      const divIds = new Set(current.divIds)
      if (divIds.has(divisionId)) divIds.delete(divisionId); else divIds.add(divisionId)
      return { ...sel, [group.group_id]: { ...current, divIds } }
    })
  }

  function removeSubjectChip(groupId, definitionId) {
    setSelection(sel => {
      const current = sel[groupId]
      if (!current) return sel
      const defIds = new Set(current.defIds)
      defIds.delete(definitionId)
      return { ...sel, [groupId]: { ...current, defIds } }
    })
  }

  // flattened list of selected subject chips: { group, subject }
  const selectedSubjectChips = useMemo(() => {
    const chips = []
    relevantGroups.forEach(g => {
      const sel = selection[g.group_id]
      if (!sel) return
      g.subjects.forEach(s => { if (sel.defIds.has(s.definition_id)) chips.push({ group: g, subject: s }) })
    })
    return chips
  }, [relevantGroups, selection])

  const totalSelectedSubjects = selectedSubjectChips.length

  const canGoStep2 = !!teacherId
  const canGoStep3 = depts.length > 0
  const canGoStep4 = totalSelectedSubjects > 0
  const steps = ['Teacher', 'Departments', 'Subjects', 'Review']

  function goNext() {
    if (step === 1 && canGoStep2) setStep(2)
    else if (step === 2 && canGoStep3) setStep(3)
    else if (step === 3 && canGoStep4) setStep(4)
  }
  function goBack() { setStep(s => Math.max(1, s - 1)) }

  function handleSubmit() {
    const payloadGroups = relevantGroups
      .map(g => {
        const sel = selection[g.group_id]
        if (!sel || sel.defIds.size === 0 || sel.divIds.size === 0) return null
        return { group: g, definitionIds: [...sel.defIds], divisionIds: [...sel.divIds] }
      })
      .filter(Boolean)
    if (!payloadGroups.length) return
    onSubmit({ teacherId, groups: payloadGroups })
  }

  return (
    <div className="modal-backdrop faculty-modal-root" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="academic-modal fac-modal-xl">
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-icon"><Icon name="link" size={19} /></div>
            <div>
              <div className="academic-eyebrow">TEACHING ASSIGNMENTS</div>
              <h2>Add Teaching Assignment</h2>
              <p>Assign a faculty member to subjects across departments and divisions.</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div className="fac-steps">
          {steps.map((label, i) => {
            const n = i + 1
            const cls = n === step ? 'active' : n < step ? 'done' : ''
            return (
              <div className={`fac-step ${cls}`} key={label}>
                <div className="fac-step-dot">{n < step ? <Icon name="check" size={13} /> : n}</div>
                <span className="fac-step-label">{label}</span>
              </div>
            )
          })}
        </div>

        {/* STEP 1 — TEACHER */}
        {step === 1 && (
          <div>
            <div className="modal-section-label">1 &middot; SELECT TEACHER</div>
            <div className="fac-search">
              <Icon name="search" size={16} />
              <input value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} placeholder="Search faculty..." autoFocus />
            </div>
            <div className="fac-radio-list">
              {filteredTeachers.map(t => (
                <button key={t.teacher_id} type="button" className={`fac-radio-row ${teacherId === t.teacher_id ? 'selected' : ''}`} onClick={() => setTeacherId(t.teacher_id)}>
                  <span className="fac-radio-dot">{teacherId === t.teacher_id && <span className="fac-radio-dot-inner" />}</span>
                  {t.teacher_name}
                  <span className="fac-radio-sub">max {t.max_periods_per_day}/day</span>
                </button>
              ))}
              {!filteredTeachers.length && <div className="fac-subject-group-empty">No faculty members match your search.</div>}
            </div>
            {selectedTeacher && <div className="fac-selected-banner">Selected: {selectedTeacher.teacher_name}</div>}
          </div>
        )}

        {/* STEP 2 — DEPARTMENTS (multi-select) */}
        {step === 2 && (
          <div>
            <div className="modal-section-label">2 &middot; SELECT DEPARTMENT(S)</div>
            <div className="fac-dept-grid">
              {departments.map(d => (
                <div key={d} className={`fac-dept-card ${depts.includes(d) ? 'checked' : ''}`} onClick={() => toggleDept(d)}>
                  <span className="fac-checkbox">{depts.includes(d) && <Icon name="check" size={12} />}</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
            {depts.length > 0 && (
              <div className="chip-row wrap" style={{ marginTop: 14 }}>
                <span className="modal-section-label" style={{ margin: 0, alignSelf: 'center' }}>Selected:</span>
                {depts.map(d => (
                  <span className="division-chip" key={d}>{d}<button onClick={() => toggleDept(d)}><Icon name="close" size={11} /></button></span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — SMART SUBJECT + DIVISION REVEAL, grouped by department -> year */}
        {step === 3 && (
          <div>
            <div className="modal-section-label">3 &middot; SELECT SUBJECTS</div>
            <div className="fac-subject-groups">
              {relevantGroups.length === 0 && <div className="fac-subject-group-empty">No academic groups found for the selected department(s).</div>}
              {relevantGroups.map(g => {
                const allDivisionIds = g.divisions.map(d => d.division_id)
                const sel = selection[g.group_id] || { defIds: new Set(), divIds: new Set(allDivisionIds) }
                return (
                  <div className="fac-subject-group" key={g.group_id}>
                    <div className="fac-subject-group-head">
                      <div className="fac-subject-group-title">
                        {g.department}
                        <small>{yearLabel(g.year_of_study)} &bull; {g.divisions.length} division{g.divisions.length === 1 ? '' : 's'}</small>
                      </div>
                      <div className="fac-div-toggle-row">
                        {g.divisions.map(d => (
                          <button
                            key={d.division_id}
                            type="button"
                            className={`fac-div-toggle ${sel.divIds.has(d.division_id) ? 'on' : ''}`}
                            onClick={() => { ensureGroupSelection(g.group_id, allDivisionIds); toggleDivision(g, d.division_id) }}
                            title="Toggle division"
                          >
                            {d.division_name}
                          </button>
                        ))}
                      </div>
                    </div>
                    {g.subjects.length ? (
                      <div className="fac-subject-list">
                        {g.subjects.map(s => {
                          const checked = sel.defIds.has(s.definition_id)
                          return (
                            <div key={s.definition_id} className={`fac-subject-row ${checked ? 'checked' : ''}`} onClick={() => { ensureGroupSelection(g.group_id, allDivisionIds); toggleSubject(g, s.definition_id) }}>
                              <span className="fac-checkbox">{checked && <Icon name="check" size={12} />}</span>
                              <span className="fac-subject-name">{s.subject_name}</span>
                              <SubjectTypeBadge name="" type={s.subject_type} showName={false} />
                            </div>
                          )
                        })}
                      </div>
                    ) : <div className="fac-subject-group-empty">No subjects configured for this year yet.</div>}
                  </div>
                )
              })}
            </div>

            <div className="fac-selection-summary">
              <div className="fac-selection-summary-count">{totalSelectedSubjects} subject{totalSelectedSubjects === 1 ? '' : 's'} selected</div>
              {totalSelectedSubjects > 0 && (
                <div className="chip-row wrap">
                  {selectedSubjectChips.map(({ group, subject }) => (
                    <span className="division-chip" key={`${group.group_id}-${subject.definition_id}`}>
                      {subject.subject_name}
                      <button onClick={() => removeSubjectChip(group.group_id, subject.definition_id)}><Icon name="close" size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4 — REVIEW */}
        {step === 4 && (
          <div>
            <div className="modal-section-label">ASSIGNMENT SUMMARY</div>
            <div className="fac-review-card">
              <div className="fac-review-row">
                <span className="label">Teacher</span>
                <span className="value">{selectedTeacher?.teacher_name}</span>
              </div>
              <div className="fac-review-row">
                <span className="label">Departments</span>
                <span className="value">{depts.join(', ')}</span>
              </div>
              <div className="fac-review-row">
                <span className="label">Subjects</span>
                <span className="value">
                  {relevantGroups.map(g => {
                    const sel = selection[g.group_id]
                    if (!sel || sel.defIds.size === 0) return null
                    const names = g.subjects.filter(s => sel.defIds.has(s.definition_id)).map(s => s.subject_name)
                    const divNames = g.divisions.filter(d => sel.divIds.has(d.division_id)).map(d => d.division_name)
                    return (
                      <div key={g.group_id} style={{ marginBottom: 6 }}>
                        {names.join(', ')}
                        <span className="fac-review-sub">{g.department} &bull; {yearLabel(g.year_of_study)} &bull; Div {divNames.join(', ') || '—'}</span>
                      </div>
                    )
                  })}
                </span>
              </div>
            </div>
            {submitError && <div className="notice error" style={{ marginTop: 14 }}>{submitError}</div>}
          </div>
        )}

        <div className="modal-actions">
          {step > 1 && <button className="secondary-button" onClick={goBack}>Back</button>}
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          {step < 4 && (
            <button
              className="primary-button modal-primary"
              disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3) || (step === 3 && !canGoStep4)}
              style={{ opacity: (step === 1 && !canGoStep2) || (step === 2 && !canGoStep3) || (step === 3 && !canGoStep4) ? 0.5 : 1 }}
              onClick={goNext}
            >
              Continue
            </button>
          )}
          {step === 4 && <button className="primary-button modal-primary" onClick={handleSubmit}>Add Assignment</button>}
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   ASSIGNMENT REASSIGN (edit) MODAL — change teacher on one division-level row
========================================================================= */
function AssignmentEditModal({ assignment, teachers, onSave, onClose, error }) {
  const [teacherId, setTeacherId] = useState(assignment.teacherId)
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teachers
    return teachers.filter(t => t.teacher_name.toLowerCase().includes(q))
  }, [teachers, search])

  return (
    <div className="modal-backdrop faculty-modal-root" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="academic-modal" style={{ width: 'min(480px, 100%)' }}>
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-icon edit"><Icon name="edit" size={19} /></div>
            <div>
              <div className="academic-eyebrow">TEACHING ASSIGNMENT</div>
              <h2>Edit Assignment</h2>
              <p>{assignment.subjectName} &middot; {assignment.department} &middot; {yearLabel(assignment.yearOfStudy)} &middot; Div {assignment.divisionName}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div className="modal-section-label">TEACHER</div>
        <div className="fac-search">
          <Icon name="search" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search faculty..." />
        </div>
        <div className="fac-radio-list">
          {filtered.map(t => (
            <button key={t.teacher_id} type="button" className={`fac-radio-row ${teacherId === t.teacher_id ? 'selected' : ''}`} onClick={() => setTeacherId(t.teacher_id)}>
              <span className="fac-radio-dot">{teacherId === t.teacher_id && <span className="fac-radio-dot-inner" />}</span>
              {t.teacher_name}
              <span className="fac-radio-sub">max {t.max_periods_per_day}/day</span>
            </button>
          ))}
        </div>

        {error && <div className="notice error">{error}</div>}

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button modal-primary" onClick={() => onSave(teacherId)}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   ASSIGNMENTS DIRECTORY MODAL — search, filter, grouped-by-teacher, edit/delete
========================================================================= */
function AssignmentsDirectoryModal({ tree, departmentsList, teachers, onClose, onEditRow, onDeleteRow }) {
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [teacherFilter, setTeacherFilter] = useState('all')
  const [collapsed, setCollapsed] = useState({})

  const filteredTree = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tree
      .filter(t => teacherFilter === 'all' || String(t.teacherId) === String(teacherFilter))
      .map(t => {
        const subjects = t.subjects
          .filter(s => deptFilter === 'all' || s.department === deptFilter)
          .filter(s => yearFilter === 'all' || String(s.yearOfStudy) === String(yearFilter))
          .filter(s => {
            if (!q) return true
            return (
              t.teacherName.toLowerCase().includes(q) ||
              s.subjectName.toLowerCase().includes(q) ||
              s.department.toLowerCase().includes(q) ||
              yearLabel(s.yearOfStudy).toLowerCase().includes(q) ||
              s.divisions.some(d => d.divisionName.toLowerCase().includes(q))
            )
          })
        return { ...t, subjects }
      })
      .filter(t => t.subjects.length > 0)
  }, [tree, search, deptFilter, yearFilter, teacherFilter])

  const hasAnyFilter = search || deptFilter !== 'all' || yearFilter !== 'all' || teacherFilter !== 'all'

  function clearFilters() { setSearch(''); setDeptFilter('all'); setYearFilter('all'); setTeacherFilter('all') }
  function toggle(key) { setCollapsed(c => ({ ...c, [key]: !c[key] })) }

  return (
    <div className="modal-backdrop faculty-modal-root" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="academic-modal fac-modal-xl">
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-icon"><Icon name="link" size={19} /></div>
            <div>
              <div className="academic-eyebrow">TEACHING ASSIGNMENTS</div>
              <h2>Assignments Directory</h2>
              <p>View and manage every faculty-subject assignment</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        <div className="fac-search">
          <Icon name="search" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assignments..." autoFocus />
          {search && <button onClick={() => setSearch('')}><Icon name="close" size={13} /></button>}
        </div>

        <div className="fac-filter-bar">
          <select className="fac-filter-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="all">All Departments</option>
            {departmentsList.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="fac-filter-select" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="all">All Years</option>
            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{yearLabel(y)}</option>)}
          </select>
          <select className="fac-filter-select" value={teacherFilter} onChange={e => setTeacherFilter(e.target.value)}>
            <option value="all">All Teachers</option>
            {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.teacher_name}</option>)}
          </select>
        </div>

        {filteredTree.length ? (
          <div className="fac-assign-list">
            {filteredTree.map(t => {
              const isOpen = !collapsed[t.teacherId]
              return (
                <div className="fac-assign-card" key={t.teacherId}>
                  <div className="fac-assign-card-head" onClick={() => toggle(t.teacherId)}>
                    <div className="fac-assign-avatar">{initials(t.teacherName)}</div>
                    <div>
                      <b>{t.teacherName}</b>
                      <small>{t.subjects.length} assignment{t.subjects.length === 1 ? '' : 's'}</small>
                    </div>
                    <span className={`chev ${isOpen ? 'open' : ''}`}><Icon name="chevronDown" size={16} /></span>
                  </div>
                  {isOpen && t.subjects.map(s => (
                    <div className="fac-assign-subject-row" key={s.key}>
                      <div className="fac-assign-subject-main">
                        <div className="name">{s.subjectName} <SubjectTypeBadge name="" type={s.subjectType} showName={false} /></div>
                        <div className="meta">{s.department} &middot; {yearLabel(s.yearOfStudy)}</div>
                        <div style={{ marginTop: 4 }}>
                          {s.divisions.map(d => <span className="fac-div-pill" key={d.assignmentId}>{d.divisionName}</span>)}
                        </div>
                      </div>
                      <div className="fac-assign-actions">
                        {s.divisions.map(d => (
                          <div key={d.assignmentId} style={{ display: 'flex', gap: 4 }}>
                            <button className="fac-icon-btn" title={`Edit ${d.divisionName}`} onClick={() => onEditRow({ ...s, assignmentId: d.assignmentId, divisionName: d.divisionName, divisionId: d.divisionId, teacherId: t.teacherId })}>
                              <Icon name="edit" size={13} />
                            </button>
                            <button className="fac-icon-btn danger" title={`Remove ${d.divisionName}`} onClick={() => onDeleteRow({ ...s, assignmentId: d.assignmentId, divisionName: d.divisionName, teacherName: t.teacherName })}>
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="fac-empty">
            <div className="fac-empty-icon"><Icon name="search" size={18} /></div>
            <h3>No assignments match the selected filters.</h3>
            {hasAnyFilter && <button className="secondary-button" onClick={clearFilters}>Clear Filters</button>}
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   MAIN PAGE
========================================================================= */
export default function FacultyAssignments() {
  const [teachers, setTeachers] = useState([])
  const [groups, setGroups] = useState([])
  const [assignments, setAssignments] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // add-teacher compact row
  const [name, setName] = useState('')
  const [max, setMax] = useState(6)

  // modals
  const [showDirectory, setShowDirectory] = useState(false)
  const [editTeacher, setEditTeacher] = useState(null)
  const [teacherEditError, setTeacherEditError] = useState('')
  const [deleteTeacherTarget, setDeleteTeacherTarget] = useState(null)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardError, setWizardError] = useState('')
  const [showAssignments, setShowAssignments] = useState(false)
  const [editAssignmentRow, setEditAssignmentRow] = useState(null)
  const [assignmentEditError, setAssignmentEditError] = useState('')
  const [deleteAssignmentTarget, setDeleteAssignmentTarget] = useState(null)

  async function load() {
    try {
      const [t, g, a] = await Promise.all([
        axios.get(`${BASE}/teachers`),
        axios.get(`${BASE}/teaching-assignments/groups`),
        axios.get(`${BASE}/teaching-assignments`),
      ])
      setTeachers(t.data)
      setGroups(g.data)
      setAssignments(a.data)
    } catch (err) {
      setError(!err.response ? 'Cannot connect to backend server. Make sure it is running on http://localhost:8000.' : 'Could not load faculty or assignments.')
    }
  }
  useEffect(() => { load() }, [])

  const tree = useMemo(() => buildTeacherAssignmentTree(assignments), [assignments])
  const departmentsList = useMemo(() => [...new Set(groups.map(g => g.department))].sort(), [groups])
  const assignmentCountByTeacher = useMemo(() => {
    const m = new Map()
    assignments.forEach(a => m.set(a.teacher_id, (m.get(a.teacher_id) || 0) + 1))
    return m
  }, [assignments])

  /* ── Teacher CRUD ───────────────────────────────────────────────── */
  async function addTeacher(e) {
    e.preventDefault(); setMessage(''); setError('')
    if (!name.trim()) { setError('Teacher name is required.'); return }
    try {
      await axios.post(`${BASE}/teachers`, { teacher_name: name.trim(), max_periods_per_day: Number(max) })
      setMessage(`${name.trim()} added.`)
      setName(''); setMax(6)
      await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : !err.response ? 'Cannot connect to backend server.' : 'Could not add teacher.')
    }
  }

  async function saveTeacherEdit(payload) {
    setTeacherEditError('')
    try {
      await axios.put(`${BASE}/teachers/${editTeacher.teacher_id}`, payload)
      setMessage(`${payload.teacher_name} was updated.`)
      setEditTeacher(null)
      await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      setTeacherEditError(typeof detail === 'string' ? detail : 'Could not update teacher.')
    }
  }

  async function confirmDeleteTeacher() {
    if (!deleteTeacherTarget) return
    try {
      await axios.delete(`${BASE}/teachers/${deleteTeacherTarget.teacher_id}`)
      setMessage(`${deleteTeacherTarget.teacher_name} was deleted.`)
      setDeleteTeacherTarget(null)
      await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Could not delete teacher.')
    }
  }

  /* ── Assignment CRUD ────────────────────────────────────────────── */
  async function submitWizard({ teacherId, groups: payloadGroups }) {
    setWizardError('')
    let createdCount = 0
    let alreadyCount = 0
    try {
      for (const pg of payloadGroups) {
        const res = await axios.post(`${BASE}/teaching-assignments`, {
          teacher_id: Number(teacherId),
          definition_ids: pg.definitionIds.map(Number),
          division_ids: pg.divisionIds.map(Number),
        })
        if (res.data.divisions && res.data.divisions.length) createdCount++
        else alreadyCount++
      }
      const parts = []
      if (createdCount) parts.push(`${createdCount} assignment group${createdCount === 1 ? '' : 's'} created.`)
      if (alreadyCount) parts.push(`${alreadyCount} group${alreadyCount === 1 ? '' : 's'} already existed.`)
      setMessage(parts.join(' ') || 'Assignment saved.')
      setShowWizard(false)
      await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      setWizardError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : 'Could not save assignment.')
    }
  }

  async function saveAssignmentEdit(newTeacherId) {
    setAssignmentEditError('')
    try {
      const res = await axios.put(`${BASE}/teaching-assignments/${editAssignmentRow.assignmentId}`, { teacher_id: Number(newTeacherId) })
      setMessage(res.data.message)
      setEditAssignmentRow(null)
      await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      setAssignmentEditError(typeof detail === 'string' ? detail : 'Could not reassign this assignment.')
    }
  }

  async function confirmDeleteAssignment() {
    if (!deleteAssignmentTarget) return
    try {
      await axios.delete(`${BASE}/teaching-assignments/${deleteAssignmentTarget.assignmentId}`)
      setMessage('Assignment removed.')
      setDeleteAssignmentTarget(null)
      await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Could not delete assignment.')
    }
  }

  const totalFaculty = teachers.length
  const totalAssignments = assignments.length
  const totalDepartments = departmentsList.length

  return (
    <div className="academic-page">

      {/* HERO */}
      <section className="academic-hero">
        <FacultyWatermark />
        <div className="hero-left">
          <div className="hero-icon"><Icon name="faculty" size={30} stroke={1.7} /></div>
          <div>
            <div className="academic-eyebrow">ACADEMIC SCHEDULING &middot; STEP 3</div>
            <h1>Faculty &amp; Assignments</h1>
            <div className="hero-subtitle">Manage Faculty &amp; Teaching Assignments</div>
            <p>Add faculty globally, configure their daily teaching capacity, and assign them to subjects across departments and divisions.</p>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="academic-stats">
        <div className="stat-card stat-blue">
          <div className="stat-icon"><Icon name="faculty" size={24} /></div>
          <div><div className="stat-label">TOTAL FACULTY</div><div className="stat-number">{totalFaculty}</div></div>
        </div>
        <div className="stat-card stat-purple">
          <div className="stat-icon"><Icon name="link" size={24} /></div>
          <div><div className="stat-label">TOTAL ASSIGNMENTS</div><div className="stat-number">{totalAssignments}</div></div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-icon"><Icon name="building" size={24} /></div>
          <div><div className="stat-label">TOTAL DEPARTMENTS</div><div className="stat-number">{totalDepartments}</div></div>
        </div>
      </section>

      {message && <div className="global-notice success"><Icon name="check" size={16} />{message}<button onClick={() => setMessage('')}><Icon name="close" size={15} /></button></div>}
      {error && <div className="global-notice error"><Icon name="alert" size={16} />{error}<button onClick={() => setError('')}><Icon name="close" size={15} /></button></div>}

      <div className="fac-blocks">

        {/* ═══════════ BLOCK 1 — FACULTY ═══════════ */}
        <section className="fac-block">
          <svg className="fac-block-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="9" cy="8" r="3.4" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
          <div className="fac-block-head">
            <div className="fac-block-head-left">
              <div className="fac-block-icon"><Icon name="faculty" size={22} /></div>
              <div>
                <h2>Faculty</h2>
                <p>Global teachers, added once and reused across every department, year, and division.</p>
              </div>
            </div>
            <button className="secondary-button" onClick={() => setShowDirectory(true)}>
              <Icon name="faculty" size={14} /> &nbsp;View All Teachers
            </button>
          </div>

          <div className="fac-block-body">
            <form onSubmit={addTeacher} className="fac-add-row">
              <Field label="Teacher name">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Prof. Sharma" />
              </Field>
              <Field label="Maximum periods / day">
                <input type="number" min="1" max="8" value={max} onChange={e => setMax(e.target.value)} />
              </Field>
              <button className="primary-button" type="submit"><Icon name="plus" size={16} /> Add Teacher</button>
            </form>

            {teachers.length ? (
              <>
                <div className="fac-teacher-preview-head">
                  <span className="section-kicker">FACULTY PREVIEW</span>
                  <span style={{ color: 'var(--as-muted)', fontSize: 11 }}>{teachers.length} teacher{teachers.length === 1 ? '' : 's'} total</span>
                </div>
                <div className="fac-teacher-grid">
                  {teachers.slice(0, 7).map(t => (
                    <div className="fac-teacher-chip" key={t.teacher_id}>
                      <b>{t.teacher_name}</b>
                      <span>{t.max_periods_per_day} max/day</span>
                    </div>
                  ))}
                  {teachers.length > 7 && (
                    <button className="fac-teacher-more" onClick={() => setShowDirectory(true)}>+{teachers.length - 7} more</button>
                  )}
                </div>
              </>
            ) : (
              <div className="fac-empty">
                <div className="fac-empty-icon"><Icon name="faculty" size={18} /></div>
                <h3>No faculty members added yet.</h3>
                <p>Add your first teacher using the form above.</p>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════ BLOCK 2 — TEACHING ASSIGNMENTS ═══════════ */}
        <section className="fac-block">
          <svg className="fac-block-bg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M9 15 15 9" /><path d="M10.5 6.5 12 5a3.7 3.7 0 0 1 5.2 5.2l-1.5 1.5" /></svg>
          <div className="fac-block-head">
            <div className="fac-block-head-left">
              <div className="fac-block-icon purple"><Icon name="link" size={22} /></div>
              <div>
                <h2>Teaching Assignments</h2>
                <p>Assign faculty to subjects for specific departments, years, and divisions.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="secondary-button" onClick={() => setShowAssignments(true)}>
                <Icon name="grid" size={14} /> &nbsp;View Assignments
              </button>
              <button className="primary-button" disabled={!teachers.length} style={{ opacity: teachers.length ? 1 : .5 }} onClick={() => { setWizardError(''); setShowWizard(true) }}>
                <Icon name="plus" size={16} /> Add Assignment
              </button>
            </div>
          </div>

          <div className="fac-block-body">
            {tree.length ? (
              <div className="fac-assign-list">
                {tree.slice(0, 4).map(t => (
                  <div className="fac-assign-card" key={t.teacherId}>
                    <div className="fac-assign-card-head">
                      <div className="fac-assign-avatar">{initials(t.teacherName)}</div>
                      <div>
                        <b>{t.teacherName}</b>
                        <small>{t.subjects.length} assignment{t.subjects.length === 1 ? '' : 's'}</small>
                      </div>
                    </div>
                    {t.subjects.slice(0, 2).map(s => (
                      <div className="fac-assign-subject-row" key={s.key}>
                        <div className="fac-assign-subject-main">
                          <div className="name">{s.subjectName} <SubjectTypeBadge name="" type={s.subjectType} showName={false} /></div>
                          <div className="meta">{s.department} &middot; {yearLabel(s.yearOfStudy)}</div>
                        </div>
                        <div>{s.divisions.map(d => <span className="fac-div-pill" key={d.assignmentId}>{d.divisionName}</span>)}</div>
                      </div>
                    ))}
                  </div>
                ))}
                {tree.length > 4 && (
                  <button className="secondary-button" style={{ justifySelf: 'start' }} onClick={() => setShowAssignments(true)}>
                    View all {assignments.length} assignments
                  </button>
                )}
              </div>
            ) : (
              <div className="fac-empty">
                <div className="fac-empty-icon"><Icon name="link" size={18} /></div>
                <h3>No teaching assignments configured yet.</h3>
                <p>Assign a teacher to their first subject to get started.</p>
                <button className="primary-button" disabled={!teachers.length} style={{ opacity: teachers.length ? 1 : .5 }} onClick={() => setShowWizard(true)}>
                  <Icon name="plus" size={16} /> Add Assignment
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────── */}

      {showDirectory && (
        <FacultyDirectoryModal
          teachers={teachers}
          assignmentCountByTeacher={assignmentCountByTeacher}
          onClose={() => setShowDirectory(false)}
          onRequestEdit={t => { setTeacherEditError(''); setEditTeacher(t) }}
          onRequestDelete={t => setDeleteTeacherTarget(t)}
        />
      )}

      {editTeacher && (
        <TeacherEditModal
          teacher={editTeacher}
          onClose={() => setEditTeacher(null)}
          onSave={saveTeacherEdit}
          error={teacherEditError}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTeacherTarget}
        title="Delete Faculty Member?"
        itemName={deleteTeacherTarget?.teacher_name}
        message={
          deleteTeacherTarget && (assignmentCountByTeacher.get(deleteTeacherTarget.teacher_id) || 0) > 0
            ? `This teacher currently has ${assignmentCountByTeacher.get(deleteTeacherTarget.teacher_id)} subject assignment(s). Deleting the teacher will remove those relationships.`
            : 'Are you sure you want to delete this faculty member? This action cannot be undone.'
        }
        onCancel={() => setDeleteTeacherTarget(null)}
        onConfirm={confirmDeleteTeacher}
      />

      {showWizard && (
        <AddAssignmentWizardModal
          teachers={teachers}
          groups={groups}
          onClose={() => setShowWizard(false)}
          onSubmit={submitWizard}
          submitError={wizardError}
        />
      )}

      {showAssignments && (
        <AssignmentsDirectoryModal
          tree={tree}
          departmentsList={departmentsList}
          teachers={teachers}
          onClose={() => setShowAssignments(false)}
          onEditRow={row => { setAssignmentEditError(''); setEditAssignmentRow(row) }}
          onDeleteRow={row => setDeleteAssignmentTarget(row)}
        />
      )}

      {editAssignmentRow && (
        <AssignmentEditModal
          assignment={editAssignmentRow}
          teachers={teachers}
          onClose={() => setEditAssignmentRow(null)}
          onSave={saveAssignmentEdit}
          error={assignmentEditError}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteAssignmentTarget}
        title="Remove Assignment?"
        itemName={deleteAssignmentTarget ? `${deleteAssignmentTarget.teacherName} \u2014 ${deleteAssignmentTarget.subjectName}` : ''}
        message={deleteAssignmentTarget ? `Remove ${deleteAssignmentTarget.teacherName} from ${deleteAssignmentTarget.subjectName} \u00b7 ${deleteAssignmentTarget.department} \u00b7 ${yearLabel(deleteAssignmentTarget.yearOfStudy)} \u00b7 Div ${deleteAssignmentTarget.divisionName}?` : ''}
        onCancel={() => setDeleteAssignmentTarget(null)}
        onConfirm={confirmDeleteAssignment}
      />

    </div>
  )
}