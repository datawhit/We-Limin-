import AsyncStorage from '@react-native-async-storage/async-storage';

// Hidden badges — earned via behavioral triggers, not the activity list.
// Each badge: id, name, emoji, hint (visible while locked).
export const HIDDEN_BADGES = [
  { id: 'night_owl',     name: 'Night Owl',    emoji: '🦉', hint: 'Out past midnight' },
  { id: 'sunrise_crew',  name: 'Sunrise Crew', emoji: '🌅', hint: 'See the sun come up' },
  { id: 'spontaneous',   name: 'Spontaneous',  emoji: '🚲', hint: 'No plans, all plans' },
  { id: 'squad_goals',   name: 'Squad Goals',  emoji: '🤝', hint: '3+ friends on one lime' },
  { id: 'bus_a_lime',    name: "Bus' a Lime",  emoji: '🍋', hint: 'Your first memory' },
  { id: 'touch_road',    name: 'Touch Road',   emoji: '🛣️', hint: 'A spot no one in the squad has hit' },
];

const STORAGE_KEY = 'lime_hidden_badges';
const FIRST_OPEN_PREFIX = 'lime_first_open_';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Records the first time the app was opened today (ms). Returns the
// stored value. Cheap to call on every cold start.
export async function markFirstOpenToday() {
  const key = FIRST_OPEN_PREFIX + todayKey();
  try {
    const existing = await AsyncStorage.getItem(key);
    if (existing) return parseInt(existing, 10);
    const now = Date.now();
    await AsyncStorage.setItem(key, String(now));
    return now;
  } catch { return Date.now(); }
}

async function getFirstOpenToday() {
  const key = FIRST_OPEN_PREFIX + todayKey();
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? parseInt(raw, 10) : null;
  } catch { return null; }
}

export async function getUnlocked() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function persistUnlocked(map) {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
}

function meta(id) { return HIDDEN_BADGES.find(b => b.id === id); }

// Run all detectors against the given context and unlock anything new.
// Returns a list of newly-unlocked badges (with metadata) so the caller
// can fire the BadgeUnlockModal in sequence.
//
// context shape (all optional, depending on call site):
//   { trigger: 'memory_added' | 'activity_completed',
//     memory: { created_at, profile_ids: string[], activity_id },
//     activity: { id, name, tier },
//     allMemoriesForUser: [{ activity_id, profile_id }],   // for first-memory & touch-road
//     squadCompletedActivityIds: Set<number>,              // for touch-road
//     completedAt: ISOstring }
export async function checkAndUnlockHiddenBadges(context = {}) {
  const unlocked = await getUnlocked();
  const newly = [];

  const tryUnlock = (id) => {
    if (unlocked[id]) return;
    unlocked[id] = { earnedAt: new Date().toISOString() };
    newly.push(meta(id));
  };

  // Memory-time checks
  if (context.trigger === 'memory_added' && context.memory) {
    const hour = new Date(context.memory.created_at || Date.now()).getHours();
    if (hour >= 0 && hour < 4)   tryUnlock('night_owl');
    if (hour >= 5 && hour < 7)   tryUnlock('sunrise_crew');

    // First memory ever for this user
    const totalMine = (context.allMemoriesForUser || []).length;
    if (totalMine <= 1) tryUnlock('bus_a_lime');

    // 3+ squad members in the memory
    const profileIds = context.memory.profile_ids || [];
    if (profileIds.length >= 3) tryUnlock('squad_goals');

    // Touch Road — activity no squad member has completed before
    const aid = context.memory.activity_id;
    if (aid && context.squadCompletedActivityIds) {
      if (!context.squadCompletedActivityIds.has(aid)) tryUnlock('touch_road');
    }
  }

  // Activity-completed checks
  if (context.trigger === 'activity_completed') {
    const firstOpen = await getFirstOpenToday();
    const completedAt = context.completedAt ? new Date(context.completedAt).getTime() : Date.now();
    if (firstOpen && (completedAt - firstOpen) <= 2 * 60 * 60 * 1000) {
      tryUnlock('spontaneous');
    }
  }

  if (newly.length) await persistUnlocked(unlocked);
  return newly;
}
