import { useApp, type Screen } from '../game/state/store';

const HASH: Record<Screen, string> = { menu: '#/menu', play: '#/play', pause: '#/pause', finish: '#/finish' };

export function hashToScreen(hash: string): Screen {
  if (hash.startsWith('#/play')) return 'play';
  if (hash.startsWith('#/pause')) return 'pause';
  if (hash.startsWith('#/finish')) return 'finish';
  return 'menu';
}

/** Keeps the URL hash in sync with the current screen (so a refresh stays on the same screen). */
export function initRouter(): () => void {
  const write = (screen: Screen) => {
    const want = HASH[screen];
    if (window.location.hash !== want) history.replaceState(null, '', want);
  };
  const unsub = useApp.subscribe((s, prev) => {
    if (s.hydrated && (s.screen !== prev.screen || !prev.hydrated)) write(s.screen);
  });
  const onHash = () => {
    const st = useApp.getState();
    if (!st.hydrated) return;
    const target = hashToScreen(window.location.hash);
    if (target === st.screen) return;
    // manual hash edits / back button: only allow safe transitions
    if (target === 'menu') st.quit();
    else if (target === 'pause') st.pause();
    else if (target === 'play') { if (st.screen === 'pause') st.resumeRace(); else if (st.screen === 'menu') st.startRace(); }
    else write(st.screen);
  };
  window.addEventListener('hashchange', onHash);
  return () => { unsub(); window.removeEventListener('hashchange', onHash); };
}
