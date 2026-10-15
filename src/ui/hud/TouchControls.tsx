import { useEffect, useState } from 'react';
import { input, type TouchState } from '../../game/input/InputManager';
import { rt } from '../../game/state/runtime';
import { useApp } from '../../game/state/store';

function Btn({ k, label, cls }: { k: keyof TouchState; label: string; cls: string }) {
  const set = (v: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (v) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    input.touch[k] = v;
  };
  return (
    <button
      className={`tbtn ${cls}`}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onPointerCancel={set(false)}
      onLostPointerCapture={() => { input.touch[k] = false; }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      {label}
    </button>
  );
}

/** On-screen controls for touch devices (responsive / mobile). */
export function TouchControls() {
  const [coarse, setCoarse] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    const mq = matchMedia('(pointer: coarse)');
    const h = () => setCoarse(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  if (!coarse) return null;
  return (
    <div className="touch">
      <div className="touch-left">
        <Btn k="left" label="◀" cls="steer" />
        <Btn k="right" label="▶" cls="steer" />
      </div>
      <div className="touch-right">
        <Btn k="hand" label="DRIFT" cls="small" />
        <Btn k="brake" label="BRAKE" cls="pedal brake" />
        <Btn k="gas" label="GAS" cls="pedal gas" />
      </div>
      <div className="touch-top">
        <button className="tbtn tiny" onClick={() => { const a = useApp.getState(); a.updateSettings({ cameraMode: (a.settings.cameraMode + 1) % 6 }); }}>CAM</button>
        <button className="tbtn tiny" onClick={() => { rt.respawnRequested = true; }}>RESET</button>
        <button className="tbtn tiny" onClick={() => useApp.getState().pause()}>II</button>
      </div>
    </div>
  );
}
