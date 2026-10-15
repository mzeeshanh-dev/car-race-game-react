import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useApp } from '../state/store';
import { live } from '../state/telemetry';

/** Tiny WebAudio engine: two detuned saw oscillators through a low-pass, pitch follows RPM. No assets needed. */
export function EngineSound() {
  const ref = useRef<{ ctx: AudioContext; o1: OscillatorNode; o2: OscillatorNode; gain: GainNode; lp: BiquadFilterNode } | null>(null);

  useEffect(() => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let ctx: AudioContext;
    try { ctx = new AC(); } catch { return; }
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const gain = ctx.createGain(); gain.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    o1.start(); o2.start();
    ref.current = { ctx, o1, o2, gain, lp };
    const resume = () => { void ctx.resume(); };
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    resume();
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      try { o1.stop(); o2.stop(); } catch { /* already stopped */ }
      void ctx.close();
      ref.current = null;
    };
  }, []);

  useFrame(() => {
    const a = ref.current;
    if (!a) return;
    const { settings, screen } = useApp.getState();
    const L = live().vehicle;
    const t = a.ctx.currentTime;
    const f = 28 + (L.rpm / 7000) * 150;
    a.o1.frequency.setTargetAtTime(f, t, 0.04);
    a.o2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    a.lp.frequency.setTargetAtTime(380 + L.rpm * 0.28 + L.throttle * 500, t, 0.06);
    const on = screen === 'play' && !settings.muted;
    const vol = on ? settings.volume * (0.05 + 0.07 * L.throttle + 0.03 * (L.rpm / 7000)) : 0;
    a.gain.gain.setTargetAtTime(vol, t, 0.08);
  });
  return null;
}
