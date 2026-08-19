import React from 'react'

export default function ConfirmModal({
  isOpen,
  title,
  itemName,
  message,
  onConfirm,
  onCancel,
  isDeleting = false
}) {
  if (!isOpen) return null

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Warning Icon Badge */}
        <div style={styles.iconContainer}>
          <div style={styles.iconRing}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div style={styles.title}>{title || 'Confirm Deletion'}</div>

        {itemName && (
          <div style={styles.itemNameBadge}>
            "{itemName}"
          </div>
        )}

        <div style={styles.message}>
          {message || 'Are you sure you want to delete this item? This action cannot be undone.'}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={styles.cancelBtn}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            style={styles.deleteBtn}
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    animation: 'modalFadeIn 0.2s ease-out forwards',
    padding: '16px'
  },
  modal: {
    background: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '28px 24px 24px',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    animation: 'modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
  },
  iconContainer: {
    marginBottom: '16px'
  },
  iconRing: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: '#2b141d',
    border: '8px solid #4a1c29',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-main)',
    marginBottom: '8px',
    letterSpacing: '-0.01em'
  },
  itemNameBadge: {
    display: 'inline-block',
    background: 'var(--bg-page)',
    color: 'var(--text-main)',
    fontWeight: '600',
    fontSize: '14px',
    padding: '4px 12px',
    borderRadius: '20px',
    marginBottom: '12px',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  message: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
    marginBottom: '24px'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    width: '100%'
  },
  cancelBtn: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    color: 'var(--text-main)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  deleteBtn: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#DC2626',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
    transition: 'all 0.15s ease'
  }
}
