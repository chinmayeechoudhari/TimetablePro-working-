import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
            padding: '2rem',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            color: 'var(--text-main, #0f172a)',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--card-bg, #ffffff)',
              borderRadius: '16px',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.1)',
              padding: '2.5rem 2rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
                fontSize: '24px',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: '20px',
                fontWeight: '700',
                margin: '0 0 8px 0',
                color: 'var(--text-main, #0f172a)',
                letterSpacing: '-0.02em',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-muted, #64748b)',
                lineHeight: 1.6,
                margin: '0 0 24px 0',
              }}
            >
              An unexpected error occurred in this view. Your saved schedules and
              configuration data in the database remain safe.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: '20px',
              }}
            >
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = '0.92')}
                onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Try Again
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  background: 'var(--bg-secondary, #f8fafc)',
                  color: 'var(--text-main, #334155)',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
            </div>

            {this.state.error && (
              <div style={{ marginTop: '16px', textAlign: 'left' }}>
                <button
                  type="button"
                  onClick={() =>
                    this.setState((prev) => ({ showDetails: !prev.showDetails }))
                  }
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted, #64748b)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{this.state.showDetails ? '▼' : '▶'}</span>
                  {this.state.showDetails ? 'Hide error details' : 'Show error details'}
                </button>

                {this.state.showDetails && (
                  <pre
                    style={{
                      marginTop: '8px',
                      padding: '12px',
                      background: 'var(--code-bg, #0f172a)',
                      color: '#f87171',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      lineHeight: 1.5,
                      overflowX: 'auto',
                      maxHeight: '160px',
                    }}
                  >
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
