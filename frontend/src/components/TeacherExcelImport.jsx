import { useState, useRef, useCallback } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'

const BASE = 'http://localhost:8000'

function ImportIcon({ name, size = 20, stroke = 1.9 }) {
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
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
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
  }

  return <svg {...common}>{paths[name]}</svg>
}

export default function TeacherExcelImport({
  isOpen,
  onClose,
  onImportComplete,
}) {
  const [stage, setStage] = useState('upload')
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewRows, setPreviewRows] = useState([])
  const [importResult, setImportResult] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const resetState = useCallback(() => {
    setStage('upload')
    setFileName('')
    setSelectedFile(null)
    setPreviewRows([])
    setImportResult(null)
    setError('')
    setDragOver(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  function handleClose() {
    if (stage === 'importing') return
    resetState()
    onClose()
  }

  function normalise(value) {
    return (value ?? '').toString().trim().replace(/\s+/g, ' ')
  }

  function processFile(file) {
    setError('')

    if (!file) return

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Only .xlsx files are supported.')
      return
    }

    setFileName(file.name)
    setSelectedFile(file)

    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null

        if (!sheet) {
          setError('The Excel file has no sheets.')
          return
        }

        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (rawRows.length === 0) {
          setError('The Excel file contains no data rows.')
          return
        }

        // Resolve columns case-insensitively and tolerate minor whitespace differences.
        const originalHeaders = Object.keys(rawRows[0])
        const headerMap = Object.fromEntries(
          originalHeaders.map((header) => [
            normalise(header).toLowerCase().replace(/\s+/g, '_'),
            header,
          ])
        )

        const teacherColumn = headerMap.teacher_name
        const periodsColumn = headerMap.max_periods_per_day

        if (!teacherColumn || !periodsColumn) {
          setError(
            'Missing required columns: teacher_name, max_periods_per_day'
          )
          return
        }

        const seenNames = new Map()

        const rows = rawRows.map((rawRow, index) => {
          const rowNumber = index + 2
          const rawName = rawRow[teacherColumn]
          const rawPeriods = rawRow[periodsColumn]
          const name = normalise(rawName)

          if (!name) {
            return {
              row: rowNumber,
              teacher_name: '',
              max_periods_per_day: null,
              status: 'invalid',
              reason: 'Teacher name is empty.',
            }
          }

          if (name.length > 100) {
            return {
              row: rowNumber,
              teacher_name: `${name.slice(0, 50)}...`,
              max_periods_per_day: null,
              status: 'invalid',
              reason: 'Name exceeds 100 characters.',
            }
          }

          const rawPeriodText = normalise(rawPeriods)
          const periods = Number(rawPeriods)

          if (
            rawPeriodText === '' ||
            !Number.isFinite(periods) ||
            !Number.isInteger(periods)
          ) {
            return {
              row: rowNumber,
              teacher_name: name,
              max_periods_per_day: null,
              status: 'invalid',
              reason: `Invalid max periods: '${rawPeriodText}'.`,
            }
          }

          if (periods < 1 || periods > 8) {
            return {
              row: rowNumber,
              teacher_name: name,
              max_periods_per_day: periods,
              status: 'invalid',
              reason: `Max periods must be 1–8 (got ${periods}).`,
            }
          }

          const nameKey = name.toLowerCase()

          if (seenNames.has(nameKey)) {
            return {
              row: rowNumber,
              teacher_name: name,
              max_periods_per_day: periods,
              status: 'skipped',
              reason: `Duplicate of row ${seenNames.get(nameKey)}.`,
            }
          }

          seenNames.set(nameKey, rowNumber)

          return {
            row: rowNumber,
            teacher_name: name,
            max_periods_per_day: periods,
            status: 'valid',
            reason: null,
          }
        })

        setPreviewRows(rows)
        setStage('preview')
      } catch {
        setError(
          'Could not parse the Excel file. Please check the file format and try again.'
        )
      }
    }

    reader.onerror = () => {
      setError('Could not read the selected file.')
    }

    reader.readAsArrayBuffer(file)
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragOver(false)

    const file = event.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  async function handleDownloadTemplate() {
    setError('')

    try {
      const response = await axios.get(`${BASE}/teachers/import/template`, {
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )

      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'teacher_import_template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Could not download the template. Is the backend running?')
    }
  }

  async function handleImport() {
    if (!selectedFile) return

    setStage('importing')
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await axios.post(
        `${BASE}/teachers/import`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setImportResult(response.data)
      setStage('result')

      if (response.data.imported > 0) {
        onImportComplete()
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(detail || 'Import failed. Please try again.')
      setStage('preview')
    }
  }

  if (!isOpen) return null

  const validCount = previewRows.filter(
    (row) => row.status === 'valid'
  ).length
  const skippedCount = previewRows.filter(
    (row) => row.status === 'skipped'
  ).length
  const invalidCount = previewRows.filter(
    (row) => row.status === 'invalid'
  ).length

  const processedCount = importResult?.total ?? 0
  const importedCount = importResult?.imported ?? 0
  const failedCount = importResult?.failed ?? 0

  return (
    <div
      className="teacher-modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          stage !== 'importing'
        ) {
          handleClose()
        }
      }}
    >
      <div className="teacher-modal import-modal">
        <div className="modal-header import-header">
          <div className="modal-title-group">
            <div className="modal-icon import-title-icon">
              <ImportIcon name="upload" size={22} />
            </div>

            <div>
              <div className="modal-eyebrow">BULK IMPORT</div>
              <h2>Import Teachers</h2>
              <p>
                Add multiple teachers to the directory from one Excel file.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            disabled={stage === 'importing'}
            aria-label="Close import dialog"
          >
            <ImportIcon name="close" size={19} />
          </button>
        </div>

        <div className="import-progress">
          {['upload', 'preview', 'result'].map((item, index) => {
            const labels = ['Upload', 'Review', 'Complete']
            const active =
              stage === item ||
              (stage === 'importing' && item === 'result')

            const complete =
              (stage === 'preview' && index === 0) ||
              (stage === 'importing' && index === 0) ||
              (stage === 'result' && index < 2)

            return (
              <div
                key={item}
                className={`progress-step ${active ? 'is-active' : ''
                  } ${complete ? 'is-complete' : ''}`}
              >
                <span className="progress-number">
                  {complete ? <ImportIcon name="check" size={12} /> : index + 1}
                </span>
                <span>{labels[index]}</span>
              </div>
            )
          })}
        </div>

        <div className="modal-body import-body">
          {stage === 'upload' && (
            <div className="upload-stage">
              <div
                className={`import-dropzone ${dragOver ? 'drag-over' : ''
                  }`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    fileInputRef.current?.click()
                  }
                }}
              >
                <div className="dropzone-icon">
                  <ImportIcon name="upload" size={27} />
                </div>

                <div className="dropzone-title">
                  Drop your Excel file here
                </div>

                <div className="dropzone-subtitle">
                  or click to browse from your computer
                </div>

                <div className="dropzone-hint">
                  XLSX format · teacher_name · max_periods_per_day
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="upload-helper">
                <div className="helper-icon">
                  <ImportIcon name="info" size={15} />
                </div>
                <div>
                  <strong>Using the template?</strong>
                  <span>
                    Keep the column names unchanged for the smoothest import.
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="template-button"
                onClick={handleDownloadTemplate}
              >
                <ImportIcon name="download" size={16} />
                Download Excel Template
              </button>
            </div>
          )}

          {stage === 'preview' && (
            <>
              <div className="import-file-info">
                <div className="file-badge">
                  <div className="file-badge-icon">
                    <ImportIcon name="file" size={17} />
                  </div>
                  <div className="file-copy">
                    <div className="file-name">{fileName}</div>
                    <div className="file-meta">
                      {previewRows.length} row
                      {previewRows.length !== 1 ? 's' : ''} detected
                    </div>
                  </div>
                  <span className="file-ready">READY TO REVIEW</span>
                </div>
              </div>

              <div className="import-summary">
                <div className="summary-heading">
                  <span>Import preview</span>
                  <small>Review the rows before importing</small>
                </div>

                <div className="summary-badges">
                  {validCount > 0 && (
                    <div className="summary-badge summary-valid">
                      <ImportIcon name="check" size={13} />
                      {validCount} valid
                    </div>
                  )}

                  {skippedCount > 0 && (
                    <div className="summary-badge summary-skipped">
                      <ImportIcon name="alert" size={13} />
                      {skippedCount} duplicate
                      {skippedCount !== 1 ? 's' : ''}
                    </div>
                  )}

                  {invalidCount > 0 && (
                    <div className="summary-badge summary-invalid">
                      <ImportIcon name="close" size={13} />
                      {invalidCount} invalid
                    </div>
                  )}
                </div>
              </div>

              <div className="import-table-wrapper">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th className="column-number">#</th>
                      <th>TEACHER</th>
                      <th className="column-capacity">DAILY CAPACITY</th>
                      <th className="column-status">STATUS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map((row) => (
                      <tr
                        key={row.row}
                        className={`import-row-${row.status}`}
                      >
                        <td className="row-number">
                          {String(row.row).padStart(2, '0')}
                        </td>

                        <td className="teacher-cell">
                          {row.teacher_name || (
                            <span className="empty-value">empty</span>
                          )}
                        </td>

                        <td className="capacity-cell">
                          {row.max_periods_per_day != null ? (
                            <span className="preview-load-badge">
                              {row.max_periods_per_day}
                            </span>
                          ) : (
                            <span className="missing-value">—</span>
                          )}
                        </td>

                        <td className="status-cell">
                          {row.status === 'valid' && (
                            <span className="status-badge status-valid">
                              <ImportIcon name="check" size={12} />
                              Ready
                            </span>
                          )}

                          {row.status === 'skipped' && (
                            <span
                              className="status-badge status-skipped"
                              title={row.reason}
                            >
                              <ImportIcon name="alert" size={12} />
                              Duplicate
                            </span>
                          )}

                          {row.status === 'invalid' && (
                            <span
                              className="status-badge status-invalid"
                              title={row.reason}
                            >
                              <ImportIcon name="close" size={12} />
                              Invalid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewRows.some((row) => row.reason) && (
                <div className="import-issues">
                  <div className="issues-header">
                    <ImportIcon name="alert" size={14} />
                    <span>Rows requiring attention</span>
                  </div>

                  <div className="issues-list">
                    {previewRows
                      .filter((row) => row.reason)
                      .map((row) => (
                        <div key={row.row} className="issue-line">
                          <span className="issue-row">
                            Row {row.row}
                          </span>
                          <span>{row.reason}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {stage === 'importing' && (
            <div className="import-loading">
              <div className="loading-orbit">
                <div className="import-spinner" />
              </div>

              <div className="loading-kicker">PLEASE WAIT</div>
              <h3>Importing teachers</h3>
              <p>
                Adding {validCount} teacher
                {validCount !== 1 ? 's' : ''} to the directory.
              </p>

              <div className="loading-bar">
                <span />
              </div>
            </div>
          )}

          {stage === 'result' && importResult && (
            <div className="import-result">
              <div
                className={`result-icon-wrapper ${importedCount > 0 ? 'result-success' : 'result-warning'
                  }`}
              >
                <ImportIcon
                  name={importedCount > 0 ? 'check' : 'alert'}
                  size={28}
                />
              </div>

              <div className="result-kicker">
                {importedCount > 0 ? 'IMPORT COMPLETE' : 'IMPORT FINISHED'}
              </div>

              <h3>
                {importedCount > 0
                  ? 'Teachers added successfully'
                  : 'No teachers were added'}
              </h3>

              <p>
                {processedCount} row
                {processedCount !== 1 ? 's' : ''} processed from{' '}
                <strong>{fileName}</strong>
              </p>

              <div className="result-stats">
                {importedCount > 0 && (
                  <div className="result-stat result-stat-success">
                    <span className="result-stat-icon">
                      <ImportIcon name="check" size={14} />
                    </span>
                    <div>
                      <strong>{importedCount}</strong>
                      <span>Imported</span>
                    </div>
                  </div>
                )}

                {importResult.skipped > 0 && (
                  <div className="result-stat result-stat-skipped">
                    <span className="result-stat-icon">
                      <ImportIcon name="alert" size={14} />
                    </span>
                    <div>
                      <strong>{importResult.skipped}</strong>
                      <span>Skipped</span>
                    </div>
                  </div>
                )}

                {failedCount > 0 && (
                  <div className="result-stat result-stat-failed">
                    <span className="result-stat-icon">
                      <ImportIcon name="close" size={14} />
                    </span>
                    <div>
                      <strong>{failedCount}</strong>
                      <span>Failed</span>
                    </div>
                  </div>
                )}
              </div>

              {importResult.rows?.filter(
                (row) => row.status !== 'imported'
              ).length > 0 && (
                  <div className="import-issues result-issues">
                    <div className="issues-header">
                      <ImportIcon name="alert" size={14} />
                      <span>Import details</span>
                    </div>

                    <div className="issues-list">
                      {importResult.rows
                        .filter((row) => row.status !== 'imported')
                        .map((row) => (
                          <div key={row.row} className="issue-line">
                            <span className="issue-row">
                              Row {row.row}
                            </span>
                            <span
                              className={
                                row.status === 'skipped'
                                  ? 'issue-warning'
                                  : 'issue-danger'
                              }
                            >
                              {row.teacher_name
                                ? `"${row.teacher_name}" — `
                                : ''}
                              {row.reason}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {error && (
            <div className="modal-error">
              <ImportIcon name="alert" size={15} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-footer import-footer">
          {stage === 'upload' && (
            <button
              type="button"
              className="secondary-button"
              onClick={handleClose}
            >
              Cancel
            </button>
          )}

          {stage === 'preview' && (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={resetState}
              >
                ← Change File
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={validCount === 0}
                onClick={handleImport}
              >
                <ImportIcon name="upload" size={16} />
                Import {validCount} Teacher
                {validCount !== 1 ? 's' : ''}
              </button>
            </>
          )}

          {stage === 'result' && (
            <button
              type="button"
              className="primary-button"
              onClick={handleClose}
            >
              <ImportIcon name="check" size={16} />
              Done
            </button>
          )}
        </div>

        <style>{`
          .import-modal {
            width: min(720px, calc(100vw - 32px)) !important;
            max-height: min(760px, calc(100vh - 32px));
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .import-header {
            flex-shrink: 0;
          }

          .import-title-icon {
            background: #edf3ff !important;
            color: #2563eb !important;
            border: 1px solid #d9e5ff;
          }

          .import-progress {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 0 28px 18px;
            border-bottom: 1px solid #edf1f6;
          }

          .progress-step {
            display: flex;
            align-items: center;
            gap: 7px;
            color: #94a3b8;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .055em;
            text-transform: uppercase;
          }

          .progress-step:not(:last-child)::after {
            content: '';
            width: 42px;
            height: 1px;
            margin: 0 6px;
            background: #e4e9f1;
          }

          .progress-number {
            width: 22px;
            height: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #dbe2ec;
            border-radius: 50%;
            background: #fff;
            color: #94a3b8;
            font-size: 10px;
            font-weight: 850;
          }

          .progress-step.is-active {
            color: #2563eb;
          }

          .progress-step.is-active .progress-number {
            border-color: #bcd2ff;
            background: #edf3ff;
            color: #2563eb;
          }

          .progress-step.is-complete {
            color: #147447;
          }

          .progress-step.is-complete .progress-number {
            border-color: #bde8d1;
            background: #effbf5;
            color: #147447;
          }

          .import-body {
            overflow-y: auto;
          }

          .upload-stage {
            padding-top: 2px;
          }

          .import-dropzone {
            min-height: 214px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 32px 24px;
            border: 1.5px dashed #c9d9ff;
            border-radius: 16px;
            background:
              radial-gradient(circle at 50% 0%, #f4f7ff 0, transparent 58%),
              linear-gradient(180deg, #fbfcff, #f6f9ff);
            cursor: pointer;
            transition:
              border-color .18s ease,
              background .18s ease,
              transform .18s ease,
              box-shadow .18s ease;
          }

          .import-dropzone:hover,
          .import-dropzone.drag-over {
            border-color: #2563eb;
            background:
              radial-gradient(circle at 50% 0%, #eaf1ff 0, transparent 58%),
              #f3f7ff;
            box-shadow: 0 10px 30px rgba(37, 99, 235, .08);
            transform: translateY(-1px);
          }

          .import-dropzone:focus-visible {
            outline: 3px solid rgba(37, 99, 235, .18);
            outline-offset: 2px;
          }

          .dropzone-icon {
            width: 58px;
            height: 58px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            border: 1px solid #d9e5ff;
            border-radius: 17px;
            background: #edf3ff;
            color: #2563eb;
            box-shadow: 0 8px 20px rgba(37, 99, 235, .08);
          }

          .dropzone-title {
            color: #15213d;
            font-size: 16px;
            font-weight: 800;
            letter-spacing: -.01em;
          }

          .dropzone-subtitle {
            color: #71809d;
            font-size: 12px;
          }

          .dropzone-hint {
            margin-top: 8px;
            padding: 5px 9px;
            border-radius: 7px;
            background: #eef3fb;
            color: #7a879c;
            font-size: 10px;
            font-weight: 700;
          }

          .upload-helper {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-top: 14px;
            padding: 11px 13px;
            border: 1px solid #e4eaf2;
            border-radius: 10px;
            background: #fafbfd;
          }

          .helper-icon {
            flex: 0 0 auto;
            display: flex;
            color: #64748b;
            margin-top: 1px;
          }

          .upload-helper div:last-child {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .upload-helper strong {
            color: #334155;
            font-size: 11px;
            font-weight: 800;
          }

          .upload-helper span {
            color: #7b879a;
            font-size: 10px;
            line-height: 1.5;
          }

          .template-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            min-height: 42px;
            margin-top: 10px;
            padding: 0 16px;
            border: 1px solid #d7dfeb;
            border-radius: 10px;
            background: #fff;
            color: #53627a;
            font-size: 12px;
            font-weight: 750;
            cursor: pointer;
            transition: all .15s ease;
          }

          .template-button:hover {
            border-color: #c4cfdf;
            background: #f8fafc;
            color: #334155;
          }

          .import-file-info {
            margin-bottom: 16px;
          }

          .file-badge {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            padding: 11px 13px;
            border: 1px solid #d9e4f7;
            border-radius: 12px;
            background: linear-gradient(180deg, #f7f9ff, #f2f6ff);
          }

          .file-badge-icon {
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
            border-radius: 9px;
            background: #e7efff;
            color: #2563eb;
          }

          .file-copy {
            min-width: 0;
          }

          .file-name {
            overflow: hidden;
            color: #15213d;
            font-size: 12px;
            font-weight: 800;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .file-meta {
            margin-top: 2px;
            color: #7b879a;
            font-size: 10px;
          }

          .file-ready {
            margin-left: auto;
            flex: 0 0 auto;
            padding: 5px 8px;
            border: 1px solid #bde8d1;
            border-radius: 6px;
            background: #effbf5;
            color: #147447;
            font-size: 8px;
            font-weight: 850;
            letter-spacing: .06em;
          }

          .import-summary {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 11px;
          }

          .summary-heading {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .summary-heading > span {
            color: #17233f;
            font-size: 12px;
            font-weight: 850;
          }

          .summary-heading small {
            color: #8a96a8;
            font-size: 10px;
          }

          .summary-badges {
            display: flex;
            justify-content: flex-end;
            gap: 6px;
            flex-wrap: wrap;
          }

          .summary-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 9px;
            border-radius: 7px;
            font-size: 10px;
            font-weight: 800;
          }

          .summary-valid,
          .status-valid {
            background: #effbf5;
            color: #147447;
            border: 1px solid #bde8d1;
          }

          .summary-skipped,
          .status-skipped {
            background: #fffbeb;
            color: #92400e;
            border: 1px solid #fde68a;
          }

          .summary-invalid,
          .status-invalid {
            background: #fff5f4;
            color: #b42318;
            border: 1px solid #f1c5c1;
          }

          .import-table-wrapper {
            overflow: auto;
            max-height: 350px;
            border: 1px solid #e1e7f0;
            border-radius: 12px;
          }

          .import-table {
            width: 100%;
            min-width: 560px;
            border-collapse: separate;
            border-spacing: 0;
            table-layout: fixed;
          }

          .import-table th {
            position: sticky;
            top: 0;
            z-index: 2;
            height: 38px;
            padding: 0 12px;
            border-bottom: 1px solid #dfe6ef;
            background: #f8faff;
            color: #697791;
            text-align: left;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: .08em;
          }

          .import-table td {
            height: 46px;
            padding: 8px 12px;
            border-bottom: 1px solid #e7ebf2;
            background: #fff;
            color: #15213d;
            vertical-align: middle;
          }

          .import-table tbody tr:last-child td {
            border-bottom: 0;
          }

          .column-number,
          .row-number {
            width: 52px;
            text-align: center !important;
          }

          .column-capacity,
          .capacity-cell {
            width: 132px;
            text-align: center !important;
          }

          .column-status,
          .status-cell {
            width: 145px;
            text-align: center !important;
          }

          .row-number {
            color: #3566d8 !important;
            font-size: 10px;
            font-weight: 850;
          }

          .teacher-cell {
            overflow: hidden;
            font-size: 12px;
            font-weight: 750;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .import-row-invalid td {
            background: #fffbfb;
          }

          .import-row-skipped td {
            background: #fffdf5;
          }

          .preview-load-badge {
            min-width: 29px;
            height: 25px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 8px;
            border: 1px solid #c9d9ff;
            border-radius: 7px;
            background: #edf3ff;
            color: #245bd2;
            font-size: 11px;
            font-weight: 850;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 7px;
            font-size: 10px;
            font-weight: 750;
          }

          .status-valid {
            border: 0;
          }

          .status-skipped {
            border: 0;
          }

          .status-invalid {
            border: 0;
          }

          .empty-value,
          .missing-value {
            color: #b42318;
            font-size: 11px;
            font-style: italic;
          }

          .missing-value {
            font-style: normal;
          }

          .import-issues {
            margin-top: 11px;
            overflow: hidden;
            border: 1px solid #e3e8ef;
            border-radius: 10px;
            background: #fafbfd;
          }

          .issues-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 11px;
            border-bottom: 1px solid #e9edf3;
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
          }

          .issues-list {
            max-height: 115px;
            overflow-y: auto;
            padding: 7px 11px;
          }

          .issue-line {
            display: flex;
            gap: 5px;
            color: #71809d;
            font-size: 10px;
            line-height: 1.7;
          }

          .issue-row {
            flex: 0 0 auto;
            color: #475569;
            font-weight: 800;
          }

          .issue-warning {
            color: #92400e;
          }

          .issue-danger {
            color: #b42318;
          }

          .import-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 50px 20px 45px;
            text-align: center;
          }

          .loading-orbit {
            width: 58px;
            height: 58px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 18px;
            border: 1px solid #dbe7ff;
            border-radius: 50%;
            background: #f5f8ff;
          }

          .import-spinner {
            width: 29px;
            height: 29px;
            border: 3px solid #dbeafe;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: teacherSpin .8s linear infinite;
          }

          .loading-kicker,
          .result-kicker {
            color: #3566d8;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: .12em;
          }

          .import-loading h3 {
            margin: 5px 0 0;
            color: #15213d;
            font-size: 18px;
            font-weight: 850;
          }

          .import-loading p {
            margin: 6px 0 0;
            color: #71809d;
            font-size: 11px;
          }

          .loading-bar {
            width: min(260px, 70%);
            height: 4px;
            overflow: hidden;
            margin-top: 20px;
            border-radius: 999px;
            background: #e9eef7;
          }

          .loading-bar span {
            display: block;
            width: 45%;
            height: 100%;
            border-radius: inherit;
            background: #2563eb;
            animation: teacherLoading 1.15s ease-in-out infinite;
          }

          .import-result {
            padding: 24px 0 10px;
            text-align: center;
          }

          .result-icon-wrapper {
            width: 62px;
            height: 62px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 13px;
            border-radius: 50%;
          }

          .result-success {
            border: 4px solid #bde8d1;
            background: #effbf5;
            color: #147447;
          }

          .result-warning {
            border: 4px solid #fde68a;
            background: #fffbeb;
            color: #92400e;
          }

          .import-result h3 {
            margin: 5px 0 0;
            color: #15213d;
            font-size: 19px;
            font-weight: 850;
          }

          .import-result > p {
            max-width: 520px;
            margin: 5px auto 0;
            color: #71809d;
            font-size: 11px;
            line-height: 1.6;
          }

          .import-result > p strong {
            color: #475569;
            font-weight: 750;
          }

          .result-stats {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 20px;
            flex-wrap: wrap;
          }

          .result-stat {
            min-width: 115px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 9px 12px;
            border-radius: 10px;
            text-align: left;
          }

          .result-stat-icon {
            width: 27px;
            height: 27px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
            border-radius: 8px;
          }

          .result-stat > div {
            display: flex;
            flex-direction: column;
            gap: 1px;
          }

          .result-stat strong {
            font-size: 14px;
            line-height: 1;
          }

          .result-stat span:not(.result-stat-icon) {
            font-size: 9px;
            font-weight: 700;
          }

          .result-stat-success {
            border: 1px solid #bde8d1;
            background: #f4fcf7;
            color: #147447;
          }

          .result-stat-success .result-stat-icon {
            background: #e0f6e9;
          }

          .result-stat-skipped {
            border: 1px solid #fde68a;
            background: #fffdf4;
            color: #92400e;
          }

          .result-stat-skipped .result-stat-icon {
            background: #fff4c7;
          }

          .result-stat-failed {
            border: 1px solid #f1c5c1;
            background: #fff8f7;
            color: #b42318;
          }

          .result-stat-failed .result-stat-icon {
            background: #fee7e4;
          }

          .result-issues {
            max-width: 590px;
            margin: 18px auto 0;
            text-align: left;
          }

          .modal-error {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            margin-top: 12px;
            padding: 10px 12px;
            border: 1px solid #f1c5c1;
            border-radius: 9px;
            background: #fff7f6;
            color: #b42318;
            font-size: 11px;
            font-weight: 650;
            line-height: 1.5;
          }

          .import-footer {
            flex-shrink: 0;
          }

          @keyframes teacherSpin {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes teacherLoading {
            0% {
              transform: translateX(-110%);
            }
            50% {
              transform: translateX(90%);
            }
            100% {
              transform: translateX(230%);
            }
          }

          [data-theme='dark'] .import-progress {
            border-bottom-color: #1a2338;
          }

          [data-theme='dark'] .progress-step {
            color: #64748b;
          }

          [data-theme='dark'] .progress-step.is-active {
            color: #60a5fa;
          }

          [data-theme='dark'] .progress-number {
            border-color: #26334d;
            background: #0d1322;
            color: #64748b;
          }

          [data-theme='dark'] .progress-step.is-active .progress-number {
            border-color: #294a78;
            background: #111e35;
            color: #60a5fa;
          }

          [data-theme='dark'] .progress-step.is-complete {
            color: #4ade80;
          }

          [data-theme='dark'] .progress-step.is-complete .progress-number {
            border-color: #235536;
            background: #102719;
            color: #4ade80;
          }

          [data-theme='dark'] .import-title-icon {
            background: #111e35 !important;
            border-color: #294a78 !important;
            color: #60a5fa !important;
          }

          [data-theme='dark'] .import-dropzone {
            background: #090d16 !important;
            border-color: #26334d !important;
          }

          [data-theme='dark'] .import-dropzone:hover,
          [data-theme='dark'] .import-dropzone.drag-over {
            border-color: #3b82f6 !important;
            background: #0d1322 !important;
          }

          [data-theme='dark'] .dropzone-icon {
            background: #141d33 !important;
            border-color: #263b61;
            color: #60a5fa !important;
          }

          [data-theme='dark'] .dropzone-title,
          [data-theme='dark'] .summary-heading > span,
          [data-theme='dark'] .file-name,
          [data-theme='dark'] .teacher-cell,
          [data-theme='dark'] .import-loading h3,
          [data-theme='dark'] .import-result h3 {
            color: #fff !important;
          }

          [data-theme='dark'] .dropzone-subtitle,
          [data-theme='dark'] .file-meta,
          [data-theme='dark'] .summary-heading small,
          [data-theme='dark'] .import-loading p,
          [data-theme='dark'] .import-result > p {
            color: #8a99ad !important;
          }

          [data-theme='dark'] .dropzone-hint {
            background: #111a2b;
            color: #7d8da7;
          }

          [data-theme='dark'] .upload-helper,
          [data-theme='dark'] .template-button,
          [data-theme='dark'] .import-issues {
            background: #090d16 !important;
            border-color: #1f2b45 !important;
          }

          [data-theme='dark'] .upload-helper strong,
          [data-theme='dark'] .issue-row,
          [data-theme='dark'] .file-ready {
            color: #dbe4f2;
          }

          [data-theme='dark'] .upload-helper span,
          [data-theme='dark'] .helper-icon {
            color: #7d8da7;
          }

          [data-theme='dark'] .template-button {
            color: #9aa8bb;
          }

          [data-theme='dark'] .file-badge {
            background: #111a2b !important;
            border-color: #263b61 !important;
          }

          [data-theme='dark'] .file-badge-icon {
            background: #172641;
            color: #60a5fa;
          }

          [data-theme='dark'] .import-table-wrapper {
            border-color: #1a2338;
          }

          [data-theme='dark'] .import-table th {
            background: #090d16;
            color: #8a99ad;
            border-bottom-color: #1f2b45;
          }

          [data-theme='dark'] .import-table td {
            background: #0d1322;
            color: #fff;
            border-bottom-color: #161e30;
          }

          [data-theme='dark'] .import-row-invalid td {
            background: #1a0f0f;
          }

          [data-theme='dark'] .import-row-skipped td {
            background: #1a1608;
          }

          [data-theme='dark'] .preview-load-badge {
            background: #121f36;
            border-color: #294a78;
            color: #60a5fa;
          }

          [data-theme='dark'] .empty-value,
          [data-theme='dark'] .missing-value {
            color: #f87171;
          }

          [data-theme='dark'] .issues-header {
            border-bottom-color: #1f2b45;
            color: #9aa8bb;
          }

          [data-theme='dark'] .issue-line {
            color: #8a99ad;
          }

          [data-theme='dark'] .result-success {
            background: #0d2818;
            border-color: #1a4028;
            color: #4ade80;
          }

          [data-theme='dark'] .result-warning {
            background: #2a2108;
            border-color: #59470b;
            color: #fbbf24;
          }

          [data-theme='dark'] .result-stat-success {
            background: #0d2818;
            border-color: #1a4028;
          }

          [data-theme='dark'] .result-stat-skipped {
            background: #211a08;
            border-color: #59470b;
          }

          [data-theme='dark'] .result-stat-failed {
            background: #2a1010;
            border-color: #54201e;
          }

          [data-theme='dark'] .modal-error {
            background: #261010;
            border-color: #54201e;
            color: #f87171;
          }

          @media (max-width: 620px) {
            .import-modal {
              width: calc(100vw - 20px) !important;
            }

            .import-progress {
              padding-left: 18px;
              padding-right: 18px;
            }

            .progress-step:not(:last-child)::after {
              width: 20px;
            }

            .file-ready {
              display: none;
            }

            .import-summary {
              align-items: flex-start;
              flex-direction: column;
            }

            .summary-badges {
              justify-content: flex-start;
            }
          }
        `}</style>
      </div>
    </div>
  )
}