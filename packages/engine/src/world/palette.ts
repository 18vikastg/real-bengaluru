/** Shared colour tables, indexed by the small integers stored in chunk files. */
export const WALL_COLORS = [
  '#efe2c8',
  '#f2c9a9',
  '#c4e0d0',
  '#bcd6e8',
  '#efbcc3',
  '#e2b962',
  '#d2c6e6',
  '#e9e4da',
  '#d9d2c2',
  '#f0d9a0',
  '#c9d8b0',
  '#e6c2a6',
  '#b8c4d6',
  '#f3ead2',
] as const;
export const ROOF_COLORS = [
  '#b9b3a6',
  '#a8a295',
  '#c4beb0',
  '#9c9a94',
  '#b08a72',
  '#8f9aa6',
] as const;
export const SHOP_COLORS = [
  '#c0392b',
  '#1f6f8b',
  '#d98e04',
  '#2e7d4f',
  '#7b3fa0',
  '#c2185b',
  '#00695c',
  '#e65100',
] as const;
export const TREE_COLORS = [
  '#2f7d3a',
  '#3c8f45',
  '#27682f',
  '#4a9a3f',
  '#5d8f34',
  '#d9512c',
] as const;

export const COLOR = {
  asphalt: '#3b3c40',
  asphaltMinor: '#46474a',
  footpath: '#a9a294',
  marking: '#ece7d6',
  concrete: '#b5b0a6',
  concreteDark: '#8d897f',
  green: '#6f9a4e',
  pitch: '#7fb05a',
  water: '#3f7fa6',
  shutter: '#39424d',
  awning: '#e9e2d0',
} as const;

/** sRGB hex to linear RGB, the space three.js expects for vertex colours. */
export function hexToLinear(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [toLinear((value >> 16) & 255), toLinear((value >> 8) & 255), toLinear(value & 255)];
}
