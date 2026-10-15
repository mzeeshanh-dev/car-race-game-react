import { formatTime } from '../../game/race/lapTimer';
import { useApp } from '../../game/state/store';

export function FinishScreen() {
  const result = useApp((s) => s.result);
  const bestLap = useApp((s) => s.bestLap);
  const start = useApp((s) => s.startRace);
  const quit = useApp((s) => s.quit);
  if (!result) return null;
  const newBest = bestLap !== null && Math.abs(bestLap - result.best) < 1e-6;
  return (
    <div className="screen overlay">
      <div className="menu-card">
        <h1>Finish!</h1>
        <p className="place">P{result.position}<small> / {result.racers}</small></p>
        <div className="bests">
          <div><label>Total time</label><b>{formatTime(result.total)}</b></div>
          <div><label>Best lap {newBest ? '🏆 NEW' : ''}</label><b>{formatTime(result.best)}</b></div>
        </div>
        <table className="laps">
          <tbody>
            {result.laps.map((t, i) => (
              <tr key={i} className={Math.abs(t - result.best) < 1e-6 ? 'best' : ''}><td>Lap {i + 1}</td><td>{formatTime(t)}</td></tr>
            ))}
          </tbody>
        </table>
        <button className="btn primary" onClick={start}>↻ Race again</button>
        <button className="btn ghost" onClick={quit}>⏏ Menu</button>
      </div>
    </div>
  );
}
