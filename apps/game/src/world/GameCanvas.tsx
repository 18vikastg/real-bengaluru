import { useEffect, useRef } from 'react';
import { GameView } from '../game/GameView';

/** Mounts the 3D game view and tears it down again. */
export function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const view = new GameView(element, `${import.meta.env.BASE_URL}world/`);
    return () => view.dispose();
  }, []);

  return <div ref={host} className="absolute inset-0" data-testid="game-canvas" />;
}
