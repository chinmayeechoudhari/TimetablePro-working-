import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import ConfirmModal from './ConfirmModal'
import TeacherExcelImport from './TeacherExcelImport'

const BASE = 'http://localhost:8000'
const PAGE_SIZE = 8

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
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    gauge: (
      <>
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M12 3a9 9 0 0 0-9 9c0 2.4.9 4.6 2.4 6.3" />
        <path d="M12 3a9 9 0 0 1 9 9c0 2.4-.9 4.6-2.4 6.3" />
        <path d="M13.6 13.6 17 10" />
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
    alert: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 2.6 17.5A1.6 1.6 0 0 0 4 20h16a1.6 1.6 0 0 0 1.4-2.5L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <path d="M12 7.5h.01" />
      </>
    ),
    chevronLeft: (
      <>
        <path d="m15 18-6-6 6-6" />
      </>
    ),
    chevronRight: (
      <>
        <path d="m9 18 6-6-6-6" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

export default function TeacherForm() {
  const [teachers, setTeachers] = useState([])

  const [name, setName] = useState('')
  const [maxPeriods, setMaxPeriods] = useState(4)

  const [search, setSearch] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [currentPage, setCurrentPage] = useState(1)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    fetchTeachers()
  }, [])

  async function fetchTeachers() {
    setLoading(true)
    setError('')

    try {
      const res = await axios.get(`${BASE}/teachers`)
      setTeachers(res.data)
    } catch {
      setError(
        'Could not load teachers. Please check that the backend is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setName('')
    setMaxPeriods(4)
    setEditingId(null)
  }

  function openAddModal() {
    resetForm()
    setMessage('')
    setError('')
    setIsModalOpen(true)
  }

  function openEditModal(teacher) {
    setEditingId(teacher.teacher_id)
    setName(teacher.teacher_name)
    setMaxPeriods(teacher.max_periods_per_day)

    setMessage('')
    setError('')
    setIsModalOpen(true)
  }

  function closeModal() {
    if (saving) return

    setIsModalOpen(false)
    resetForm()
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    setMessage('')
    setError('')

    const trimmedName = name.trim()
    const parsedMaxPeriods = Number(maxPeriods)

    if (!trimmedName) {
      setError('Teacher name is required.')
      return
    }

    if (
      !Number.isInteger(parsedMaxPeriods) ||
      parsedMaxPeriods < 1 ||
      parsedMaxPeriods > 8
    ) {
      setError('Max periods per day must be between 1 and 8.')
      return
    }

    const duplicate = teachers.some(
      teacher =>
        teacher.teacher_id !== editingId &&
        teacher.teacher_name.trim().toLowerCase() ===
          trimmedName.toLowerCase()
    )

    if (duplicate) {
      setError(`A teacher named "${trimmedName}" already exists.`)
      return
    }

    setSaving(true)

    try {
      if (editingId) {
        await axios.put(`${BASE}/teachers/${editingId}`, {
          teacher_name: trimmedName,
          max_periods_per_day: parsedMaxPeriods,
        })

        setMessage(`"${trimmedName}" updated successfully.`)
      } else {
        await axios.post(`${BASE}/teachers`, {
          teacher_name: trimmedName,
          max_periods_per_day: parsedMaxPeriods,
        })

        setMessage(`"${trimmedName}" added successfully.`)
      }

      setIsModalOpen(false)
      resetForm()

      await fetchTeachers()
      setCurrentPage(1)
    } catch (err) {
      const detail = err.response?.data?.detail

      if (err.response?.status === 409) {
        setError(detail || 'A teacher with this name already exists.')
      } else {
        setError(detail || 'Error saving teacher.')
      }
    } finally {
      setSaving(false)
    }
  }

  function promptDelete(teacher) {
    setDeleteTarget(teacher)
    setMessage('')
    setError('')
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)
    setMessage('')
    setError('')

    try {
      await axios.delete(`${BASE}/teachers/${deleteTarget.teacher_id}`)

      setMessage(`"${deleteTarget.teacher_name}" deleted successfully.`)

      await fetchTeachers()

      setCurrentPage(previousPage => {
        const remainingItems = Math.max(0, teachers.length - 1)
        const remainingPages = Math.max(
          1,
          Math.ceil(remainingItems / PAGE_SIZE)
        )

        return Math.min(previousPage, remainingPages)
      })
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Error deleting teacher. Please try again.'
      )
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return teachers

    return teachers.filter(teacher =>
      teacher.teacher_name.toLowerCase().includes(query)
    )
  }, [teachers, search])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTeachers.length / PAGE_SIZE)
  )

  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedTeachers = filteredTeachers.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  )

  const avgLoad =
    teachers.length > 0
      ? (
          teachers.reduce(
            (sum, teacher) => sum + teacher.max_periods_per_day,
            0
          ) / teachers.length
        ).toFixed(1)
      : '0.0'

  const firstVisible =
    filteredTeachers.length === 0
      ? 0
      : (safeCurrentPage - 1) * PAGE_SIZE + 1

  const lastVisible = Math.min(
    safeCurrentPage * PAGE_SIZE,
    filteredTeachers.length
  )

  function handleSearchChange(e) {
    setSearch(e.target.value)
    setCurrentPage(1)
  }

  return (
    <div className="teachers-page">

      {/* =========================================================
          PAGE HEADER
      ========================================================= */}

      <section className="teachers-hero">

        <div className="teachers-watermark" aria-hidden="true">
          <svg viewBox="0 0 620 220" fill="none">
            <circle cx="150" cy="80" r="34" stroke="currentColor" strokeWidth="2" />
            <path d="M90 190v-20a60 60 0 0 1 120 0v20" stroke="currentColor" strokeWidth="2" />
            <circle cx="330" cy="65" r="26" stroke="currentColor" strokeWidth="2" />
            <path d="M282 175v-16a48 48 0 0 1 96 0v16" stroke="currentColor" strokeWidth="2" />
            <circle cx="470" cy="95" r="30" stroke="currentColor" strokeWidth="2" />
            <path d="M416 195v-18a54 54 0 0 1 108 0v18" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>

        <div className="hero-left">

          <div className="hero-icon">
            <Icon name="users" size={32} stroke={1.7} />
          </div>

          <div>
            <div className="eyebrow">ACADEMIC SCHEDULING</div>

            <h1>Teachers</h1>

            <div className="hero-subtitle">Faculty Management</div>

            <p>Manage faculty members and their daily teaching limits.</p>
          </div>

        </div>

        <div className="hero-buttons">
          <button
            type="button"
            className="secondary-button hero-import-button"
            onClick={() => setShowImportModal(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import Excel
          </button>
          <button
            type="button"
            className="primary-button hero-add-button"
            onClick={openAddModal}
          >
            <Icon name="plus" size={19} />
            Add Teacher
          </button>
        </div>

      </section>


      {/* =========================================================
          STATS
      ========================================================= */}

      <section className="stats-grid">

        <div className="stat-card stat-blue">
          <div className="stat-icon">
            <Icon name="users" size={25} />
          </div>
          <div>
            <div className="stat-label">TOTAL FACULTY</div>
            <div className="stat-number">{teachers.length}</div>
          </div>
          <div className="stat-decoration">
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

        <div className="stat-card stat-purple">
          <div className="stat-icon">
            <Icon name="gauge" size={25} />
          </div>
          <div>
            <div className="stat-label">AVG DAILY LOAD</div>
            <div className="stat-number">{avgLoad}</div>
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


      {/* =========================================================
          GLOBAL MESSAGES
      ========================================================= */}

      {message && (
        <div className="message success-message">
          <Icon name="check" size={17} />
          {message}
        </div>
      )}

      {error && !isModalOpen && (
        <div className="message error-message">
          <Icon name="alert" size={17} />
          {error}
        </div>
      )}


      {/* =========================================================
          DIRECTORY
      ========================================================= */}

      <section className="directory-card">

        <div className="directory-header">

          <div className="directory-title-block">
            <div className="directory-eyebrow">FACULTY DIRECTORY</div>

            <div className="directory-title-row">
              <div className="directory-main-icon">
                <Icon name="users" size={23} />
              </div>

              <div>
                <h2>Teacher Directory</h2>
                <p>Faculty available for timetable scheduling.</p>
              </div>
            </div>
          </div>

          <div className="directory-actions">
            <div className="result-count">
              {filteredTeachers.length} result
              {filteredTeachers.length !== 1 ? 's' : ''}
            </div>

            <button
              type="button"
              className="small-add-button"
              onClick={openAddModal}
            >
              <Icon name="plus" size={17} />
              Add
            </button>
          </div>

        </div>


        {/* SEARCH */}

        <div className="search-wrapper">
          <Icon name="search" size={19} />

          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search teachers by name..."
          />

          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={() => {
                setSearch('')
                setCurrentPage(1)
              }}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>


        {/* TABLE / STATES */}

        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
            <h3>Loading teachers...</h3>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="users" size={27} />
            </div>

            <h3>
              {search ? 'No teachers found' : 'No teachers added yet'}
            </h3>

            <p>
              {search
                ? `No teacher matches "${search}".`
                : 'Add your first teacher to the directory.'}
            </p>

            {!search && (
              <button
                type="button"
                className="primary-button empty-add-button"
                onClick={openAddModal}
              >
                <Icon name="plus" size={18} />
                Add Teacher
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="teacher-table-wrapper">
              <table className="teacher-table">
                <thead>
                  <tr>
                    <th className="index-column">#</th>
                    <th>TEACHER</th>
                    <th className="capacity-column">DAILY CAPACITY</th>
                    <th className="actions-column">ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedTeachers.map((teacher, index) => (
                    <tr key={teacher.teacher_id}>

                      <td className="index-cell">
                        {String(
                          (safeCurrentPage - 1) * PAGE_SIZE + index + 1
                        ).padStart(2, '0')}
                      </td>

                      <td>
                        <div className="teacher-name-cell">
                          <div className="avatar-circle">
                            {getInitials(teacher.teacher_name)}
                          </div>

                          <div>
                            <div className="teacher-name">
                              {teacher.teacher_name}
                            </div>
                            <div className="teacher-role">
                              Faculty member
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="capacity-cell">
                        <div className="capacity-wrapper">
                          <span className="load-badge">
                            {teacher.max_periods_per_day}
                          </span>
                          <span className="capacity-text">
                            periods / day
                          </span>
                        </div>
                      </td>

                      <td className="actions-cell">
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => openEditModal(teacher)}
                        >
                          <Icon name="edit" size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => promptDelete(teacher)}
                        >
                          <Icon name="trash" size={15} />
                          Delete
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


            {/* PAGINATION */}

            <div className="pagination-bar">

              <div className="pagination-info">
                Showing {firstVisible}–{lastVisible} of{' '}
                {filteredTeachers.length} teacher
                {filteredTeachers.length !== 1 ? 's' : ''}
              </div>

              {totalPages > 1 && (
                <div className="pagination-controls">

                  <button
                    type="button"
                    className="pagination-button pagination-nav"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage(previous => previous - 1)}
                  >
                    <Icon name="chevronLeft" size={15} />
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1)
                    .slice(0, 5)
                    .map(page => (
                      <button
                        key={page}
                        type="button"
                        className={`pagination-button ${
                          safeCurrentPage === page ? 'active' : ''
                        }`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}

                  {totalPages > 5 && (
                    <>
                      <span className="pagination-dots">...</span>

                      <button
                        type="button"
                        className={`pagination-button ${
                          safeCurrentPage === totalPages ? 'active' : ''
                        }`}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="pagination-button pagination-nav"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage(previous => previous + 1)}
                  >
                    Next
                    <Icon name="chevronRight" size={15} />
                  </button>

                </div>
              )}

            </div>
          </>
        )}

      </section>


      {/* =========================================================
          FOOTER NOTE
      ========================================================= */}

      <div className="info-banner">
        <Icon name="info" size={16} />
        <div>Teacher names are unique and cannot be added twice.</div>
      </div>


      {/* =========================================================
          ADD / EDIT MODAL
      ========================================================= */}

      {isModalOpen && (
        <div
          className="teacher-modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget && !saving) {
              closeModal()
            }
          }}
        >
          <form className="teacher-modal" onSubmit={handleSubmit}>

            <div className="modal-header">

              <div className="modal-title-group">
                <div className="modal-icon">
                  <Icon name="users" size={24} />
                </div>

                <div>
                  <div className="modal-eyebrow">FACULTY MANAGEMENT</div>

                  <h2>{editingId ? 'Edit Teacher' : 'Add Teacher'}</h2>

                  <p>
                    {editingId
                      ? 'Update the faculty details.'
                      : 'Create a faculty member and set their daily capacity.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <Icon name="close" size={19} />
              </button>

            </div>


            <div className="modal-body">

              <div className="form-field">
                <label htmlFor="teacher-name">Teacher Name</label>

                <input
                  id="teacher-name"
                  autoFocus
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value)
                    setError('')
                  }}
                  placeholder="e.g. Prof. Sharma"
                  disabled={saving}
                  maxLength={100}
                />

                <span>Faculty display name.</span>
              </div>

              <div className="form-field">
                <label htmlFor="teacher-max-periods">Max Periods Per Day</label>

                <input
                  id="teacher-max-periods"
                  type="number"
                  min="1"
                  max="8"
                  value={maxPeriods}
                  onChange={e => {
                    setMaxPeriods(e.target.value)
                    setError('')
                  }}
                  disabled={saving}
                />

                <span>1–8 periods per day.</span>
              </div>

              {error && (
                <div className="modal-error">
                  <Icon name="alert" size={15} />
                  {error}
                </div>
              )}

            </div>


            <div className="modal-footer">

              <button
                type="button"
                className="secondary-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? (
                  'Saving...'
                ) : editingId ? (
                  <>
                    <Icon name="check" size={17} />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={17} />
                    Add Teacher
                  </>
                )}
              </button>

            </div>

          </form>
        </div>
      )}


      {/* =========================================================
          DELETE CONFIRMATION
      ========================================================= */}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Teacher"
        itemName={deleteTarget?.teacher_name}
        message="Are you sure you want to delete this teacher? This will disassociate any assigned subjects and timetable entries."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />


      {/* =========================================================
          EXCEL IMPORT MODAL
      ========================================================= */}

      <TeacherExcelImport
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={fetchTeachers}
      />

      {/* =========================================================
          PAGE STYLES
      ========================================================= */}

      <style>{`

        .teachers-page {
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

        .teachers-hero {
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

        .teachers-hero h1 {
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

        .teachers-hero p {
          margin: 7px 0 0;
          color: #71809d;
          font-size: 13px;
          line-height: 1.5;
          max-width: 420px;
        }

        .teachers-watermark {
          position: absolute;
          z-index: 1;
          right: 60px;
          bottom: -10px;
          width: min(44%, 580px);
          color: #8fa8e7;
          opacity: 0.11;
          pointer-events: none;
        }

        .teachers-watermark svg {
          display: block;
          width: 100%;
          height: auto;
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
          padding: 0 18px;
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
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .hero-add-button {
          position: relative;
          z-index: 3;
          min-width: 150px;
          min-height: 48px;
          font-size: 14px;
        }

        .hero-buttons {
          position: relative;
          z-index: 3;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .hero-import-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 48px;
          min-width: 150px;
          padding: 0 18px;
          font-size: 14px;
          border: 1px solid #c9d9ff;
          border-radius: 11px;
          background: white;
          color: #245dd6;
          font-weight: 750;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.06);
          transition: background 0.12s ease, box-shadow 0.12s ease;
        }

        .hero-import-button:hover {
          background: #f4f7ff;
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.10);
        }

        .secondary-button {
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid #d2dce9;
          border-radius: 10px;
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
          min-height: 102px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 19px 21px;
          border: 1px solid #dfe6f2;
          border-radius: 17px;
          background: white;
          box-shadow: 0 7px 22px rgba(30, 48, 87, 0.045);
        }

        .stat-icon {
          position: relative;
          z-index: 2;
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 15px;
        }

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
          font-size: 30px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

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
          flex-wrap: wrap;
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
          width: 48px;
          height: 48px;
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
          font-size: 20px;
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

        .directory-actions {
          display: flex;
          align-items: center;
          gap: 10px;
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

        .small-add-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 37px;
          padding: 0 13px;
          border: 1px solid #c9d9ff;
          border-radius: 9px;
          background: #f4f7ff;
          color: #245dd6;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }

        .small-add-button:hover {
          background: #eaf1ff;
        }

        /* =========================
           SEARCH
        ========================= */

        .search-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 25px 18px;
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
          width: 27px;
          height: 27px;
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

        .teacher-table-wrapper {
          margin: 0 14px 14px;
          overflow: hidden;
          border: 1px solid #e1e7f0;
          border-radius: 14px;
        }

        .teacher-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .teacher-table th {
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

        .teacher-table th.index-column { width: 70px; text-align: center; }
        .teacher-table th.capacity-column { width: 200px; text-align: center; }
        .teacher-table th.actions-column { width: 205px; text-align: center; }

        .teacher-table td {
          height: 82px;
          padding: 12px 14px;
          border-bottom: 1px solid #e7ebf2;
          background: white;
          vertical-align: middle;
        }

        .teacher-table tbody tr:last-child td { border-bottom: 0; }
        .teacher-table tbody tr:hover td { background: #fbfcff; }

        .index-cell {
          text-align: center;
          color: #3566d8;
          font-size: 13px;
          font-weight: 800;
        }

        .teacher-name-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatar-circle {
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 850;
        }

        .teacher-name {
          color: #15213d;
          font-size: 14px;
          font-weight: 800;
        }

        .teacher-role {
          margin-top: 3px;
          color: #8a97ab;
          font-size: 11px;
        }

        .capacity-cell { text-align: center; }

        .capacity-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .load-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 32px;
          padding: 0 10px;
          border-radius: 9px;
          background: #edf3ff;
          border: 1px solid #c9d9ff;
          color: #245bd2;
          font-size: 13px;
          font-weight: 850;
        }

        .capacity-text {
          color: #7c899f;
          font-size: 11px;
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

        /* =========================
           PAGINATION
        ========================= */

        .pagination-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 25px 20px;
          flex-wrap: wrap;
        }

        .pagination-info {
          color: #7c899f;
          font-size: 11px;
          font-weight: 600;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }

        .pagination-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 34px;
          height: 34px;
          padding: 0 10px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .pagination-button:hover:not(:disabled) {
          background: #f5f7fa;
        }

        .pagination-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .pagination-button.active {
          background: #2563eb;
          border-color: #2563eb;
          color: white;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.18);
        }

        .pagination-dots {
          padding: 0 3px;
          color: #94a3b8;
        }

        /* =========================
           EMPTY / LOADING STATE
        ========================= */

        .empty-state {
          margin: 0 14px 14px;
          padding: 54px 25px;
          border: 1px dashed #cad5e5;
          border-radius: 14px;
          background: linear-gradient(180deg, #fbfcff, #f8faff);
          text-align: center;
        }

        .empty-icon {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 13px;
          color: #2563eb;
          border-radius: 17px;
          background: #edf3ff;
        }

        .empty-state h3 {
          margin: 0;
          color: #1a2742;
          font-size: 16px;
          font-weight: 800;
        }

        .empty-state p {
          max-width: 410px;
          margin: 7px auto 17px;
          color: #7c899f;
          font-size: 12px;
          line-height: 1.5;
        }

        .empty-add-button {
          min-height: 40px;
        }

        .loading-spinner {
          width: 28px;
          height: 28px;
          margin: 0 auto 16px;
          border: 3px solid #dbeafe;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: teacherSpin 0.8s linear infinite;
        }

        @keyframes teacherSpin {
          to { transform: rotate(360deg); }
        }

        /* =========================
           INFO BANNER
        ========================= */

        .info-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          padding: 12px 15px;
          border-radius: 11px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        /* =========================
           MODAL
        ========================= */

        .teacher-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(11, 22, 44, 0.42);
          backdrop-filter: blur(5px);
        }

        .teacher-modal {
          width: min(540px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          border: 1px solid #dbe3ef;
          border-radius: 20px;
          background: white;
          box-shadow: 0 30px 80px rgba(12, 25, 52, 0.22);
          animation: teacherModalIn 0.16s ease-out;
        }

        @keyframes teacherModalIn {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 23px 24px;
          border-bottom: 1px solid #e7ebf2;
          background: #fbfcff;
        }

        .modal-title-group {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .modal-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border-radius: 14px;
          background: #edf3ff;
        }

        .modal-eyebrow {
          margin-bottom: 3px;
          color: #72809b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .modal-header h2 {
          margin: 0;
          color: #16233f;
          font-size: 19px;
          font-weight: 800;
        }

        .modal-header p {
          margin: 3px 0 0;
          color: #7b89a1;
          font-size: 11px;
        }

        .modal-close {
          width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid #d8e0ec;
          border-radius: 9px;
          background: white;
          color: #687792;
          cursor: pointer;
        }

        .modal-close:hover {
          background: #f4f7fb;
        }

        .modal-body {
          padding: 24px;
        }

        .form-field {
          margin-bottom: 22px;
        }

        .form-field:last-child {
          margin-bottom: 0;
        }

        .form-field > label {
          display: block;
          margin-bottom: 8px;
          color: #35445f;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .form-field > input {
          width: 100%;
          height: 48px;
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

        .form-field > input:focus {
          border-color: #8eaff2;
          background: white;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }

        .form-field > input:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .form-field > span {
          display: block;
          margin-top: 7px;
          color: #8a97aa;
          font-size: 10px;
        }

        .modal-error {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 17px;
          padding: 10px 12px;
          border: 1px solid #f0c8c5;
          border-radius: 9px;
          background: #fff5f4;
          color: #b42318;
          font-size: 11px;
          font-weight: 600;
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 24px;
          border-top: 1px solid #e7ebf2;
          background: #fbfcff;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 1000px) {
          .stats-grid { grid-template-columns: 1fr; }
          .teachers-watermark { display: none; }

          .teacher-table th.capacity-column,
          .teacher-table td.capacity-cell {
            display: none;
          }
        }

        @media (max-width: 720px) {

          .teachers-page {
            padding: 4px 0 30px;
          }

          .teachers-hero {
            min-height: auto;
            align-items: flex-start;
            flex-direction: column;
            padding: 22px;
          }

          .hero-left {
            align-items: flex-start;
          }

          .teachers-hero h1 {
            font-size: 29px;
          }

          .hero-add-button {
            width: 100%;
          }

          .hero-buttons {
            width: 100%;
            flex-direction: column;
          }

          .hero-import-button {
            width: 100%;
          }

          .directory-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .directory-actions {
            width: 100%;
            justify-content: space-between;
          }

          .teacher-table th:nth-child(1),
          .teacher-table td:nth-child(1) {
            display: none;
          }

          .edit-button,
          .delete-button {
            width: 34px;
            padding: 0;
            font-size: 0;
          }

          .edit-button svg,
          .delete-button svg {
            margin: 0;
          }

          .pagination-bar {
            flex-direction: column;
            align-items: flex-start;
          }

          .pagination-nav span {
            display: none;
          }

          .teacher-modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .teacher-modal {
            width: 100%;
            border-radius: 20px 20px 0 0;
          }

        }

        @media (max-width: 500px) {

          .hero-left {
            gap: 13px;
          }

          .hero-icon {
            width: 55px;
            height: 55px;
            border-radius: 15px;
          }

          .teachers-hero p {
            font-size: 11px;
          }

          .stat-card {
            min-height: 88px;
          }
        }

        /* ── DARK THEME OVERRIDES ── */
        [data-theme='dark'] .teachers-page { color: #ffffff; }
        [data-theme='dark'] .teachers-hero { background: #0d1322 !important; border-color: #1a2338 !important; box-shadow: none !important; }
        [data-theme='dark'] .teachers-hero h1 { color: #ffffff !important; }
        [data-theme='dark'] .hero-subtitle { color: #ffffff !important; }
        [data-theme='dark'] .eyebrow { color: #a855f7 !important; }
        [data-theme='dark'] .hero-left p { color: #8a99ad !important; }
        [data-theme='dark'] .hero-icon { background: #141d33 !important; border-color: #1e2f57 !important; color: #3b82f6 !important; }
        [data-theme='dark'] .primary-button { background: linear-gradient(135deg, #4f46e5, #4338ca) !important; border-color: #3730a3 !important; }
        [data-theme='dark'] .stat-card { background: #0d1322 !important; border-color: #1a2338 !important; }
        [data-theme='dark'] .stat-label { color: #8a99ad !important; }
        [data-theme='dark'] .stat-number { color: #ffffff !important; }
        [data-theme='dark'] .stat-blue .stat-icon { background: #141d33 !important; color: #3b82f6 !important; }
        [data-theme='dark'] .stat-purple .stat-icon { background: #23173a !important; color: #a855f7 !important; }
        [data-theme='dark'] .directory-card { background: #0d1322 !important; border-color: #1a2338 !important; }
        [data-theme='dark'] .directory-title-row h2 { color: #ffffff !important; }
        [data-theme='dark'] .directory-title-row p { color: #8a99ad !important; }
        [data-theme='dark'] .directory-main-icon { background: #141d33 !important; color: #3b82f6 !important; }
        [data-theme='dark'] .search-wrapper { background: #090d16 !important; border-color: #1f2b45 !important; }
        [data-theme='dark'] .search-wrapper input { color: #ffffff !important; background: transparent !important; }
        [data-theme='dark'] .search-wrapper input::placeholder { color: #8a99ad !important; }
        [data-theme='dark'] .teacher-table-wrapper { border-color: #1a2338 !important; }
        [data-theme='dark'] .teacher-table th { background: #090d16 !important; color: #8a99ad !important; border-bottom-color: #1f2b45 !important; }
        [data-theme='dark'] .teacher-table td { background: #0d1322 !important; border-bottom-color: #161e30 !important; color: #ffffff !important; }
        [data-theme='dark'] .teacher-table tbody tr:hover td { background: #111827 !important; }
        [data-theme='dark'] .teacher-name { color: #ffffff !important; }
        [data-theme='dark'] .teacher-role { color: #8a97ab !important; }
        [data-theme='dark'] .avatar-circle { background: #1a2540 !important; color: #3b82f6 !important; border-color: #233763 !important; }
        [data-theme='dark'] .load-badge { background: #121b2d !important; color: #3b82f6 !important; border-color: #1e2f4a !important; }
        [data-theme='dark'] .capacity-text { color: #8a99ad !important; }
        [data-theme='dark'] .edit-button { background: #16223d !important; color: #3b82f6 !important; border-color: #233763 !important; }
        [data-theme='dark'] .delete-button { background: #2b141d !important; color: #f43f5e !important; border-color: #4a1c29 !important; }
        [data-theme='dark'] .info-card { background: #0d1322 !important; border-color: #1a2338 !important; color: #ffffff !important; }
        [data-theme='dark'] .info-card * { color: #ffffff !important; }
        [data-theme='dark'] .index-cell { color: #3b82f6 !important; }
        [data-theme='dark'] .result-count { background: #121b2d !important; color: #3b82f6 !important; border-color: #1e2f4a !important; }
        [data-theme='dark'] .small-add-button { background: #121b2d !important; color: #3b82f6 !important; border-color: #1e2f4a !important; }
        [data-theme='dark'] .pagination-bar { border-color: #1a2338 !important; }
        [data-theme='dark'] .pagination-info { color: #8a99ad !important; }
        [data-theme='dark'] .hero-import-button { background: #121b2d !important; color: #3b82f6 !important; border-color: #1e2f4a !important; }

      `}</style>

    </div>
  )
}