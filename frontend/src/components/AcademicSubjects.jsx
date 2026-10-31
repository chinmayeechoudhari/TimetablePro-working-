import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './AcademicStructureModern.css'
import './AcademicSubjectsBase.css'
import './AcademicSubjects.css'
import './AcademicSubjectsTable.css'
import Icon from './AcademicIcon'
import { loadShortCodes, deriveShortCode, accentIndex } from '../lib/AcademicShortCodes'

import { API_BASE } from '../lib/config'
const BASE = API_BASE
const yearLabel = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y] || `${y}th Year`)
const divisionNames = group => (group?.divisions || []).map(d => typeof d === 'string' ? d : d?.division_name).filter(Boolean)

function StatSpark({ color, id }) {
  const gid = `subj-spark-${id}`
  return <div className="stat-decoration"><svg width="110" height="38" viewBox="0 0 120 40" preserveAspectRatio="none"><path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ opacity: .6 }} /><path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10 L 120 40 L 0 40 Z" fill={`url(#${gid})`} style={{ opacity: .15 }} /><defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="transparent" /></linearGradient></defs></svg></div>
}
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
function SubjectsWatermark() { return <svg className="academic-hero-watermark" viewBox="0 0 620 220" fill="none" aria-hidden="true"><rect x="150" y="150" width="150" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><rect x="163" y="136" width="130" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><rect x="140" y="164" width="165" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M370 70v100M410 60v110M450 74v96M362 70h16M402 60h16M442 74h16" stroke="currentColor" strokeWidth="2"/><rect x="330" y="170" width="160" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="470" cy="120" r="34" stroke="currentColor" strokeWidth="2"/><path d="M470 104v16l11 11M40 185h540" stroke="currentColor" strokeWidth="2"/></svg> }

export default function AcademicSubjects() {
  const [groups, setGroups] = useState([]), [subjects, setSubjects] = useState([])
  const [terms, setTerms] = useState([]), [selectedTermId, setSelectedTermId] = useState('')
  const [shortCodes] = useState(loadShortCodes)
  const [loadError, setLoadError] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState(''), [selectedGroupId, setSelectedGroupId] = useState('')
  const [search, setSearch] = useState(''), [departmentSearch, setDepartmentSearch] = useState(''), [typeFilter, setTypeFilter] = useState('all')
  const [message, setMessage] = useState(''), [error, setError] = useState('')
  const [formModal, setFormModal] = useState(null), [formName, setFormName] = useState(''), [formType, setFormType] = useState('theory')
  const [formPeriods, setFormPeriods] = useState(3), [formTheoryPeriods, setFormTheoryPeriods] = useState(3), [formLabPeriods, setFormLabPeriods] = useState(2)
  const [formTotalHours, setFormTotalHours] = useState(45), [formDuration, setFormDuration] = useState(1)
  const [formTheoryHours, setFormTheoryHours] = useState(45), [formTheoryDuration, setFormTheoryDuration] = useState(1)
  const [formLabHours, setFormLabHours] = useState(30), [formLabDuration, setFormLabDuration] = useState(2)
  const [formError, setFormError] = useState(''), [formSaving, setFormSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null), [deleteError, setDeleteError] = useState(''), [deleting, setDeleting] = useState(false)

  async function load(termId = selectedTermId) {
    try {
      const [gr, tr] = await Promise.all([
        axios.get(`${BASE}/academic-structure`),
        axios.get(`${BASE}/calendar/terms`),
      ])
      const termList = Array.isArray(tr.data) ? tr.data : []
      setTerms(termList)
      const resolvedTermId = String(termId || termList.find(t => t.status === 'active')?.term_id || termList[0]?.term_id || '')
      if (resolvedTermId !== selectedTermId) setSelectedTermId(resolvedTermId)
      const sr = resolvedTermId
        ? await axios.get(`${BASE}/academic-subjects`, { params: { term_id: Number(resolvedTermId) } })
        : { data: [] }
      const rawGroups = Array.isArray(gr.data) ? gr.data : (gr.data?.groups || [])
      setGroups(rawGroups.map(g => ({ ...g, divisions: (g.divisions || []).map(d => typeof d === 'string' ? d : d?.division_name).filter(Boolean) })))
      setSubjects(Array.isArray(sr.data) ? sr.data : [])
      setLoadError('')
    } catch (err) { console.error(err); setLoadError('Could not load semester subjects or global academic structure. Is the backend running?') }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { if (selectedTermId) loadSubjects(selectedTermId) }, [selectedTermId])

  async function loadSubjects(termId) {
    try {
      const response = await axios.get(`${BASE}/academic-subjects`, { params: { term_id: Number(termId) } })
      setSubjects(Array.isArray(response.data) ? response.data : [])
    } catch (err) { console.error(err); setLoadError('Could not load subjects for this semester.') }
  }
  useEffect(() => {
    const locked = Boolean(formModal || deleteTarget); if (!locked) return undefined
    const html = document.documentElement, body = document.body, ph = html.style.overflow, pb = body.style.overflow, pp = body.style.paddingRight
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; const sw = window.innerWidth - html.clientWidth; if (sw > 0) body.style.paddingRight = `${sw}px`
    return () => { html.style.overflow = ph; body.style.overflow = pb; body.style.paddingRight = pp }
  }, [formModal, deleteTarget])

  const departments = useMemo(() => [...new Set(groups.map(g => g.department))].sort((a,b) => a.localeCompare(b)), [groups])
  const departmentRows = useMemo(() => departments.map(name => { const rows = groups.filter(g => g.department === name).sort((a,b) => a.year_of_study-b.year_of_study); return { name, groups: rows, divisions: rows.reduce((n,g) => n + g.divisions.length, 0) } }), [departments, groups])
  const filteredDepartments = useMemo(() => { const q = departmentSearch.trim().toLowerCase(); return q ? departmentRows.filter(d => d.name.toLowerCase().includes(q)) : departmentRows }, [departmentRows, departmentSearch])
  const totalDivisions = departmentRows.reduce((n,d) => n+d.divisions, 0)
  const totalSubjects = useMemo(() => new Set(subjects.map(s => `${s.group_id}::${s.subject_name.trim().toLowerCase()}`)).size, [subjects])
  const activeDeptRow = departmentRows.find(d => d.name === selectedDepartment) || null
  const selectedGroup = groups.find(g => String(g.group_id) === String(selectedGroupId)) || null
  const selectedDivisionNames = divisionNames(selectedGroup)
  useEffect(() => { if (!activeDeptRow) return; if (!activeDeptRow.groups.some(g => String(g.group_id) === String(selectedGroupId))) setSelectedGroupId(activeDeptRow.groups[0] ? String(activeDeptRow.groups[0].group_id) : '') }, [activeDeptRow, selectedGroupId])

  const directory = useMemo(() => {
    if (!selectedGroup) return []
    const map = new Map()
    subjects.filter(s => s.group_id === selectedGroup.group_id).forEach(s => {
      const k = s.subject_name.trim().toLowerCase()
      if (!map.has(k)) {
        map.set(k, {
          name: s.subject_name,
          theory: null,
          lab: null,
          theory_hours: null,
          lab_hours: null,
          theory_duration: 1,
          lab_duration: 2,
          total_hours: s.total_hours,
          lecture_duration: s.lecture_duration || 1,
        })
      }
      const item = map.get(k)
      item[s.subject_type] = s.periods_per_week
      if (s.subject_type === 'theory') {
        item.theory_hours = s.total_hours
        item.theory_duration = s.lecture_duration || 1
      } else if (s.subject_type === 'lab') {
        item.lab_hours = s.total_hours
        item.lab_duration = s.lecture_duration || 2
      }
      if (item.total_hours == null && s.total_hours != null) item.total_hours = s.total_hours
      if (item.lecture_duration == null && s.lecture_duration != null) item.lecture_duration = s.lecture_duration
    })
    return [...map.values()].map(r => ({ ...r, type: r.theory!=null&&r.lab!=null?'theory+lab':r.lab!=null?'lab':'theory' })).sort((a,b)=>a.name.localeCompare(b.name))
  }, [subjects, selectedGroup])
  const filterCounts = useMemo(() => ({ all:directory.length, theory:directory.filter(r=>r.theory!=null).length, lab:directory.filter(r=>r.lab!=null).length }), [directory])
  const filteredDirectory = useMemo(() => { const q=search.trim().toLowerCase(); return directory.filter(r => (!q || r.name.toLowerCase().includes(q)) && (typeFilter==='all' || (typeFilter==='theory'&&r.theory!=null) || (typeFilter==='lab'&&r.lab!=null))) }, [directory,search,typeFilter])

  function chooseDepartment(name) { const rows=groups.filter(g=>g.department===name).sort((a,b)=>a.year_of_study-b.year_of_study); setSelectedDepartment(name); setSelectedGroupId(rows[0]?String(rows[0].group_id):''); setSearch(''); setDepartmentSearch(''); setTypeFilter('all'); setMessage(''); setError('') }
  function changeDepartment() { setSelectedDepartment(''); setSelectedGroupId(''); setSearch(''); setDepartmentSearch(''); setTypeFilter('all') }
  function chooseYear(id) { setSelectedGroupId(String(id)); setSearch(''); setTypeFilter('all') }
  function resetForm() {
    setFormName('')
    setFormType('theory')
    setFormPeriods(3)
    setFormTheoryPeriods(3)
    setFormLabPeriods(2)
    setFormTotalHours(45)
    setFormDuration(1)
    setFormTheoryHours(45)
    setFormTheoryDuration(1)
    setFormLabHours(30)
    setFormLabDuration(2)
    setFormError('')
  }
  function openAdd() { resetForm(); setFormModal({type:'add'}) }
  function openEdit(row) {
    setFormError('')
    setFormName(row.name)
    setFormType(row.type)
    setFormPeriods(row.type==='lab'?(row.lab??2):(row.theory??3))
    if (row.type === 'theory+lab') {
      setFormTheoryPeriods(row.theory ?? 3)
      setFormLabPeriods(row.lab ?? 2)
      setFormTheoryHours(row.theory_hours ?? 45)
      setFormTheoryDuration(row.theory_duration ?? 1)
      setFormLabHours(row.lab_hours ?? 30)
      setFormLabDuration(row.lab_duration ?? 2)
    } else if (row.type === 'lab') {
      setFormTotalHours(row.lab_hours ?? row.total_hours ?? 30)
      setFormDuration(row.lab_duration ?? row.lecture_duration ?? 2)
    } else {
      setFormTotalHours(row.theory_hours ?? row.total_hours ?? 45)
      setFormDuration(row.theory_duration ?? row.lecture_duration ?? 1)
    }
    setFormModal({type:'edit',originalName:row.name})
  }
  function closeFormModal() { setFormModal(null); resetForm() }
  async function submitForm(e) {
    e.preventDefault(); setFormError(''); if(!formName.trim()) return setFormError('Enter a subject name.'); if(!selectedGroup) return setFormError('Select a department and year first.')

    // Divisibility validation
    if (formType === 'theory' || formType === 'lab') {
      const th = Number(formTotalHours)
      const dur = Number(formDuration)
      if (th && dur && th % dur !== 0) {
        return setFormError(`Total hours (${th}) must be evenly divisible by session duration (${dur}h).`)
      }
    } else if (formType === 'theory+lab') {
      const th = Number(formTheoryHours)
      const td = Number(formTheoryDuration)
      const lh = Number(formLabHours)
      const ld = Number(formLabDuration)
      if (th && td && th % td !== 0) {
        return setFormError(`Theory hours (${th}) must be divisible by theory duration (${td}h).`)
      }
      if (lh && ld && lh % ld !== 0) {
        return setFormError(`Lab hours (${lh}) must be divisible by lab duration (${ld}h).`)
      }
    }

    const payload = {
      subject_name: formName.trim(),
      subject_type: formType,
      periods_per_week: Number(formPeriods),
      total_hours: Number(formTotalHours),
      lecture_duration: Number(formDuration),
      ...(formType === 'theory+lab' ? {
        theory_periods_per_week: Number(formTheoryPeriods),
        lab_periods_per_week: Number(formLabPeriods),
        theory_total_hours: Number(formTheoryHours),
        theory_lecture_duration: Number(formTheoryDuration),
        lab_total_hours: Number(formLabHours),
        lab_lecture_duration: Number(formLabDuration),
      } : {})
    };
    setFormSaving(true)
    try {
      if (formModal?.type === 'edit') {
        await axios.put(`${BASE}/academic-subjects/${selectedGroup.group_id}/${encodeURIComponent(formModal.originalName)}?term_id=${selectedTermId}`, payload);
        setMessage(`${payload.subject_name} was updated.`)
      } else {
        const r = await axios.post(`${BASE}/academic-subjects`, { group_id: selectedGroup.group_id, term_id: Number(selectedTermId), ...payload });
        setMessage(`${r.data.subject_name} added to all divisions: ${r.data.assigned_to_divisions.join(', ')}`)
      }
      closeFormModal();
      await load()
    } catch(err) {
      setFormError(err.response?.data?.detail || 'Could not save the subject.')
    } finally {
      setFormSaving(false)
    }
  }
  async function confirmDelete() { if(!deleteTarget||!selectedGroup)return; setDeleting(true);setDeleteError('');try{await axios.delete(`${BASE}/academic-subjects/${selectedGroup.group_id}/${encodeURIComponent(deleteTarget.name)}?term_id=${selectedTermId}`);setMessage(`${deleteTarget.name} was deleted.`);setDeleteTarget(null);await load()}catch(err){setDeleteError(err.response?.data?.detail||'Could not delete this subject.')}finally{setDeleting(false)} }

  const calculatedSessions = useMemo(() => {
    if (formType === 'theory' || formType === 'lab') {
      const th = Number(formTotalHours) || 0
      const d = Number(formDuration) || 1
      return d ? Math.floor(th / d) : 0
    }
    return 0
  }, [formType, formTotalHours, formDuration])

  const formModalContent = formModal && selectedGroup ? <div className="subjects-modal-root"><div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&closeFormModal()}><div className="academic-modal subject-form-modal" role="dialog" aria-modal="true"><form onSubmit={submitForm}><div className="subject-modal-header"><div className="subject-modal-context"><span>Subjects</span><i/><span>{selectedDepartment}</span><i/><span>{yearLabel(selectedGroup.year_of_study)}</span></div><button type="button" className="modal-close subject-modal-close" onClick={closeFormModal}><Icon name="close" size={18}/></button><div className="subject-modal-heading"><div className="modal-icon"><Icon name={formModal.type==='edit'?'edit':'plus'} size={22}/></div><div><div className="academic-eyebrow">{formModal.type==='edit'?'EDIT SUBJECT':'NEW SUBJECT'}</div><h2>{formModal.type==='edit'?'Edit subject':'Add a new subject'}</h2><p>Configure subject details, semester teaching hours, and session durations.</p></div></div></div><div className="subject-form-body"><section className="subject-form-card"><div className="subject-form-card-head"><div className="modal-card-icon"><Icon name="book" size={20}/></div><div><h3>Subject details</h3><p>Name the subject and choose how it is taught.</p></div></div><Field label="SUBJECT NAME"><input autoFocus value={formName} onChange={e=>setFormName(e.target.value)} placeholder="e.g. Data Structures"/></Field><div className="subject-type-select"><button type="button" className={`subject-type-option ${formType==='theory'?'active':''}`} onClick={()=>setFormType('theory')}><Icon name="book" size={19}/><span>Theory</span><small>Lecture-based</small></button><button type="button" className={`subject-type-option ${formType==='lab'?'active':''}`} onClick={()=>setFormType('lab')}><Icon name="beaker" size={19}/><span>Lab</span><small>Practical sessions</small></button><button type="button" className={`subject-type-option ${formType==='theory+lab'?'active':''}`} onClick={()=>setFormType('theory+lab')}><Icon name="layers" size={19}/><span>Theory + Lab</span><small>Both components</small></button></div></section><section className="subject-form-card"><div className="subject-form-card-head"><div className="modal-card-icon purple"><Icon name="calendar" size={20}/></div><div><h3>Semester Teaching Hours &amp; Duration</h3><p>Authoritative semester hour targets and multi-period lecture block sizes.</p></div></div>{formType!=='theory+lab'?(<><div className="subject-period-grid"><Field label="TOTAL SEMESTER HOURS"><input type="number" min="1" max="500" value={formTotalHours} onChange={e=>setFormTotalHours(e.target.value)}/></Field><Field label="SESSION DURATION"><select style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border,#cbd5e1)',background:'var(--surface,#fff)',color:'inherit',font:'inherit'}} value={formDuration} onChange={e=>setFormDuration(Number(e.target.value))}><option value={1}>1 Hour (Single Period)</option><option value={2}>2 Hours (Consecutive Double Block)</option></select></Field></div><div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:'rgba(99,102,241,0.08)',color:'#4f46e5',fontSize:12.5,fontWeight:600,display:'flex',alignItems:'center',gap:6}}><span>ℹ️</span><span><b>{calculatedSessions} sessions</b> required ({formDuration}h each) to fulfill {formTotalHours} semester hours.</span></div>{formTotalHours%formDuration!==0&&<div style={{marginTop:6,fontSize:12,color:'#ef4444',fontWeight:600}}>⚠️ Total hours ({formTotalHours}) is not evenly divisible by session duration ({formDuration}h).</div>}</>):(<><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}><div style={{padding:12,borderRadius:8,border:'1px solid var(--border,#e2e8f0)',background:'var(--surface,#f8fafc)'}}><strong style={{fontSize:12,display:'block',marginBottom:8,color:'#3b82f6'}}>Theory Component</strong><Field label="TOTAL HOURS"><input type="number" min="1" max="500" value={formTheoryHours} onChange={e=>setFormTheoryHours(e.target.value)}/></Field><Field label="DURATION"><select style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #cbd5e1',background:'#fff',font:'inherit'}} value={formTheoryDuration} onChange={e=>setFormTheoryDuration(Number(e.target.value))}><option value={1}>1 Hour</option><option value={2}>2 Hours</option></select></Field><small style={{color:'#64748b',display:'block',marginTop:4}}>{formTheoryDuration?Math.floor(formTheoryHours/formTheoryDuration):0} sessions required</small></div><div style={{padding:12,borderRadius:8,border:'1px solid var(--border,#e2e8f0)',background:'var(--surface,#f8fafc)'}}><strong style={{fontSize:12,display:'block',marginBottom:8,color:'#10b981'}}>Lab Component</strong><Field label="TOTAL HOURS"><input type="number" min="1" max="500" value={formLabHours} onChange={e=>setFormLabHours(e.target.value)}/></Field><Field label="DURATION"><select style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #cbd5e1',background:'#fff',font:'inherit'}} value={formLabDuration} onChange={e=>setFormLabDuration(Number(e.target.value))}><option value={1}>1 Hour</option><option value={2}>2 Hours (Double Block)</option></select></Field><small style={{color:'#64748b',display:'block',marginTop:4}}>{formLabDuration?Math.floor(formLabHours/formLabDuration):0} sessions required</small></div></div></>)}<div style={{marginTop:16}}><Field label="RECURRING WEEKLY PERIODS"><input type="number" min="1" value={formPeriods} onChange={e=>setFormPeriods(e.target.value)}/></Field>{formType==='theory+lab'&&<div className="subject-period-grid" style={{marginTop:8}}><Field label="THEORY / WEEK"><input type="number" min="1" value={formTheoryPeriods} onChange={e=>setFormTheoryPeriods(e.target.value)}/></Field><Field label="LAB / WEEK"><input type="number" min="1" value={formLabPeriods} onChange={e=>setFormLabPeriods(e.target.value)}/></Field></div>}</div><div className="subject-form-note"><Icon name="info" size={15}/><span>This subject will be configured for all <b>{selectedDivisionNames.length} divisions</b>: {selectedDivisionNames.join(', ')}.</span></div>{formError&&<div className="global-notice error">{formError}</div>}</section></div><div className="subject-form-footer"><button type="button" className="secondary-button" onClick={closeFormModal}>Cancel</button><button type="submit" className="primary-button" disabled={formSaving}>{formSaving?'Saving...':<><Icon name="check" size={16}/> {formModal.type==='edit'?'Save Changes':'Add Subject'}</>}</button></div></form></div></div></div> : null

  return <div className="academic-page subjects-page">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:18,padding:'14px 18px',border:'1px solid var(--border, #e2e8f0)',borderRadius:14,background:'var(--card, #fff)'}}>
      <div><strong style={{display:'block',fontSize:14}}>Selected semester</strong><span style={{fontSize:12,color:'var(--text-muted, #64748b)'}}>Subjects and teaching loads are saved separately for each semester. Departments, classes and divisions remain global.</span></div>
      <select aria-label="Selected semester" value={selectedTermId} onChange={e=>setSelectedTermId(e.target.value)} style={{minWidth:230,maxWidth:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--border, #cbd5e1)',background:'var(--surface, #fff)',color:'var(--text-main, #0f172a)',font:'inherit'}} disabled={!terms.length}>
        {!terms.length&&<option value="">Create a semester first</option>}
        {terms.map(t=><option key={t.term_id} value={String(t.term_id)}>{t.academic_year} · {t.term_name}</option>)}
      </select>
    </div>
    {loadError&&<div className="global-notice error">{loadError}</div>}{message&&<div className="global-notice success">{message}</div>}{error&&<div className="global-notice error">{error}</div>}
    <section className="academic-hero subjects-hero"><div className="hero-left"><div className="hero-icon"><Icon name="book" size={28}/></div><div><div className="academic-eyebrow">ACADEMIC STRUCTURE</div><h1>Subjects</h1><div className="hero-subtitle">Manage Subjects &amp; Course Components</div><p>Configure subjects for each department and year. Subjects are automatically associated with the divisions in their academic group.</p></div></div><SubjectsWatermark/></section>
    <section className="subjects-stats"><div className="stat-card stat-blue"><div className="stat-icon"><Icon name="building" size={20}/></div><div><div className="stat-label">TOTAL DEPARTMENTS</div><div className="stat-number">{departments.length}</div></div><StatSpark color="#7aa4ff" id="departments"/></div><div className="stat-card stat-green"><div className="stat-icon"><Icon name="book" size={20}/></div><div><div className="stat-label">TOTAL SUBJECTS</div><div className="stat-number">{totalSubjects}</div></div><StatSpark color="#63d7ba" id="subjects"/></div><div className="stat-card stat-purple"><div className="stat-icon"><Icon name="grid" size={20}/></div><div><div className="stat-label">TOTAL DIVISIONS</div><div className="stat-number">{totalDivisions}</div></div><StatSpark color="#c08cff" id="divisions"/></div></section>
    {!selectedDepartment?<section className="department-picker-section"><div className="department-picker-intro"><div className="department-picker-icon"><Icon name="building" size={20}/></div><div><div className="academic-eyebrow">SUBJECT CONFIGURATION</div><h2>Select a department to proceed</h2><p>Choose a department below to manage its subjects year by year. Each department card gives a quick curriculum overview.</p></div></div><div className="department-picker-tools"><span>{filteredDepartments.length} {filteredDepartments.length===1?'department':'departments'} available</span><label className="dept-search"><Icon name="search" size={15}/><input value={departmentSearch} onChange={e=>setDepartmentSearch(e.target.value)} placeholder="Search departments..."/></label></div><div className="department-picker-grid">{filteredDepartments.map(d=><button key={d.name} className="department-picker-card" onClick={()=>chooseDepartment(d.name)}><div className="department-card-heading"><div className={`department-picker-logo avatar-accent-${accentIndex(d.name)}`}>{deriveShortCode(d.name,shortCodes)}</div><div className="department-picker-arrow"><Icon name="arrowRight" size={16}/></div></div><div className="department-card-kicker">ACADEMIC DEPARTMENT</div><h3 className="department-picker-name">{d.name}</h3><div className="department-picker-meta">{d.groups.length} Years &nbsp;•&nbsp; {d.divisions} Divisions</div><div className="department-card-subheading">YEAR-WISE SUBJECT LOAD</div><div className="department-year-summary">{d.groups.map(g=>{const dc=g.divisions.length,sc=subjects.filter(s=>s.group_id===g.group_id).length,spd=dc?Math.round(sc/dc*10)/10:0;return <div className="department-year-summary-row" key={g.group_id}><div><span>{yearLabel(g.year_of_study)}</span><b>{dc} divisions</b></div><em>{spd} subjects / division</em></div>})}</div><div className="department-card-footer">Open department <Icon name="arrowRight" size={14}/></div></button>)}</div></section>:<><section className="subjects-context-bar"><div className="subjects-context-left"><div className={`subjects-context-avatar avatar-accent-${accentIndex(selectedDepartment)}`}>{(shortCodes[selectedDepartment]||deriveShortCode(selectedDepartment)).slice(0,2)}</div><div className="subjects-context-copy"><div className="academic-eyebrow">SUBJECT CONFIGURATION</div><h2>{selectedDepartment}</h2><div className="subjects-context-meta"><span>{activeDeptRow?.groups.length||0} Years</span><i/><span>{activeDeptRow?.divisions||0} Divisions</span></div></div></div><button className="secondary-button" onClick={changeDepartment}>Change Department</button></section><section className="subject-year-tabs"><div className="subject-year-tabs-heading"><div><div className="academic-eyebrow">SELECT YEAR</div><p>Choose a year to view and manage its subjects.</p></div><span>{directory.length} subjects in current year</span></div><div className="subject-year-tab-list">{activeDeptRow?.groups.map(g=><button key={g.group_id} className={`subject-year-tab ${String(g.group_id)===String(selectedGroupId)?'active':''}`} onClick={()=>chooseYear(g.group_id)}><div className="subject-year-number">{g.year_of_study}</div><div><strong>{yearLabel(g.year_of_study)}</strong><small>{g.divisions.length} divisions · {subjects.filter(s=>s.group_id===g.group_id).length} subjects</small></div></button>)}</div></section><section className="subject-directory-card"><div className="subject-directory-head"><div><div className="section-kicker">SUBJECT DIRECTORY</div><div className="subject-directory-title-row"><h2>{yearLabel(selectedGroup.year_of_study)} Subjects</h2><span className="subject-directory-count">{directory.length}</span></div><p className="subject-directory-divisions">{selectedDepartment} · Divisions: <b>{selectedDivisionNames.join(' · ')}</b></p></div><div className="subject-directory-actions"><label className="dept-search"><Icon name="search" size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search subjects..."/></label><button className="primary-button" onClick={openAdd}><Icon name="plus" size={17}/> Add Subject</button></div></div><div className="subject-filter-bar"><div className="subject-filter-label"><span>FILTER BY TYPE</span><small>{filteredDirectory.length} of {directory.length} shown</small></div><div className="subject-filter-chips">{[['all','All',filterCounts.all],['theory','Theory',filterCounts.theory],['lab','Lab',filterCounts.lab]].map(([k,l,c])=><button key={k} className={`subject-filter-chip ${k} ${typeFilter===k?'active':''}`} onClick={()=>setTypeFilter(k)}>{l}<b>{c}</b></button>)}</div></div><div className="subject-table-wrap"><div className="subject-table-header"><span>#</span><span>SUBJECT</span><span>TYPE</span><span>SEMESTER &amp; WEEKLY LOAD</span><span>DIVISIONS</span><span>ACTIONS</span></div><div className="subject-list">{filteredDirectory.map((row,i)=><div className="subject-card" key={row.name}><div className="subject-card-index">{String(i+1).padStart(2,'0')}</div><div className="subject-card-main"><div className="subject-card-name">{row.name}</div><span className="subject-card-subtitle">Course subject</span></div><div className="subject-card-badges">{row.theory!=null&&<span className="subject-type-pill theory">Theory</span>}{row.lab!=null&&<span className="subject-type-pill lab">Lab</span>}</div><div className="subject-card-load">{row.theory!=null&&<div><b>{row.theory}</b> th/wk · <span style={{color:'#4338ca',fontWeight:600}}>{row.theory_hours||row.total_hours||45}h</span> ({row.theory_duration||row.lecture_duration||1}h blocks)</div>}{row.lab!=null&&<div><b>{row.lab}</b> lab/wk · <span style={{color:'#059669',fontWeight:600}}>{row.lab_hours||30}h</span> ({row.lab_duration||2}h blocks)</div>}</div><div className="subject-card-divisions"><b>{selectedDivisionNames.length}</b><span>{selectedDivisionNames.join(' · ')}</span></div><div className="subject-card-actions"><button className="subject-icon-btn" onClick={()=>openEdit(row)} aria-label={`Edit ${row.name}`}><Icon name="edit" size={15}/></button><button className="subject-icon-btn" onClick={()=>{setDeleteTarget(row);setDeleteError('')}} aria-label={`Delete ${row.name}`}><Icon name="trash" size={15}/></button></div></div>)}{filteredDirectory.length===0&&<div className="empty-state">No subjects match your current search or filter.</div>}</div><div className="subject-table-footer">Showing {filteredDirectory.length} of {directory.length} subjects</div></div></section></>}
    {formModalContent}
    {deleteTarget&&selectedGroup&&createPortal(<div className="subjects-modal-root"><div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setDeleteTarget(null)}><div className="danger-modal" role="dialog" aria-modal="true"><div className="danger-modal-icon"><Icon name="trash" size={22}/></div><div className="danger-eyebrow">REMOVE SUBJECT</div><h3>Delete {deleteTarget.name}?</h3><p>This removes the subject from all divisions in {selectedGroup.department} {yearLabel(selectedGroup.year_of_study)}.</p>{deleteError&&<div className="global-notice error">{deleteError}</div>}<div className="modal-actions"><button className="secondary-button" onClick={()=>setDeleteTarget(null)}>Cancel</button><button className="danger-button" onClick={confirmDelete} disabled={deleting}>{deleting?'Deleting...':'Delete Subject'}</button></div></div></div></div>,document.body)}
  </div>
}
