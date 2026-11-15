/** Original loading-screen tips. Add freely; keep them short. */
export const LOADING_TIPS: readonly string[] = [
  'An indicator is a suggestion. A honk is a contract.',
  'The meter works. The driver has simply chosen not to believe in it.',
  'If the road looks empty at 6 PM, you have taken a wrong turn into a lake.',
  'Two minutes away is a unit of hope, not distance.',
  'Speed breakers are unmarked so that you may discover them personally.',
  'Rain forecast: yes.',
  'Every shortcut is known to exactly as many people as the main road.',
  'Filter coffee restores health. This is not a game mechanic, it is just true.',
];

export function pickTip(random: () => number = Math.random): string {
  const index = Math.floor(random() * LOADING_TIPS.length);
  return LOADING_TIPS[Math.min(index, LOADING_TIPS.length - 1)] ?? '';
}
