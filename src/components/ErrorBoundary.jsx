import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surfaces in the Vercel function logs and browser console
    console.error('[ErrorBoundary]', error.message, info?.componentStack?.split('\n').slice(0, 4).join(' '))
    this.setState({ info })
  }

  reset() {
    this.setState({ error: null, info: null })
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error)
      return (
        <div style={{
          padding: '32px 20px',
          textAlign: 'center',
          maxWidth: 480,
          margin: '0 auto',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
          <div style={{
            fontWeight: 700, fontSize: 15,
            color: 'var(--text)', marginBottom: 8,
          }}>
            {this.props.label || 'Something went wrong'}
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '10px 14px',
            textAlign: 'left',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
            marginBottom: 18,
            lineHeight: 1.6,
          }}>
            {msg}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => this.reset()}
          >
            ↺ Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
