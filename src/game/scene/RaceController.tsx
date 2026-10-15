import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBeforePhysicsStep } from '@react-three/rapier';
import { FIXED_DT, TRACK_CFG } from '../constants';
import { input } from '../input/InputManager';
import { CheckpointTracker } from '../race/checkpoints';
import { LapTimer, formatTime } from '../race/lapTimer';
import { hudBus } from '../state/hudBus';
import { rt } from '../state/runtime';
import { useApp } from '../state/store';
import { live } from '../state/telemetry';
import { createNearest, nearestOnTrack, trackYaw, type TrackData } from '../track/trackData';
import { TRACK_ID, persistence, type RaceResult } from '../../persistence/db';

const COUNTDOWN_SECONDS = 3;

/** Race rules: countdown, ordered checkpoints, lap timing, wrong-way, respawn, persistence snapshots. */
export function RaceController({ track }: { track: TrackData }) {
  const timer = useRef(new LapTimer(useApp.getState().bestLap)).current;
  const near = useRef(createNearest()).current;
  const st = useRef({
    tracker: null as CheckpointTracker | null,
    hint: -1,
    started: false,
    badTime: 0,
    wrongTime: 0,
    snapshotT: 0,
    finishing: false,
    countdown: COUNTDOWN_SECONDS + 0.8,
  }).current;

  useEffect(() => {
    return input.onAction((a) => { if (a === 'respawn') rt.respawnRequested = true; });
  }, []);

  // Race clock runs on the fixed physics step so timing stays correct even if rendering is slow.
  useBeforePhysicsStep(() => {
    if (!st.started) return;
    const race = live().race;
    if (race.phase === 'countdown') {
      st.countdown -= FIXED_DT;
      race.countdown = st.countdown - 0.8; // shows 3,2,1 then <=0 => "GO"
      if (st.countdown <= 0.8) { race.phase = 'racing'; race.countdown = 0; timer.start(); }
    } else if (race.phase === 'racing') {
      timer.tick(FIXED_DT);
    }
  });

  useFrame((_, delta) => {
    const sim = rt.sim;
    const car = rt.car;
    const app = useApp.getState();
    if (!sim || !car.valid || app.screen !== 'play') return;
    const dt = Math.min(delta, 0.05);
    const L = live();
    const race = L.race;

    // ---- first-frame setup (fresh race or restore after refresh) ----------------------------
    if (!st.started) {
      st.started = true;
      race.totalLaps = TRACK_CFG.lapCount;
      race.best = timer.best;
      race.gateCount = track.gates.length;
      const snap = app.restore;
      if (snap) {
        sim.respawn(snap.car.x, snap.car.y + 0.4, snap.car.z, snap.car.yaw);
        timer.restore(snap.total, snap.lapTime, snap.laps, timer.best);
        const n = nearestOnTrack(track, snap.car.x, snap.car.z, -1, near);
        st.tracker = new CheckpointTracker(track.gateS, track.length, TRACK_CFG.lapCount, n.s);
        st.tracker.restore(snap.lap, snap.next, snap.lastGate, n.s);
        race.phase = 'racing'; race.countdown = 0;
        timer.start();
      } else {
        const n = nearestOnTrack(track, car.x, car.z, -1, near);
        st.tracker = new CheckpointTracker(track.gateS, track.length, TRACK_CFG.lapCount, n.s);
        race.phase = 'countdown';
      }
    }
    const tracker = st.tracker;
    if (!tracker) return;

    // ---- progress ----------------------------------------------------------------------------
    const n = nearestOnTrack(track, car.x, car.z, st.hint, near, 40);
    st.hint = n.index;
    car.upY = sim.live.upY;

    if (race.phase === 'racing') {
      const ev = tracker.update(n.s);
      if (ev.type === 'checkpoint') {
        hudBus.toast({ kind: 'checkpoint', text: `Checkpoint ${ev.index}/${track.gates.length - 1}`, sub: formatTime(timer.total) });
      } else if (ev.type === 'lap' || ev.type === 'finish') {
        const res = timer.completeLap();
        void persistence.submitLap(TRACK_ID, res.time).then((isBest) => {
          if (isBest) app.setBests(res.time, useApp.getState().bestTotal);
        });
        race.best = timer.best;
        if (ev.type === 'lap') {
          hudBus.toast({ kind: res.isBest ? 'best' : 'lap', text: res.isBest ? `BEST LAP ${formatTime(res.time)}` : `Lap ${ev.lap}: ${formatTime(res.time)}`, sub: `Lap ${ev.lap + 1} of ${TRACK_CFG.lapCount}` });
        } else if (!st.finishing) {
          st.finishing = true;
          timer.stop();
          race.phase = 'finished';
          const progress = tracker.progress(n.s);
          let ahead = 0;
          for (const a of rt.ai) if (a.dist >= progress) ahead++;
          const result: RaceResult = {
            trackId: TRACK_ID, total: timer.total, laps: timer.laps.slice(), best: timer.best ?? res.time,
            position: ahead + 1, racers: rt.ai.length + 1, date: Date.now(),
          };
          void persistence.submitTotal(TRACK_ID, result.total).then((isBest) => { if (isBest) app.setBests(useApp.getState().bestLap, result.total); });
          setTimeout(() => useApp.getState().finishRace(result), 1800);
        }
      }
      // race position
      const prog = tracker.progress(n.s);
      let ahead = 0;
      for (const a of rt.ai) if (a.dist > prog) ahead++;
      race.position = ahead + 1;
      race.racers = rt.ai.length + 1;
      race.lap = Math.min(tracker.lap, TRACK_CFG.lapCount);
      race.nextGate = tracker.next;
    }
    race.lapTime = timer.lapTime;
    race.total = timer.total;

    // ---- wrong way -------------------------------------------------------------------------
    const dot = car.fx * track.fx[n.index] + car.fz * track.fz[n.index];
    if (race.phase === 'racing' && dot < -0.35 && car.speedKmh > 10) st.wrongTime += dt; else st.wrongTime = 0;
    race.wrongWay = st.wrongTime > 0.8;

    // ---- respawn: flipped / off the map for > 3 s, or R key --------------------------------
    const flipped = sim.live.upY < 0.35;
    const offMap = Math.abs(n.lateral) > TRACK_CFG.barrierOffset + 6 || car.y < TRACK_CFG.groundY - 3;
    if (race.phase !== 'countdown' && (flipped || offMap)) st.badTime += dt; else st.badTime = 0;
    if (rt.respawnRequested || st.badTime > 3) {
      if (race.phase !== 'countdown') {
        const gi = track.gates[tracker.lastGate];
        sim.respawn(track.px[gi], track.py[gi] + 1.0, track.pz[gi], trackYaw(track, gi));
        tracker.sync(track.gateS[tracker.lastGate]);
        st.hint = -1; st.badTime = 0; st.wrongTime = 0;
        hudBus.toast({ kind: 'warn', text: 'Respawned at checkpoint' });
      }
      rt.respawnRequested = false;
    }

    // ---- snapshot so a refresh can resume the race -----------------------------------------
    st.snapshotT += dt;
    if (st.snapshotT > 1 && race.phase === 'racing') {
      st.snapshotT = 0;
      const p = sim.body.translation();
      void persistence.saveRace({
        trackId: TRACK_ID, lap: tracker.lap, next: tracker.next, lastGate: tracker.lastGate,
        total: timer.total, lapTime: timer.lapTime, laps: timer.laps.slice(),
        car: { x: p.x, y: p.y, z: p.z, yaw: car.yaw }, savedAt: Date.now(),
      });
    }
  }, -8);

  return null;
}
