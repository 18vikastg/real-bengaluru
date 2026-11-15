import { CHAPTER, CREATOR, CREDIT_LINE, PUBLIC_TITLE, TAGLINE, pickTip } from '@blr/content';
import { useState } from 'react';
import { useUi } from '../state/ui';
import { Attribution } from './Attribution';

export function TitleScreen() {
  const start = useUi((s) => s.start);
  const setAboutOpen = useUi((s) => s.setAboutOpen);
  const [tip] = useState(() => pickTip());

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-tr from-ink/90 via-ink/30 to-transparent p-6 sm:p-12">
      <p className="rise text-xs font-semibold tracking-[0.35em] text-auto uppercase">{CHAPTER}</p>

      <div className="pointer-events-auto max-w-xl">
        <h1
          className="rise font-display text-6xl leading-[0.9] font-black tracking-tight uppercase italic sm:text-8xl"
          style={{ animationDelay: '80ms' }}
        >
          {PUBLIC_TITLE}
        </h1>
        <p
          className="rise mt-4 text-base text-paper/80 sm:text-lg"
          style={{ animationDelay: '160ms' }}
        >
          {TAGLINE}
        </p>
        <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
          <button
            type="button"
            onClick={start}
            className="rounded-sm bg-auto px-8 py-3 text-sm font-bold tracking-widest text-ink uppercase transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-auto active:translate-y-px"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="rounded-sm border border-paper/30 px-8 py-3 text-sm font-bold tracking-widest uppercase transition hover:border-paper/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
          >
            About
          </button>
        </div>
        <p
          className="rise mt-8 max-w-md text-sm text-paper/60 italic"
          style={{ animationDelay: '320ms' }}
        >
          “{tip}”
        </p>
      </div>

      <footer className="pointer-events-auto flex flex-wrap items-end justify-between gap-2 text-xs text-paper/60">
        <span>
          {CREDIT_LINE} ·{' '}
          <a
            className="underline underline-offset-2 hover:text-paper"
            href={CREATOR.githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            @{CREATOR.githubHandle}
          </a>
        </span>
        <span>
          <Attribution /> · Pre-alpha preview
        </span>
      </footer>
    </div>
  );
}
