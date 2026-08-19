import { useEffect, useMemo, useState } from 'react'
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
    building: (
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

    lab: (
      <>
        <path d="M9 3h6" />
        <path d="M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3" />
        <path d="M7.2 16h9.6" />
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

    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

export default function RoomForm() {
  const [rooms, setRooms] = useState([])

  const [number, setNumber] = useState('')
  const [roomType, setRoomType] = useState('classroom')

  const [activeTab, setActiveTab] = useState('classroom')
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchRooms()
  }, [])

  async function fetchRooms() {
    try {
      const res = await axios.get(`${BASE}/rooms`)
      setRooms(res.data)
    } catch {
      setError('Could not load rooms.')
    }
  }

  function openAddForm(type = activeTab) {
    setEditingId(null)
    setNumber('')
    setRoomType(type)
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function openEditForm(room) {
    setEditingId(room.room_id)
    setNumber(room.room_number)
    setRoomType(room.room_type)
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    if (isSaving) return

    setShowForm(false)
    setEditingId(null)
    setNumber('')
    setRoomType('classroom')
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const trimmedNumber = number.trim()

    if (!trimmedNumber) {
      setError('Room number is required.')
      return
    }

    setMessage('')
    setError('')
    setIsSaving(true)

    try {
      if (editingId) {
        await axios.put(`${BASE}/rooms/${editingId}`, {
          room_number: trimmedNumber,
          room_type: roomType,
        })

        setMessage(`Room "${trimmedNumber}" updated successfully.`)
      } else {
        await axios.post(`${BASE}/rooms`, {
          room_number: trimmedNumber,
          room_type: roomType,
        })

        setMessage(`Room "${trimmedNumber}" added successfully.`)
      }

      await fetchRooms()

      setShowForm(false)
      setEditingId(null)
      setNumber('')
      setRoomType('classroom')
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not save the room. Please try again.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  function promptDelete(room) {
    setDeleteTarget(room)
    setError('')
    setMessage('')
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)
    setError('')
    setMessage('')

    try {
      await axios.delete(`${BASE}/rooms/${deleteTarget.room_id}`)

      await fetchRooms()

      setMessage(
        `Room "${deleteTarget.room_number}" deleted successfully.`
      )

      if (editingId === deleteTarget.room_id) {
        closeForm()
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not delete the room.'
      )
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const classroomCount = rooms.filter(
    room => room.room_type === 'classroom'
  ).length

  const labCount = rooms.filter(
    room => room.room_type === 'lab'
  ).length

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase()

    return rooms
      .filter(room => room.room_type === activeTab)
      .filter(room =>
        room.room_number.toLowerCase().includes(query)
      )
  }, [rooms, activeTab, search])

  const currentCount =
    activeTab === 'classroom' ? classroomCount : labCount

  const isLab = activeTab === 'lab'

  return (
    <div className="rooms-page">

      {/* =========================================================
          PAGE HEADER
      ========================================================= */}

      <section className="rooms-hero">

        <div className="rooms-watermark" aria-hidden="true">
          <svg viewBox="0 0 620 220" fill="none">
            <path
              d="M70 185V92l105-58 105 58v93"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M112 185v-58h54v58M203 185v-58h54v58"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M145 92h60M145 116h60"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M315 185V62l85-43 85 43v123"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M350 185v-55h38v55M407 185v-55h38v55"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M368 82h64M368 105h64"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M40 185h540"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="hero-left">

          <div className="hero-icon">
            <Icon name="building" size={32} stroke={1.7} />
          </div>

          <div>
            <div className="eyebrow">
              ACADEMIC SCHEDULING
            </div>

            <h1>Rooms</h1>

            <div className="hero-subtitle">
              Room &amp; Facility Management
            </div>

            <p>
              Organize academic spaces used by the timetable system
            </p>
          </div>

        </div>

        <button
          className="primary-button hero-add-button"
          onClick={() => openAddForm(activeTab)}
        >
          <Icon name="plus" size={19} />
          Add Room
        </button>

      </section>


      {/* =========================================================
          STATS
      ========================================================= */}

      <section className="stats-grid">

        <div className="stat-card stat-blue">
          <div className="stat-icon">
            <Icon name="building" size={27} />
          </div>
          <div>
            <div className="stat-label">TOTAL SPACES</div>
            <div className="stat-number">{rooms.length}</div>
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

        <div className="stat-card stat-green">
          <div className="stat-icon">
            <Icon name="building" size={27} />
          </div>
          <div>
            <div className="stat-label">CLASSROOMS</div>
            <div className="stat-number">{classroomCount}</div>
          </div>
          <div className="stat-decoration">
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

        <div className="stat-card stat-purple">
          <div className="stat-icon">
            <Icon name="lab" size={27} />
          </div>
          <div>
            <div className="stat-label">LABORATORIES</div>
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


      {/* =========================================================
          GLOBAL MESSAGES
      ========================================================= */}

      {message && (
        <div className="message success-message">
          <Icon name="check" size={17} />
          {message}
        </div>
      )}

      {error && !showForm && (
        <div className="message error-message">
          {error}
        </div>
      )}


      {/* =========================================================
          CATEGORY TABS
      ========================================================= */}

      <section className="category-tabs">

        <button
          className={`category-tab ${
            activeTab === 'classroom' ? 'active classroom-active' : ''
          }`}
          onClick={() => {
            setActiveTab('classroom')
            setSearch('')
          }}
        >
          <div className="tab-icon classroom-icon">
            <Icon name="building" size={23} />
          </div>

          <div className="tab-content">
            <strong>Classrooms</strong>
            <span>
              {classroomCount} lecture spaces
            </span>
          </div>
        </button>


        <button
          className={`category-tab ${
            activeTab === 'lab' ? 'active lab-active' : ''
          }`}
          onClick={() => {
            setActiveTab('lab')
            setSearch('')
          }}
        >
          <div className="tab-icon lab-icon">
            <Icon name="lab" size={23} />
          </div>

          <div className="tab-content">
            <strong>Laboratories</strong>
            <span>
              {labCount} practical spaces
            </span>
          </div>
        </button>

      </section>


      {/* =========================================================
          DIRECTORY
      ========================================================= */}

      <section className="directory-card">

        <div className="directory-header">

          <div className="directory-title-block">

            <div className="directory-eyebrow">
              ROOM DIRECTORY
            </div>

            <div className="directory-title-row">

              <div
                className={`directory-main-icon ${
                  isLab ? 'directory-lab-icon' : ''
                }`}
              >
                <Icon
                  name={isLab ? 'lab' : 'building'}
                  size={25}
                />
              </div>

              <div>
                <h2>
                  {isLab ? 'Laboratories' : 'Classrooms'}
                </h2>

                <p>
                  {isLab
                    ? 'Practical spaces available for lab-based timetable slots.'
                    : 'Lecture spaces available for theory-based timetable slots.'}
                </p>
              </div>

            </div>

          </div>


          <div className="directory-actions">

            <div className="result-count">
              {currentCount}{' '}
              {isLab
                ? currentCount === 1
                  ? 'laboratory'
                  : 'laboratories'
                : currentCount === 1
                ? 'classroom'
                : 'classrooms'}
            </div>

            <button
              className="small-add-button"
              onClick={() => openAddForm(activeTab)}
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
            onChange={e => setSearch(e.target.value)}
            placeholder={
              isLab
                ? 'Search laboratories by room number...'
                : 'Search classrooms by room number...'
            }
          />

          {search && (
            <button
              className="clear-search"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}

        </div>


        {/* DIRECTORY TABLE */}

        {filteredRooms.length > 0 ? (

          <div className="room-table-wrapper">

            <table className="room-table">

              <thead>
                <tr>
                  <th className="index-column">#</th>
                  <th>
                    {isLab ? 'LABORATORY' : 'CLASSROOM'}
                  </th>
                  <th>SCHEDULING ROLE</th>
                  <th className="actions-column">ACTIONS</th>
                </tr>
              </thead>

              <tbody>

                {filteredRooms.map((room, index) => (

                  <tr key={room.room_id}>

                    <td className="index-cell">
                      {String(index + 1).padStart(2, '0')}
                    </td>


                    <td>

                      <div className="room-name-cell">

                        <div
                          className={`room-icon ${
                            room.room_type === 'lab'
                              ? 'room-icon-lab'
                              : 'room-icon-classroom'
                          }`}
                        >
                          <Icon
                            name={
                              room.room_type === 'lab'
                                ? 'lab'
                                : 'building'
                            }
                            size={21}
                          />
                        </div>

                        <div>
                          <div className="room-number">
                            {room.room_number}
                          </div>

                          <div className="room-description">
                            {room.room_type === 'lab'
                              ? 'Practical facility'
                              : 'Lecture facility'}
                          </div>
                        </div>

                      </div>

                    </td>


                    <td>

                      <div className="role-cell">

                        <span
                          className={`role-badge ${
                            room.room_type === 'lab'
                              ? 'role-lab'
                              : 'role-theory'
                          }`}
                        >
                          {room.room_type === 'lab'
                            ? 'LAB'
                            : 'THEORY'}
                        </span>

                        <span className="role-description">
                          {room.room_type === 'lab'
                            ? 'Practical sessions'
                            : 'Theory sessions'}
                        </span>

                      </div>

                    </td>


                    <td className="actions-cell">

                      <button
                        className="edit-button"
                        onClick={() => openEditForm(room)}
                      >
                        <Icon name="edit" size={16} />
                        Edit
                      </button>

                      <button
                        className="delete-button"
                        onClick={() => promptDelete(room)}
                      >
                        <Icon name="trash" size={16} />
                        Delete
                      </button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

            <div className="table-footer">
              Showing {filteredRooms.length} of {currentCount}{' '}
              {isLab
                ? currentCount === 1
                  ? 'laboratory'
                  : 'laboratories'
                : currentCount === 1
                ? 'classroom'
                : 'classrooms'}
            </div>

          </div>

        ) : (

          <div className="empty-state">

            <div
              className={`empty-icon ${
                isLab ? 'empty-icon-lab' : ''
              }`}
            >
              <Icon
                name={isLab ? 'lab' : 'building'}
                size={29}
              />
            </div>

            <h3>
              {search
                ? 'No matching rooms'
                : `No ${isLab ? 'laboratories' : 'classrooms'} yet`}
            </h3>

            <p>
              {search
                ? 'Try a different room number.'
                : `Add your first ${
                    isLab ? 'laboratory' : 'classroom'
                  } to start building your timetable resources.`}
            </p>

            {!search && (
              <button
                className="primary-button empty-add-button"
                onClick={() => openAddForm(activeTab)}
              >
                <Icon name="plus" size={18} />
                Add {isLab ? 'Laboratory' : 'Classroom'}
              </button>
            )}

          </div>

        )}

      </section>


      {/* =========================================================
          ADD / EDIT MODAL
      ========================================================= */}

      {showForm && (

        <div
          className="room-modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              closeForm()
            }
          }}
        >

          <form
            className="room-modal"
            onSubmit={handleSubmit}
          >

            <div className="modal-header">

              <div className="modal-title-group">

                <div
                  className={`modal-icon ${
                    roomType === 'lab'
                      ? 'modal-icon-lab'
                      : ''
                  }`}
                >
                  <Icon
                    name={
                      roomType === 'lab'
                        ? 'lab'
                        : 'building'
                    }
                    size={24}
                  />
                </div>

                <div>
                  <div className="modal-eyebrow">
                    ROOM MANAGEMENT
                  </div>

                  <h2>
                    {editingId
                      ? 'Edit Room'
                      : 'Add Room'}
                  </h2>

                  <p>
                    {editingId
                      ? 'Update this academic space.'
                      : 'Create a classroom or laboratory space.'}
                  </p>
                </div>

              </div>


              <button
                type="button"
                className="modal-close"
                onClick={closeForm}
                disabled={isSaving}
              >
                <Icon name="close" size={19} />
              </button>

            </div>


            <div className="modal-body">

              <div className="form-field">

                <label htmlFor="room-number">
                  Room number
                </label>

                <input
                  id="room-number"
                  value={number}
                  onChange={e => setNumber(e.target.value)}
                  placeholder={
                    roomType === 'lab'
                      ? 'e.g. LAB-101'
                      : 'e.g. 101'
                  }
                  autoFocus
                  required
                />

                <span>
                  This exact label will appear in the timetable.
                </span>

              </div>


              <div className="form-field">

                <label>Space type</label>

                <div className="type-selector">

                  <button
                    type="button"
                    className={`type-option ${
                      roomType === 'classroom'
                        ? 'selected classroom-option'
                        : ''
                    }`}
                    onClick={() =>
                      setRoomType('classroom')
                    }
                  >

                    <div className="type-option-icon">
                      <Icon
                        name="building"
                        size={22}
                      />
                    </div>

                    <div>
                      <strong>Classroom</strong>
                      <span>
                        Lectures &amp; theory
                      </span>
                    </div>

                  </button>


                  <button
                    type="button"
                    className={`type-option ${
                      roomType === 'lab'
                        ? 'selected lab-option'
                        : ''
                    }`}
                    onClick={() =>
                      setRoomType('lab')
                    }
                  >

                    <div className="type-option-icon">
                      <Icon
                        name="lab"
                        size={22}
                      />
                    </div>

                    <div>
                      <strong>Laboratory</strong>
                      <span>
                        Practical sessions
                      </span>
                    </div>

                  </button>

                </div>

              </div>


              {error && (
                <div className="modal-error">
                  {error}
                </div>
              )}

            </div>


            <div className="modal-footer">

              <button
                type="button"
                className="secondary-button"
                onClick={closeForm}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={isSaving}
              >
                {isSaving ? (
                  'Saving...'
                ) : editingId ? (
                  <>
                    <Icon name="check" size={17} />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={17} />
                    Add Room
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
        title="Delete Room"
        itemName={deleteTarget?.room_number}
        message="Are you sure you want to delete this room? This will disassociate any assigned timetable entries."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />


      {/* =========================================================
          PAGE STYLES
      ========================================================= */}

      <style>{`

        .rooms-page {
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

        .rooms-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
          min-height: 205px;
          padding: 26px 30px;
          margin-bottom: 22px;
          border: 1px solid #dfe7f4;
          border-radius: 24px;
          background:
            linear-gradient(
              135deg,
              #ffffff 0%,
              #f8faff 58%,
              #f2f5ff 100%
            );
          box-shadow:
            0 12px 36px rgba(28, 52, 96, 0.06);
        }

        .hero-left {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hero-icon {
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #2563eb;
          border: 1px solid #cbdcff;
          border-radius: 20px;
          background: linear-gradient(
            145deg,
            #eff5ff,
            #e0eaff
          );
          box-shadow:
            0 10px 24px rgba(37, 99, 235, 0.08);
        }

        .eyebrow {
          margin-bottom: 5px;
          color: #3564bb;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .rooms-hero h1 {
          margin: 0;
          color: #101b35;
          font-size: 34px;
          line-height: 1.08;
          letter-spacing: -0.035em;
          font-weight: 800;
        }

        .hero-subtitle {
          margin-top: 7px;
          color: #4a5d84;
          font-size: 17px;
          line-height: 1.3;
          font-weight: 650;
        }

        .rooms-hero p {
          margin: 7px 0 0;
          color: #71809d;
          font-size: 13px;
          line-height: 1.5;
        }

        .rooms-watermark {
          position: absolute;
          z-index: 1;
          right: 70px;
          bottom: -2px;
          width: min(48%, 620px);
          color: #8fa8e7;
          opacity: 0.13;
          pointer-events: none;
        }

        .rooms-watermark svg {
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
          background: linear-gradient(
            135deg,
            #326bf0,
            #2458db
          );
          color: white;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          box-shadow:
            0 9px 20px rgba(37, 99, 235, 0.20);
          transition:
            transform 0.16s ease,
            box-shadow 0.16s ease,
            filter 0.16s ease;
        }

        .primary-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
          box-shadow:
            0 12px 25px rgba(37, 99, 235, 0.25);
        }

        .primary-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .hero-add-button {
          position: relative;
          z-index: 3;
          min-width: 140px;
          min-height: 48px;
          font-size: 14px;
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
          min-height: 102px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 19px 21px;
          border: 1px solid #dfe6f2;
          border-radius: 17px;
          background: white;
          box-shadow:
            0 7px 22px rgba(30, 48, 87, 0.045);
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

        .stat-blue .stat-icon {
          color: #2563eb;
          background: #eaf1ff;
        }

        .stat-green .stat-icon {
          color: #15945a;
          background: #e7f8ef;
        }

        .stat-purple .stat-icon {
          color: #7041d9;
          background: #f0eaff;
        }

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

        .stat-blue .stat-number {
          color: #2563eb;
        }

        .stat-green .stat-number {
          color: #148451;
        }

        .stat-purple .stat-number {
          color: #7041d9;
        }

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
        .stat-green .stat-decoration { }
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
           CATEGORY TABS
        ========================= */

        .category-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-bottom: 20px;
          overflow: hidden;
          border: 1px solid #dce4f0;
          border-radius: 17px;
          background: white;
          box-shadow:
            0 6px 20px rgba(30, 48, 87, 0.04);
        }

        .category-tab {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          min-height: 88px;
          padding: 14px 20px;
          border: 0;
          background: white;
          color: #667594;
          cursor: pointer;
          text-align: left;
          transition:
            background 0.18s ease,
            color 0.18s ease;
        }

        .category-tab + .category-tab {
          border-left: 1px solid #e3e8f1;
        }

        .category-tab:hover {
          background: #fafcff;
        }

        .category-tab.active {
          background: linear-gradient(
            180deg,
            #fbfdff,
            #f5f8ff
          );
        }

        .category-tab.active::after {
          content: '';
          position: absolute;
          left: 13%;
          right: 13%;
          bottom: 0;
          height: 3px;
          border-radius: 5px 5px 0 0;
        }

        .classroom-active::after {
          background: #2864eb;
        }

        .lab-active::after {
          background: #7846dc;
        }

        .tab-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 14px;
        }

        .classroom-icon {
          color: #2563eb;
          background: #edf3ff;
        }

        .lab-icon {
          color: #7541d5;
          background: #f1ebff;
        }

        .tab-content {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .tab-content strong {
          color: #172441;
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.035em;
        }

        .tab-content span {
          color: #73819c;
          font-size: 12px;
        }

        /* =========================
           DIRECTORY
        ========================= */

        .directory-card {
          overflow: hidden;
          border: 1px solid #dfe6f1;
          border-radius: 20px;
          background: white;
          box-shadow:
            0 10px 30px rgba(28, 48, 90, 0.055);
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

        .directory-lab-icon {
          color: #7140d3;
          background: #f1ebff;
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
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .search-wrapper:focus-within {
          border-color: #8db0f5;
          background: white;
          box-shadow:
            0 0 0 3px rgba(37, 99, 235, 0.08);
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

        .room-table-wrapper {
          margin: 0 14px 14px;
          overflow: hidden;
          border: 1px solid #e1e7f0;
          border-radius: 14px;
        }

        .room-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .room-table th {
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

        .room-table th:nth-child(1) {
          width: 70px;
        }

        .room-table th:nth-child(2) {
          width: 36%;
        }

        .room-table th:nth-child(3) {
          width: 32%;
        }

        .room-table th:nth-child(4) {
          width: 205px;
        }

        .room-table td {
          height: 82px;
          padding: 12px 14px;
          border-bottom: 1px solid #e7ebf2;
          background: white;
          vertical-align: middle;
        }

        .room-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .room-table tbody tr:hover td {
          background: #fbfcff;
        }

        .index-cell {
          color: #3566d8;
          font-size: 15px;
          font-weight: 800;
        }

        .room-name-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .room-icon {
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 13px;
        }

        .room-icon-classroom {
          color: #2563eb;
          background: #edf3ff;
        }

        .room-icon-lab {
          color: #7441d6;
          background: #f1ebff;
        }

        .room-number {
          color: #15213d;
          font-size: 14px;
          font-weight: 800;
        }

        .room-description {
          margin-top: 3px;
          color: #8a97ab;
          font-size: 11px;
        }

        .role-cell {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.04em;
        }

        .role-theory {
          color: #245bd2;
          border: 1px solid #c9d9ff;
          background: #edf3ff;
        }

        .role-lab {
          color: #7540d3;
          border: 1px solid #d8c7ff;
          background: #f2edff;
        }

        .role-description {
          color: #7c899f;
          font-size: 11px;
        }

        .actions-cell {
          text-align: right;
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

        .edit-button:hover {
          background: #eaf1ff;
        }

        .delete-button {
          color: #d12c2c;
          border: 1px solid #f2cccc;
          background: #fff7f7;
        }

        .delete-button:hover {
          background: #fff0f0;
        }

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
          margin: 0 14px 14px;
          padding: 54px 25px;
          border: 1px dashed #cad5e5;
          border-radius: 14px;
          background:
            linear-gradient(
              180deg,
              #fbfcff,
              #f8faff
            );
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

        .empty-icon-lab {
          color: #7441d6;
          background: #f1ebff;
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

        /* =========================
           MODAL
        ========================= */

        .room-modal-backdrop {
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

        .room-modal {
          width: min(560px, 100%);
          overflow: hidden;
          border: 1px solid #dbe3ef;
          border-radius: 20px;
          background: white;
          box-shadow:
            0 30px 80px rgba(12, 25, 52, 0.22);
          animation: roomModalIn 0.16s ease-out;
        }

        @keyframes roomModalIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
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

        .modal-icon-lab {
          color: #7441d6;
          background: #f1ebff;
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
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .form-field > input:focus {
          border-color: #8eaff2;
          background: white;
          box-shadow:
            0 0 0 3px rgba(37, 99, 235, 0.08);
        }

        .form-field > span {
          display: block;
          margin-top: 7px;
          color: #8a97aa;
          font-size: 10px;
        }

        .type-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .type-option {
          display: flex;
          align-items: center;
          gap: 11px;
          min-height: 70px;
          padding: 11px;
          border: 1px solid #d7dfeb;
          border-radius: 12px;
          background: #fbfcfe;
          color: #65738e;
          text-align: left;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            box-shadow 0.15s ease;
        }

        .type-option:hover {
          background: #f7f9fd;
        }

        .type-option.selected {
          box-shadow:
            0 5px 14px rgba(30, 48, 90, 0.055);
        }

        .classroom-option.selected {
          border-color: #7ca4f5;
          background: #f2f6ff;
          color: #245bd2;
        }

        .lab-option.selected {
          border-color: #b49ae9;
          background: #f5f1ff;
          color: #7441d6;
        }

        .type-option-icon {
          width: 39px;
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: rgba(255,255,255,0.7);
        }

        .type-option strong {
          display: block;
          color: #1d2a45;
          font-size: 12px;
          font-weight: 800;
        }

        .type-option span {
          margin-top: 3px;
          color: #8490a5;
          font-size: 10px;
        }

        .modal-error {
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
           RESPONSIVE
        ========================= */

        @media (max-width: 1000px) {

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .rooms-watermark {
            right: -40px;
            width: 55%;
          }

          .room-table th:nth-child(3),
          .room-table td:nth-child(3) {
            display: none;
          }

        }

        @media (max-width: 720px) {

          .rooms-page {
            padding: 4px 0 30px;
          }

          .rooms-hero {
            min-height: auto;
            align-items: flex-start;
            flex-direction: column;
            padding: 22px;
          }

          .hero-left {
            align-items: flex-start;
          }

          .rooms-hero h1 {
            font-size: 29px;
          }

          .hero-add-button {
            width: 100%;
          }

          .rooms-watermark {
            right: -70px;
            bottom: 0;
            width: 85%;
          }

          .directory-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .directory-actions {
            width: 100%;
            justify-content: space-between;
          }

          .category-tab {
            justify-content: flex-start;
            min-height: 78px;
            padding: 12px;
          }

          .tab-icon {
            width: 40px;
            height: 40px;
          }

          .tab-content strong {
            font-size: 11px;
          }

          .tab-content span {
            font-size: 10px;
          }

          .room-table th:nth-child(1),
          .room-table td:nth-child(1) {
            display: none;
          }

          .room-table th:nth-child(4) {
            width: 112px;
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

          .type-selector {
            grid-template-columns: 1fr;
          }

          .room-modal-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .room-modal {
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

          .rooms-hero p {
            font-size: 11px;
          }

          .stat-card {
            min-height: 88px;
          }

          .directory-header,
          .search-wrapper {
            margin-left: 16px;
            margin-right: 16px;
          }

          .directory-header {
            padding-left: 0;
            padding-right: 0;
          }

          .directory-title-row p {
            max-width: 240px;
          }

          .room-table th,
          .room-table td {
            padding-left: 9px;
            padding-right: 9px;
          }
        }

        /* ── DARK THEME OVERRIDES ── */
        [data-theme='dark'] .rooms-page { color: #ffffff; }
        [data-theme='dark'] .rooms-hero { background: #0d1322 !important; border-color: #1a2338 !important; box-shadow: none !important; }
        [data-theme='dark'] .rooms-hero h1 { color: #ffffff !important; }
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
        [data-theme='dark'] .room-table-wrapper { border-color: #1a2338 !important; }
        [data-theme='dark'] .room-table th { background: #090d16 !important; color: #8a99ad !important; border-bottom-color: #1f2b45 !important; }
        [data-theme='dark'] .room-table td { background: #0d1322 !important; border-bottom-color: #161e30 !important; color: #ffffff !important; }
        [data-theme='dark'] .room-table tbody tr:hover td { background: #111827 !important; }
        [data-theme='dark'] .room-number { color: #ffffff !important; }
        [data-theme='dark'] .room-sub { color: #8a97ab !important; }
        [data-theme='dark'] .avatar-circle { background: #1a2540 !important; color: #3b82f6 !important; border-color: #233763 !important; }
        [data-theme='dark'] .edit-button { background: #16223d !important; color: #3b82f6 !important; border-color: #233763 !important; }
        [data-theme='dark'] .delete-button { background: #2b141d !important; color: #f43f5e !important; border-color: #4a1c29 !important; }
        [data-theme='dark'] .info-card { background: #0d1322 !important; border-color: #1a2338 !important; color: #ffffff !important; }
        [data-theme='dark'] .info-card * { color: #ffffff !important; }
        [data-theme='dark'] .index-cell { color: #3b82f6 !important; }
        [data-theme='dark'] .role-badge { background: #16223d !important; color: #3b82f6 !important; border-color: #233763 !important; }

      `}</style>

    </div>
  )
}