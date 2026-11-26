import { Component } from 'react';

/**
 * Catches a crash inside one page so the visitor sees a friendly message (with the header and
 * footer still working) instead of a blank screen. Layout gives it key={pathname}, so moving to
 * another page clears the error. Crashes are logged to the console; hook an error-monitoring
 * service (e.g. Sentry) into componentDidCatch when one is set up.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[page error]', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="page-error" role="alert">
        <p className="page-error__eyebrow">Something went wrong</p>
        <h1>This page did not load properly</h1>
        <p>Please try again. If it keeps happening, message us on WhatsApp and we will help you right away.</p>
        <div className="page-error__actions">
          <button type="button" className="btn btn--dark" onClick={() => window.location.reload()}>Reload the page</button>
          <a className="btn btn--outline" href="/">Go to the home page</a>
        </div>
      </section>
    );
  }
}
