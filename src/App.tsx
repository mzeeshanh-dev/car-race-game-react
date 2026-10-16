import { lazy, Suspense, useEffect } from 'react';
import { input } from './game/input/InputManager';
import { useApp } from './game/state/store';
import { FinishScreen } from './ui/menus/FinishScreen';
import { MainMenu } from './ui/menus/MainMenu';
import { PauseMenu } from './ui/menus/PauseMenu';
import { HUD } from './ui/hud/HUD';
import { initRouter } from './ui/router';
import { GameErrorBoundary } from './ui/GameErrorBoundary';
import { unlockAudio } from './game/audio/context';

// the whole 3D stack (three, rapier, drei) is code-split: the menu paints immediately
const GameCanvas = lazy(() => import('./game/scene/GameCanvas').then((m) => ({ default: m.GameCanvas })));

export default function App() {
  const hydrated = useApp((s) => s.hydrated);
  const screen = useApp((s) => s.screen);

  useEffect(() => {
    const stopRouter = initRouter();
    void useApp.getState().init(window.location.hash);
    input.attach();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    const off = input.onAction((a) => {
      const app = useApp.getState();
      if (a === 'pause') app.togglePause();
      else if (a === 'mute') app.updateSettings({ muted: !app.settings.muted });
    });
    const blur = () => { input.clear(); useApp.getState().pause(); };
    const vis = () => { if (document.hidden) blur(); };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    return () => { stopRouter(); off(); input.detach(); document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', blur); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
  }, []);

  if (!hydrated) return <div className="screen splash">Loading…</div>;
  const inGame = screen !== 'menu';
  return (
    <>
      {inGame && (
        <GameErrorBoundary>
          <Suspense fallback={<div className="screen splash">Loading track…</div>}>
            <GameCanvas />
          </Suspense>
        </GameErrorBoundary>
      )}
      {inGame && <HUD />}
      {screen === 'menu' && <MainMenu />}
      {screen === 'pause' && <PauseMenu />}
      {screen === 'finish' && <FinishScreen />}
    </>
  );
}
