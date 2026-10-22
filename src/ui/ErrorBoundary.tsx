import { Component, type ReactNode } from 'react'

/** Catches WebGL / runtime failures in the 3D scene and offers a friendly way out. */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('[our-little-world]', error)
  }
  render() {
    if (this.state.error)
      return (
        this.props.fallback ?? (
          <div className="welcome">
            <div className="welcome-card">
              <h2>The little world could not open</h2>
              <p className="lead">
                This browser could not start 3D graphics. Try another browser, turn on hardware acceleration, or switch to Light graphics.
              </p>
              <p className="hint">{this.state.error.message}</p>
              <div className="row">
                <button
                  className="btn"
                  onClick={() => {
                    try {
                      localStorage.setItem('olw.settings', JSON.stringify({ quality: 'low' }))
                    } catch {
                      /* ignore */
                    }
                    location.reload()
                  }}
                >
                  Try Light graphics
                </button>
              </div>
            </div>
          </div>
        )
      )
    return this.props.children
  }
}
