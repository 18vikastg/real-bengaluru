import { Suspense, lazy, useEffect } from 'react';
import { useUi } from './state/ui';
import { AboutDialog } from './ui/AboutDialog';
import { Hud } from './ui/Hud';
import { PauseMenu } from './ui/PauseMenu';
import { TitleScreen } from './ui/TitleScreen';

// The 3D scene (three.js and friends) loads as its own chunk so the title UI paints first.
const CityScene = lazy(() =>
  import('./world/CityScene').then((module) => ({ default: module.CityScene })),
);

const TilesView = lazy(() =>
  import('./world/TilesView').then((module) => ({ default: module.TilesView })),
);

/** Prototype switch: ?view=top (top-down drive) or ?view=tiles (Google 3D Tiles viewer). */
const VIEW = new URLSearchParams(window.location.search).get('view');

export function App() {
  const phase = useUi((s) => s.phase);
  const aboutOpen = useUi((s) => s.aboutOpen);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const ui = useUi.getState();
      if (ui.aboutOpen) ui.setAboutOpen(false);
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
        <CityScene topDown={VIEW === 'top'} />
      </Suspense>
      {phase === 'title' && <TitleScreen />}
      {phase === 'playing' && <Hud />}
      {phase === 'paused' && <PauseMenu />}
      {aboutOpen && <AboutDialog />}
    </div>
  );
}
