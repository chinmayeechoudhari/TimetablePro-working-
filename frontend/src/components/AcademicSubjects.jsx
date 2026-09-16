import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './AcademicStructureModern.css'
import './AcademicSubjects.css'
import Icon from './AcademicIcon'
import { loadShortCodes, deriveShortCode, accentIndex } from '../lib/academicShortCodes'

const BASE = 'http://localhost:8000'
const yearLabel = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y] || `${y}th Year`)

function StatSpark({ color, id }) {
  const gid = `subj-spark-${id}`
  return (
    <div className="stat-decoration">
      <svg width="110" height="38" viewBox="0 0 120 40" preserveAspectRatio="none">
        <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
        <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10 L 120 40 L 0 40 Z" fill={`url(#${gid})`} style={{ opacity: 0.15 }} />
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function SubjectsWatermark({ className = 'subjects-landing-illustration' }) {
  return (
    <svg className={className} viewBox="0 0 620 220" fill="none" aria-hidden="true">
      <rect x="150" y="150" width="150" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="163" y="136" width="130" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="140" y="164" width="165" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M370 70v100M410 60v110M450 74v96" stroke="currentColor" strokeWidth="2" />
      <path d="M362 70h16M402 60h16M442 74h16" stroke="currentColor" strokeWidth="2" />
      <rect x="330" y="170" width="160" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="470" cy="120" r="34" stroke="currentColor" strokeWidth="2" />
      <path d="M470 104v16l11 11M40 185h540" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function AcademicSubjects() {
  const [groups, setGroups] = useState([])
  const [subjects, setSubjects] = useState([])
  const [shortCodes] = useState(loadShortCodes)
  const [loadError, setLoadError] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [search, setSearch] = useState('')
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [formModal, setFormModal] = useState(null)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('theory')
  const [formPeriods, setFormPeriods] = useState(3)
  const [formTheoryPeriods, setFormTheoryPeriods] = useState(3)
  const [formLabPeriods, setFormLabPeriods] = useState(2)
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const [groupResponse, subjectResponse] = await Promise.all([
        axios.get(`${BASE}/academic-structure`),
        axios.get(`${BASE}/academic-subjects`),
      ])
      const groupData = groupResponse.data
      setGroups(Array.isArray(groupData) ? groupData : (groupData?.groups || []))
      setSubjects(Array.isArray(subjectResponse.data) ? subjectResponse.data : [])
      setLoadError('')
    } catch (err) {
      console.error('Failed to load academic subjects:', err)
      setLoadError('Could not load academic structure or subjects. Is the backend running?')
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const locked = Boolean(formModal || deleteTarget)
    if (!locked) return undefined

    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - html.clientWidth

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.paddingRight = previousBodyPaddingRight
    }
  }, [formModal, deleteTarget])

  const departments = useMemo(
    () => [...new Set(groups.map(g => g.department))].sort((a, b) => a.localeCompare(b)),
    [groups],
  )

  const departmentRows = useMemo(() => departments.map(name => {
    const rows = groups
      .filter(g => g.department === name)
      .sort((a, b) => a.year_of_study - b.year_of_study)
    return {
      name,
      groups: rows,
      divisions: rows.reduce((n, g) => n + g.divisions.length, 0),
    }
  }), [departments, groups])

  const filteredDepartments = useMemo(() => {
    const q = departmentSearch.trim().toLowerCase()
    return q ? departmentRows.filter(d => d.name.toLowerCase().includes(q)) : departmentRows
  }, [departmentRows, departmentSearch])

  const totalDivisions = departmentRows.reduce((n, d) => n + d.divisions, 0)
  const totalSubjects = useMemo(
    () => new Set(subjects.map(s => `${s.group_id}::${s.subject_name.trim().toLowerCase()}`)).size,
    [subjects],
  )
  const activeDeptRow = departmentRows.find(d => d.name === selectedDepartment) || null
  const selectedGroup = groups.find(g => String(g.group_id) === String(selectedGroupId)) || null

  useEffect(() => {
    if (!activeDeptRow) return
    const valid = activeDeptRow.groups.some(g => String(g.group_id) === String(selectedGroupId))
    if (!valid) setSelectedGroupId(activeDeptRow.groups[0] ? String(activeDeptRow.groups[0].group_id) : '')
  }, [activeDeptRow, selectedGroupId])

  const directory = useMemo(() => {
    if (!selectedGroup) return []
    const rows = subjects.filter(s => s.group_id === selectedGroup.group_id)
    const map = new Map()

    rows.forEach(subject => {
      const key = subject.subject_name.trim().toLowerCase()
      if (!map.has(key)) map.set(key, { name: subject.subject_name, theory: null, lab: null })
      const row = map.get(key)
      row[subject.subject_type] = subject.periods_per_week
    })

    return [...map.values()]
      .map(row => ({
        ...row,
        type: row.theory != null && row.lab != null
          ? 'theory+lab'
          : (row.lab != null ? 'lab' : 'theory'),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [subjects, selectedGroup])

  const filteredDirectory = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? directory.filter(row => row.name.toLowerCase().includes(q)) : directory
  }, [directory, search])

  function chooseDepartment(name) {
    const rows = groups
      .filter(g => g.department === name)
      .sort((a, b) => a.year_of_study - b.year_of_study)
    setSelectedDepartment(name)
    setSelectedGroupId(rows[0] ? String(rows[0].group_id) : '')
    setSearch('')
    setDepartmentSearch('')
    setMessage('')
    setError('')
  }

  function changeDepartment() {
    setSelectedDepartment('')
    setSelectedGroupId('')
    setSearch('')
    setDepartmentSearch('')
  }

  function chooseYear(groupId) {
    setSelectedGroupId(String(groupId))
    setSearch('')
  }

  function resetForm() {
    setFormName('')
    setFormType('theory')
    setFormPeriods(3)
    setFormTheoryPeriods(3)
    setFormLabPeriods(2)
    setFormError('')
  }

  function openAdd() {
    resetForm()
    setFormModal({ type: 'add' })
  }

  function openEdit(row) {
    setFormError('')
    setFormName(row.name)
    setFormType(row.type)
    if (row.type === 'theory+lab') {
      setFormTheoryPeriods(row.theory ?? 3)
      setFormLabPeriods(row.lab ?? 2)
      setFormPeriods(row.theory ?? 3)
    } else {
      setFormPeriods(row.type === 'lab' ? (row.lab ?? 2) : (row.theory ?? 3))
    }
    setFormModal({ type: 'edit', originalName: row.name })
  }

  function closeFormModal() {
    setFormModal(null)
    resetForm()
  }

  async function submitForm(e) {
    e.preventDefault()
    setFormError('')

    if (!formName.trim()) return setFormError('Enter a subject name.')
    if (!selectedGroup) return setFormError('Select a department and year first.')

    const payload = {
      subject_name: formName.trim(),
      subject_type: formType,
      periods_per_week: Number(formPeriods),
      ...(formType === 'theory+lab'
        ? {
            theory_periods_per_week: Number(formTheoryPeriods),
            lab_periods_per_week: Number(formLabPeriods),
          }
        : {}),
    }

    setFormSaving(true)
    try {
      const isEdit = formModal?.type === 'edit'
      if (isEdit) {
        await axios.put(
          `${BASE}/academic-subjects/${selectedGroup.group_id}/${encodeURIComponent(formModal.originalName)}`,
          payload,
        )
        setMessage(`${payload.subject_name} was updated.`)
      } else {
        const response = await axios.post(`${BASE}/academic-subjects`, {
          group_id: selectedGroup.group_id,
          ...payload,
        })
        setMessage(`${response.data.subject_name} added to all divisions: ${response.data.assigned_to_divisions.join(', ')}`)
      }
      closeFormModal()
      await load()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Could not save the subject.')
    } finally {
      setFormSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !selectedGroup) return
    setDeleting(true)
    setDeleteError('')
    try {
      await axios.delete(`${BASE}/academic-subjects/${selectedGroup.group_id}/${encodeURIComponent(deleteTarget.name)}`)
      setMessage(`${deleteTarget.name} was deleted.`)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Could not delete this subject.')
    } finally {
      setDeleting(false)
    }
  }

  const formIsEdit = formModal?.type === 'edit'

  const formModalContent = formModal && selectedGroup ? (
    <div className="subjects-modal-root">
      <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && closeFormModal()}>
        <div className="academic-modal subject-form-modal" role="dialog" aria-modal="true" aria-labelledby="subject-modal-title">
          <form onSubmit={submitForm}>
            <div className="subject-modal-header">
              <div className="subject-modal-context">
                <span>Subjects</span><i />
                <span>{selectedDepartment}</span><i />
                <span>{yearLabel(selectedGroup.year_of_study)}</span>
              </div>
              <button type="button" className="modal-close subject-modal-close" onClick={closeFormModal} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
              <div className="subject-modal-heading">
                <div className={`modal-icon ${formIsEdit ? 'edit' : ''}`}><Icon name={formIsEdit ? 'edit' : 'plus'} size={22} /></div>
                <div>
                  <div className="academic-eyebrow">{formIsEdit ? 'EDIT SUBJECT' : 'NEW SUBJECT'}</div>
                  <h2 id="subject-modal-title">{formIsEdit ? 'Edit subject' : 'Add a new subject'}</h2>
                  <p>Configure the subject details and weekly teaching load.</p>
                </div>
              </div>
            </div>

            <div className="subject-form-body">
              <section className="subject-form-card">
                <div className="subject-form-card-head">
                  <div className="modal-card-icon blue"><Icon name="book" size={20} /></div>
                  <div><h3>Subject details</h3><p>Name the subject and choose how it is taught.</p></div>
                </div>

                <Field label="SUBJECT NAME">
                  <input autoFocus value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Data Structures" />
                </Field>

                <div className="modal-section-label">SUBJECT TYPE</div>
                <div className="subject-type-select">
                  <button type="button" className={`subject-type-option ${formType === 'theory' ? 'active' : ''}`} onClick={() => setFormType('theory')}>
                    <Icon name="book" size={19} /><span>Theory</span><small>Lecture-based</small>
                  </button>
                  <button type="button" className={`subject-type-option ${formType === 'lab' ? 'active' : ''}`} onClick={() => setFormType('lab')}>
                    <Icon name="beaker" size={19} /><span>Lab</span><small>Practical sessions</small>
                  </button>
                  <button type="button" className={`subject-type-option ${formType === 'theory+lab' ? 'active' : ''}`} onClick={() => setFormType('theory+lab')}>
                    <Icon name="layers" size={19} /><span>Theory + Lab</span><small>Both components</small>
                  </button>
                </div>
              </section>

              <section className="subject-form-card subject-form-load-card">
                <div className="subject-form-card-head">
                  <div className="modal-card-icon purple"><Icon name="calendar" size={20} /></div>
                  <div><h3>Weekly teaching load</h3><p>Set the periods scheduled each week.</p></div>
                </div>

                {formType === 'theory+lab' ? (
                  <div className="subject-period-grid">
                    <Field label="THEORY / WEEK"><input type="number" min="1" max="30" value={formTheoryPeriods} onChange={e => setFormTheoryPeriods(e.target.value)} /></Field>
                    <Field label="LAB / WEEK"><input type="number" min="1" max="30" value={formLabPeriods} onChange={e => setFormLabPeriods(e.target.value)} /></Field>
                  </div>
                ) : (
                  <Field label="PERIODS / WEEK"><input type="number" min="1" max="30" value={formPeriods} onChange={e => setFormPeriods(e.target.value)} /></Field>
                )}

                <div className="subject-form-note">
                  <Icon name="info" size={15} />
                  <span>This subject will be created for all <b>{selectedGroup.divisions.length} divisions</b>: {selectedGroup.divisions.map(d => d.division_name).join(', ')}.</span>
                </div>
              </section>
            </div>

            {formError && <div className="notice error modal-inline-error">{formError}</div>}

            <div className="modal-actions subject-form-footer">
              <button type="button" className="secondary-button" onClick={closeFormModal}>Cancel</button>
              <button className="primary-button modal-primary" disabled={formSaving}>
                <Icon name="check" size={17} />
                {formSaving ? 'Saving…' : (formIsEdit ? 'Save Changes' : 'Add Subject')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  ) : null

  const deleteModalContent = deleteTarget && selectedGroup ? (
    <div className="subjects-modal-root">
      <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDeleteTarget(null)}>
        <div className="danger-modal" role="dialog" aria-modal="true" aria-labelledby="delete-subject-title">
          <div className="danger-modal-icon"><Icon name="trash" size={20} /></div>
          <div className="academic-eyebrow danger-eyebrow">DELETE SUBJECT</div>
          <h2 id="delete-subject-title">Delete {deleteTarget.name}?</h2>
          <p>Are you sure you want to delete “{deleteTarget.name}”? This removes the subject from all divisions of {selectedDepartment} · {yearLabel(selectedGroup.year_of_study)}.</p>
          {deleteError && <div className="notice error">{deleteError}</div>}
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => { setDeleteTarget(null); setDeleteError('') }}>Cancel</button>
            <button className="delete-confirm" onClick={confirmDelete} disabled={deleting}><Icon name="trash" size={16} />{deleting ? 'Deleting…' : 'Delete Subject'}</button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="academic-page">
      <section className="academic-hero">
        <SubjectsWatermark className="academic-hero-watermark" />
        <div className="hero-left">
          <div className="hero-icon"><Icon name="book" size={28} stroke={1.7} /></div>
          <div>
            <div className="academic-eyebrow">ACADEMIC STRUCTURE</div>
            <h1>Subjects</h1>
            <div className="hero-subtitle">Manage Subjects &amp; Course Components</div>
            <p>Configure subjects for each department and year. Subjects are automatically associated with the divisions in their academic group.</p>
          </div>
        </div>
      </section>

      <section className="subjects-stats">
        <div className="stat-card stat-blue"><div className="stat-icon"><Icon name="building" size={24} /></div><div><div className="stat-label">TOTAL DEPARTMENTS</div><div className="stat-number">{departmentRows.length}</div></div><StatSpark color="#2563eb" id="dept" /></div>
        <div className="stat-card stat-green"><div className="stat-icon"><Icon name="book" size={22} /></div><div><div className="stat-label">TOTAL SUBJECTS</div><div className="stat-number">{totalSubjects}</div></div><StatSpark color="#10b981" id="subj" /></div>
        <div className="stat-card stat-purple"><div className="stat-icon"><Icon name="grid" size={24} /></div><div><div className="stat-label">TOTAL DIVISIONS</div><div className="stat-number">{totalDivisions}</div></div><StatSpark color="#a855f7" id="divs" /></div>
      </section>

      {message && <div className="global-notice success"><Icon name="check" size={16} />{message}<button onClick={() => setMessage('')}><Icon name="close" size={15} /></button></div>}
      {error && <div className="global-notice error">{error}<button onClick={() => setError('')}><Icon name="close" size={15} /></button></div>}
      {loadError && <div className="global-notice error">{loadError}<button onClick={() => setLoadError('')}><Icon name="close" size={15} /></button></div>}

      {!selectedGroup && (
        <section className="department-picker-section">
          <div className="department-picker-intro">
            <div className="department-picker-icon"><Icon name="building" size={22} /></div>
            <div><div className="academic-eyebrow">SUBJECT CONFIGURATION</div><h2>Select a department to proceed</h2><p>Choose a department below to manage its subjects year by year. Each card shows the current subject load for every configured year.</p></div>
          </div>
          <div className="department-picker-tools">
            <span>{departmentRows.length} department{departmentRows.length === 1 ? '' : 's'} available</span>
            <div className="dept-search"><Icon name="search" size={16} /><input value={departmentSearch} onChange={e => setDepartmentSearch(e.target.value)} placeholder="Search departments..." />{departmentSearch && <button onClick={() => setDepartmentSearch('')}><Icon name="close" size={13} /></button>}</div>
          </div>
          {filteredDepartments.length ? (
            <div className="department-picker-grid">
              {filteredDepartments.map(row => {
                const code = shortCodes[row.name] || deriveShortCode(row.name)
                return (
                  <button className="department-picker-card" key={row.name} onClick={() => chooseDepartment(row.name)}>
                    <div className="department-picker-card-top"><div className={`department-picker-avatar avatar-accent-${accentIndex(row.name)}`}>{code.slice(0, 2)}</div><span className="department-picker-arrow"><Icon name="arrowRight" size={16} /></span></div>
                    <div className="department-picker-name">{row.name}</div>
                    <div className="department-picker-meta">{row.groups.length} year{row.groups.length === 1 ? '' : 's'} · {row.divisions} division{row.divisions === 1 ? '' : 's'}</div>
                    <div className="department-year-summary">
                      {row.groups.map(g => {
                        const count = new Set(subjects.filter(s => s.group_id === g.group_id).map(s => s.subject_name.trim().toLowerCase())).size
                        return <div className="department-year-summary-row" key={g.group_id}><span>{yearLabel(g.year_of_study)}</span><b>{g.divisions.length} division{g.divisions.length === 1 ? '' : 's'}</b><em>{count} subject{count === 1 ? '' : 's'} / division</em></div>
                      })}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="department-picker-empty"><Icon name="search" size={20} /><b>No departments found</b><span>{departmentRows.length ? 'Try a different search.' : 'Create a department first from Academic Structure.'}</span></div>
          )}
        </section>
      )}

      {selectedGroup && activeDeptRow && (
        <>
          <section className="subjects-context-bar">
            <div className="subjects-context-left">
              <div className={`subjects-context-avatar avatar-accent-${accentIndex(selectedDepartment)}`}>{(shortCodes[selectedDepartment] || deriveShortCode(selectedDepartment)).slice(0, 2)}</div>
              <div className="subjects-context-copy"><div className="section-kicker">SUBJECT CONFIGURATION</div><h2>{selectedDepartment}</h2><div className="subjects-context-meta"><span>{activeDeptRow.groups.length} Year{activeDeptRow.groups.length === 1 ? '' : 's'}</span><i /><span>{activeDeptRow.divisions} Division{activeDeptRow.divisions === 1 ? '' : 's'}</span></div></div>
            </div>
            <button className="secondary-button" onClick={changeDepartment}>Change Department</button>
          </section>

          <section className="subject-year-tabs">
            <div className="subject-year-tabs-heading"><div><div className="section-kicker">SELECT YEAR</div><p>Choose a year to view and manage its subjects.</p></div><span>{directory.length} subject{directory.length === 1 ? '' : 's'} in current year</span></div>
            <div className="subject-year-tab-list">
              {activeDeptRow.groups.map(g => (
                <button key={g.group_id} className={`subject-year-tab ${String(g.group_id) === String(selectedGroupId) ? 'active' : ''}`} onClick={() => chooseYear(g.group_id)}>
                  <span className="subject-year-number">{g.year_of_study}</span>
                  <span><strong>{yearLabel(g.year_of_study)}</strong><small>{g.divisions.length} division{g.divisions.length === 1 ? '' : 's'} · {new Set(subjects.filter(s => s.group_id === g.group_id).map(s => s.subject_name.trim().toLowerCase())).size} subjects</small></span>
                </button>
              ))}
            </div>
          </section>

          <section className="subject-directory-card">
            <div className="subject-directory-head">
              <div>
                <div className="section-kicker">SUBJECT DIRECTORY</div>
                <div className="subject-directory-title-row"><h2>{yearLabel(selectedGroup.year_of_study)} Subjects</h2><span className="subject-directory-count">{directory.length}</span></div>
                <p className="subject-directory-divisions">{selectedDepartment} · Divisions: <b>{selectedGroup.divisions.map(d => d.division_name).join(' · ')}</b></p>
              </div>
              <div className="subject-directory-actions"><div className="dept-search"><Icon name="search" size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subjects..." />{search && <button onClick={() => setSearch('')}><Icon name="close" size={13} /></button>}</div><button className="primary-button" onClick={openAdd}><Icon name="plus" size={16} /> Add Subject</button></div>
            </div>

            {directory.length === 0 ? (
              <div className="subject-empty"><div className="subject-empty-icon"><Icon name="book" size={20} /></div><h3>No subjects configured yet</h3><p>Start building the {yearLabel(selectedGroup.year_of_study)} curriculum for {selectedDepartment}.</p><button className="primary-button" onClick={openAdd}><Icon name="plus" size={16} /> Add First Subject</button></div>
            ) : filteredDirectory.length === 0 ? (
              <div className="subject-no-match">No subjects match your search.</div>
            ) : (
              <div className="subject-table-wrap">
                <div className="subject-table-header" aria-hidden="true"><span>#</span><span>SUBJECT</span><span>TYPE</span><span>WEEKLY LOAD</span><span>DIVISIONS</span><span>ACTIONS</span></div>
                <div className="subject-list">
                  {filteredDirectory.map((row, index) => (
                    <div className="subject-card" key={row.name}>
                      <div className="subject-card-index">{String(index + 1).padStart(2, '0')}</div>
                      <div className="subject-card-main"><h3 className="subject-card-name">{row.name}</h3><span className="subject-card-subtitle">Course subject</span></div>
                      <div className="subject-card-badges">{row.theory != null && <span className="subject-type-pill theory">Theory</span>}{row.lab != null && <span className="subject-type-pill lab">Lab</span>}</div>
                      <div className="subject-card-load">{row.type === 'theory+lab' ? <><b>{row.theory}</b> theory + <b>{row.lab}</b> lab / week</> : <><b>{row.theory ?? row.lab}</b> periods / week</>}</div>
                      <div className="subject-card-divisions">{selectedGroup.divisions.length} · {selectedGroup.divisions.map(d => d.division_name).join(' · ')}</div>
                      <div className="subject-card-actions"><button className="subject-icon-btn" title="Edit subject" onClick={() => openEdit(row)}><Icon name="edit" size={15} /></button><button className="subject-icon-btn danger" title="Delete subject" onClick={() => { setDeleteError(''); setDeleteTarget(row) }}><Icon name="trash" size={15} /></button></div>
                    </div>
                  ))}
                </div>
                <div className="subject-table-footer">Showing {filteredDirectory.length} of {directory.length} subject{directory.length === 1 ? '' : 's'}</div>
              </div>
            )}
          </section>
        </>
      )}

      {createPortal(formModalContent || deleteModalContent, document.body)}
    </div>
  )
}
