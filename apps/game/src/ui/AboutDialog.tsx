import { CREATOR, CREDIT_LINE, PUBLIC_TITLE } from '@blr/content';
import { useUi } from '../state/ui';

export function AboutDialog() {
  const setAboutOpen = useUi((s) => s.setAboutOpen);
  const close = () => setAboutOpen(false);

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-ink/70 p-6 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="rise w-full max-w-md rounded-md border border-paper/15 bg-ink p-8 select-text"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="about-title" className="font-display text-3xl font-black uppercase italic">
          About {PUBLIC_TITLE}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-paper/80">
          An original open-world game set in a stylised Bengaluru, built for the browser. Every
          model, line of dialogue and brand in the game is original.
        </p>
        <p className="mt-4 text-sm font-semibold">{CREDIT_LINE}</p>
        <p className="text-sm text-paper/70">
          {CREATOR.role}, {CREATOR.city} ·{' '}
          <a
            className="text-auto underline underline-offset-2"
            href={CREATOR.githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            github.com/{CREATOR.githubHandle}
          </a>
        </p>
        <button
          type="button"
          autoFocus
          onClick={close}
          className="mt-8 rounded-sm border border-paper/30 px-6 py-2 text-xs font-bold tracking-widest uppercase hover:border-paper/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}
