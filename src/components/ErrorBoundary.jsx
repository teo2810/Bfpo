import { Component } from 'react';
import ErrorScreen from './ErrorScreen.jsx';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.warn('Cassetto: errore di render', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <ErrorScreen
            error={this.state.error}
            onRetry={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
          />
        </div>
      );
    }
    return <div key={this.state.attempt} style={{ display: 'contents' }}>{this.props.children}</div>;
  }
}
