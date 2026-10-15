import { useApp } from '../../game/state/store';
import { SettingsPanel } from './SettingsPanel';

export function PauseMenu() {
  const { needsResume, resumeRace, restartRace, quit, settingsOpen, setSettingsOpen } = useApp();
  return (
    <div className="screen overlay">
      <div className="menu-card">
        <h1>{needsResume ? 'Race in progress' : 'Paused'}</h1>
        {settingsOpen ? (
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        ) : (
          <>
            {needsResume && <p className="tag">Your page was reloaded. Pick up where you left off at your last position.</p>}
            <button className="btn primary" onClick={resumeRace}>{needsResume ? '▶ Resume race' : '▶ Resume'}</button>
            <button className="btn" onClick={restartRace}>↻ {needsResume ? 'Restart race' : 'Restart'}</button>
            <button className="btn" onClick={() => setSettingsOpen(true)}>⚙ Settings</button>
            <button className="btn ghost" onClick={quit}>⏏ Quit to menu</button>
          </>
        )}
      </div>
    </div>
  );
}
