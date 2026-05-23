// We Limin' design tokens — pastel palette, washi colors, card +
// headline base styles. Importing primitives (Polaroid, WashiTape,
// Doodles) and any future screen should pull from here so the
// scrapbook aesthetic stays consistent.

import { COLORS } from './constants';

// ─── Pastel background tokens ─────────────────────────────
// Used for emoji squares inside polaroids and other soft tinted
// surfaces. Names match the washi color tokens below.
export const PASTELS = {
  mintBg:     '#B8E6D0',
  blueBg:     '#B8DDF0',
  amberBg:    '#F9E0A8',
  pinkBg:     '#F5C6D5',
  lavenderBg: '#D9CFF5',
  coralBg:    '#F8C9B8',
};

// ─── Washi tape stripe colors ─────────────────────────────
// Slightly more saturated than the pastels — they read as paper
// tape on a cream page.
export const TAPE_COLORS = {
  pink:     '#F4A8C0',
  blue:     '#9EC8E8',
  coral:    '#F2A88C',
  lavender: '#C4B5F0',
  amber:    '#F2D068',
};

// Optional pairing: when a Polaroid is told to use a washi color,
// pick a coordinated pastel for the emoji box. Override via prop
// when a screen needs a different combination.
export const WASHI_TO_EMOJI_BG = {
  pink:     PASTELS.pinkBg,
  blue:     PASTELS.blueBg,
  coral:    PASTELS.pinkBg,    // soft peach reads warm next to coral tape
  lavender: PASTELS.lavenderBg,
  amber:    PASTELS.amberBg,
};

// ─── Standard scrapbook-page card ─────────────────────────
// Cream background, generous radius, faint border. Compose with
// `style={[CARD, { backgroundColor: PASTELS.coralBg }]}` for the
// tinted variant (randomizer, etc.).
export const CARD = {
  backgroundColor: COLORS.cream,
  borderRadius: 28,
  padding: 22,
  borderWidth: 1,
  borderColor: COLORS.cardBorder,
};

// ─── Handwritten headline ─────────────────────────────────
// Base style — caller supplies `fontFamily` (after `useFonts`
// resolves) and any size override. The text content is expected
// to be lowercase; `textTransform` is included as a safety net.
export const HANDWRITTEN_500 = 'Caveat_500Medium';
export const HANDWRITTEN_700 = 'Caveat_700Bold';

export const headlineStyle = {
  fontSize: 26,
  letterSpacing: -0.4,
  lineHeight: 32,
  color: COLORS.dark,
  textTransform: 'lowercase',
};
