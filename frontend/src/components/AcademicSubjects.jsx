import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8000'
const yearLabel = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y] || `${y}th Year`)

export default function AcademicSubjects() {
  const [groups, setGroups] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [modalStep, setModalStep] = useState(null)
  const [departmentChoice, setDepartmentChoice] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('theory')
  const [periods, setPeriods] = useState(3)
  const [theoryPeriods, setTheoryPeriods] = useState(3)
  const [labPeriods, setLabPeriods] = useState(2)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  async function load() {
    try {
      const [g, s] = await Promise.all([
        axios.get(`${BASE}/academic-structure`),
        axios.get(`${BASE}/academic-subjects`),
      ])
      const data = g.data
      setGroups(Array.isArray(data) ? data : (data.groups || []))
      setSubjects(Array.isArray(s.data) ? s.data : [])
    } catch (err) {
      setError('Could not load academic subjects.')
    }
  }

  useEffect(() => { load() }, [])

  const departments = useMemo(
    () => [...new Set(groups.map(g => g.department))].sort((a, b) => a.localeCompare(b)),
    [groups]
  )
  const departmentGroups = useMemo(
    () => groups.filter(g => g.department === departmentChoice).sort((a, b) => a.year_of_study - b.year_of_study),
    [groups, departmentChoice]
  )
  const selectedGroup = groups.find(g => String(g.group_id) === String(selectedGroupId))
  const selectedSubjects = subjects.filter(s => s.group_id === Number(selectedGroupId))

  // The backend stores theory and lab as separate solver-ready definitions.
  // The directory merges them visually so the user sees one subject.
  const directory = useMemo(() => {
    const map = new Map()
    selectedSubjects.forEach(s => {
      const key = s.subject_name.trim().toLowerCase()
      if (!map.has(key)) map.set(key, { name: s.subject_name, components: [], definitionIds: [] })
      const row = map.get(key)
      row.components.push(s.subject_type)
      row.definitionIds.push(s.definition_id)
      row.periods = (row.periods || 0) + Number(s.periods_per_week || 0)
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedSubjects])

  function openSelector() {
    setError('')
    setModalStep('department')
    setDepartmentChoice('')
  }

  function chooseDepartment(department) {
    setDepartmentChoice(department)
    setModalStep('year')
  }

  function chooseYear(groupId) {
    setSelectedGroupId(String(groupId))
    setModalStep(null)
    setMessage('')
    setError('')
  }

  function clearSelection() {
    setSelectedGroupId('')
    setMessage('')
    setError('')
  }

  function resetForm() {
    setName('')
    setType('theory')
    setPeriods(3)
    setTheoryPeriods(3)
    setLabPeriods(2)
    setEditing(null)
  }

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    if (!selectedGroupId || !name.trim()) {
      setError('Select a department and year, then enter a subject name.')
      return
    }
    try {
      const payload = {
        group_id: Number(selectedGroupId),
        subject_name: name.trim(),
        subject_type: type,
        periods_per_week: Number(periods),
        ...(type === 'theory+lab' ? {
          theory_periods_per_week: Number(theoryPeriods),
          lab_periods_per_week: Number(labPeriods),
        } : {}),
      }
      const r = await axios.post(`${BASE}/academic-subjects`, payload)
      setMessage(`${r.data.subject_name} added to all divisions: ${r.data.assigned_to_divisions.join(', ')}`)
      resetForm()
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save subject.')
    }
  }

  function startEdit(row) {
    setEditing(row)
    setName(row.name)
    if (row.components.includes('theory') && row.components.includes('lab')) setType('theory+lab')
    else setType(row.components[0] || 'theory')
    setPeriods(Math.max(1, Math.round(row.periods / row.components.length)))
    setTheoryPeriods(3)
    setLabPeriods(2)
    setError('Editing existing subjects is not yet exposed by the current academic-subject API.')
  }

  return (
    <div className="subjects-page">
      <section className="subjects-hero">
        <div className="subjects-hero-copy">
          <div className="subjects-eyebrow">ACADEMIC SETUP · STEP 2</div>
          <h1>Subjects</h1>
          <p>Configure subjects by department and year. Every subject is automatically assigned to all divisions in that academic group.</p>
        </div>
        <div className="subjects-hero-stats">
          <div><strong>{departments.length}</strong><span>Departments</span></div>
          <i />
          <div><strong>{groups.reduce((n, g) => n + g.divisions.length, 0)}</strong><span>Divisions</span></div>
        </div>
      </section>

      {message && <div className="subjects-notice success">✓ {message}<button onClick={() => setMessage('')}>×</button></div>}
      {error && !modalStep && <div className="subjects-notice error">! {error}<button onClick={() => setError('')}>×</button></div>}

      <section className="subject-selection-card">
        <div className="subject-selection-copy">
          <span className="subjects-kicker">CURRENT SCOPE</span>
          {selectedGroup ? (
            <>
              <h2>{selectedGroup.department} · {yearLabel(selectedGroup.year_of_study)}</h2>
              <p>Subjects added here will automatically be assigned to every division of this year.</p>
              <div className="division-chips">{selectedGroup.divisions.map(d => <span key={d.division_id}>{d.division_name}</span>)}</div>
            </>
          ) : (
            <><h2>Choose where to add subjects</h2><p>Select a department first, then choose its year.</p></>
          )}
        </div>
        <div className="selection-actions">
          <button className="subject-primary" onClick={openSelector}>＋ {selectedGroup ? 'Change department / year' : 'Select your department'}</button>
          {selectedGroup && <button className="subject-ghost" onClick={clearSelection}>Clear</button>}
        </div>
      </section>

      {selectedGroup && (
        <>
          <section className="subject-workspace">
            <div className="add-subject-panel">
              <div className="subject-panel-heading"><div className="panel-icon">＋</div><div><span className="subjects-kicker">ADD TO {selectedGroup.department.toUpperCase()}</span><h2>New Subject</h2><p>{yearLabel(selectedGroup.year_of_study)} · Divisions {selectedGroup.divisions.map(d => d.division_name).join(', ')}</p></div></div>
              <form onSubmit={submit}>
                <label className="subject-field"><span>SUBJECT NAME</span><input autoFocus={!editing} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Data Structures" /></label>
                <div className="subject-field"><span>SUBJECT TYPE</span><div className="subject-type-grid">
                  <button type="button" className={`type-option ${type === 'theory' ? 'active' : ''}`} onClick={() => setType('theory')}><b>▣</b><strong>Theory Only</strong><small>Lecture sessions</small></button>
                  <button type="button" className={`type-option ${type === 'theory+lab' ? 'active' : ''}`} onClick={() => setType('theory+lab')}><b>⚗</b><strong>Theory + Lab</strong><small>Both components</small></button>
                </div></div>
                {type === 'theory+lab' ? <div className="period-split"><label className="subject-field"><span>THEORY PERIODS / WEEK</span><input type="number" min="1" max="30" value={theoryPeriods} onChange={e => setTheoryPeriods(e.target.value)} /></label><label className="subject-field"><span>LAB PERIODS / WEEK</span><input type="number" min="1" max="30" value={labPeriods} onChange={e => setLabPeriods(e.target.value)} /></label></div> : <label className="subject-field"><span>PERIODS / WEEK</span><input type="number" min="1" max="30" value={periods} onChange={e => setPeriods(e.target.value)} /></label>}
                <button className="subject-primary full">＋ Add Subject to All Divisions</button>
              </form>
              <div className="subject-info">ⓘ This subject will be created for {selectedGroup.divisions.length} division{selectedGroup.divisions.length !== 1 ? 's' : ''}: {selectedGroup.divisions.map(d => d.division_name).join(', ')}.</div>
            </div>

            <div className="subject-directory-panel">
              <div className="directory-heading"><div><span className="subjects-kicker">SUBJECT DIRECTORY</span><h2>{selectedGroup.department} · {yearLabel(selectedGroup.year_of_study)}</h2><p>Subjects configured for all divisions in this academic group.</p></div><span className="directory-count">{directory.length} subject{directory.length !== 1 ? 's' : ''}</span></div>
              {directory.length === 0 ? <div className="directory-empty"><div>＋</div><h3>No subjects yet</h3><p>Add the first subject using the form.</p></div> : <div className="subject-table"><div className="subject-table-head"><span>SUBJECT</span><span>TYPE</span><span>PERIODS</span><span>ACTIONS</span></div>{directory.map(row => <div className="subject-table-row" key={row.name}><div><strong>{row.name}</strong><small>{selectedGroup.divisions.length} divisions</small></div><div className="type-badges">{row.components.includes('theory') && <span className="theory-badge">Theory</span>}{row.components.includes('lab') && <span className="lab-badge">Lab</span>}</div><span>{row.periods}</span><div className="row-actions"><button title="Edit" onClick={() => startEdit(row)}>✎</button><button title="Delete" className="delete">⌫</button></div></div>)}</div>}
            </div>
          </section>
        </>
      )}

      <section className="subject-guidelines"><div className="guideline-title"><span>ⓘ</span><div><h3>How subjects are assigned</h3><p>Choose one department and year. The system applies each subject to every division in that group.</p></div></div><div className="guideline-points"><div><b>01</b><span>Department → Year</span></div><div><b>02</b><span>One subject definition</span></div><div><b>03</b><span>All divisions inherit it</span></div></div></section>

      {modalStep && <div className="subjects-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setModalStep(null)}><div className="subjects-modal">
        <div className="subjects-modal-head"><div><span className="subjects-eyebrow">SUBJECT CONFIGURATION</span><h2>{modalStep === 'department' ? 'Select your department' : 'Select a year'}</h2><p>{modalStep === 'department' ? 'Choose the department whose subjects you want to configure.' : `Choose the year for ${departmentChoice}.`}</p></div><button onClick={() => setModalStep(null)}>×</button></div>
        {modalStep === 'department' ? <div className="department-choice-grid">{departments.map(dep => <button key={dep} className="department-choice" onClick={() => chooseDepartment(dep)}><span>{dep.slice(0, 2).toUpperCase()}</span><strong>{dep}</strong><small>{groups.filter(g => g.department === dep).reduce((n, g) => n + g.divisions.length, 0)} divisions</small><b>→</b></button>)}</div> : <div className="year-choice-list">{departmentGroups.map(g => <button key={g.group_id} className="year-choice" onClick={() => chooseYear(g.group_id)}><span className="year-number">{g.year_of_study}</span><div><strong>{yearLabel(g.year_of_study)}</strong><small>{g.divisions.length} division{g.divisions.length !== 1 ? 's' : ''} · {g.divisions.map(d => d.division_name).join(', ')}</small></div><b>→</b></button>)}</div>}
        {modalStep === 'year' && <button className="modal-back" onClick={() => setModalStep('department')}>← Back to departments</button>}
      </div></div>}
    </div>
  )
}
