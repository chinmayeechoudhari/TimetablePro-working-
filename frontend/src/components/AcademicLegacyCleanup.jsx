import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Icon from './AcademicIcon'
import './AcademicLegacyCleanup.css'

const BASE = 'http://localhost:8000'

export default function AcademicLegacyCleanup() {
  const [classes, setClasses] = useState([])
  const [groups, setGroups] = useState([])
  const [open, setOpen] = useState(true)
  const [target, setTarget] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const [classResponse, structureResponse] = await Promise.all([
        axios.get(`${BASE}/classes`),
        axios.get(`${BASE}/academic-structure`),
      ])
      setClasses(classResponse.data || [])
      setGroups(structureResponse.data.groups || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load old class records.')
    }
  }

  useEffect(() => { load() }, [])

  const activeClassIds = useMemo(
    () => new Set(groups.flatMap(g => (g.divisions || []).map(v => v.class_id).filter(Boolean))),
    [groups],
  )
  const legacyClasses = useMemo(
    () => classes.filter(c => !activeClassIds.has(c.class_id)),
    [classes, activeClassIds],
  )

  async function removeClass() {
    if (!target) return
    try {
      await axios.delete(`${BASE}/classes/${target.class_id}`)
      setMessage(`${target.class_name} was removed.`)
      setTarget(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not remove the old class.')
    }
  }

  return (
    <section className="academic-legacy-cleanup">
      <button className="academic-legacy-strip" onClick={() => setOpen(value => !value)}>
        <span className="academic-legacy-icon"><Icon name="archive" size={19} /></span>
        <span className="academic-legacy-heading">
          <b>Remove Old Classes</b>
          <small>Clean up classes created through the previous Classes page</small>
        </span>
        <span className="academic-legacy-count">{legacyClasses.length}</span>
        <strong>{open ? '−' : '+'}</strong>
      </button>

      {open && (
        <div className="academic-legacy-panel">
          <div className="academic-legacy-panel-head">
            <div>
              <div className="academic-legacy-kicker">LEGACY DATA CLEANUP</div>
              <h3>Old class records</h3>
              <p>These classes are not linked to the current Academic Structure. Remove them only when you no longer need their old data.</p>
            </div>
            <div className="academic-legacy-status">
              <Icon name={legacyClasses.length ? 'archive' : 'check'} size={16} />
              {legacyClasses.length ? `${legacyClasses.length} to review` : 'No old classes'}
            </div>
          </div>

          {message && <div className="academic-legacy-message success"><Icon name="check" size={15} />{message}<button onClick={() => setMessage('')}><Icon name="close" size={13} /></button></div>}
          {error && <div className="academic-legacy-message error"><Icon name="alert" size={15} />{error}<button onClick={() => setError('')}><Icon name="close" size={13} /></button></div>}

          {legacyClasses.length ? (
            <div className="academic-legacy-list">
              {legacyClasses.map(c => (
                <div className="academic-legacy-row" key={c.class_id}>
                  <div className="academic-legacy-row-icon"><Icon name="archive" size={16} /></div>
                  <div className="academic-legacy-row-info"><b>{c.class_name}</b><small>Class ID {c.class_id} · old record</small></div>
                  <button className="academic-legacy-remove" onClick={() => { setError(''); setTarget(c) }}><Icon name="trash" size={15} /> Remove old class</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="academic-legacy-empty">
              <div className="academic-legacy-empty-icon"><Icon name="check" size={18} /></div>
              <div><b>No old classes found</b><p>There are no old Class records outside the current academic structure.</p></div>
            </div>
          )}
        </div>
      )}

      {target && (
        <div className="academic-legacy-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setTarget(null)}>
          <div className="academic-legacy-modal">
            <div className="academic-legacy-modal-icon"><Icon name="trash" size={20} /></div>
            <div className="academic-legacy-kicker">CONFIRM REMOVAL</div>
            <h3>Remove {target.class_name}?</h3>
            <p>This will permanently remove the old class and its associated legacy data. This action cannot be undone.</p>
            <div className="academic-legacy-modal-actions">
              <button className="academic-legacy-cancel" onClick={() => setTarget(null)}>Cancel</button>
              <button className="academic-legacy-confirm" onClick={removeClass}><Icon name="trash" size={15} /> Remove permanently</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
