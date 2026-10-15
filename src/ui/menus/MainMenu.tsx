import { formatTime } from '../../game/race/lapTimer';
import { useApp } from '../../game/state/store';
import { SettingsPanel } from './SettingsPanel';

export function MainMenu() {
  const start = useApp((s) => s.startRace);
  const best = useApp((s) => s.bestLap);
  const bestTotal = useApp((s) => s.bestTotal);
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  return (
    <div className="screen menu">
      <div className="stripes" aria-hidden />
      <div className="menu-card">
        <h1>APEX <span>RING</span></h1>
        <p className="tag">3-lap arcade circuit race · 3 AI rivals</p>
        {open ? (
          <SettingsPanel onClose={() => setOpen(false)} />
        ) : (
          <>
            <button className="btn primary" onClick={start}>▶ Start race</button>
            <button className="btn" onClick={() => setOpen(true)}>⚙ Settings</button>
            <div className="bests">
              <div><label>Best lap</label><b>{formatTime(best)}</b></div>
              <div><label>Best race</label><b>{formatTime(bestTotal)}</b></div>
            </div>
            <div className="keys">
              <span><kbd>W</kbd><kbd>S</kbd> gas / brake·reverse</span>
              <span><kbd>A</kbd><kbd>D</kbd> steer</span>
              <span><kbd>Space</kbd> handbrake drift</span>
              <span><kbd>C</kbd> / <kbd>1</kbd>–<kbd>6</kbd> camera</span>
              <span><kbd>B</kbd> look back</span>
              <span><kbd>R</kbd> respawn</span>
              <span><kbd>Esc</kbd> pause</span>
              <span>Gamepad &amp; touch supported</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
