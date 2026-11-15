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
} as const;

export const CREDIT_LINE = `Created & developed by ${CREATOR.name}`;

/** Our name for the wanted meter. */
export const WANTED_METER_NAME = 'Hoysala Heat';
