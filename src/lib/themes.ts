import type { CSSProperties } from 'react';

/** Encodes an SVG string for use as a CSS background-image data URI. */
function svgUrl(svg: string, size = '28px 28px'): CSSProperties {
  const encoded = svg
    .replace(/\n\s*/g, ' ')
    .trim()
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/#/g, '%23')
    .replace(/"/g, "'");
  return {
    backgroundImage: `url("data:image/svg+xml,${encoded}")`,
    backgroundSize: size,
  };
}

export type ThemeId =
  | 'dungeon'
  | 'snow'
  | 'desert'
  | 'stone'
  | 'forest'
  | 'neon';

export interface Theme {
  id: ThemeId;
  label: string;
  /** Hex preview color shown in the theme picker swatch (represents the wall). */
  wallPreview: string;
  /** CSS properties for wall tiles. */
  wall: CSSProperties;
  /** CSS properties for floor tiles. */
  floor: CSSProperties;
}

export const THEMES: Theme[] = [
  {
    id: 'dungeon',
    label: 'Dungeon',
    wallPreview: '#9b3a10',
    wall: svgUrl(`
      <svg width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" fill="#351008"/>
        <rect x="0" y="0" width="26" height="12" fill="#9b3a10" rx="1"/>
        <rect x="0" y="0" width="26" height="2" fill="#c45a30" rx="1" opacity="0.4"/>
        <rect x="0" y="14" width="12" height="12" fill="#9b3a10" rx="1"/>
        <rect x="0" y="14" width="12" height="2" fill="#c45a30" rx="1" opacity="0.4"/>
        <rect x="14" y="14" width="14" height="12" fill="#9b3a10" rx="1"/>
        <rect x="14" y="14" width="14" height="2" fill="#c45a30" rx="1" opacity="0.4"/>
      </svg>`),
    floor: {
      ...svgUrl(`
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" fill="#d0c080" fill-opacity="0.1"/>
          <circle cx="3" cy="7" r="0.7" fill="#c0b070" fill-opacity="0.2"/>
          <circle cx="14" cy="3" r="0.5" fill="#b8a868" fill-opacity="0.18"/>
          <circle cx="8" cy="18" r="0.6" fill="#c8b878" fill-opacity="0.2"/>
          <circle cx="20" cy="11" r="0.8" fill="#b8a868" fill-opacity="0.15"/>
          <circle cx="11" cy="10" r="0.4" fill="#c0b070" fill-opacity="0.18"/>
          <circle cx="18" cy="21" r="0.6" fill="#c8b878" fill-opacity="0.15"/>
          <circle cx="5" cy="14" r="0.5" fill="#b8a868" fill-opacity="0.2"/>
        </svg>`, '24px 24px'),
      backgroundColor: 'rgba(220,200,130,0.25)',
    },
  },

  {
    id: 'snow',
    label: 'Snow',
    wallPreview: '#2a6090',
    wall: svgUrl(`
      <svg width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" fill="#0a1e30"/>
        <rect x="0" y="0" width="26" height="12" fill="#1a4565" rx="1"/>
        <rect x="0" y="0" width="26" height="2" fill="#80c8f0" rx="1" opacity="0.35"/>
        <rect x="4" y="4" width="18" height="1" fill="#ffffff" rx="1" opacity="0.06"/>
        <rect x="0" y="14" width="12" height="12" fill="#1a4565" rx="1"/>
        <rect x="0" y="14" width="12" height="2" fill="#80c8f0" rx="1" opacity="0.35"/>
        <rect x="14" y="14" width="14" height="12" fill="#1a4565" rx="1"/>
        <rect x="14" y="14" width="14" height="2" fill="#80c8f0" rx="1" opacity="0.35"/>
      </svg>`),
    floor: {
      ...svgUrl(`
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" fill="#6aaad0" fill-opacity="0.35"/>
          <ellipse cx="5"  cy="8"  rx="4"   ry="1.4" fill="#3a7898" fill-opacity="0.3"/>
          <ellipse cx="18" cy="15" rx="3.5" ry="1.2" fill="#3a7898" fill-opacity="0.25"/>
          <ellipse cx="10" cy="20" rx="3"   ry="1"   fill="#3a7898" fill-opacity="0.22"/>
        </svg>`, '24px 24px'),
      backgroundColor: 'rgba(185,220,242,0.5)',
    },
  },

  {
    id: 'desert',
    label: 'Desert',
    wallPreview: '#c4892e',
    wall: svgUrl(`
      <svg width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" fill="#6b3c10"/>
        <rect x="0" y="0" width="26" height="12" fill="#c4892e" rx="1"/>
        <rect x="0" y="0" width="26" height="2" fill="#f0c060" rx="1" opacity="0.4"/>
        <rect x="2" y="5" width="22" height="1" fill="#e0a840" rx="1" opacity="0.1"/>
        <rect x="0" y="14" width="12" height="12" fill="#c4892e" rx="1"/>
        <rect x="0" y="14" width="12" height="2" fill="#f0c060" rx="1" opacity="0.4"/>
        <rect x="14" y="14" width="14" height="12" fill="#c4892e" rx="1"/>
        <rect x="14" y="14" width="14" height="2" fill="#f0c060" rx="1" opacity="0.4"/>
      </svg>`),
    floor: {
      ...svgUrl(`
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" fill="#d4a055" fill-opacity="0.18"/>
          <path d="M0,8 Q6,6 12,8 Q18,10 24,8" stroke="#c09040" stroke-width="0.6" fill="none" opacity="0.25"/>
          <path d="M0,16 Q6,14 12,16 Q18,18 24,16" stroke="#c09040" stroke-width="0.6" fill="none" opacity="0.25"/>
          <circle cx="5"  cy="12" r="0.5" fill="#b88030" fill-opacity="0.3"/>
          <circle cx="18" cy="5"  r="0.6" fill="#b88030" fill-opacity="0.25"/>
          <circle cx="21" cy="19" r="0.4" fill="#b88030" fill-opacity="0.28"/>
        </svg>`, '24px 24px'),
      backgroundColor: 'rgba(210,165,80,0.22)',
    },
  },

  {
    id: 'stone',
    label: 'Stone',
    wallPreview: '#3a3a48',
    wall: svgUrl(`
      <svg width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" fill="#18181f"/>
        <rect x="0" y="0" width="26" height="12" fill="#2e2e3c" rx="1"/>
        <rect x="0" y="0" width="26" height="2" fill="#606070" rx="1" opacity="0.35"/>
        <rect x="2" y="5" width="20" height="1" fill="#505060" rx="1" opacity="0.08"/>
        <rect x="0" y="14" width="12" height="12" fill="#2e2e3c" rx="1"/>
        <rect x="0" y="14" width="12" height="2" fill="#606070" rx="1" opacity="0.35"/>
        <rect x="14" y="14" width="14" height="12" fill="#2e2e3c" rx="1"/>
        <rect x="14" y="14" width="14" height="2" fill="#606070" rx="1" opacity="0.35"/>
      </svg>`),
    floor: {
      ...svgUrl(`
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" fill="#404050" fill-opacity="0.18"/>
          <circle cx="3"  cy="7"  r="0.7" fill="#606070" fill-opacity="0.22"/>
          <circle cx="15" cy="3"  r="0.5" fill="#505060" fill-opacity="0.18"/>
          <circle cx="8"  cy="19" r="0.6" fill="#606070" fill-opacity="0.2"/>
          <circle cx="20" cy="13" r="0.8" fill="#505060" fill-opacity="0.15"/>
          <circle cx="12" cy="11" r="0.4" fill="#606070" fill-opacity="0.18"/>
        </svg>`, '24px 24px'),
      backgroundColor: 'rgba(55,55,70,0.28)',
    },
  },

  {
    id: 'forest',
    label: 'Forest',
    wallPreview: '#4a2810',
    wall: svgUrl(`
      <svg width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" fill="#1a0c05"/>
        <rect x="0" y="0"  width="28" height="8"  fill="#4a2810"/>
        <rect x="0" y="0"  width="28" height="1.5" fill="#7a5030" opacity="0.5"/>
        <rect x="0" y="9"  width="28" height="8"  fill="#3a1e08"/>
        <rect x="0" y="9"  width="28" height="1.5" fill="#6a3820" opacity="0.45"/>
        <rect x="0" y="18" width="28" height="10" fill="#4a2810"/>
        <rect x="0" y="18" width="28" height="1.5" fill="#7a5030" opacity="0.5"/>
        <line x1="0" y1="4"  x2="28" y2="4"  stroke="#6a3820" stroke-width="0.4" opacity="0.25"/>
        <line x1="0" y1="13" x2="28" y2="13" stroke="#5a2810" stroke-width="0.4" opacity="0.25"/>
        <line x1="0" y1="23" x2="28" y2="23" stroke="#6a3820" stroke-width="0.4" opacity="0.25"/>
      </svg>`),
    floor: {
      ...svgUrl(`
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" fill="#2d6820" fill-opacity="0.18"/>
          <circle cx="3"  cy="7"  r="0.7" fill="#4a8830" fill-opacity="0.28"/>
          <circle cx="14" cy="3"  r="0.5" fill="#3d7828" fill-opacity="0.22"/>
          <circle cx="8"  cy="18" r="0.6" fill="#4a8830" fill-opacity="0.25"/>
          <circle cx="20" cy="11" r="0.8" fill="#3d7828" fill-opacity="0.2"/>
          <circle cx="11" cy="10" r="0.4" fill="#4a8830" fill-opacity="0.22"/>
          <circle cx="18" cy="21" r="0.5" fill="#2d6820" fill-opacity="0.32"/>
          <circle cx="5"  cy="14" r="0.5" fill="#2d6820" fill-opacity="0.28"/>
        </svg>`, '24px 24px'),
      backgroundColor: 'rgba(45,104,32,0.22)',
    },
  },

  {
    id: 'neon',
    label: 'Neon',
    wallPreview: '#0a1530',
    wall: svgUrl(`
      <svg width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" fill="#040810"/>
        <rect x="1" y="1" width="26" height="26" fill="#0a1530" rx="1"/>
        <line x1="0"  y1="14" x2="28" y2="14" stroke="#00c8e0" stroke-width="0.5" opacity="0.4"/>
        <line x1="14" y1="0"  x2="14" y2="28" stroke="#00c8e0" stroke-width="0.5" opacity="0.4"/>
        <rect x="0" y="0" width="28" height="28" fill="none" stroke="#00c8e0" stroke-width="0.5" opacity="0.25"/>
      </svg>`),
    floor: {
      ...svgUrl(`
        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" fill="#00c8e0" fill-opacity="0.02"/>
          <line x1="0"  y1="12" x2="24" y2="12" stroke="#00c8e0" stroke-width="0.4" opacity="0.12"/>
          <line x1="12" y1="0"  x2="12" y2="24" stroke="#00c8e0" stroke-width="0.4" opacity="0.12"/>
        </svg>`, '24px 24px'),
      backgroundColor: 'rgba(0,10,20,0.6)',
    },
  },
];

export const DEFAULT_THEME: ThemeId = 'dungeon';

export function getTheme(id?: string): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}
