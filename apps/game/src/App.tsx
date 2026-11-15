import { Suspense, lazy, useEffect } from 'react';
import { useCity } from './state/city';
import { useUi } from './state/ui';
import { AboutDialog } from './ui/AboutDialog';
import { Hud } from './ui/Hud';
import { PauseMenu } from './ui/PauseMenu';
import { TitleScreen } from './ui/TitleScreen';
import { CityLayer } from './ui/city/CityLayer';

// The 3D scene (three.js and friends) loads as its own chunk so the title UI paints first.
const GameCanvas = lazy(() =>
  import('./world/GameCanvas').then((module) => ({ default: module.GameCanvas })),
);

const TilesView = lazy(() =>
  import('./world/TilesView').then((module) => ({ default: module.TilesView })),
);

/** Prototype switch: ?view=tiles opens the Google 3D Tiles viewer instead of the game. */
const VIEW = new URLSearchParams(window.location.search).get('view');

export function App() {
  const phase = useUi((s) => s.phase);
  const aboutOpen = useUi((s) => s.aboutOpen);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const ui = useUi.getState();
      const city = useCity.getState();
      // Escape backs out of the innermost thing first.
      if (ui.aboutOpen) ui.setAboutOpen(false);
      else if (ui.phase === 'playing' && city.conversation) city.closeTalk();
      else if (ui.phase === 'playing' && city.panel) city.openPanel(null);
      else if (ui.phase === 'playing') ui.pause();
      else if (ui.phase === 'paused') ui.resume();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (VIEW === 'tiles') {
    return (
      <div className="relative h-full w-full">
        <Suspense fallback={null}>
          <TilesView />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none">
      <Suspense fallback={null}>
        <GameCanvas />
      </Suspense>
      {phase === 'title' && <TitleScreen />}
      {phase === 'playing' && <Hud />}
      {phase === 'playing' && <CityLayer />}
      {phase === 'paused' && <PauseMenu />}
      {aboutOpen && <AboutDialog />}
    </div>
  );
}
