import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import * as S from '../styles/formStyles'
import SubjectTypeBadge from './SubjectTypeBadge'
import ConfirmModal from './ConfirmModal'

const BASE = 'http://localhost:8000'

// =========================================================
// TYPE ICON (Theory / Laboratory)
// =========================================================

function TypeIcon({ type, size = 22 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (type === 'lab') {
    return (
      <svg {...common}>
        <path d="M9 3h6" />
        <path d="M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3" />
        <path d="M7.2 16h9.6" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  )
}

export default function TeacherSubjectForm() {
  // =========================================================
  // DATA
  // =========================================================

  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [links, setLinks] = useState([])

  // =========================================================
  // MAIN FORM STATE
  // =========================================================

  const [selectedClass, setSelectedClass] = useState('')
  const [assignmentType, setAssignmentType] = useState('theory')

  // Multiple teachers -> ONE subject
  const [selectedTeachers, setSelectedTeachers] = useState([])
  const [selectedSubject, setSelectedSubject] = useState('')

  // =========================================================
  // TEACHER DROPDOWN
  // =========================================================

  const [teacherSearch, setTeacherSearch] = useState('')
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false)
  const teacherDropdownRef = useRef(null)

  // =========================================================
  // SUBJECT DROPDOWN
  // =========================================================

  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false)
  const subjectDropdownRef = useRef(null)

  // =========================================================
  // DIRECTORY
  // =========================================================

  const [directoryFilter, setDirectoryFilter] = useState('all')
  const [directorySearch, setDirectorySearch] = useState('')

  // =========================================================
  // EDIT ASSIGNMENT (reassign teacher on an existing link)
  // =========================================================

  const [editTarget, setEditTarget] = useState(null)
  const [editTeacherId, setEditTeacherId] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // =========================================================
  // DELETE ASSIGNMENT
  // =========================================================

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // =========================================================
  // UI STATE
  // =========================================================

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    fetchAll()
  }, [])

  // =========================================================
  // CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
  // =========================================================

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        teacherDropdownRef.current &&
        !teacherDropdownRef.current.contains(event.target)
      ) {
        setTeacherDropdownOpen(false)
      }

      if (
        subjectDropdownRef.current &&
        !subjectDropdownRef.current.contains(event.target)
      ) {
        setSubjectDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // =========================================================
  // FETCH DATA
  // =========================================================

  async function fetchAll() {
    try {
      const [
        classesResponse,
        teachersResponse,
        subjectsResponse,
        linksResponse,
      ] = await Promise.all([
        axios.get(`${BASE}/classes`),
        axios.get(`${BASE}/teachers`),
        axios.get(`${BASE}/subjects`),
        axios.get(`${BASE}/teacher-subjects`),
      ])

      setClasses(classesResponse.data)
      setTeachers(teachersResponse.data)
      setSubjects(subjectsResponse.data)
      setLinks(linksResponse.data)
    } catch (err) {
      console.error(err)

      setError(
        'Could not load data. Make sure the backend is running.'
      )
    }
  }

  // =========================================================
  // CLASS SWITCH
  // =========================================================

  function handleClassSwitch(classId) {
    setSelectedClass(String(classId))

    // Class change invalidates both selections.
    setSelectedTeachers([])
    setSelectedSubject('')
    setSubjectSearch('')
    setSubjectDropdownOpen(false)

    setMessage('')
    setError('')
  }

  // =========================================================
  // ASSIGNMENT TYPE SWITCH
  // =========================================================

  function handleAssignmentTypeChange(type) {
    setAssignmentType(type)

    // Subject must be reselected because type changed.
    setSelectedSubject('')
    setSubjectSearch('')
    setSubjectDropdownOpen(false)

    setMessage('')
    setError('')
  }

  // =========================================================
  // TEACHER SELECTION
  // =========================================================

  function toggleTeacher(teacherId) {
    const id = String(teacherId)

    setSelectedTeachers(prev => {
      if (prev.includes(id)) {
        return prev.filter(existingId => existingId !== id)
      }

      return [...prev, id]
    })

    setMessage('')
    setError('')
  }

  function clearTeachers() {
    setSelectedTeachers([])
    setMessage('')
    setError('')
  }

  function selectAllTeachers() {
    setSelectedTeachers(
      filteredTeachers.map(teacher => String(teacher.teacher_id))
    )

    setMessage('')
    setError('')
  }

  // =========================================================
  // SUBJECT SELECTION
  // =========================================================

  function handleSubjectSelect(subjectId) {
    setSelectedSubject(String(subjectId))
    setSubjectDropdownOpen(false)
    setSubjectSearch('')

    setMessage('')
    setError('')
  }

  // =========================================================
  // SUBMIT
  //
  // MULTIPLE TEACHERS -> ONE SUBJECT
  // =========================================================

  async function handleSubmit(e) {
    e.preventDefault()

    setMessage('')
    setError('')

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

    if (!selectedClass) {
      setError('Please select a class first.')
      return
    }

    if (selectedTeachers.length === 0) {
      setError('Please select at least one teacher.')
      return
    }

    if (!selectedSubject) {
      setError('Please select one subject.')
      return
    }

    const subjectId = parseInt(selectedSubject)

    const subject = subjects.find(
      s => s.subject_id === subjectId
    )

    if (!subject) {
      setError('Selected subject could not be found.')
      return
    }

    // Safety validation:
    // selected subject MUST belong to selected class.
    if (subject.class_id !== parseInt(selectedClass)) {
      setError(
        'The selected subject does not belong to the selected class.'
      )
      return
    }

    // Safety validation:
    // subject type must match current assignment type.
    if (subject.subject_type !== assignmentType) {
      setError(
        'The selected subject type does not match the assignment type.'
      )
      return
    }

    setSaving(true)

    try {
      let successCount = 0
      let duplicateCount = 0
      let failedCount = 0

      // -----------------------------------------------------
      // CREATE ONE LINK FOR EACH SELECTED TEACHER
      // -----------------------------------------------------

      for (const teacherId of selectedTeachers) {
        try {
          await axios.post(
            `${BASE}/teacher-subjects`,
            {
              teacher_id: parseInt(teacherId),
              subject_id: subjectId,
            }
          )

          successCount++
        } catch (err) {
          const status = err.response?.status

          const detail =
            err.response?.data?.detail || ''

          const detailText =
            String(detail).toLowerCase()

          // Duplicate assignment
          if (
            status === 400 ||
            status === 409 ||
            detailText.includes('already') ||
            detailText.includes('duplicate') ||
            detailText.includes('exists')
          ) {
            duplicateCount++
          } else {
            failedCount++
          }

          console.error(
            `Failed to assign teacher ${teacherId} to subject ${subjectId}:`,
            err
          )
        }
      }

      // -----------------------------------------------------
      // RESULT MESSAGE
      // -----------------------------------------------------

      const subjectName =
        subject.subject_name || 'selected subject'

      if (successCount > 0) {
        let resultMessage =
          `${successCount} teacher` +
          `${successCount !== 1 ? 's' : ''}` +
          ` assigned to ${subjectName}.`

        if (duplicateCount > 0) {
          resultMessage +=
            ` ${duplicateCount} teacher` +
            `${duplicateCount !== 1 ? 's' : ''}` +
            ` were already assigned to this subject.`
        }

        if (failedCount > 0) {
          resultMessage +=
            ` ${failedCount} assignment` +
            `${failedCount !== 1 ? 's' : ''}` +
            ` failed.`
        }

        setMessage(resultMessage)
      } else if (duplicateCount > 0) {
        setError(
          'All selected teachers are already assigned to this subject.'
        )
      } else {
        setError(
          'Could not create the selected teacher assignments.'
        )
      }

      // Clear only teacher selection.
      // Keep subject selected so the user can easily add
      // another teacher to the same subject.
      setSelectedTeachers([])

      await fetchAll()
    } catch (err) {
      console.error(err)

      setError(
        'An unexpected error occurred while creating the assignments.'
      )
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // EDIT ASSIGNMENT (reassign to a different teacher)
  // =========================================================

  function openEditModal(link) {
    setEditTarget(link)
    setEditTeacherId(String(link.teacher_id))
    setEditError('')
  }

  function closeEditModal() {
    if (editSaving) return

    setEditTarget(null)
    setEditTeacherId('')
    setEditError('')
  }

  async function handleEditSave() {
    if (!editTarget) return

    if (!editTeacherId) {
      setEditError('Please select a teacher.')
      return
    }

    const newTeacherId = parseInt(editTeacherId)

    if (newTeacherId === editTarget.teacher_id) {
      setEditError('Select a different teacher to reassign this subject.')
      return
    }

    setEditSaving(true)
    setEditError('')

    try {
      await axios.put(
        `${BASE}/teacher-subjects/${editTarget.teacher_id}/${editTarget.subject_id}`,
        { teacher_id: newTeacherId }
      )

      setMessage('Assignment updated successfully.')
      setError('')

      setEditTarget(null)
      setEditTeacherId('')

      await fetchAll()
    } catch (err) {
      const detail = err.response?.data?.detail
      const detailText = String(detail || '').toLowerCase()

      if (
        err.response?.status === 400 ||
        err.response?.status === 409 ||
        detailText.includes('already') ||
        detailText.includes('duplicate') ||
        detailText.includes('exists')
      ) {
        setEditError('This teacher is already assigned to this subject.')
      } else {
        setEditError(detail || 'Could not update the assignment.')
      }
    } finally {
      setEditSaving(false)
    }
  }

  // =========================================================
  // DELETE ASSIGNMENT
  // =========================================================

  function promptDelete(link) {
    setDeleteTarget(link)
    setMessage('')
    setError('')
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)

    try {
      await axios.delete(
        `${BASE}/teacher-subjects/${deleteTarget.teacher_id}/${deleteTarget.subject_id}`
      )

      setMessage('Assignment deleted successfully.')
      setError('')

      await fetchAll()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not delete the assignment.'
      )
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  // =========================================================
  // FILTERED SUBJECTS
  // =========================================================

  const filteredSubjects = useMemo(() => {
    if (!selectedClass) {
      return []
    }

    return subjects.filter(subject => {
      return (
        subject.class_id === parseInt(selectedClass) &&
        subject.subject_type === assignmentType
      )
    })
  }, [
    subjects,
    selectedClass,
    assignmentType,
  ])

  // =========================================================
  // FILTERED SUBJECTS (DROPDOWN SEARCH)
  // =========================================================

  const filteredSubjectsForDropdown = useMemo(() => {
    const search = subjectSearch.trim().toLowerCase()

    if (!search) {
      return filteredSubjects
    }

    return filteredSubjects.filter(subject =>
      subject.subject_name.toLowerCase().includes(search)
    )
  }, [
    filteredSubjects,
    subjectSearch,
  ])

  // =========================================================
  // FILTERED TEACHERS
  // =========================================================

  const filteredTeachers = useMemo(() => {
    const search = teacherSearch
      .trim()
      .toLowerCase()

    if (!search) {
      return teachers
    }

    return teachers.filter(teacher =>
      teacher.teacher_name
        .toLowerCase()
        .includes(search)
    )
  }, [
    teachers,
    teacherSearch,
  ])

  // =========================================================
  // SELECTED SUBJECT
  // =========================================================

  const selectedSubjectData = useMemo(() => {
    if (!selectedSubject) {
      return null
    }

    return subjects.find(
      subject =>
        subject.subject_id ===
        parseInt(selectedSubject)
    ) || null
  }, [
    subjects,
    selectedSubject,
  ])

  // =========================================================
  // EXISTING ASSIGNMENTS FOR SELECTED SUBJECT
  // =========================================================

  const existingTeachersForSubject = useMemo(() => {
    if (!selectedSubject) {
      return []
    }

    const subjectId = parseInt(selectedSubject)

    return links
      .filter(link => link.subject_id === subjectId)
      .map(link => link.teacher_id)
  }, [
    links,
    selectedSubject,
  ])

  // =========================================================
  // DIRECTORY FILTERING
  // =========================================================

  const filteredDirectoryLinks = useMemo(() => {
    let result = [...links]

    // -------------------------------------------------------
    // CLASS FILTER
    // -------------------------------------------------------

    if (selectedClass) {
      result = result.filter(link => {
        const subject = subjects.find(
          s => s.subject_id === link.subject_id
        )

        return (
          subject &&
          subject.class_id ===
            parseInt(selectedClass)
        )
      })
    }

    // -------------------------------------------------------
    // THEORY / LAB FILTER
    // -------------------------------------------------------

    if (directoryFilter !== 'all') {
      result = result.filter(link => {
        const subject = subjects.find(
          s => s.subject_id === link.subject_id
        )

        return (
          subject?.subject_type ===
          directoryFilter
        )
      })
    }

    // -------------------------------------------------------
    // SEARCH FILTER
    // -------------------------------------------------------

    const search = directorySearch
      .trim()
      .toLowerCase()

    if (search) {
      result = result.filter(link => {
        const teacher = teachers.find(
          t =>
            t.teacher_id ===
            link.teacher_id
        )

        const subject = subjects.find(
          s =>
            s.subject_id ===
            link.subject_id
        )

        const teacherName =
          teacher?.teacher_name
            ?.toLowerCase() || ''

        const subjectName =
          subject?.subject_name
            ?.toLowerCase() || ''

        return (
          teacherName.includes(search) ||
          subjectName.includes(search)
        )
      })
    }

    return result
  }, [
    links,
    subjects,
    teachers,
    selectedClass,
    directoryFilter,
    directorySearch,
  ])

  // =========================================================
  // COUNTS
  // =========================================================

  const theoryCount = selectedClass
    ? subjects.filter(
        subject =>
          subject.class_id ===
            parseInt(selectedClass) &&
          subject.subject_type === 'theory'
      ).length
    : 0

  const labCount = selectedClass
    ? subjects.filter(
        subject =>
          subject.class_id ===
            parseInt(selectedClass) &&
          subject.subject_type === 'lab'
      ).length
    : 0

  // =========================================================
  // HELPERS
  // =========================================================

  const getClassName = id =>
    classes.find(
      c => c.class_id === id
    )?.class_name || `Class ${id}`

  const getTeacherName = id =>
    teachers.find(
      t => t.teacher_id === id
    )?.teacher_name || `Teacher ${id}`

  const getSubject = id =>
    subjects.find(
      s => s.subject_id === id
    )

  const getSubjectName = id =>
    getSubject(id)?.subject_name ||
    `Subject ${id}`

  const selectedClassName = selectedClass
    ? getClassName(parseInt(selectedClass))
    : ''

  // =========================================================
  // CAN SUBMIT
  // =========================================================

  const canSubmit =
    !!selectedClass &&
    selectedTeachers.length > 0 &&
    !!selectedSubject &&
    !saving

  // =========================================================
  // PAGE LAYOUT (full-width, matches Rooms/Classes page)
  // =========================================================

  const pageCard = {
    ...S.card,
    width: '100%',
    maxWidth: 'none',
    boxSizing: 'border-box',
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div style={pageWrap}>

      {/* ===================================================
          HERO
      =================================================== */}

      <section style={heroCard} className="ts-hero">
        <div style={heroContent}>
          <div style={heroIcon} className="hero-icon">
            <span style={heroIconGlyph}>T</span>
          </div>

          <div>
            <div style={heroEyebrow}>ACADEMIC SCHEDULING</div>
            <h1 style={heroTitle}>Teacher Subjects</h1>
            <div style={heroSubtitle}>Faculty Assignment Management</div>
            <p style={heroDescription}>
              Assign one subject to one or more faculty members.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================
          STATS
      =================================================== */}

      <section style={statsGrid}>
        <div style={statCard} className="ts-stat-card stat-blue">
          <div style={statIconBlue}>▤</div>
          <div>
            <div style={statLabel} className="stat-label">TOTAL TEACHERS</div>
            <div style={statNumberBlue} className="stat-number">{teachers.length}</div>
          </div>
          <div style={statDecorationBlue}>
            <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
              <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
              <path d="M0 30 Q 15 15, 30 25 T 60 15 T 90 20 T 120 10 L 120 40 L 0 40 Z" fill="url(#blue-gradient)" style={{ opacity: 0.15 }} />
              <defs>
                <linearGradient id="blue-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div style={statCard} className="ts-stat-card stat-green">
          <div style={statIconGreen}>✓</div>
          <div>
            <div style={statLabel} className="stat-label">TOTAL ASSIGNMENTS</div>
            <div style={statNumberGreen} className="stat-number">{links.length}</div>
          </div>
          <div style={statDecorationGreen}>
            <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
              <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.6 }} />
              <path d="M0 25 Q 20 10, 40 20 T 80 15 T 120 5 L 120 40 L 0 40 Z" fill="url(#green-gradient)" style={{ opacity: 0.15 }} />
              <defs>
                <linearGradient id="green-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div style={statCard} className="ts-stat-card stat-purple">
          <div style={statIconPurple}>◇</div>
          <div>
            <div style={statLabel} className="stat-label">SCHEDULING ROLE</div>
            <div style={statNumberPurple} className="stat-number">Teacher ↔ Subject</div>
          </div>
          <div style={statDecorationPurple}>
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

      {/* ===================================================
          MESSAGES
      =================================================== */}

      {message && !editTarget && (
        <div style={successBanner}>
          <span style={successIcon}>✓</span>
          {message}
        </div>
      )}

      {error && !editTarget && (
        <div style={errorBanner}>
          <span style={errorIcon}>!</span>
          {error}
        </div>
      )}

      {/* ===================================================
          SELECT CLASS
      =================================================== */}

      <div
        style={{
          ...pageCard,
          padding: '24px 28px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: '800',
            color: '#0F2342',
            letterSpacing: '0.4px',
            marginBottom: '6px',
          }}
        >
          SELECT CLASS
        </div>

        <div
          style={{
            fontSize: '12px',
            lineHeight: '1.5',
            color: '#64748B',
            marginBottom: '18px',
          }}
        >
          Choose the class whose subject you want to assign.
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {classes.map(cls => {
            const active =
              selectedClass ===
              String(cls.class_id)

            return (
              <button
                key={cls.class_id}
                type="button"
                onClick={() =>
                  handleClassSwitch(
                    cls.class_id
                  )
                }
                style={{
                  padding: '11px 18px',
                  minWidth: '64px',
                  borderRadius: '10px',
                  border: active
                    ? '1px solid #2563EB'
                    : '1px solid #D9E3F0',
                  background: active
                    ? '#EFF6FF'
                    : '#FFFFFF',
                  color: active
                    ? '#1D4ED8'
                    : '#475569',
                  fontSize: '12px',
                  fontWeight: active
                    ? '800'
                    : '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {cls.class_name}
              </button>
            )
          })}
        </div>
      </div>

      {/* ===================================================
          CURRENT CONTEXT
      =================================================== */}

      <div
        style={{
          width: '100%',
          minHeight: '108px',
          padding: '20px 28px',
          borderRadius: '16px',
          border: selectedClass
            ? '1px solid #BFDBFE'
            : '1px solid #D9E3F0',
          background: selectedClass
            ? '#F4F8FF'
            : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          boxSizing: 'border-box',
          marginBottom: '20px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: '800',
              letterSpacing: '1.3px',
              color: '#64748B',
              marginBottom: '6px',
            }}
          >
            CURRENTLY CONFIGURING
          </div>

          <div
            style={{
              fontSize: '19px',
              lineHeight: '1.2',
              fontWeight: '800',
              color: selectedClass
                ? '#1D4ED8'
                : '#64748B',
            }}
          >
            {selectedClass
              ? selectedClassName
              : 'No class selected'}
          </div>

          <div
            style={{
              fontSize: '11px',
              lineHeight: '1.5',
              color: '#64748B',
              marginTop: '5px',
            }}
          >
            {selectedClass
              ? 'Select multiple teachers and one subject below.'
              : 'Select a class before assigning subjects.'}
          </div>
        </div>

        {selectedClass && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                padding: '7px 11px',
                borderRadius: '20px',
                background: '#EFF6FF',
                color: '#2563EB',
                border: '1px solid #BFDBFE',
                fontSize: '11px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
              }}
            >
              {theoryCount} Theory
            </span>

            <span
              style={{
                padding: '7px 11px',
                borderRadius: '20px',
                background: '#FFFBEB',
                color: '#B45309',
                border: '1px solid #FDE68A',
                fontSize: '11px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
              }}
            >
              {labCount} Laboratory
            </span>
          </div>
        )}
      </div>

      {/* ===================================================
          ASSIGNMENT FORM
      =================================================== */}

      <div
        style={{
          ...pageCard,
          padding: '28px',
          opacity: selectedClass ? 1 : 0.6,
          boxSizing: 'border-box',
          marginBottom: '20px',
        }}
      >
        {/* FORM HEADER */}

        <div
          style={{
            marginBottom: '26px',
            paddingBottom: '18px',
            borderBottom: '1px solid #E8EEF5',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              lineHeight: '1.2',
              fontWeight: '800',
              color: '#0F2342',
            }}
          >
            Create Teacher Assignment
          </div>

          <div
            style={{
              fontSize: '12px',
              lineHeight: '1.5',
              color: '#64748B',
              marginTop: '6px',
            }}
          >
            Select multiple faculty members, then assign them to one subject.
          </div>
        </div>

        {/* =================================================
            ASSIGNMENT TYPE
        ================================================= */}

        <label style={S.label}>
          ASSIGNMENT TYPE
        </label>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '14px',
            marginTop: '8px',
            marginBottom: '26px',
          }}
        >
          {/* THEORY */}

          <button
            type="button"
            disabled={!selectedClass}
            onClick={() =>
              handleAssignmentTypeChange('theory')
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 18px',
              minHeight: '84px',
              borderRadius: '14px',
              border:
                assignmentType === 'theory'
                  ? '1.5px solid #2563EB'
                  : '1px solid #D9E3F0',
              background:
                assignmentType === 'theory'
                  ? 'linear-gradient(135deg, #EFF6FF 0%, #E0EAFF 100%)'
                  : '#FFFFFF',
              boxShadow:
                assignmentType === 'theory'
                  ? '0 8px 20px rgba(37, 99, 235, 0.14)'
                  : 'none',
              cursor: selectedClass
                ? 'pointer'
                : 'not-allowed',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                minWidth: '46px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background:
                  assignmentType === 'theory'
                    ? '#2563EB'
                    : '#EEF2F7',
                color:
                  assignmentType === 'theory'
                    ? '#FFFFFF'
                    : '#94A3B8',
                transition: 'all 0.15s ease',
              }}
            >
              <TypeIcon type="theory" />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: '800',
                  fontSize: '14px',
                  color:
                    assignmentType === 'theory'
                      ? '#1D4ED8'
                      : '#0F2342',
                }}
              >
                Theory
              </div>

              <div
                style={{
                  fontSize: '11px',
                  marginTop: '4px',
                  fontWeight: '600',
                  color:
                    assignmentType === 'theory'
                      ? '#3B6FE0'
                      : '#94A3B8',
                }}
              >
                {theoryCount} subjects
              </div>
            </div>
          </button>

          {/* LABORATORY */}

          <button
            type="button"
            disabled={!selectedClass}
            onClick={() =>
              handleAssignmentTypeChange('lab')
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 18px',
              minHeight: '84px',
              borderRadius: '14px',
              border:
                assignmentType === 'lab'
                  ? '1.5px solid #D97706'
                  : '1px solid #D9E3F0',
              background:
                assignmentType === 'lab'
                  ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)'
                  : '#FFFFFF',
              boxShadow:
                assignmentType === 'lab'
                  ? '0 8px 20px rgba(217, 119, 6, 0.14)'
                  : 'none',
              cursor: selectedClass
                ? 'pointer'
                : 'not-allowed',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                minWidth: '46px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background:
                  assignmentType === 'lab'
                    ? '#D97706'
                    : '#EEF2F7',
                color:
                  assignmentType === 'lab'
                    ? '#FFFFFF'
                    : '#94A3B8',
                transition: 'all 0.15s ease',
              }}
            >
              <TypeIcon type="lab" />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: '800',
                  fontSize: '14px',
                  color:
                    assignmentType === 'lab'
                      ? '#B45309'
                      : '#0F2342',
                }}
              >
                Laboratory
              </div>

              <div
                style={{
                  fontSize: '11px',
                  marginTop: '4px',
                  fontWeight: '600',
                  color:
                    assignmentType === 'lab'
                      ? '#C08014'
                      : '#94A3B8',
                }}
              >
                {labCount} subjects
              </div>
            </div>
          </button>
        </div>

        {/* =================================================
            TEACHERS + SUBJECT
        ================================================= */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '22px',
            alignItems: 'start',
          }}
        >
          {/* TEACHERS */}

          <div
            ref={teacherDropdownRef}
            style={{
              position: 'relative',
              minWidth: 0,
            }}
          >
            <label style={S.label}>
              TEACHERS
            </label>

            <button
              type="button"
              disabled={!selectedClass}
              onClick={() =>
                setTeacherDropdownOpen(
                  prev => !prev
                )
              }
              style={{
                width: '100%',
                minHeight: '48px',
                marginTop: '8px',
                padding: '9px 12px',
                borderRadius: '9px',
                border:
                  teacherDropdownOpen
                    ? '1px solid #2563EB'
                    : '1px solid #CBD5E1',
                background: '#FFFFFF',
                cursor: selectedClass
                  ? 'pointer'
                  : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  color:
                    selectedTeachers.length > 0
                      ? '#1D4ED8'
                      : '#94A3B8',
                  fontSize: '12px',
                  fontWeight:
                    selectedTeachers.length > 0
                      ? '700'
                      : '400',
                }}
              >
                {selectedTeachers.length > 0
                  ? `${selectedTeachers.length} teacher${
                      selectedTeachers.length !== 1
                        ? 's'
                        : ''
                    } selected`
                  : 'Select teacher(s)'}
              </span>

              <span
                style={{
                  color: '#64748B',
                  fontSize: '12px',
                }}
              >
                {teacherDropdownOpen
                  ? '▲'
                  : '▼'}
              </span>
            </button>

            {selectedTeachers.length > 0 && (
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {selectedTeachers.map(id => (
                  <span
                    key={id}
                    className="ts-teacher-chip"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 8px',
                      borderRadius: '7px',
                      background: 'var(--badge-teacher)',
                      border: '1px solid var(--input-border)',
                      color: '#1D4ED8',
                      fontSize: '10px',
                      fontWeight: '700',
                    }}
                  >
                    {getTeacherName(parseInt(id))}

                    <button
                      type="button"
                      onClick={() =>
                        toggleTeacher(id)
                      }
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#64748B',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {teacherDropdownOpen &&
              selectedClass && (
                <div
                  className="ts-dropdown"
                  style={{
                    position: 'absolute',
                    top: '72px',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    boxShadow:
                      '0 12px 30px rgba(15, 35, 66, 0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px',
                      borderBottom:
                        '1px solid #E2E8F0',
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={teacherSearch}
                      onChange={e =>
                        setTeacherSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search teachers..."
                      className="ts-dropdown-search"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 11px',
                        borderRadius: '7px',
                        border: '1px solid var(--input-border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-main)',
                        outline: 'none',
                        fontSize: '12px',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderBottom:
                        '1px solid #E2E8F0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#64748B',
                        fontWeight: '600',
                      }}
                    >
                      {filteredTeachers.length} teacher
                      {filteredTeachers.length !== 1
                        ? 's'
                        : ''}
                    </span>

                    <button
                      type="button"
                      onClick={selectAllTeachers}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#2563EB',
                        fontSize: '10px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      Select all
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    {filteredTeachers.length === 0 ? (
                      <div
                        style={{
                          padding: '18px',
                          textAlign: 'center',
                          fontSize: '11px',
                          color: '#94A3B8',
                        }}
                      >
                        No teachers found.
                      </div>
                    ) : (
                      filteredTeachers.map(teacher => {
                        const id = String(
                          teacher.teacher_id
                        )

                        const selected =
                          selectedTeachers.includes(id)

                        return (
                          <button
                            key={
                              teacher.teacher_id
                            }
                            type="button"
                            onClick={() =>
                              toggleTeacher(
                                teacher.teacher_id
                              )
                            }
                            className="ts-dropdown-item"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: 'none',
                              borderBottom: '1px solid var(--border-color)',
                              background: selected
                                ? 'var(--badge-teacher)'
                                : 'var(--bg-card)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '5px',
                                border: selected
                                  ? '1px solid #2563EB'
                                  : '1px solid var(--border-color)',
                                background: selected
                                  ? '#2563EB'
                                  : 'var(--bg-page)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: '800',
                                flexShrink: 0,
                              }}
                            >
                              {selected ? '✓' : ''}
                            </span>

                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: selected
                                  ? '700'
                                  : '500',
                                color: selected
                                  ? '#1D4ED8'
                                  : 'var(--text-main)',
                              }}
                            >
                              {teacher.teacher_name}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* SUBJECT */}

          <div
            ref={subjectDropdownRef}
            style={{
              position: 'relative',
              minWidth: 0,
            }}
          >
            <label style={S.label}>
              {assignmentType === 'lab'
                ? 'LABORATORY SUBJECT'
                : 'THEORY SUBJECT'}
            </label>

            <button
              type="button"
              disabled={!selectedClass}
              onClick={() =>
                setSubjectDropdownOpen(
                  prev => !prev
                )
              }
              style={{
                width: '100%',
                minHeight: '48px',
                marginTop: '8px',
                padding: '9px 12px',
                borderRadius: '9px',
                border:
                  subjectDropdownOpen
                    ? assignmentType === 'lab'
                      ? '1px solid #D97706'
                      : '1px solid #2563EB'
                    : '1px solid #CBD5E1',
                background: '#FFFFFF',
                cursor: selectedClass
                  ? 'pointer'
                  : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  color: selectedSubjectData
                    ? assignmentType === 'lab'
                      ? '#B45309'
                      : '#1D4ED8'
                    : '#94A3B8',
                  fontSize: '12px',
                  fontWeight: selectedSubjectData
                    ? '700'
                    : '400',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedSubjectData
                  ? selectedSubjectData.subject_name
                  : selectedClass
                  ? `Select ${
                      assignmentType === 'lab'
                        ? 'laboratory'
                        : 'theory'
                    } subject...`
                  : 'Select a class first'}
              </span>

              <span
                style={{
                  color: '#64748B',
                  fontSize: '12px',
                }}
              >
                {subjectDropdownOpen
                  ? '▲'
                  : '▼'}
              </span>
            </button>

            {subjectDropdownOpen &&
              selectedClass && (
                <div
                  className="ts-dropdown"
                  style={{
                    position: 'absolute',
                    top: '72px',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    boxShadow:
                      '0 12px 30px rgba(15, 35, 66, 0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px',
                      borderBottom:
                        '1px solid #E2E8F0',
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={subjectSearch}
                      onChange={e =>
                        setSubjectSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search subjects..."
                      className="ts-dropdown-search"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 11px',
                        borderRadius: '7px',
                        border: '1px solid var(--input-border)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-main)',
                        outline: 'none',
                        fontSize: '12px',
                      }}
                    />
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderBottom:
                        '1px solid #E2E8F0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#64748B',
                        fontWeight: '600',
                      }}
                    >
                      {filteredSubjectsForDropdown.length} subject
                      {filteredSubjectsForDropdown.length !== 1
                        ? 's'
                        : ''}
                    </span>
                  </div>

                  <div
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    {filteredSubjectsForDropdown.length === 0 ? (
                      <div
                        style={{
                          padding: '18px',
                          textAlign: 'center',
                          fontSize: '11px',
                          color: '#94A3B8',
                        }}
                      >
                        No{' '}
                        {assignmentType === 'lab'
                          ? 'laboratory'
                          : 'theory'}{' '}
                        subjects found.
                      </div>
                    ) : (
                      filteredSubjectsForDropdown.map(subject => {
                        const id = String(
                          subject.subject_id
                        )

                        const selected =
                          selectedSubject === id

                        const assignedCount =
                          links.filter(
                            link =>
                              link.subject_id ===
                              subject.subject_id
                          ).length

                        return (
                          <button
                            key={
                              subject.subject_id
                            }
                            type="button"
                            onClick={() =>
                              handleSubjectSelect(
                                subject.subject_id
                              )
                            }
                            className="ts-dropdown-item"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: 'none',
                              borderBottom: '1px solid var(--border-color)',
                              background: selected
                                ? assignmentType === 'lab'
                                  ? 'var(--badge-room)'
                                  : 'var(--badge-teacher)'
                                : 'var(--bg-card)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                border: selected
                                  ? assignmentType === 'lab'
                                    ? '1px solid #D97706'
                                    : '1px solid #2563EB'
                                  : '1px solid var(--border-color)',
                                background: selected
                                  ? assignmentType === 'lab'
                                    ? '#D97706'
                                    : '#2563EB'
                                  : 'var(--bg-page)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: '800',
                                flexShrink: 0,
                              }}
                            >
                              {selected ? '✓' : ''}
                            </span>

                            <span
                              style={{
                                flex: 1,
                                fontSize: '12px',
                                fontWeight: selected
                                  ? '700'
                                  : '500',
                                color: selected
                                  ? assignmentType === 'lab'
                                    ? '#B45309'
                                    : '#1D4ED8'
                                  : '#334155',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {subject.subject_name}
                            </span>

                            <span
                              style={{
                                fontSize: '9px',
                                color: '#94A3B8',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {assignedCount} teacher
                              {assignedCount !== 1
                                ? 's'
                                : ''}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* SELECTED SUBJECT INFO */}

        {selectedSubjectData && (
          <div
            className={assignmentType === 'lab' ? 'ts-subject-info-lab' : 'ts-subject-info-theory'}
            style={{
              marginTop: '18px',
              padding: '13px 15px',
              borderRadius: '10px',
              background:
                assignmentType === 'lab'
                  ? '#FFFBEB'
                  : '#F4F8FF',
              border:
                assignmentType === 'lab'
                  ? '1px solid #FDE68A'
                  : '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '15px',
            }}
          >
            <div>
              <div
                className="ts-subject-info-label"
                style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#64748B',
                  letterSpacing: '0.8px',
                  marginBottom: '4px',
                }}
              >
                SELECTED SUBJECT
              </div>

              <div
                className={assignmentType === 'lab' ? 'ts-subject-info-name-lab' : 'ts-subject-info-name-theory'}
                style={{
                  fontSize: '13px',
                  fontWeight: '800',
                  color:
                    assignmentType === 'lab'
                      ? '#B45309'
                      : '#1D4ED8',
                }}
              >
                {selectedSubjectData.subject_name}
              </div>
            </div>

            <SubjectTypeBadge
              name={
                assignmentType === 'lab'
                  ? 'Laboratory'
                  : 'Theory'
              }
              type={assignmentType}
              showName={false}
            />
          </div>
        )}

        {/* ASSIGNMENT SUMMARY */}

        {selectedTeachers.length > 0 &&
          selectedSubjectData && (
            <div
              className="ts-summary-box"
              style={{
                marginTop: '18px',
                padding: '14px 16px',
                borderRadius: '10px',
                background: 'var(--bg-page)',
                border: '1px solid var(--border-color)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              <strong
                style={{
                  color: '#1E293B',
                }}
              >
                Ready to assign:
              </strong>{' '}

              <strong
                style={{
                  color: '#1D4ED8',
                }}
              >
                {selectedTeachers.length}
              </strong>{' '}
              teacher
              {selectedTeachers.length !== 1
                ? 's'
                : ''}{' '}
              →{' '}

              <strong
                style={{
                  color:
                    assignmentType === 'lab'
                      ? '#B45309'
                      : '#1D4ED8',
                }}
              >
                {selectedSubjectData.subject_name}
              </strong>

              {existingTeachersForSubject.length > 0 && (
                <div
                  style={{
                    marginTop: '7px',
                    color: '#64748B',
                    fontSize: '10px',
                  }}
                >
                  This subject already has{' '}
                  <strong>
                    {existingTeachersForSubject.length}
                  </strong>{' '}
                  teacher
                  {existingTeachersForSubject.length !== 1
                    ? 's'
                    : ''}{' '}
                  assigned.
                </div>
              )}
            </div>
          )}

        {/* SUBMIT */}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            ...primaryButtonWide,
            marginTop: '18px',
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit
              ? 'pointer'
              : 'not-allowed',
          }}
        >
          {saving
            ? 'Assigning...'
            : selectedTeachers.length > 1
            ? `Assign Subject to ${selectedTeachers.length} Teachers`
            : 'Assign Subject'}
        </button>
      </div>

      {/* ===================================================
          ASSIGNMENT DIRECTORY
      =================================================== */}

      <section style={directoryCard}>

        {/* DIRECTORY HEADER */}

        <div style={directoryHeader}>
          <div style={directoryHeaderLeft}>
            <div style={directoryIcon}>▤</div>

            <div>
              <div style={directoryEyebrow}>ASSIGNMENT DIRECTORY</div>
              <h2 style={directoryTitle}>Teacher Assignment Directory</h2>
              <p style={directorySubtitle}>
                View, edit, and remove faculty assignments for{' '}
                {selectedClass ? selectedClassName : 'all classes'}.
              </p>
            </div>
          </div>

          <div style={directoryHeaderRight}>
            <div style={countPill}>
              {filteredDirectoryLinks.length} assignment
              {filteredDirectoryLinks.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* FILTERS + SEARCH */}

        <div style={{ padding: '0 24px 17px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'theory', label: 'Theory' },
            { key: 'lab', label: 'Laboratory' },
          ].map(filter => {
            const active = directoryFilter === filter.key

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setDirectoryFilter(filter.key)}
                className={`ts-filter-btn${active ? ' active' : ''}`}
                style={{
                  padding: '8px 15px',
                  borderRadius: '9px',
                  border: active ? '1px solid #2563EB' : '1px solid var(--border-color)',
                  background: active ? 'var(--badge-teacher)' : 'var(--bg-card)',
                  color: active ? '#1D4ED8' : 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                {filter.label}
              </button>
            )
          })}

          <div style={{ ...searchWrapper, flex: 1, minWidth: '240px', marginLeft: 'auto' }}>
            <span style={searchIcon}>⌕</span>

            <input
              type="text"
              value={directorySearch}
              onChange={e => setDirectorySearch(e.target.value)}
              placeholder="Search teacher or subject..."
              style={searchInput}
            />

            {directorySearch && (
              <button
                type="button"
                onClick={() => setDirectorySearch('')}
                style={clearButton}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* TABLE */}

        {filteredDirectoryLinks.length === 0 ? (
          <div style={emptyState}>
            <div style={stateTitle}>No assignments found</div>
            <div style={stateText}>
              Try another filter or assign a subject to one or more teachers.
            </div>
          </div>
        ) : (
          <div style={tableWrapper}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>TEACHER</th>
                  <th style={S.th}>SUBJECT</th>
                  <th style={S.th}>TYPE</th>
                  {!selectedClass && <th style={S.th}>CLASS</th>}
                  <th style={{ ...S.th, width: '190px', textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredDirectoryLinks.map((link, index) => {
                  const teacher = teachers.find(
                    t => t.teacher_id === link.teacher_id
                  )

                  const subject = subjects.find(
                    s => s.subject_id === link.subject_id
                  )

                  return (
                    <tr
                      key={`${link.teacher_id}-${link.subject_id}-${index}`}
                      className={index % 2 === 0 ? 'ts-table-row-even' : 'ts-table-row-odd'}
                    >
                      <td style={{ ...S.td, fontWeight: '700', color: '#1E293B' }}>
                        {teacher?.teacher_name || `Teacher ${link.teacher_id}`}
                      </td>

                      <td style={S.td}>
                        {subject?.subject_name || `Subject ${link.subject_id}`}
                      </td>

                      <td style={S.td}>
                        <SubjectTypeBadge
                          name={subject?.subject_type === 'lab' ? 'Laboratory' : 'Theory'}
                          type={subject?.subject_type}
                          showName={false}
                        />
                      </td>

                      {!selectedClass && (
                        <td style={S.td}>
                          <span
                            style={{
                              padding: '4px 9px',
                              borderRadius: '20px',
                              fontSize: '10px',
                              fontWeight: '700',
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                            }}
                          >
                            {subject ? getClassName(subject.class_id) : '—'}
                          </span>
                        </td>
                      )}

                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <div style={actionGroup}>
                          <button
                            type="button"
                            onClick={() => openEditModal(link)}
                            style={editButton}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => promptDelete(link)}
                            style={deleteButton}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===================================================
          EDIT ASSIGNMENT MODAL
      =================================================== */}

      {editTarget && (
        <div
          style={modalOverlay}
          onMouseDown={e => {
            if (e.target === e.currentTarget && !editSaving) {
              closeEditModal()
            }
          }}
        >
          <div style={modalCard}>
            <div style={modalAccent} />

            <div style={modalHeader}>
              <div>
                <div style={modalEyebrow}>TEACHER ASSIGNMENT</div>
                <div style={modalTitle}>Edit Assignment</div>
                <div style={modalSubtitle}>
                  Reassign "{getSubjectName(editTarget.subject_id)}" to a different teacher.
                </div>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={editSaving}
                style={modalCloseButton}
              >
                ×
              </button>
            </div>

            <div style={modalBody}>
              <div style={S.fieldWrap}>
                <label style={S.label}>Current Teacher</label>
                <div style={readOnlyField}>
                  {getTeacherName(editTarget.teacher_id)}
                </div>
              </div>

              <div style={{ ...S.fieldWrap, marginTop: '18px' }}>
                <label style={S.label}>New Teacher</label>
                <select
                  value={editTeacherId}
                  onChange={e => {
                    setEditTeacherId(e.target.value)
                    setEditError('')
                  }}
                  disabled={editSaving}
                  style={modalSelect}
                >
                  <option value="">Select a teacher...</option>
                  {teachers.map(teacher => (
                    <option key={teacher.teacher_id} value={teacher.teacher_id}>
                      {teacher.teacher_name}
                    </option>
                  ))}
                </select>
                <div style={fieldHint}>
                  Subject stays the same — only the assigned teacher changes.
                </div>
              </div>

              {editError && (
                <div style={modalError}>
                  <span>!</span>
                  {editError}
                </div>
              )}
            </div>

            <div style={modalFooter}>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editSaving}
                style={cancelButton}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleEditSave}
                disabled={editSaving}
                style={{
                  ...primaryButton,
                  minWidth: '130px',
                  opacity: editSaving ? 0.7 : 1,
                }}
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          DELETE CONFIRM MODAL
      =================================================== */}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Assignment"
        itemName={
          deleteTarget
            ? `${getTeacherName(deleteTarget.teacher_id)} → ${getSubjectName(deleteTarget.subject_id)}`
            : ''
        }
        message="Are you sure you want to remove this teacher from this subject? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />

      <style>{`
        /* ── DARK THEME OVERRIDES ── */
        [data-theme='dark'] .ts-hero { background: #0d1322 !important; border-color: #1a2338 !important; box-shadow: none !important; }
        [data-theme='dark'] .ts-hero h1 { color: #ffffff !important; }
        [data-theme='dark'] .hero-subtitle { color: #ffffff !important; }
        [data-theme='dark'] .eyebrow { color: #a855f7 !important; }
        [data-theme='dark'] .ts-stat-card { background: #0d1322 !important; border-color: #1a2338 !important; }
        [data-theme='dark'] .stat-label { color: #8a99ad !important; }
        [data-theme='dark'] .stat-number { color: #ffffff !important; }

        /* ── FORM CARD (assignment panel) ── */
        [data-theme='dark'] .ts-form-card {
          background: #0d1322 !important;
          border-color: #1a2338 !important;
          box-shadow: none !important;
        }
        [data-theme='dark'] .ts-form-card label,
        [data-theme='dark'] .ts-form-card .field-label { color: #8a99ad !important; }

        /* ── TYPE TOGGLE BUTTONS ── */
        [data-theme='dark'] .ts-type-btn {
          background: #111827 !important;
          border-color: #1f2b45 !important;
          color: #8a99ad !important;
        }
        [data-theme='dark'] .ts-type-btn.active-theory {
          background: #0d1f3c !important;
          border-color: #2563eb !important;
          color: #60a5fa !important;
        }
        [data-theme='dark'] .ts-type-btn.active-lab {
          background: #2b1e0a !important;
          border-color: #d97706 !important;
          color: #fbbf24 !important;
        }

        /* ── CLASS SELECTOR & TEACHER CHIPS ── */
        [data-theme='dark'] .ts-class-select,
        [data-theme='dark'] .ts-subject-trigger,
        [data-theme='dark'] .ts-teacher-trigger {
          background: #090d16 !important;
          border-color: #1f2b45 !important;
          color: #ffffff !important;
        }
        [data-theme='dark'] .ts-teacher-chip {
          background: #111827 !important;
          border-color: #1f2b45 !important;
          color: #8a99ad !important;
        }
        [data-theme='dark'] .ts-teacher-chip.selected {
          background: #0d1f3c !important;
          border-color: #2563eb !important;
          color: #60a5fa !important;
        }

        /* ── DROPDOWNS ── */
        [data-theme='dark'] .ts-dropdown {
          background: #0d1322 !important;
          border-color: #1a2338 !important;
          box-shadow: 0 12px 30px rgba(0,0,0,0.5) !important;
        }
        [data-theme='dark'] .ts-dropdown-search {
          background: #090d16 !important;
          border-color: #1f2b45 !important;
          color: #ffffff !important;
        }
        [data-theme='dark'] .ts-dropdown-item {
          background: #0d1322 !important;
          border-bottom-color: #161e30 !important;
          color: #ffffff !important;
        }
        [data-theme='dark'] .ts-dropdown-item:hover {
          background: #111827 !important;
        }
        [data-theme='dark'] .ts-dropdown-count {
          background: #090d16 !important;
          border-bottom-color: #1a2338 !important;
          color: #8a99ad !important;
        }

        /* ── SUBJECT INFO / SUMMARY BOXES ── */
        [data-theme='dark'] .ts-subject-info-theory {
          background: #0d1f3c !important;
          border-color: #2563eb !important;
        }
        [data-theme='dark'] .ts-subject-info-lab {
          background: #2b1e0a !important;
          border-color: #d97706 !important;
        }
        [data-theme='dark'] .ts-subject-info-label { color: #8a99ad !important; }
        [data-theme='dark'] .ts-subject-info-name-theory { color: #60a5fa !important; }
        [data-theme='dark'] .ts-subject-info-name-lab { color: #fbbf24 !important; }

        [data-theme='dark'] .ts-summary-box {
          background: #090d16 !important;
          border-color: #1f2b45 !important;
          color: #8a99ad !important;
        }
        [data-theme='dark'] .ts-summary-box strong { color: #ffffff !important; }

        /* ── DIRECTORY TABLE ROWS ── */
        [data-theme='dark'] .ts-table-row-even { background: #0d1322 !important; }
        [data-theme='dark'] .ts-table-row-odd  { background: #090d16 !important; }
        [data-theme='dark'] .ts-table-td { color: #ffffff !important; border-color: #1a2338 !important; }
        [data-theme='dark'] .ts-table-td-name { color: #ffffff !important; font-weight: 700; }
        [data-theme='dark'] .ts-class-pill {
          background: #0d1f3c !important;
          border-color: #2563eb !important;
          color: #60a5fa !important;
        }

        /* ── FILTER BUTTONS ── */
        [data-theme='dark'] .ts-filter-btn {
          background: #111827 !important;
          border-color: #1f2b45 !important;
          color: #8a99ad !important;
        }
        [data-theme='dark'] .ts-filter-btn.active {
          background: #0d1f3c !important;
          border-color: #2563eb !important;
          color: #60a5fa !important;
        }

        /* ── ALL TABLE BORDERS ── */
        [data-theme='dark'] table,
        [data-theme='dark'] tr,
        [data-theme='dark'] td,
        [data-theme='dark'] th { border-color: #1a2338 !important; }
        [data-theme='dark'] td { background: #0d1322 !important; color: #ffffff !important; }
        [data-theme='dark'] th { background: #090d16 !important; color: #8a99ad !important; }
      `}</style>

    </div>
  )
}


/* ================================================================
   PAGE
================================================================ */

const pageWrap = {
  position: 'relative',
  width: '100%',
  minHeight: '100%',
  padding: '8px 4px 50px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
}


/* ================================================================
   HERO
================================================================ */

const heroCard = {
  position: 'relative',
  minHeight: '150px',
  display: 'flex',
  alignItems: 'center',
  padding: '30px 28px',
  overflow: 'hidden',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  background: 'var(--bg-card)',
  boxShadow: '0 12px 35px rgba(15,23,42,0.045)',
  boxSizing: 'border-box',
}

const heroContent = {
  display: 'flex',
  alignItems: 'center',
  gap: '18px',
}

const heroIcon = {
  width: '64px',
  height: '64px',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '17px',
  background: 'var(--badge-teacher)',
  border: '1px solid var(--input-border)',
  boxShadow: '0 8px 22px rgba(37,99,235,0.10)',
}

const heroIconGlyph = {
  fontSize: '26px',
  fontWeight: '800',
  color: '#2563EB',
  lineHeight: 1,
}

const heroEyebrow = {
  marginBottom: '5px',
  fontSize: '10px',
  fontWeight: '850',
  letterSpacing: '0.16em',
  color: '#2563EB',
}

const heroTitle = {
  margin: 0,
  fontSize: '31px',
  lineHeight: 1.05,
  fontWeight: '850',
  letterSpacing: '-0.035em',
  color: 'var(--text-main)',
}

const heroSubtitle = {
  marginTop: '7px',
  fontSize: '15px',
  fontWeight: '750',
  color: 'var(--text-main)',
}

const heroDescription = {
  margin: '5px 0 0',
  fontSize: '12px',
  color: 'var(--text-muted)',
}


/* ================================================================
   STATS
================================================================ */

const statsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '14px',
}

const statCard = {
  position: 'relative',
  minHeight: '88px',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  overflow: 'hidden',
  padding: '18px 20px',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  background: 'var(--bg-card)',
  boxShadow: '0 8px 25px rgba(15,23,42,0.035)',
  boxSizing: 'border-box',
}

const statIconBlue = {
  width: '42px',
  height: '42px',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  background: 'var(--badge-teacher)',
  border: '1px solid var(--input-border)',
  color: '#2563EB',
  fontSize: '19px',
}

const statIconGreen = {
  ...statIconBlue,
  background: 'var(--badge-classroom)',
  color: '#059669',
}

const statIconPurple = {
  ...statIconBlue,
  background: 'var(--badge-subject)',
  color: '#7C3AED',
}

const statLabel = {
  marginBottom: '5px',
  fontSize: '9px',
  fontWeight: '850',
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
}

const statNumberBlue = {
  fontSize: '20px',
  fontWeight: '850',
  color: '#2563EB',
}

const statNumberGreen = {
  fontSize: '18px',
  fontWeight: '850',
  color: '#059669',
}

const statNumberPurple = {
  fontSize: '13px',
  fontWeight: '800',
  color: '#7C3AED',
}

const statDecorationBlue = {
  position: 'absolute',
  right: '-20px',
  bottom: '-35px',
  width: '120px',
  height: '80px',
  borderRadius: '50%',
  background: 'rgba(37,99,235,0.055)',
}

const statDecorationGreen = {
  ...statDecorationBlue,
  background: 'rgba(16,185,129,0.055)',
}

const statDecorationPurple = {
  ...statDecorationBlue,
  background: 'rgba(124,58,237,0.055)',
}


/* ================================================================
   MESSAGES
================================================================ */

const successBanner = {
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  padding: '11px 14px',
  borderRadius: '10px',
  background: 'var(--badge-classroom)',
  border: '1px solid var(--border-color)',
  color: '#166534',
  fontSize: '12px',
  fontWeight: '600',
}

const errorBanner = {
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  padding: '11px 14px',
  borderRadius: '10px',
  background: 'var(--badge-subject)',
  border: '1px solid var(--border-color)',
  color: '#991B1B',
  fontSize: '12px',
  fontWeight: '600',
}

const successIcon = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  background: 'var(--badge-classroom)',
  color: '#15803D',
  fontWeight: '800',
}

const errorIcon = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  background: 'var(--badge-subject)',
  color: '#DC2626',
  fontWeight: '800',
}


/* ================================================================
   PRIMARY BUTTON
================================================================ */

const primaryButton = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  minHeight: '44px',
  padding: '0 18px',
  border: 'none',
  borderRadius: '10px',
  background: '#2563EB',
  color: '#FFFFFF',
  fontSize: '12px',
  fontWeight: '800',
  cursor: 'pointer',
  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.22)',
}

const primaryButtonWide = {
  ...primaryButton,
  width: '100%',
  padding: '13px 16px',
  fontSize: '13px',
}


/* ================================================================
   DIRECTORY
================================================================ */

const directoryCard = {
  position: 'relative',
  overflow: 'hidden',
  border: '1px solid var(--border-color)',
  borderRadius: '18px',
  background: 'var(--bg-card)',
  boxShadow: '0 12px 35px rgba(15,23,42,0.045)',
}

const directoryHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '20px',
  padding: '22px 24px 17px',
}

const directoryHeaderLeft = {
  display: 'flex',
  alignItems: 'center',
  gap: '13px',
}

const directoryHeaderRight = {
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
}

const directoryIcon = {
  width: '42px',
  height: '42px',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  background: 'var(--badge-teacher)',
  border: '1px solid var(--input-border)',
  color: '#2563EB',
  fontSize: '21px',
}

const directoryEyebrow = {
  marginBottom: '3px',
  fontSize: '9px',
  fontWeight: '850',
  letterSpacing: '0.13em',
  color: 'var(--text-muted)',
}

const directoryTitle = {
  margin: 0,
  fontSize: '17px',
  fontWeight: '850',
  color: 'var(--text-main)',
}

const directorySubtitle = {
  margin: '4px 0 0',
  fontSize: '11px',
  color: 'var(--text-muted)',
}

const countPill = {
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'var(--bg-page)',
  border: '1px solid var(--input-border)',
  color: 'var(--text-main)',
  fontSize: '10px',
  fontWeight: '850',
  whiteSpace: 'nowrap',
}

const searchWrapper = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
}

const searchIcon = {
  position: 'absolute',
  left: '14px',
  zIndex: 1,
  color: '#8292AA',
  fontSize: '18px',
  lineHeight: 1,
  transform: 'rotate(-20deg)',
}

const searchInput = {
  width: '100%',
  height: '43px',
  boxSizing: 'border-box',
  padding: '0 42px',
  border: '1px solid var(--input-border)',
  borderRadius: '10px',
  background: 'var(--input-bg)',
  color: 'var(--text-main)',
  fontFamily: 'inherit',
  fontSize: '12px',
  outline: 'none',
}

const clearButton = {
  position: 'absolute',
  right: '11px',
  width: '24px',
  height: '24px',
  border: 'none',
  borderRadius: '50%',
  background: 'var(--border-color)',
  color: 'var(--text-muted)',
  fontSize: '16px',
  cursor: 'pointer',
}

const tableWrapper = {
  width: '100%',
  overflowX: 'auto',
  borderTop: '1px solid var(--border-color)',
}

const actionGroup = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '7px',
}

const editButton = {
  padding: '8px 13px',
  borderRadius: '8px',
  border: '1px solid var(--input-border)',
  background: 'var(--badge-teacher)',
  color: '#1D4ED8',
  fontSize: '11px',
  fontWeight: '800',
  cursor: 'pointer',
}

const deleteButton = {
  padding: '8px 13px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  background: 'var(--badge-subject)',
  color: '#DC2626',
  fontSize: '11px',
  fontWeight: '800',
  cursor: 'pointer',
}


/* ================================================================
   EMPTY STATE
================================================================ */

const emptyState = {
  margin: '0 24px 24px',
  padding: '55px 20px',
  textAlign: 'center',
  border: '1px dashed var(--border-color)',
  borderRadius: '14px',
  background: 'var(--bg-page)',
}

const stateTitle = {
  marginBottom: '5px',
  fontSize: '14px',
  fontWeight: '800',
  color: 'var(--text-main)',
}

const stateText = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: 'var(--text-muted)',
}


/* ================================================================
   EDIT MODAL
================================================================ */

const modalOverlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background: 'rgba(15, 23, 42, 0.48)',
  backdropFilter: 'blur(7px)',
}

const modalCard = {
  position: 'relative',
  width: '100%',
  maxWidth: '470px',
  overflow: 'hidden',
  borderRadius: '19px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  boxShadow: '0 28px 80px rgba(15, 23, 42, 0.24)',
}

const modalAccent = {
  height: '4px',
  background: 'linear-gradient(90deg, #2563EB, #60A5FA, #BFDBFE)',
}

const modalHeader = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '24px 25px 21px',
  borderBottom: '1px solid var(--border-color)',
}

const modalEyebrow = {
  marginBottom: '5px',
  fontSize: '9px',
  fontWeight: '850',
  letterSpacing: '0.12em',
  color: '#6B8FC5',
}

const modalTitle = {
  fontSize: '19px',
  fontWeight: '850',
  color: 'var(--text-main)',
}

const modalSubtitle = {
  marginTop: '5px',
  fontSize: '12px',
  lineHeight: '1.5',
  color: 'var(--text-muted)',
}

const modalCloseButton = {
  width: '32px',
  height: '32px',
  flexShrink: 0,
  border: '1px solid var(--border-color)',
  borderRadius: '9px',
  background: 'var(--bg-page)',
  color: 'var(--text-muted)',
  fontSize: '21px',
  cursor: 'pointer',
}

const modalBody = {
  padding: '25px',
}

const readOnlyField = {
  ...S.input,
  height: '46px',
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  borderRadius: '10px',
  background: 'var(--bg-page)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-muted)',
  fontSize: '13px',
}

const modalSelect = {
  ...S.select,
  height: '46px',
  boxSizing: 'border-box',
  borderRadius: '10px',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  fontSize: '13px',
}

const fieldHint = {
  marginTop: '6px',
  fontSize: '10px',
  color: 'var(--text-muted)',
}

const modalError = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '18px',
  padding: '10px 12px',
  borderRadius: '9px',
  background: 'var(--badge-subject)',
  border: '1px solid var(--border-color)',
  color: '#991B1B',
  fontSize: '12px',
  fontWeight: '600',
}

const modalFooter = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: '9px',
  padding: '16px 25px 21px',
  borderTop: '1px solid var(--border-color)',
}

const cancelButton = {
  padding: '11px 18px',
  borderRadius: '9px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-card)',
  color: 'var(--text-main)',
  fontSize: '12px',
  fontWeight: '750',
  cursor: 'pointer',
}