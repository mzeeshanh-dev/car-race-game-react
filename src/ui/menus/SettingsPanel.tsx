import { CAMERA_MODES } from '../../game/camera/modes';
import { useApp } from '../../game/state/store';
import type { Quality } from '../../persistence/db';
import { useState } from 'react';
import { tilt } from '../../game/input/tilt';

const COLORS = ['#e63946', '#f4a261', '#ffd166', '#2a9d8f', '#3a86ff', '#8338ec', '#f8f9fa', '#212529'];

export function SettingsPanel({ onClose }: { onClose?: () => void }) {
  const s = useApp((st) => st.settings);
  const update = useApp((st) => st.updateSettings);
  const [sensorStatus, setSensorStatus] = useState('Tilt requires a supported sensor and HTTPS. Touch is always available.');
  return (
    <div className="panel settings">
      <h2>Settings</h2>
      <div className="row"><span>Race lighting</span><div className="seg">
        {(['day', 'night'] as const).map(environment => <button key={environment} className={s.environment === environment ? 'on' : ''} onClick={() => update({ environment })}>{environment === 'day' ? 'Day' : 'Night'}</button>)}
      </div></div>
      <div className="row"><span>Steering input</span><div className="seg">
        <button className={!s.tilt ? 'on' : ''} onClick={() => { tilt.enabled = false; update({ tilt: false }); }}>Touch / keys</button>
        <button className={s.tilt ? 'on' : ''} onClick={async () => { setSensorStatus(await tilt.request()); update({ tilt: tilt.enabled }); }}>Enable tilt</button>
        <button onClick={() => { tilt.calibrate(); setSensorStatus('Neutral position calibrated.'); }}>Calibrate</button>
      </div></div>
      <small role="status">{sensorStatus}</small>
      {s.tilt && <label className="row"><span>Tilt sensitivity</span><input aria-label="Tilt sensitivity" type="range" min="0.5" max="2" step="0.1" value={s.tiltSensitivity} onChange={e => update({ tiltSensitivity: Number(e.target.value) })} /></label>}
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
        <span>Master volume <b>{Math.round(s.volume * 100)}%</b></span>
        <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => update({ volume: Number(e.target.value) })} />
      </label>
      <label className="row"><span>Effects volume</span><input type="range" min="0" max="1" step="0.05" value={s.sfxVolume} onChange={e => update({ sfxVolume: Number(e.target.value) })} /></label>
      <label className="row check"><input type="checkbox" checked={s.cameraShake} onChange={e => update({ cameraShake: e.target.checked })} /><span>Impact camera shake</span></label>
      <label className="row check">
        <input type="checkbox" checked={s.muted} onChange={(e) => update({ muted: e.target.checked })} />
        <span>Mute (M)</span>
      </label>
      {onClose && <button className="btn" onClick={onClose}>Back</button>}
    </div>
  );
}
