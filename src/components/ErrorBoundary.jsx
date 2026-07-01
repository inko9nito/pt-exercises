import { Component } from 'react';

// Without this, an uncaught render error anywhere in the tree silently
// unmounts the whole app (React's default with no boundary) — the page
// just goes blank with no indication anything went wrong. This shows the
// actual error on screen instead, so a real crash is diagnosable without
// needing a connected debugger.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, componentStack: info?.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', color: '#b91c1c', background: '#fff' }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Something crashed:</p>
          <p>{this.state.error.name}: {this.state.error.message}</p>
          <p style={{ marginTop: 12, color: '#7f1d1d' }}>{this.state.error.stack}</p>
          {this.state.componentStack && (
            <p style={{ marginTop: 12, color: '#7f1d1d' }}>Component stack:{this.state.componentStack}</p>
          )}
          <button
            style={{ marginTop: 16, padding: '8px 14px', fontSize: 14 }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
