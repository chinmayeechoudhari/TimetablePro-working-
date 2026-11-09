import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ConfirmModal({
  isOpen,
  title,
  itemName,
  message,
  onConfirm,
  onCancel,
  isDeleting = false,
  confirmText = 'Yes, Delete',
  isDeletingText = 'Deleting...',
  error = '',
}) {
  useEffect(() => {
    if (!isOpen) return
    document.body.classList.add('confirm-modal-open')
    document.documentElement.classList.add('confirm-modal-open')
    return () => {
      document.body.classList.remove('confirm-modal-open')
      document.documentElement.classList.remove('confirm-modal-open')
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
        {/* Close 'X' Button */}
        <button
          type="button"
          className="confirm-modal-close"
          onClick={onCancel}
          disabled={isDeleting}
          aria-label="Close dialog"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Warning Icon Badge */}
        <div className="confirm-modal-icon-container">
          <div className="confirm-modal-icon-ring">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="confirm-modal-title">{title || 'Confirm Deletion'}</h3>

        {/* Item Name Pill */}
        {itemName && (
          <div className="confirm-modal-item-badge">
            "{itemName}"
          </div>
        )}

        {/* Message */}
        <p className="confirm-modal-message">
          {message || 'Are you sure you want to delete this item? This action cannot be undone.'}
        </p>

        {/* Error notification if deletion failed */}
        {error && (
          <div style={{
            width: '100%',
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#b91c1c',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '18px',
            boxSizing: 'border-box',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="confirm-modal-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="confirm-modal-btn confirm-modal-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="confirm-modal-btn confirm-modal-delete"
          >
            {isDeleting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="confirm-modal-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {isDeletingText}
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>

      <style>{`
        body.confirm-modal-open,
        html.confirm-modal-open {
          overflow-y: auto !important;
          pointer-events: auto !important;
        }

        body.confirm-modal-open .app-main-scroll {
          overflow: hidden !important;
          scrollbar-width: none !important;
        }

        body.confirm-modal-open .app-main-scroll::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
        }

        .confirm-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background-color: rgba(15, 23, 42, 0.55) !important;
          backdrop-filter: blur(6px) !important;
          -webkit-backdrop-filter: blur(6px) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 2147483647 !important;
          animation: confirmModalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
          padding: 16px !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }

        .confirm-modal-box {
          position: relative !important;
          margin: auto !important;
          background: var(--bg-card, #ffffff) !important;
          border: 1px solid var(--border-color, #e2e8f0) !important;
          border-radius: 20px !important;
          padding: 30px 24px 24px !important;
          max-width: 440px !important;
          width: 100% !important;
          max-height: calc(100vh - 32px) !important;
          overflow-y: auto !important;
          box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.04) !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          text-align: center !important;
          animation: confirmModalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
          box-sizing: border-box !important;
        }

        .confirm-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted, #94a3b8);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .confirm-modal-close:hover:not(:disabled) {
          background: var(--bg-page, #f1f5f9);
          color: var(--text-main, #0f172a);
          border-color: var(--border-color, #e2e8f0);
        }

        .confirm-modal-icon-container {
          margin-bottom: 16px;
        }

        .confirm-modal-icon-ring {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: #fee2e2;
          border: 6px solid #fef2f2;
          color: #dc2626;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.12);
        }

        [data-theme="dark"] .confirm-modal-icon-ring {
          background: rgba(220, 38, 38, 0.18);
          border-color: rgba(220, 38, 38, 0.08);
          color: #f87171;
        }

        .confirm-modal-title {
          font-size: 19px;
          font-weight: 700;
          color: var(--text-main, #0f172a);
          margin: 0 0 10px 0;
          letter-spacing: -0.015em;
          line-height: 1.3;
        }

        .confirm-modal-item-badge {
          display: inline-block;
          background: var(--bg-page, #f8fafc);
          color: var(--text-main, #1e293b);
          border: 1px solid var(--border-color, #e2e8f0);
          font-weight: 600;
          font-size: 13.5px;
          padding: 6px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          box-sizing: border-box;
        }

        .confirm-modal-message {
          font-size: 13.5px;
          color: var(--text-muted, #64748b);
          line-height: 1.55;
          margin: 0 0 24px 0;
          padding: 0 6px;
          word-break: break-word;
        }

        .confirm-modal-actions {
          display: flex;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }

        .confirm-modal-btn {
          flex: 1;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          outline: none;
        }

        .confirm-modal-cancel {
          border: 1.5px solid var(--border-color, #cbd5e1);
          background: var(--bg-card, #ffffff);
          color: var(--text-main, #334155);
        }

        .confirm-modal-cancel:hover:not(:disabled) {
          background: var(--bg-page, #f1f5f9);
          border-color: #94a3b8;
        }

        .confirm-modal-delete {
          border: 1.5px solid #dc2626;
          background: #dc2626;
          color: #ffffff;
          box-shadow: 0 3px 10px rgba(220, 38, 38, 0.28);
        }

        .confirm-modal-delete:hover:not(:disabled) {
          background: #b91c1c;
          border-color: #b91c1c;
          box-shadow: 0 4px 14px rgba(220, 38, 38, 0.36);
        }

        .confirm-modal-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @keyframes confirmModalSpin {
          to { transform: rotate(360deg); }
        }

        .confirm-modal-spin {
          animation: confirmModalSpin 0.75s linear infinite;
        }

        @keyframes confirmModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes confirmModalPop {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  )
}
