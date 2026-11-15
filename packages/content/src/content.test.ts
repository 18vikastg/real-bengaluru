import { describe, expect, it } from 'vitest';
import { CREATOR, CREDIT_LINE, LOADING_TIPS, PUBLIC_TITLE, pickTip } from './index';

describe('branding', () => {
  it('credits the creator', () => {
    expect(CREDIT_LINE).toContain('Vikas T G');
    expect(CREATOR.githubUrl).toBe('https://github.com/18vikastg');
  });

  it('never uses the internal codename as the public title', () => {
    expect(PUBLIC_TITLE.toLowerCase()).not.toContain('gta');
  });
});

describe('pickTip', () => {
  it('returns a tip for every random value in [0, 1]', () => {
    for (const r of [0, 0.5, 0.999, 1]) {
      expect(LOADING_TIPS).toContain(pickTip(() => r));
    }
  });
});
