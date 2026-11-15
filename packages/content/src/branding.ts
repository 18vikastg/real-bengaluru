/**
 * Single source of truth for names and credits.
 * "gta-bengaluru" is an internal codename only and must never appear in
 * player-facing UI. Change PUBLIC_TITLE here once the final title is chosen.
 */
export const PUBLIC_TITLE = 'Rowdy Journey';
export const TITLE_IS_FINAL = false;
export const TAGLINE = 'New in Bengaluru. Talk to the city, and it remembers you.';
export const CHAPTER = 'Chapter 1 · Majestic to MG Road';

export const CREATOR = {
  name: 'Vikas T G',
  role: 'Software Development Engineer',
  city: 'Bengaluru',
  githubHandle: '18vikastg',
  githubUrl: 'https://github.com/18vikastg',
  /** Shown on the developer card. Edit freely. */
  bio: 'I am a software development engineer from Bengaluru. This game is my attempt to put the city I live in, its streets, its people and the way they talk, into a browser tab.',
  /** What the developer did on this project, as short credits. */
  credits: ['Concept and direction', 'Game design', 'Writing', 'Development'],
  /** Links on the developer card. Add LinkedIn, a portfolio or an email address here. */
  links: [{ label: 'GitHub', url: 'https://github.com/18vikastg' }],
} as const;

export const CREDIT_LINE = `Created & developed by ${CREATOR.name}`;

/** Our name for the wanted meter. */
export const WANTED_METER_NAME = 'Hoysala Heat';
