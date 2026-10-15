import { CAMERA_MODES } from '../../game/camera/modes';
import { useApp } from '../../game/state/store';
import type { Quality } from '../../persistence/db';

const COLORS = ['#e63946', '#f4a261', '#ffd166', '#2a9d8f', '#3a86ff', '#8338ec', '#f8f9fa', '#212529'];

export function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const s = useApp((st) => st.settings);
  const update = useApp((st) => st.updateSettings);
  return (
    <div className="panel settings">
      <h2>Settings</h2>
      <label className="row">
        <span>Steering sensitivity <b>{s.sensitivity.toFixed(2)}x</b></span>
        <input type="range" min={0.5} max={1.5} step={0.05} value={s.sensitivity} onChange={(e) => update({ sensitivity: Number(e.target.value) })} />
      </label>
      <label className="row">
        <span>Camera</span>
        <select value={s.cameraMode} onChange={(e) => update({ cameraMode: Number(e.target.value) })}>
          {CAMERA_MODES.map((m, i) => <option key={m.id} value={i}>{i + 1}. {m.name}</option>)}
        </select>
      </label>
      <div className="row">
        <span>Graphics quality</span>
        <div className="seg">
          {(['low', 'medium', 'high'] as Quality[]).map((q) => (
            <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => update({ quality: q })}>{q[0].toUpperCase() + q.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="row">
        <span>Car color</span>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className={`sw ${s.carColor.toLowerCase() === c ? 'on' : ''}`} style={{ background: c }} onClick={() => update({ carColor: c })} aria-label={`Car color ${c}`} />
          ))}
          <input type="color" value={s.carColor} onChange={(e) => update({ carColor: e.target.value })} aria-label="Custom car color" />
        </div>
      </div>
      <label className="row">
        <span>Engine volume <b>{Math.round(s.volume * 100)}%</b></span>
        <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => update({ volume: Number(e.target.value) })} />
      </label>
      <label className="row check">
        <input type="checkbox" checked={s.muted} onChange={(e) => update({ muted: e.target.checked })} />
        <span>Mute (M)</span>
      </label>
      {onClose && <button className="btn" onClick={onClose}>Back</button>}
    </div>
  );
}
