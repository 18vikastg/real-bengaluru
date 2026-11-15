import { useUi } from '../state/ui';

const item =
  'w-56 rounded-sm border border-paper/25 px-6 py-3 text-sm font-bold tracking-widest uppercase transition hover:border-auto hover:text-auto';

export function PauseMenu() {
  const resume = useUi((s) => s.resume);
  const quitToTitle = useUi((s) => s.quitToTitle);
  const setAboutOpen = useUi((s) => s.setAboutOpen);

  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-ink/75 backdrop-blur-sm">
      <div className="rise flex flex-col items-center gap-3">
        <h2 className="mb-4 font-display text-5xl font-black uppercase italic">Paused</h2>
        <button type="button" autoFocus className={item} onClick={resume}>
          Resume
        </button>
        <button type="button" className={item} onClick={() => setAboutOpen(true)}>
          About
        </button>
        <button type="button" className={item} onClick={quitToTitle}>
          Quit to title
        </button>
      </div>
    </div>
  );
}
