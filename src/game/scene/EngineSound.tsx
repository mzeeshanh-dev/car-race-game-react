import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useApp } from '../state/store';
import { live } from '../state/telemetry';
import { effects } from '../state/effects';
import { hudBus } from '../state/hudBus';
import { currentAudioContext, unlockAudio, releaseAudio } from '../audio/context';

/** One audio graph, procedural sounds only. No downloads or remote audio services. */
export function EngineSound() {
  const ref = useRef<{ ctx: AudioContext; engine: OscillatorNode; sub: OscillatorNode; master: GainNode; gain: GainNode; lp: BiquadFilterNode; tire: GainNode; cue: (f: number, duration: number, strength?: number) => void } | null>(null);
  const last = useRef({ impact: effects.serial, count: -1, phase: '' });
  useEffect(() => {
    const create = () => {
      if (ref.current) { void ref.current.ctx.resume().catch(() => {}); return; }
      try {
        const ctx = unlockAudio();
        if (!ctx) return;
        const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(master);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.connect(gain);
        const engine = ctx.createOscillator(); engine.type = 'sawtooth'; engine.connect(lp); engine.start();
        const sub = ctx.createOscillator(); sub.type = 'triangle'; sub.connect(lp); sub.start();
        const tire = ctx.createGain(); tire.gain.value = 0; tire.connect(master);
        const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const samples = noise.getChannelData(0); for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource(); source.buffer = noise; source.loop = true;
        const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1600; filter.Q.value = 3;
        source.connect(filter); filter.connect(tire); source.start();
        const cue = (frequency: number, duration: number, strength = 0.12) => {
          if (ctx.state !== 'running') return;
          const osc = ctx.createOscillator(); const envelope = ctx.createGain();
          osc.type = frequency < 150 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(frequency, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.65), ctx.currentTime + duration);
          envelope.gain.setValueAtTime(strength * useApp.getState().settings.sfxVolume, ctx.currentTime);
          envelope.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
          osc.connect(envelope); envelope.connect(master); osc.start(); osc.stop(ctx.currentTime + duration);
          osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
        };
        ref.current = { ctx, engine, sub, master, gain, lp, tire, cue };
        void ctx.resume().catch(() => {});
      } catch { /* Unsupported or blocked audio must not interrupt gameplay. */ }
    };
    window.addEventListener('pointerdown', create); window.addEventListener('keydown', create);
    if (currentAudioContext()) create();
    const off = hudBus.on(t => { if (['checkpoint', 'lap', 'best'].includes(t.kind)) ref.current?.cue(t.kind === 'checkpoint' ? 740 : 1040, 0.22); });
    return () => {
      off(); window.removeEventListener('pointerdown', create); window.removeEventListener('keydown', create);
      const audio = ref.current; ref.current = null;
      if (audio) releaseAudio(audio.ctx);
    };
  }, []);
  useFrame(() => {
    const a = ref.current; if (!a) return;
    const { settings, screen } = useApp.getState(); const { vehicle: v, race } = live(); const t = a.ctx.currentTime;
    a.master.gain.setTargetAtTime(screen === 'play' && !settings.muted ? settings.volume : 0, t, 0.04);
    a.engine.frequency.setTargetAtTime(28 + v.rpm / 7000 * 150, t, 0.04);
    a.sub.frequency.setTargetAtTime(14 + v.rpm / 7000 * 75, t, 0.04);
    a.lp.frequency.setTargetAtTime(380 + v.rpm * 0.28 + v.throttle * 500, t, 0.06);
    a.gain.gain.setTargetAtTime(0.035 + 0.065 * v.throttle, t, 0.08);
    const slip = v.grounded > 1 && v.speedKmh > 15 ? Math.min(0.18, Math.max(0, v.slip - 1.5) * 0.025 + v.brake * 0.025) : 0;
    a.tire.gain.setTargetAtTime(slip * settings.sfxVolume, t, 0.07);
    if (screen !== 'play') return;
    if (last.current.impact !== effects.serial) { last.current.impact = effects.serial; a.cue(70, 0.22, effects.strength * 0.7); }
    const count = Math.ceil(race.countdown);
    if (race.phase === 'countdown' && count !== last.current.count) { last.current.count = count; a.cue(440, 0.12); }
    if (race.phase !== last.current.phase) {
      if (race.phase === 'racing') a.cue(880, 0.4);
      if (race.phase === 'finished') a.cue(1320, 0.7);
      last.current.phase = race.phase;
    }
  });
  return null;
}
