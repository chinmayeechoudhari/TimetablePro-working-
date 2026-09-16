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
  const [bulkTarget, setBulkTarget] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
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
  const allSelected = legacyClasses.length > 0 && selectedIds.length === legacyClasses.length

  function toggleSelected(id) {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id])
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : legacyClasses.map(c => c.class_id))
  }

  async function removeSelected(ids) {
    if (!ids.length) return
    try {
      for (const id of ids) await axios.delete(`${BASE}/classes/${id}`)
      const removed = new Set(ids)
      setSelectedIds([])
      setBulkTarget(false)
      setTarget(null)
      setMessage(`${ids.length} old class${ids.length === 1 ? '' : 'es'} permanently removed.`)
      setClasses(prev => prev.filter(c => !removed.has(c.class_id)))
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not remove the selected old classes.')
    }
  }

  async function removeClass() {
    if (!target) return
    await removeSelected([target.class_id])
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
              <p>These classes are not linked to the current Academic Structure. Select individual records or select all to permanently remove them.</p>
            </div>
            <div className="academic-legacy-status">
              <Icon name={legacyClasses.length ? 'archive' : 'check'} size={16} />
              {legacyClasses.length ? `${legacyClasses.length} to review` : 'No old classes'}
            </div>
          </div>

          {message && <div className="academic-legacy-message success"><Icon name="check" size={15} />{message}<button onClick={() => setMessage('')}><Icon name="close" size={13} /></button></div>}
          {error && <div className="academic-legacy-message error"><Icon name="info" size={15} />{error}<button onClick={() => setError('')}><Icon name="close" size={13} /></button></div>}

          {legacyClasses.length ? (
            <>
              <div className="academic-legacy-bulkbar">
                <label className="academic-legacy-select-all">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  <span className="academic-legacy-checkbox" />
                  <span className="academic-legacy-select-label">Select all</span>
                  <span className="academic-legacy-selected-count">{selectedIds.length} selected</span>
                </label>
                <span className="academic-legacy-divider" />
                <button
                  className="academic-legacy-bulk-remove"
                  disabled={!selectedIds.length}
                  onClick={() => { setError(''); setBulkTarget(true) }}
                >
                  <Icon name="trash" size={14} /> Remove selected
                </button>
                <span className="academic-legacy-bulk-help">Deletion is permanent.</span>
              </div>

              <div className="academic-legacy-list">
                {legacyClasses.map(c => {
                  const selected = selectedIds.includes(c.class_id)
                  return (
                    <div className={`academic-legacy-row ${selected ? 'selected' : ''}`} key={c.class_id}>
                      <label className="academic-legacy-row-check" aria-label={`Select ${c.class_name}`}>
                        <input type="checkbox" checked={selected} onChange={() => toggleSelected(c.class_id)} />
                        <span className="academic-legacy-checkbox" />
                      </label>
                      <div className="academic-legacy-row-icon"><Icon name="archive" size={16} /></div>
                      <div className="academic-legacy-row-info"><b>{c.class_name}</b><small>Class ID {c.class_id} · old record</small></div>
                      <button className="academic-legacy-remove" onClick={() => { setError(''); setTarget(c) }}><Icon name="trash" size={15} /> Remove old class</button>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="academic-legacy-empty">
              <div className="academic-legacy-empty-icon"><Icon name="check" size={18} /></div>
              <div><b>No old classes found</b><p>There are no old Class records outside the current academic structure.</p></div>
            </div>
          )}
        </div>
      )}

      {(target || bulkTarget) && (
        <div className="academic-legacy-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && (target ? setTarget(null) : setBulkTarget(false))}>
          <div className="academic-legacy-modal">
            <div className="academic-legacy-modal-icon"><Icon name="trash" size={20} /></div>
            <div className="academic-legacy-kicker">CONFIRM PERMANENT REMOVAL</div>
            <h3>{target ? `Remove ${target.class_name}?` : `Remove ${selectedIds.length} old classes?`}</h3>
            <p>{target ? 'This will permanently remove the old class and its associated legacy data. This action cannot be undone.' : `This will permanently remove ${selectedIds.length} selected old class records and their associated legacy data. This action cannot be undone.`}</p>
            <div className="academic-legacy-modal-actions">
              <button className="academic-legacy-cancel" onClick={() => { setTarget(null); setBulkTarget(false) }}>Cancel</button>
              <button className="academic-legacy-confirm" onClick={target ? removeClass : () => removeSelected(selectedIds)}><Icon name="trash" size={15} /> {target ? 'Remove permanently' : 'Remove selected'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
