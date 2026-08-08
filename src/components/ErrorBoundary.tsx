'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', textAlign: 'center' }}>
          <div className="card elev-md" style={{ maxWidth: 420, padding: 'var(--space-6)' }}>
            <h2 style={{ color: 'var(--color-accent)' }}>Something went wrong</h2>
            <p className="text-muted" style={{ fontFamily: 'monospace', fontSize: 13 }}>{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ marginTop: 'var(--space-2)' }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
