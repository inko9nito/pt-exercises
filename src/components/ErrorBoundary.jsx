import { Component } from 'react';

// Without this, an uncaught render error anywhere in the tree silently
// unmounts the whole app (React's default with no boundary) — the page
// just goes blank with no indication anything went wrong. This shows the
// actual error on screen instead, so a real crash is diagnosable without
// needing a connected debugger.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, copied: false };
    this.handleCopy = this.handleCopy.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, componentStack: info?.componentStack });
  }

  getErrorText() {
    const { error, componentStack } = this.state;
    let text = `${error.name}: ${error.message}\n\n${error.stack}`;
    if (componentStack) text += `\n\nComponent stack:${componentStack}`;
    return text;
  }

  async handleCopy() {
    const text = this.getErrorText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be unavailable/blocked — fall back to the
      // classic hidden-textarea + execCommand trick.
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        // give up silently — the text is still selectable/visible on screen
      }
      document.body.removeChild(textarea);
    }
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
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
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={{ padding: '8px 14px', fontSize: 14 }} onClick={this.handleCopy}>
              {this.state.copied ? 'Copied!' : 'Copy error'}
            </button>
            <button style={{ padding: '8px 14px', fontSize: 14 }} onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
