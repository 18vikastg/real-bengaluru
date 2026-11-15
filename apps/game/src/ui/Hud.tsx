import { useUi } from '../state/ui';
import { Attribution } from './Attribution';

function formatHour(hour: number): string {
  const total = Math.round(hour * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const panel = 'rounded-sm bg-ink/60 px-3 py-2 text-xs backdrop-blur-sm';

export function Hud() {
  const hour = useUi((s) => s.hour);
  const setHour = useUi((s) => s.setHour);
  const pause = useUi((s) => s.pause);
  const fps = useUi((s) => s.fps);
  const drawCalls = useUi((s) => s.drawCalls);
  const triangles = useUi((s) => s.triangles);
  const world = useUi((s) => s.world);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col items-start gap-2">
          <p className={`${panel} text-paper/80`}>
            {new URLSearchParams(window.location.search).get('view') === 'top'
              ? 'Top-down prototype · WASD or arrows to drive'
              : 'Fly camera · WASD move · drag to look · Q/E down/up · Shift faster'}
          </p>
          {world.near && (
            <p className={`${panel} font-semibold text-auto`} data-testid="near">
              Near {world.near}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className={`${panel} tabular-nums text-paper/80`} data-testid="stats">
            {fps} FPS · {world.loaded} chunks{world.pending > 0 ? ` (+${world.pending})` : ''} ·{' '}
            {drawCalls} draws · {Math.round(triangles / 1000)}k tris
          </p>
          <button
            type="button"
            onClick={pause}
            aria-label="Pause"
            className={`${panel} pointer-events-auto font-bold tracking-widest uppercase hover:text-auto`}
          >
            Pause
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="text-[11px] text-paper/60">
          <Attribution />
        </span>
        <label
          className={`${panel} pointer-events-auto flex w-full max-w-sm items-center gap-3 px-4 py-3`}
        >
          <span className="w-24 font-semibold tabular-nums">Time {formatHour(hour)}</span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.05}
            value={hour}
            onChange={(event) => setHour(Number(event.target.value))}
            className="flex-1 accent-auto"
            aria-label="Time of day"
          />
        </label>
        <span className="hidden w-48 sm:block" />
      </div>
    </div>
  );
}
