import { create } from 'zustand';
import {
  DEFAULT_SETTINGS, TRACK_ID, persistence, sanitizeSettings,
  type RaceResult, type SavedRace, type Settings,
} from '../../persistence/db';

export type Screen = 'menu' | 'play' | 'pause' | 'finish';

export interface AppState {
  hydrated: boolean;
  screen: Screen;
  settings: Settings;
  settingsOpen: boolean;
  bestLap: number | null;
  bestTotal: number | null;
  needsResume: boolean; // page was refreshed mid-race -> show "Resume race"
  restore: SavedRace | null; // snapshot to apply when the scene mounts
  raceKey: number;
  result: RaceResult | null;
  init(initialHash: string): Promise<void>;
  startRace(): void;
  restartRace(): void;
  resumeRace(): void;
  pause(): void;
  togglePause(): void;
  quit(): void;
  finishRace(r: RaceResult): void;
  setScreen(s: Screen): void;
  updateSettings(p: Partial<Settings>): void;
  setSettingsOpen(v: boolean): void;
  setBests(lap: number | null, total: number | null): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  screen: 'menu',
  settings: DEFAULT_SETTINGS,
  settingsOpen: false,
  bestLap: null,
  bestTotal: null,
  needsResume: false,
  restore: null,
  raceKey: 0,
  result: null,

  async init(hash) {
    const [settings, best, race, result] = await Promise.all([
      persistence.loadSettings(),
      persistence.getBest(TRACK_ID),
      persistence.loadRace(),
      persistence.loadResult(),
    ]);
    let screen: Screen = 'menu';
    let needsResume = false;
    let restore: SavedRace | null = null;
    if (hash.startsWith('#/play') || hash.startsWith('#/pause')) {
      if (race && race.trackId === TRACK_ID) { screen = 'pause'; needsResume = true; restore = race; }
      else screen = 'play'; // refreshed before any progress was saved: stay on the race screen, fresh countdown
    } else if (hash.startsWith('#/finish')) {
      screen = result ? 'finish' : 'menu';
    }
    set({ settings, bestLap: best.bestLap, bestTotal: best.bestTotal, screen, needsResume, restore, result, hydrated: true });
  },

  startRace() {
    void persistence.clearRace();
    set((s) => ({ screen: 'play', needsResume: false, restore: null, raceKey: s.raceKey + 1, result: null, settingsOpen: false }));
  },
  restartRace() { get().startRace(); },
  resumeRace() { set({ screen: 'play', needsResume: false, settingsOpen: false }); },
  pause() { if (get().screen === 'play') set({ screen: 'pause' }); },
  togglePause() {
    const s = get();
    if (s.screen === 'play') set({ screen: 'pause' });
    else if (s.screen === 'pause' && !s.needsResume) set({ screen: 'play', settingsOpen: false });
  },
  quit() {
    void persistence.clearRace();
    set({ screen: 'menu', needsResume: false, restore: null, settingsOpen: false });
  },
  finishRace(r) {
    void persistence.clearRace();
    void persistence.saveResult(r);
    set({ screen: 'finish', result: r, restore: null, needsResume: false });
  },
  setScreen(screen) { set({ screen }); },

  updateSettings(p) {
    const next = sanitizeSettings({ ...get().settings, ...p });
    set({ settings: next });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void persistence.saveSettings(next); }, 150);
  },
  setSettingsOpen(v) { set({ settingsOpen: v }); },
  setBests(lap, total) { set({ bestLap: lap, bestTotal: total }); },
}));
