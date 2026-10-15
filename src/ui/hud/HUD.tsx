import { memo, useEffect, useRef } from 'react';
import { CAMERA_MODES } from '../../game/camera/modes';
import { hudBus, type Toast } from '../../game/state/hudBus';
import { live } from '../../game/state/telemetry';
import { formatTime } from '../../game/race/lapTimer';
import { Minimap } from './Minimap';
import { RPM_MAX, REDLINE, SPEEDO_START, SPEEDO_SWEEP, SPEED_MAX, Speedometer, type SpeedoRefs } from './Speedometer';
import { TouchControls } from './TouchControls';

const suppress = () => undefined;

/**
 * HUD: static JSX rendered ONCE. A requestAnimationFrame loop writes values straight into the DOM, so the React
 * tree is never re-rendered per frame.
 */
function HUDInner() {
  const speedo = useRef<SpeedoRefs | null>(null);
  const el = {
    lap: useRef<HTMLSpanElement>(null),
    lapTime: useRef<HTMLSpanElement>(null),
    best: useRef<HTMLSpanElement>(null),
    total: useRef<HTMLSpanElement>(null),
    pos: useRef<HTMLSpanElement>(null),
    count: useRef<HTMLDivElement>(null),
    wrong: useRef<HTMLDivElement>(null),
    toasts: useRef<HTMLDivElement>(null),
    flash: useRef<HTMLDivElement>(null),
    cam: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    let raf = 0;
    let lastCount = '';
    const text = (n: Element | null | undefined, v: string) => { if (n && n.textContent !== v) n.textContent = v; };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const L = live();
      const v = L.vehicle;
      const r = L.race;
      const s = speedo.current;
      if (s?.needle) {
        const kmh = Math.min(SPEED_MAX, v.speedKmh);
        s.needle.style.transform = `rotate(${SPEEDO_START + (kmh / SPEED_MAX) * SPEEDO_SWEEP}deg)`;
        text(s.speed, String(Math.round(v.speedKmh)));
        text(s.gear, v.gear === 0 ? 'R' : String(v.gear));
        const pct = Math.min(100, (v.rpm / RPM_MAX) * 100);
        s.rpmArc?.setAttribute('stroke-dasharray', `${pct.toFixed(1)} 100`);
        s.rpmArc?.setAttribute('stroke', v.rpm >= REDLINE ? '#ff3b4a' : '#35d0ff');
        text(s.rpmText, (v.rpm / 1000).toFixed(1));
        if (s.surface) {
          const grass = v.grassCoverage > 0.4;
          text(s.surface, grass ? 'GRASS' : v.handbrake ? 'DRIFT' : 'ASPHALT');
          s.surface.setAttribute('fill', grass ? '#d9a441' : v.handbrake ? '#ff7a59' : '#6fcf7a');
        }
      }
      text(el.lap.current, `${Math.min(r.lap, r.totalLaps)}/${r.totalLaps}`);
      text(el.lapTime.current, formatTime(r.lapTime));
      text(el.best.current, formatTime(r.best));
      text(el.total.current, formatTime(r.total));
      text(el.pos.current, `P${r.position}/${r.racers}`);
      if (el.wrong.current) el.wrong.current.hidden = !r.wrongWay;
      const c = el.count.current;
      if (c) {
        let t = '';
        if (r.phase === 'countdown') t = r.countdown > 0 ? String(Math.ceil(r.countdown)) : 'GO!';
        else if (r.phase === 'racing' && r.total < 1.2) t = 'GO!';
        if (t !== lastCount) {
          lastCount = t;
          c.textContent = t;
          c.hidden = t === '';
          c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
        }
      }
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [el.lap, el.lapTime, el.best, el.total, el.pos, el.wrong, el.count]);

  useEffect(() => {
    const addToast = (t: Toast) => {
      const host = el.toasts.current;
      if (!host) return;
      if (t.kind === 'checkpoint' && el.flash.current) {
        const f = el.flash.current; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
      }
      if (t.kind === 'camera') {
        const c = el.cam.current;
        if (c) { c.textContent = `📷 ${t.text}`; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
        return;
      }
      const d = document.createElement('div');
      d.className = `toast toast-${t.kind}`;
      const a = document.createElement('strong'); a.textContent = t.text; d.appendChild(a);
      if (t.sub) { const b = document.createElement('span'); b.textContent = t.sub; d.appendChild(b); }
      host.appendChild(d);
      while (host.children.length > 3) host.firstElementChild?.remove();
      setTimeout(() => d.remove(), 2200);
    };
    return hudBus.on(addToast);
  }, [el.toasts, el.flash, el.cam]);

  return (
    <div className="hud" aria-live="off">
      <div className="hud-flash" ref={el.flash} />
      <div className="hud-top">
        <div className="stat"><label>LAP</label><span ref={el.lap}>1/3</span></div>
        <div className="stat wide"><label>LAP TIME</label><span ref={el.lapTime}>0:00.000</span></div>
        <div className="stat"><label>BEST</label><span ref={el.best}>--:--.---</span></div>
        <div className="stat"><label>TOTAL</label><span ref={el.total}>0:00.000</span></div>
        <div className="stat pos"><label>POS</label><span ref={el.pos}>P1/4</span></div>
      </div>
      <div className="hud-map"><Minimap /></div>
      <div className="hud-speedo"><Speedometer setRefs={(r) => { speedo.current = r; }} /></div>
      <div className="hud-count" ref={el.count} hidden />
      <div className="hud-wrong" ref={el.wrong} hidden>⚠ WRONG WAY</div>
      <div className="hud-cam" ref={el.cam} />
      <div className="hud-toasts" ref={el.toasts} />
      <div className="hud-help" onClick={suppress}>
        W/S gas·brake &nbsp; A/D steer &nbsp; SPACE drift &nbsp; C or 1-{CAMERA_MODES.length} camera &nbsp; B look back &nbsp; R respawn &nbsp; ESC pause
      </div>
      <TouchControls />
    </div>
  );
}

export const HUD = memo(HUDInner);
