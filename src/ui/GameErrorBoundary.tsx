import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { attempt: number; failed: boolean }

/** Keeps a render/WebGL error from unmounting the whole app (blank screen): logs it and remounts the game. */
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { attempt: 0, failed: false };
  private retries = 0;
  private timer = 0;

  static getDerivedStateFromError(): Partial<State> { return { failed: true }; }

  componentDidCatch(error: unknown) {
    console.error('Game crashed, restarting scene:', error);
    if (this.retries++ < 5) {
      this.timer = window.setTimeout(() => this.setState((s) => ({ attempt: s.attempt + 1, failed: false })), 300);
    }
  }

  componentWillUnmount() { clearTimeout(this.timer); }

  render() {
    if (this.state.failed) {
      return (
        <div className="screen splash">
          {this.retries > 5
            ? <button onClick={() => { this.retries = 0; this.setState((s) => ({ attempt: s.attempt + 1, failed: false })); }}>Reload scene</button>
            : 'Restarting…'}
        </div>
      );
    }
    return <div key={this.state.attempt} style={{ display: 'contents' }}>{this.props.children}</div>;
  }
}
