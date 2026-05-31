// Vibe definitions for the Explore screen's vibe-first discovery.
//
// Each vibe is a curated mood — a small grouping of activities that
// share an emotional flavor (not a strict category). Activities can
// appear in multiple vibes; "Pottery" is both Solo Reset and Girls Day.
//
// Activity IDs reference the catalog in src/lib/constants.js. The list
// is intentionally short per vibe (8–10) so the detail view feels
// curated, not exhaustive.
//
// To add a new vibe: append an entry below. To add an activity to a
// vibe: append its id to that vibe's activityIds array. No schema
// changes required — this is a static taxonomy.

export const VIBES = [
  {
    id:    'girls-day',
    label: 'girls day',
    emoji: '💕',
    moodLine: 'good vibes, best company',
    bg:    '#FCDCD0', // soft coral
    fg:    '#993C1D',
    activityIds: [1, 4, 6, 11, 12, 15, 24, 3, 19, 28], // spa, picnic, pottery, paint&sip, flowers, perfume, pilates, winery, ballet, staycation
  },
  {
    id:    'date-night',
    label: 'date night',
    emoji: '🍷',
    moodLine: 'just the two of us',
    bg:    '#E4DEF6', // dusty lavender — evening hush
    fg:    '#5B3FA3',
    activityIds: [8, 9, 10, 18, 19, 20, 17, 52, 3, 6], // jazz, kbbq, hotpot, broadway, ballet, comedy, cooking, dinner-dark, winery, pottery
  },
  {
    id:    'touch-grass',
    label: 'touch grass',
    emoji: '🌿',
    moodLine: 'outside today',
    bg:    '#DDF1E2', // mint
    fg:    '#2D6A4F',
    activityIds: [4, 26, 27, 46, 36, 47, 48, 40, 41, 45], // picnic, tennis, pickleball, horseback, river, bush, scavenger, climbing, archery, polo
  },
  {
    id:    'feeling-fancy',
    label: 'feeling fancy',
    emoji: '✨',
    moodLine: 'treat yourself',
    bg:    '#FBE7C6', // soft amber
    fg:    '#A86A1E',
    activityIds: [3, 18, 19, 8, 45, 28, 53, 54, 52, 9], // winery, broadway, ballet, jazz, polo, staycation, night museum, fancy bush, dinner-dark, kbbq
  },
  {
    id:    'solo-reset',
    label: 'solo reset',
    emoji: '🧘',
    moodLine: 'back to yourself',
    bg:    '#EFE3F5', // lavender mist
    fg:    '#7A5C9C',
    activityIds: [1, 16, 24, 6, 13, 29, 22, 32, 12, 31], // spa, meditation, pilates, pottery, candle, book club, planetarium, sky yoga, flowers, aerial yoga
  },
  {
    id:    'rainy-day',
    label: 'rainy day',
    emoji: '🌧️',
    moodLine: 'stuck inside, still vibing',
    bg:    '#D6F0F4', // pale blue
    fg:    '#0c4a6e',
    activityIds: [23, 22, 18, 20, 11, 6, 55, 37, 10, 8], // interactive museum, planetarium, broadway, comedy, paint, pottery, indoor sky, escape room, hotpot, jazz
  },
  {
    id:    'adventure-mode',
    label: 'adventure mode',
    emoji: '🔥',
    moodLine: 'shake it up',
    bg:    '#FDE3DA', // warm coral
    fg:    '#993C1D',
    activityIds: [56, 55, 40, 39, 35, 37, 38, 41, 36, 47], // bungee, indoor sky, climbing, axe, gokart, escape, rage, archery, river, bush
  },
  {
    id:    'birthday-energy',
    label: 'birthday energy',
    emoji: '🎉',
    moodLine: 'celebration mode',
    bg:    '#FDEED7', // sunshine peach
    fg:    '#A86A1E',
    activityIds: [35, 37, 11, 49, 25, 20, 18, 51, 9, 17], // gokart, escape, paint, bar hop scavenger, dance, comedy, broadway, chef comp, kbbq, cooking
  },
  {
    id:    'chill-unwind',
    label: 'chill & unwind',
    emoji: '🍵',
    moodLine: 'slow and easy',
    bg:    '#D6F0DD', // soft palm
    fg:    '#2D6A4F',
    activityIds: [1, 16, 6, 4, 22, 8, 29, 12, 13, 32], // spa, meditation, pottery, picnic, planetarium, jazz, book club, flowers, candles, sky yoga
  },
];

// Helper: pick the vibes that include a given activity id. Useful if a
// future card wants to surface "also in: feeling fancy, date night".
export const vibesForActivity = (activityId) =>
  VIBES.filter(v => v.activityIds.includes(activityId));

// Helper: resolve activity records for a vibe by id, preserving the
// curated order from activityIds. Returns [] if nothing matches.
export const activitiesForVibe = (vibe, allActivities) => {
  if (!vibe) return [];
  const byId = new Map(allActivities.map(a => [a.id, a]));
  return vibe.activityIds.map(id => byId.get(id)).filter(Boolean);
};
