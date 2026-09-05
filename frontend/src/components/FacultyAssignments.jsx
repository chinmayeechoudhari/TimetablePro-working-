import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'

const BASE = 'http://localhost:8000'
const yearLabel = y => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[y] || `Year ${y}`)

/* ─── Group-picker modal ────────────────────────────────────────────── */
function GroupPickerModal({ groups, initialGroup, initialDivisionIds, onConfirm, onClose }) {
  const [step, setStep] = useState(initialGroup?.department ? 2 : 1)
  const [dept, setDept] = useState(initialGroup?.department || '')
  const [expandedYear, setExpandedYear] = useState(initialGroup?.year_of_study || null)
  const [divIds, setDivIds] = useState(initialDivisionIds || [])

  const departments = useMemo(() => [...new Set(groups.map(g => g.department))].sort(), [groups])
  const years = useMemo(() => groups.filter(g => g.department === dept).sort((a, b) => a.year_of_study - b.year_of_study), [groups, dept])
  const activeGroup = useMemo(() => years.find(g => g.year_of_study === expandedYear) || null, [years, expandedYear])

  function toggleYear(y) {
    if (expandedYear === y) {
      setExpandedYear(null)
    } else {
      setExpandedYear(y)
      // If switching to a different year, reset selected division ids
      if (activeGroup?.year_of_study !== y) {
        setDivIds([])
      }
    }
  }

  function toggleDiv(id) {
    setDivIds(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  }

  function selectAllDivs(yearDivisions) {
    const allIds = yearDivisions.map(d => d.division_id)
    const isAll = allIds.length > 0 && allIds.every(id => divIds.includes(id))
    if (isAll) {
      setDivIds([])
    } else {
      setDivIds(allIds)
    }
  }

  function pickDept(d) {
    setDept(d)
    setExpandedYear(null)
    setDivIds([])
    setStep(2)
  }

  function back() {
    setDept('')
    setExpandedYear(null)
    setDivIds([])
    setStep(1)
  }

  function confirm() {
    if (!activeGroup || !divIds.length) return
    onConfirm({ group: activeGroup, divisionIds: divIds })
  }

  const stepLabel = ['', 'Select Department', 'Select Year & Divisions']
  const canConfirm = step === 2 && !!activeGroup && divIds.length > 0

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={modalHeader}>
          <div>
            <div style={modalEyebrow}>TEACHING ASSIGNMENT</div>
            <div style={modalTitle}>{stepLabel[step]}</div>
          </div>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={stepRow}>
          {[1, 2].map(s => (
            <div key={s} style={stepDot(s <= step)}>
              <div style={stepDotInner(s < step, s === step)}>{s < step ? '✓' : s}</div>
              <span style={stepDotLabel(s === step)}>{['Department', 'Year & Divisions'][s - 1]}</span>
            </div>
          ))}
          <div style={stepLine} />
        </div>

        {/* Step 1 – Department */}
        {step === 1 && (
          <div style={stepContent}>
            <p style={stepHint}>Which department does the teacher belong to?</p>
            <div style={optionGrid}>
              {departments.map(d => (
                <button key={d} style={optionBtn(dept === d)} onClick={() => pickDept(d)}>
                  <span style={optionIcon}>🏫</span>
                  <span style={optionText}>{d}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 – Year Options with Accordion Expand to Divisions */}
        {step === 2 && (
          <div style={{ ...stepContent, maxHeight: 380, overflowY: 'auto' }}>
            <p style={stepHint}>
              Select year for <b>{dept}</b> and click to expand divisions:
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {years.map(g => {
                const isExpanded = expandedYear === g.year_of_study
                const yearDivisions = g.divisions || []
                const selectedInThisYear = isExpanded ? divIds : []
                const isAllSelected = yearDivisions.length > 0 && selectedInThisYear.length === yearDivisions.length

                return (
                  <div
                    key={g.group_id}
                    style={{
                      border: `1.5px solid ${isExpanded ? '#7c3aed' : '#e2e8f0'}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#fff',
                      boxShadow: isExpanded ? '0 4px 12px rgba(124, 58, 237, 0.08)' : 'none',
                      transition: 'all .2s ease',
                    }}
                  >
                    {/* Clickable Year Row */}
                    <button
                      type="button"
                      onClick={() => toggleYear(g.year_of_study)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '13px 16px',
                        background: isExpanded ? '#faf5ff' : '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background .15s',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>📅</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isExpanded ? '#5b21b6' : '#1e293b' }}>
                          {yearLabel(g.year_of_study)}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                          {yearDivisions.length} division{yearDivisions.length !== 1 ? 's' : ''}
                        </div>
                      </div>

                      {/* Pill indicating selected count if any */}
                      {isExpanded && selectedInThisYear.length > 0 && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#15803d',
                          background: '#dcfce7',
                          padding: '2px 8px',
                          borderRadius: 999,
                          marginRight: 4
                        }}>
                          {selectedInThisYear.length} selected
                        </span>
                      )}

                      {/* Chevron indicator */}
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isExpanded ? '#7c3aed' : '#94a3b8'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform .2s ease',
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {/* Expanded Divisions Panel */}
                    {isExpanded && (
                      <div style={{
                        padding: '12px 16px 16px',
                        background: '#faf5ff',
                        borderTop: '1px solid #f3e8ff',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 10
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b21a8' }}>
                            Choose division{yearDivisions.length > 1 ? 's' : ''}:
                          </span>
                          {yearDivisions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => selectAllDivs(yearDivisions)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#7c3aed',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: '2px 4px',
                                textDecoration: 'underline',
                              }}
                            >
                              {isAllSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                        </div>

                        {yearDivisions.length === 0 ? (
                          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                            No divisions configured for this year.
                          </p>
                        ) : (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                            gap: 8,
                          }}>
                            {yearDivisions.map(d => {
                              const isSelected = divIds.includes(d.division_id)
                              return (
                                <button
                                  key={d.division_id}
                                  type="button"
                                  onClick={() => toggleDiv(d.division_id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 12px',
                                    border: `1.5px solid ${isSelected ? '#7c3aed' : '#cbd5e1'}`,
                                    borderRadius: 9,
                                    background: isSelected ? '#ede9fe' : '#fff',
                                    cursor: 'pointer',
                                    transition: 'all .15s',
                                  }}
                                >
                                  <div style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 5,
                                    border: `2px solid ${isSelected ? '#7c3aed' : '#cbd5e1'}`,
                                    background: isSelected ? '#7c3aed' : '#fff',
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    transition: 'all .15s',
                                  }}>
                                    {isSelected ? '✓' : ''}
                                  </div>
                                  <span style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? 700 : 500,
                                    color: isSelected ? '#5b21b6' : '#334155',
                                  }}>
                                    Division {d.division_name}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {divIds.length > 0 && (
                          <div style={{
                            marginTop: 12,
                            padding: '6px 10px',
                            background: '#f0fdf4',
                            borderRadius: 7,
                            fontSize: 12,
                            color: '#15803d',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            <span>✓</span>
                            <span>{divIds.length} division{divIds.length > 1 ? 's' : ''} selected</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={modalFooter}>
          {step > 1 && <button style={backBtn} onClick={back}>← Back</button>}
          <div style={{ flex: 1 }} />
          <button style={cancelBtn} onClick={onClose}>Cancel</button>
          {step === 2 && (
            <button style={confirmBtn(canConfirm)} onClick={confirm} disabled={!canConfirm}>
              Confirm Selection
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Subject-picker modal (grouped theory & lab dropdown) ──────────── */
function SubjectPickerModal({ group, selectedDefinitionIds, onConfirm, onClose }) {
  const [selectedIds, setSelectedIds] = useState(selectedDefinitionIds || [])
  const [collapsedSubjects, setCollapsedSubjects] = useState({})
  const subjects = group?.subjects || []

  // Group subjects by subject_name
  const subjectGroups = useMemo(() => {
    const map = new Map()
    subjects.forEach(s => {
      const key = s.subject_name.trim().toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          name: s.subject_name.trim(),
          components: []
        })
      }
      map.get(key).components.push(s)
    })
    // Sort components: Theory first, then Lab
    map.forEach(val => {
      val.components.sort((a, b) => {
        if (a.subject_type === b.subject_type) return 0
        return a.subject_type === 'theory' ? -1 : 1
      })
    })
    return Array.from(map.values())
  }, [subjects])

  function toggleSubjectDropdown(subjectName) {
    setCollapsedSubjects(prev => ({
      ...prev,
      [subjectName]: !prev[subjectName]
    }))
  }

  function toggleComponent(id) {
    setSelectedIds(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  }

  function toggleAllForSubject(components, e) {
    e?.stopPropagation()
    const compIds = components.map(c => c.definition_id)
    const isAll = compIds.every(id => selectedIds.includes(id))
    if (isAll) {
      setSelectedIds(prev => prev.filter(id => !compIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...compIds])])
    }
  }

  function handleSelectAll() {
    if (selectedIds.length === subjects.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(subjects.map(s => s.definition_id))
    }
  }

  const canConfirm = selectedIds.length > 0

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={modalHeader}>
          <div>
            <div style={modalEyebrow}>TEACHING ASSIGNMENT · {group?.department} ({yearLabel(group?.year_of_study)})</div>
            <div style={modalTitle}>Select Subjects</div>
          </div>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div style={stepContent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ ...stepHint, margin: 0 }}>
              Select subject components (Theory &amp; Lab):
            </p>
            {subjects.length > 1 && (
              <button type="button" style={selectAllBtn} onClick={handleSelectAll}>
                {selectedIds.length === subjects.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {subjects.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b' }}>
              <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>📚</span>
              No subjects registered for this department and year yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
              {subjectGroups.map(sg => {
                const isCollapsed = !!collapsedSubjects[sg.name]
                const compIds = sg.components.map(c => c.definition_id)
                const selectedInSubject = compIds.filter(id => selectedIds.includes(id))
                const isAllSelected = compIds.length > 0 && selectedInSubject.length === compIds.length
                const isSomeSelected = selectedInSubject.length > 0 && !isAllSelected

                const hasTheory = sg.components.some(c => (c.subject_type || '').toLowerCase() === 'theory')
                const hasLab = sg.components.some(c => (c.subject_type || '').toLowerCase() === 'lab')

                return (
                  <div
                    key={sg.name}
                    style={{
                      border: `1.5px solid ${selectedInSubject.length > 0 ? '#7c3aed' : '#e2e8f0'}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#fff',
                      boxShadow: !isCollapsed ? '0 3px 10px rgba(124, 58, 237, 0.06)' : 'none',
                      transition: 'all .2s ease',
                    }}
                  >
                    {/* Subject Dropdown Header Row */}
                    <div
                      onClick={() => toggleSubjectDropdown(sg.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: !isCollapsed || selectedInSubject.length > 0 ? '#faf5ff' : '#fff',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'background .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        {/* Checkbox to toggle all components for this subject */}
                        <div
                          onClick={e => toggleAllForSubject(sg.components, e)}
                          title={isAllSelected ? 'Deselect all' : 'Select all components'}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            border: `2px solid ${isAllSelected || isSomeSelected ? '#7c3aed' : '#cbd5e1'}`,
                            background: isAllSelected ? '#7c3aed' : isSomeSelected ? '#ede9fe' : '#fff',
                            color: isAllSelected ? '#fff' : '#7c3aed',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all .15s',
                          }}
                        >
                          {isAllSelected ? '✓' : isSomeSelected ? '–' : ''}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                              {sg.name}
                            </span>
                            {/* Badges showing available components */}
                            {hasTheory && (
                              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
                                📖 Theory
                              </span>
                            )}
                            {hasLab && (
                              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                                🧪 Lab
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {sg.components.length} component{sg.components.length !== 1 ? 's' : ''} available
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Selected summary badge */}
                        {selectedInSubject.length > 0 && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#15803d',
                            background: '#dcfce7',
                            padding: '2px 8px',
                            borderRadius: 999,
                          }}>
                            {isAllSelected && sg.components.length > 1
                              ? 'Theory + Lab'
                              : `${selectedInSubject.length} selected`}
                          </span>
                        )}

                        {/* Chevron */}
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#7c3aed"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transform: !isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform .2s ease',
                          }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Components (Theory & Lab grouped together) */}
                    {!isCollapsed && (
                      <div style={{
                        padding: '10px 14px 14px',
                        background: '#faf5ff',
                        borderTop: '1px solid #f3e8ff',
                        display: 'grid',
                        gap: 8,
                      }}>
                        {sg.components.map(c => {
                          const isSelected = selectedIds.includes(c.definition_id)
                          const isLab = (c.subject_type || '').toLowerCase() === 'lab'
                          return (
                            <button
                              key={c.definition_id}
                              type="button"
                              onClick={() => toggleComponent(c.definition_id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                border: `1.5px solid ${isSelected ? '#7c3aed' : '#cbd5e1'}`,
                                borderRadius: 9,
                                background: '#fff',
                                boxShadow: isSelected ? '0 1px 4px rgba(124, 58, 237, 0.12)' : 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                transition: 'all .15s',
                              }}
                            >
                              <div style={{
                                width: 18,
                                height: 18,
                                borderRadius: 5,
                                border: `2px solid ${isSelected ? '#7c3aed' : '#cbd5e1'}`,
                                background: isSelected ? '#7c3aed' : '#fff',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'all .15s',
                              }}>
                                {isSelected ? '✓' : ''}
                              </div>

                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{
                                    fontSize: 13,
                                    fontWeight: isSelected ? 700 : 600,
                                    color: isSelected ? '#5b21b6' : '#1e293b'
                                  }}>
                                    {isLab ? '🧪 Lab Component' : '📖 Theory Component'}
                                  </span>
                                  <span style={typeBadge(isLab)}>
                                    {isLab ? 'Lab' : 'Theory'}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                  {c.periods_per_week} periods / week
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {selectedIds.length > 0 && (
            <div style={selectionSummary}>
              ✓ {selectedIds.length} component{selectedIds.length > 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={modalFooter}>
          <div style={{ flex: 1 }} />
          <button style={cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={confirmBtn(canConfirm)}
            onClick={() => { if (canConfirm) onConfirm(selectedIds) }}
            disabled={!canConfirm}
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  )
}

const AVATAR_PALETTES = [
  { bg: '#4f46e5', color: '#ffffff' }, // Royal Blue (SS)
  { bg: '#f5d0fe', color: '#86198f' }, // Magenta / Pink (DP)
  { bg: '#fed7aa', color: '#9a3412' }, // Warm Amber / Tan (SV)
  { bg: '#bbf7d0', color: '#166534' }, // Mint Green (PD)
  { bg: '#bae6fd', color: '#0369a1' }, // Sky Blue
  { bg: '#e9d5ff', color: '#6b21a8' }, // Purple
  { bg: '#fecdd3', color: '#9f1239' }, // Coral
]

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  if ((parts[0].toLowerCase() === 'prof.' || parts[0].toLowerCase() === 'dr.') && parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getAvatarStyle(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length]
}

function groupTeacherAssignmentsBySubject(teacherAssignments) {
  const subjectMap = new Map()
  teacherAssignments.forEach(a => {
    const subjectKey = `${a.subject_name.trim().toLowerCase()}__${a.department}__${a.year_of_study}`
    if (!subjectMap.has(subjectKey)) {
      subjectMap.set(subjectKey, {
        key: subjectKey,
        subjectName: a.subject_name.trim(),
        department: a.department,
        yearOfStudy: a.year_of_study,
        divisionsMap: new Map(),
        allAssignments: []
      })
    }
    const sg = subjectMap.get(subjectKey)
    sg.allAssignments.push(a)

    const divKey = a.division_id ?? a.division_name
    if (!sg.divisionsMap.has(divKey)) {
      sg.divisionsMap.set(divKey, {
        divisionId: a.division_id,
        divisionName: a.division_name,
        theoryAssignment: null,
        labAssignment: null
      })
    }
    const divEntry = sg.divisionsMap.get(divKey)
    const isLab = (a.subject_type || '').toLowerCase() === 'lab'
    if (isLab) {
      divEntry.labAssignment = a
    } else {
      divEntry.theoryAssignment = a
    }
  })

  return Array.from(subjectMap.values()).map(sg => ({
    ...sg,
    divisions: Array.from(sg.divisionsMap.values()).sort((a, b) =>
      a.divisionName.localeCompare(b.divisionName)
    ),
    hasTheory: sg.allAssignments.some(a => (a.subject_type || '').toLowerCase() === 'theory'),
    hasLab: sg.allAssignments.some(a => (a.subject_type || '').toLowerCase() === 'lab'),
  }))
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function FacultyAssignments() {
  const [teachers, setTeachers] = useState([])
  const [groups, setGroups] = useState([])
  const [assignments, setAssignments] = useState([])

  // teacher form
  const [name, setName] = useState('')
  const [max, setMax] = useState(6)

  // assignment form
  const [teacherId, setTeacherId] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)     // group object
  const [divisionIds, setDivisionIds] = useState([])            // chosen division IDs
  const [definitionIds, setDefinitionIds] = useState([])        // chosen subject definition IDs (array)

  // current assignments list search & filter
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [collapsedFaculty, setCollapsedFaculty] = useState({})
  const [collapsedSubjectsInTeacher, setCollapsedSubjectsInTeacher] = useState({})

  const [showPicker, setShowPicker] = useState(false)
  const [showSubjectPicker, setShowSubjectPicker] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
      if (!err.response) {
        setError('Cannot connect to backend server. Make sure it is running on http://localhost:8000.')
      } else {
        setError('Could not load faculty or assignments.')
      }
    }
  }
  useEffect(() => { load() }, [])

  function handlePickerConfirm({ group, divisionIds: ids }) {
    setSelectedGroup(group)
    setDivisionIds(ids)
    setDefinitionIds([]) // reset subjects when group changes
    setShowPicker(false)
  }

  function handleSubjectConfirm(ids) {
    setDefinitionIds(ids)
    setShowSubjectPicker(false)
  }

  // label for the group trigger button
  const pickerLabel = useMemo(() => {
    if (!selectedGroup) return 'Choose Department · Year · Division'
    const divNames = selectedGroup.divisions.filter(d => divisionIds.includes(d.division_id)).map(d => d.division_name).join(', ')
    return `${selectedGroup.department} · ${yearLabel(selectedGroup.year_of_study)} · Div ${divNames || 'None'}`
  }, [selectedGroup, divisionIds])

  // label for the subject trigger button
  const subjectPickerLabel = useMemo(() => {
    if (!selectedGroup) return 'Select Department & Year first'
    if (definitionIds.length === 0) return 'Choose Subject(s)...'

    const selectedDefs = (selectedGroup.subjects || []).filter(s => definitionIds.includes(s.definition_id))
    const subjectMap = new Map()
    selectedDefs.forEach(s => {
      const name = s.subject_name.trim()
      if (!subjectMap.has(name)) subjectMap.set(name, [])
      subjectMap.get(name).push((s.subject_type || '').toLowerCase() === 'lab' ? 'Lab' : 'Theory')
    })

    const labels = Array.from(subjectMap.entries()).map(([name, types]) => {
      const typeStr = types.sort((a, b) => a === 'Theory' ? -1 : 1).join(' + ')
      return `${name} (${typeStr})`
    })

    if (labels.length <= 2) return labels.join(', ')
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`
  }, [selectedGroup, definitionIds])

  function toggleFacultyCollapse(key) {
    setCollapsedFaculty(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  function toggleSubjectCollapseInTeacher(key) {
    setCollapsedSubjectsInTeacher(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Unique departments for filter dropdown
  const departmentsList = useMemo(() => {
    return [...new Set(assignments.map(a => a.department))].filter(Boolean).sort()
  }, [assignments])

  // Filtered assignments based on search and department
  const filteredAssignments = useMemo(() => {
    let list = assignments
    if (departmentFilter !== 'all') {
      list = list.filter(a => a.department === departmentFilter)
    }
    if (assignmentSearch.trim()) {
      const q = assignmentSearch.trim().toLowerCase()
      list = list.filter(a =>
        (a.teacher_name && a.teacher_name.toLowerCase().includes(q)) ||
        (a.subject_name && a.subject_name.toLowerCase().includes(q)) ||
        (a.department && a.department.toLowerCase().includes(q)) ||
        (a.division_name && a.division_name.toLowerCase().includes(q))
      )
    }
    return list
  }, [assignments, departmentFilter, assignmentSearch])

  // Group assignments by faculty
  const facultyGroups = useMemo(() => {
    const map = new Map()
    filteredAssignments.forEach(a => {
      const key = a.teacher_id ?? a.teacher_name
      if (!map.has(key)) {
        map.set(key, {
          key,
          teacherId: a.teacher_id,
          teacherName: a.teacher_name,
          assignments: []
        })
      }
      map.get(key).assignments.push(a)
    })
    return Array.from(map.values())
  }, [filteredAssignments])

  async function addTeacher(e) {
    e.preventDefault(); setMessage(''); setError('')
    if (!name.trim()) { setError('Teacher name is required.'); return }
    try {
      await axios.post(`${BASE}/teachers`, { teacher_name: name.trim(), max_periods_per_day: Number(max) })
      setMessage(`${name.trim()} added.`); setName(''); setMax(6); await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : !err.response ? 'Cannot connect to backend server. Make sure it is running.' : 'Could not add teacher.')
    }
  }

  async function addAssignment(e) {
    e.preventDefault(); setMessage(''); setError('')
    if (!teacherId || !definitionIds.length || !divisionIds.length) {
      setError('Select teacher, department/year/divisions, and at least one subject.')
      return
    }
    try {
      const r = await axios.post(`${BASE}/teaching-assignments`, {
        teacher_id: Number(teacherId),
        definition_ids: definitionIds.map(Number),
        division_ids: divisionIds.map(Number),
      })
      setMessage(r.data.message)
      setDivisionIds([])
      setSelectedGroup(null)
      setDefinitionIds([])
      await load()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg || JSON.stringify(d)).join(', '))
      } else if (!err.response) {
        setError('Cannot connect to backend server. Make sure it is running on port 8000.')
      } else {
        setError('Could not save assignment.')
      }
    }
  }

  async function remove(id) {
    try { await axios.delete(`${BASE}/teaching-assignments/${id}`); await load() }
    catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Could not delete assignment.')
    }
  }

  return (
    <div style={page}>
      {showPicker && (
        <GroupPickerModal
          groups={groups}
          initialGroup={selectedGroup}
          initialDivisionIds={divisionIds}
          onConfirm={handlePickerConfirm}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showSubjectPicker && selectedGroup && (
        <SubjectPickerModal
          group={selectedGroup}
          selectedDefinitionIds={definitionIds}
          onConfirm={handleSubjectConfirm}
          onClose={() => setShowSubjectPicker(false)}
        />
      )}

      <section style={hero}>
        <div style={eyebrow}>STEP 3 · FACULTY &amp; ASSIGNMENTS</div>
        <h1 style={title}>Faculty &amp; Assignments</h1>
        <p style={sub}>Add each teacher once with their daily maximum. Then assign that global teacher to subjects and specific divisions.</p>
      </section>

      {/* 1. Add faculty */}
      <section style={card}>
        <h2 style={h2}>1. Add faculty</h2>
        <form onSubmit={addTeacher} style={grid}>
          <Field label="Teacher name">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Prof. Sharma" style={inp} />
          </Field>
          <Field label="Max periods / day">
            <input type="number" min="1" max="8" value={max} onChange={e => setMax(e.target.value)} style={inp} />
          </Field>
          <button style={{ ...button, alignSelf: 'end', marginTop: 14 }}>Add Teacher</button>
        </form>
        <div style={teacherList}>
          {teachers.map(t => (
            <div key={t.teacher_id} style={teacherCard}>
              <b>{t.teacher_name}</b>
              <span>{t.max_periods_per_day} max/day</span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Add assignment */}
      <section style={card}>
        <h2 style={h2}>2. Add teaching assignment</h2>

        <div style={twoCol}>
          {/* Teacher picker */}
          <Field label="Teacher">
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} style={inp}>
              <option value="">Select teacher</option>
              {teachers.map(t => (
                <option key={t.teacher_id} value={t.teacher_id}>{t.teacher_name} · max {t.max_periods_per_day}/day</option>
              ))}
            </select>
          </Field>

          {/* Department · Year · Divisions trigger */}
          <Field label="Department · Year · Divisions">
            <button
              type="button"
              style={pickerTrigger(!!selectedGroup)}
              onClick={() => setShowPicker(true)}
            >
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pickerLabel}
              </span>
              <span style={pickerArrow}>›</span>
            </button>
          </Field>
        </div>

        {/* Subject Popup Trigger */}
        <div style={{ marginTop: 6 }}>
          <Field label="Subject(s)">
            <button
              type="button"
              style={pickerTrigger(definitionIds.length > 0, !selectedGroup)}
              onClick={() => {
                if (!selectedGroup) {
                  setError('Please select Department · Year · Divisions first.')
                  setShowPicker(true)
                  return
                }
                setShowSubjectPicker(true)
              }}
            >
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {subjectPickerLabel}
              </span>
              <span style={pickerArrow}>›</span>
            </button>
          </Field>
        </div>

        <button onClick={addAssignment} style={{ ...button, marginTop: 20 }}>Add Assignment</button>
      </section>

      {message && <div style={successBox}>{message}</div>}
      {error   && <div style={errorBox}>{error}</div>}

      {/* 3. Current assignments */}
      <section style={{ ...card, padding: '26px 28px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={docIconBox}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                Current Assignments
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>
                View and manage all faculty-subject assignments.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: 280 }}>
              <svg
                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={assignmentSearch}
                onChange={e => setAssignmentSearch(e.target.value)}
                placeholder="Search by faculty, subject or department..."
                style={searchInputStyle}
              />
              {assignmentSearch && (
                <button
                  type="button"
                  onClick={() => setAssignmentSearch('')}
                  style={clearSearchBtn}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              style={deptSelectStyle}
            >
              <option value="all">All Departments</option>
              {departmentsList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content list */}
        {assignments.length === 0 ? (
          <div style={emptyStateBox}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📋</span>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 500 }}>No assignments yet.</p>
          </div>
        ) : facultyGroups.length === 0 ? (
          <div style={emptyStateBox}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>🔍</span>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 500 }}>No assignments match your search or filter.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {facultyGroups.map(group => {
              const isCollapsed = !!collapsedFaculty[group.key]
              const avatarStyle = getAvatarStyle(group.teacherName)
              const initials = getInitials(group.teacherName)

              return (
                <div key={group.key} style={facultyCardContainer}>
                  {/* Faculty Card Header */}
                  <div
                    style={facultyCardHeader(isCollapsed)}
                    onClick={() => toggleFacultyCollapse(group.key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ ...avatarCircle, background: avatarStyle.bg, color: avatarStyle.color }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                          {group.teacherName}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {group.assignments.length} assignment{group.assignments.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      style={chevronButton}
                      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      <svg
                        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        style={{
                          transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform .2s ease'
                        }}
                      >
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                  </div>

                  {/* Subject Dropdowns grouping Theory & Lab together */}
                  {!isCollapsed && (
                    <div style={{ padding: '14px 16px 16px', display: 'grid', gap: 10, background: '#f8fafc' }}>
                      {groupTeacherAssignmentsBySubject(group.assignments).map((sg, sIdx) => {
                        const isSubCollapsed = collapsedSubjectsInTeacher[sg.key] === true
                        return (
                          <div
                            key={sg.key}
                            style={{
                              border: '1.5px solid #e2e8f0',
                              borderRadius: 12,
                              overflow: 'hidden',
                              background: '#fff',
                              boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                            }}
                          >
                            {/* Subject Dropdown Bar */}
                            <div
                              onClick={() => toggleSubjectCollapseInTeacher(sg.key)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: !isSubCollapsed ? '#faf5ff' : '#fff',
                                cursor: 'pointer',
                                userSelect: 'none',
                                borderBottom: !isSubCollapsed ? '1px solid #f3e8ff' : 'none',
                                transition: 'background .15s',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 16 }}>📘</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                                  {sg.subjectName}
                                </span>
                                <span style={{ fontSize: 12, color: '#64748b' }}>
                                  · {sg.department} – {yearLabel(sg.yearOfStudy)}
                                </span>
                                {sg.hasTheory && (
                                  <span style={typePill(false)}>
                                    Theory
                                  </span>
                                )}
                                {sg.hasLab && (
                                  <span style={typePill(true)}>
                                    Lab
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: '#6d28d9',
                                  background: '#ede9fe',
                                  padding: '3px 9px',
                                  borderRadius: 999,
                                }}>
                                  {sg.divisions.length} division{sg.divisions.length !== 1 ? 's' : ''} ({sg.divisions.map(d => d.divisionName).join(', ')})
                                </span>
                                <svg
                                  width="17"
                                  height="17"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#7c3aed"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{
                                    transform: !isSubCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform .2s ease'
                                  }}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </div>
                            </div>

                            {/* Dropdown Content: Divisions with Theory & Lab grouped */}
                            {!isSubCollapsed && (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={assignmentsTable}>
                                  <thead>
                                    <tr style={tableHeaderRow}>
                                      <th style={{ ...thCell, width: '44px' }}>#</th>
                                      <th style={{ ...thCell, width: '130px' }}>Division</th>
                                      <th style={thCell}>Components</th>
                                      <th style={{ ...thCell, textAlign: 'center', width: '220px' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sg.divisions.map((div, dIdx) => (
                                      <tr key={div.divisionId} style={tableBodyRow}>
                                        <td style={{ ...tdCell, color: '#64748b', fontWeight: 500 }}>
                                          {dIdx + 1}
                                        </td>
                                        <td style={tdCell}>
                                          <span style={divisionPill}>
                                            Div {div.divisionName}
                                          </span>
                                        </td>
                                        <td style={tdCell}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {div.theoryAssignment && (
                                              <span style={typePill(false)}>
                                                Theory
                                              </span>
                                            )}
                                            {div.labAssignment && (
                                              <span style={typePill(true)}>
                                                Lab
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td style={{ ...tdCell, textAlign: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                            {div.theoryAssignment && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  remove(div.theoryAssignment.assignment_id)
                                                }}
                                                style={actionRemoveBtn}
                                                title="Remove Theory assignment"
                                              >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <polyline points="3 6 5 6 21 6" />
                                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                                <span>{div.labAssignment ? 'Theory' : 'Remove'}</span>
                                              </button>
                                            )}
                                            {div.labAssignment && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  remove(div.labAssignment.assignment_id)
                                                }}
                                                style={actionRemoveBtn}
                                                title="Remove Lab assignment"
                                              >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <polyline points="3 6 5 6 21 6" />
                                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                                <span>{div.theoryAssignment ? 'Lab' : 'Remove'}</span>
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Bottom Summary Badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
              <div style={summaryBadge}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>
                  {facultyGroups.length} Faculty Member{facultyGroups.length !== 1 ? 's' : ''} • {filteredAssignments.length} Assignment{filteredAssignments.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 7, marginTop: 14 }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const page        = { padding: '34px 38px', maxWidth: 1100, margin: '0 auto' }
const hero        = { padding: '28px 30px', borderRadius: 18, background: 'linear-gradient(135deg,#eef5ff,#f7f4ff)', border: '1px solid #dbe5f5', marginBottom: 20 }
const eyebrow     = { fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#4f46e5' }
const title       = { fontSize: 32, margin: '8px 0 6px', color: '#172554' }
const sub         = { margin: 0, color: '#64748b', fontSize: 15, lineHeight: 1.6 }
const card        = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: '0 5px 20px rgba(15,23,42,.04)' }
const h2          = { fontSize: 19, color: '#172554', margin: '0 0 14px' }
const grid        = { display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 14, alignItems: 'end' }
const twoCol      = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
const inp         = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: 9, fontSize: 14, background: '#fff' }
const button      = { padding: '11px 17px', border: 0, borderRadius: 9, background: 'linear-gradient(90deg,#2563eb,#6d28d9)', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const fieldLabel  = { fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: '#64748b', display: 'block', marginTop: 4 }
const teacherList = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 20 }
const teacherCard = { padding: 11, border: '1px solid #e2e8f0', borderRadius: 9, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }
const assignmentRow = { display: 'grid', gridTemplateColumns: '1.4fr 1.4fr auto', gap: 10, alignItems: 'center', padding: 13, border: '1px solid #e2e8f0', borderRadius: 10 }
const deleteBtn   = { border: 0, background: '#fee2e2', color: '#b91c1c', padding: '7px 10px', borderRadius: 7, cursor: 'pointer' }
const muted       = { color: '#64748b', fontSize: 12 }
const successBox  = { padding: 12, borderRadius: 9, background: '#ecfdf5', color: '#047857', marginBottom: 16 }
const errorBox    = { padding: 12, borderRadius: 9, background: '#fef2f2', color: '#b91c1c', marginBottom: 16 }

const pickerTrigger = (active, disabled = false) => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
  padding: '11px 12px', border: `1.5px solid ${active ? '#6d28d9' : '#cbd5e1'}`,
  borderRadius: 9, fontSize: 14,
  background: disabled ? '#f8fafc' : active ? '#faf5ff' : '#fff',
  color: disabled ? '#94a3b8' : active ? '#4c1d95' : '#64748b',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: active ? 600 : 400,
  transition: 'all .15s',
})
const pickerArrow = { fontSize: 18, color: '#94a3b8', marginLeft: 'auto' }

/* ─── Modal styles ───────────────────────────────────────────────────── */
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
}
const modal = {
  background: '#fff', borderRadius: 20, width: 480, maxWidth: '92vw',
  boxShadow: '0 24px 80px rgba(15,23,42,.18)', overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
}
const modalHeader = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  padding: '22px 24px 0',
}
const modalEyebrow = { fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#6d28d9', marginBottom: 4 }
const modalTitle   = { fontSize: 20, fontWeight: 700, color: '#172554' }
const closeBtn     = { border: 0, background: 'transparent', fontSize: 18, color: '#94a3b8', cursor: 'pointer', lineHeight: 1, padding: 4 }

const stepRow = { display: 'flex', alignItems: 'center', gap: 0, padding: '18px 24px 0', position: 'relative' }
const stepLine = { position: 'absolute', top: 27, left: 44, right: 44, height: 2, background: '#e2e8f0', zIndex: 0 }
const stepDot = active => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, position: 'relative', zIndex: 1 })
const stepDotInner = (done, active) => ({
  width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, fontWeight: 700,
  background: done ? '#6d28d9' : active ? '#ede9fe' : '#f1f5f9',
  color: done ? '#fff' : active ? '#6d28d9' : '#94a3b8',
  border: active ? '2px solid #6d28d9' : '2px solid transparent',
  transition: 'all .2s',
})
const stepDotLabel = active => ({ fontSize: 10, fontWeight: 700, color: active ? '#6d28d9' : '#94a3b8', letterSpacing: '.05em' })

const stepContent = { padding: '16px 24px 8px', minHeight: 180 }
const stepHint = { fontSize: 13, color: '#64748b', marginTop: 0, marginBottom: 14 }

const optionGrid = { display: 'grid', gap: 8 }
const optionBtn = active => ({
  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
  border: `1.5px solid ${active ? '#6d28d9' : '#e2e8f0'}`,
  borderRadius: 12, background: active ? '#faf5ff' : '#fff',
  cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
})
const optionIcon = { fontSize: 20 }
const optionText = { fontSize: 14, fontWeight: 600, color: '#1e293b', flex: 1 }
const optionMeta = { fontSize: 11, color: '#94a3b8' }

const divGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }
const divBtn = active => ({
  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
  border: `1.5px solid ${active ? '#6d28d9' : '#e2e8f0'}`,
  borderRadius: 12, background: active ? '#faf5ff' : '#fff',
  cursor: 'pointer', transition: 'all .15s',
})
const divCheck = active => ({
  width: 20, height: 20, borderRadius: 6, border: `2px solid ${active ? '#6d28d9' : '#cbd5e1'}`,
  background: active ? '#6d28d9' : '#fff', color: '#fff', fontSize: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s',
})
const divLabel = active => ({ fontSize: 14, fontWeight: active ? 700 : 500, color: active ? '#4c1d95' : '#374151' })

const selectAllBtn = {
  background: 'none', border: 'none', color: '#6d28d9', fontSize: 12,
  fontWeight: 600, cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline',
}

const subjectOptionCard = active => ({
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
  border: `1.5px solid ${active ? '#6d28d9' : '#e2e8f0'}`,
  borderRadius: 12, background: active ? '#faf5ff' : '#fff',
  cursor: 'pointer', textAlign: 'left', transition: 'all .15s', width: '100%',
})
const subjectCardTitle = active => ({
  fontSize: 14, fontWeight: active ? 700 : 600, color: active ? '#4c1d95' : '#1e293b',
})
const typeBadge = isLab => ({
  fontSize: 11, padding: '2px 8px', borderRadius: 999,
  background: isLab ? '#fef3c7' : '#e0e7ff',
  color: isLab ? '#92400e' : '#3730a3',
  fontWeight: 600,
})

const selectionSummary = {
  marginTop: 14, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8,
  fontSize: 13, color: '#15803d', fontWeight: 600,
}

const modalFooter = { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px 20px', borderTop: '1px solid #f1f5f9' }
const backBtn    = { padding: '9px 15px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b' }
const cancelBtn  = { padding: '9px 15px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b' }
const confirmBtn = ok => ({
  padding: '9px 18px', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: ok ? 'pointer' : 'not-allowed',
  background: ok ? 'linear-gradient(90deg,#2563eb,#6d28d9)' : '#e2e8f0',
  color: ok ? '#fff' : '#94a3b8', transition: 'all .15s',
})

/* ─── Current Assignments Redesign Styles ────────────────────────────── */
const docIconBox = {
  width: 42,
  height: 42,
  borderRadius: 11,
  background: '#eff6ff',
  border: '1px solid #dbeafe',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const searchInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 30px 9px 36px',
  borderRadius: 9,
  border: '1px solid #e2e8f0',
  fontSize: 13,
  background: '#fff',
  color: '#0f172a',
  outline: 'none',
}

const clearSearchBtn = {
  position: 'absolute',
  right: 9,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  fontSize: 12,
  color: '#94a3b8',
  cursor: 'pointer',
  padding: 4,
  lineHeight: 1,
}

const deptSelectStyle = {
  padding: '9px 32px 9px 13px',
  borderRadius: 9,
  border: '1px solid #e2e8f0',
  fontSize: 13,
  background: '#fff',
  color: '#0f172a',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 15 5 5 5-5'/%3E%3Cpath d='m7 9 5-5 5 5'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 11px center',
  fontWeight: 500,
}

const emptyStateBox = {
  textAlign: 'center',
  padding: '48px 20px',
  background: '#f8fafc',
  borderRadius: 14,
  border: '1px dashed #cbd5e1',
}

const facultyCardContainer = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  overflow: 'hidden',
  background: '#fff',
  boxShadow: '0 1px 3px rgba(15,23,42,.03)',
  transition: 'box-shadow .15s',
}

const facultyCardHeader = isCollapsed => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  cursor: 'pointer',
  background: '#fff',
  borderBottom: isCollapsed ? 'none' : '1px solid #f1f5f9',
  transition: 'background .15s',
  userSelect: 'none',
})

const avatarCircle = {
  width: 38,
  height: 38,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '.02em',
  flexShrink: 0,
}

const chevronButton = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
}

const assignmentsTable = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  fontSize: 13,
}

const tableHeaderRow = {
  background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
}

const thCell = {
  padding: '11px 18px',
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '.02em',
}

const tableBodyRow = {
  borderBottom: '1px solid #f1f5f9',
  transition: 'background .15s',
}

const tdCell = {
  padding: '13px 18px',
  verticalAlign: 'middle',
  fontSize: 13,
}

const divisionPill = {
  display: 'inline-block',
  background: '#eff6ff',
  color: '#2563eb',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
}

const typePill = isLab => ({
  display: 'inline-block',
  background: isLab ? '#ede9fe' : '#dcfce7',
  color: isLab ? '#7c3aed' : '#16a34a',
  padding: '4px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
})

const actionRemoveBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  border: '1px solid #fee2e2',
  background: '#fef2f2',
  color: '#ef4444',
  padding: '5px 12px',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all .15s',
}

const summaryBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 22px',
  borderRadius: 999,
  background: '#eff6ff',
  border: '1px solid #dbeafe',
  color: '#2563eb',
  fontSize: 13,
  fontWeight: 600,
}

