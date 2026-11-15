import { CHAPTER, CREATOR, PUBLIC_TITLE } from '@blr/content';
import { useUi } from '../state/ui';

const initials = CREATOR.name
  .split(/\s+/)
  .map((word) => word[0])
  .join('')
  .slice(0, 3);

export function AboutDialog() {
  const setAboutOpen = useUi((s) => s.setAboutOpen);
  const close = () => setAboutOpen(false);

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-ink/75 p-6 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="rise w-full max-w-lg rounded-md border border-paper/15 bg-ink p-8 select-text"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs font-semibold tracking-[0.3em] text-auto uppercase">{CHAPTER}</p>
        <h2 id="about-title" className="mt-2 font-display text-3xl font-black uppercase italic">
          About {PUBLIC_TITLE}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-paper/80">
          An original open-world game set in the real streets of Bengaluru, built for the browser.
          Every character, line of dialogue and model in it is original. The street map comes from
          OpenStreetMap.
        </p>

        <section
          aria-label="Developer"
          className="mt-6 rounded-md border border-paper/15 bg-paper/5 p-5"
          data-testid="developer"
        >
          <p className="text-xs font-semibold tracking-[0.3em] text-paper/60 uppercase">
            Created &amp; developed by
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div
              aria-hidden="true"
              className="grid h-14 w-14 flex-none place-items-center rounded-full bg-auto font-display text-xl font-black text-ink italic"
            >
              {initials}
            </div>
            <div>
              <p className="font-display text-2xl leading-none font-black uppercase italic">
                {CREATOR.name}
              </p>
              <p className="mt-1 text-sm text-paper/70">
                {CREATOR.role} · {CREATOR.city}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-paper/80">{CREATOR.bio}</p>
          <p className="mt-3 text-xs text-paper/60">{CREATOR.credits.join(' · ')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CREATOR.links.map((link) => (
              <a
                key={link.url}
                className="rounded-sm border border-paper/30 px-4 py-2 text-xs font-bold tracking-widest uppercase hover:border-auto hover:text-auto"
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        </section>

        <button
          type="button"
          autoFocus
          onClick={close}
          className="mt-6 rounded-sm border border-paper/30 px-6 py-2 text-xs font-bold tracking-widest uppercase hover:border-paper/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}
