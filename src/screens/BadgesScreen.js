// Full badges catalog — earned / locked / hidden. Opened as a modal
// from Profile's "badges" row. Replaces the old TiersScreen placeholder
// for that route. Tier badges still appear in the "see all tiers" CTA
// on Home; this screen is the badge-collection view.

import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { AppContext } from '../lib/AppContext';
import { ACTIVITIES, COLORS, TIERS } from '../lib/constants';
import { supabase, getMemories } from '../lib/supabase';
import { HIDDEN_BADGES, getUnlocked } from '../lib/hiddenBadges';

import WashiTape from '../components/WashiTape';
import { Star, Sparkle, CurvedArrow } from '../components/Doodles';
import { HANDWRITTEN_500, PASTELS } from '../lib/theme';

const WASHI_CYCLE = ['pink', 'blue', 'coral', 'lavender', 'amber', 'mint'];
const TILT_CYCLE  = [-2, 2, -1.5, 1.5, -1, 1];

export default function BadgesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { profile, myBadges } = useContext(AppContext);

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  // ─── Data sources ─────────────────────────────────────────
  const [badgeRows, setBadgeRows] = useState([]);     // [{ activity_id, earned_at }]
  const [memories,  setMemories]  = useState([]);
  const [hiddenMap, setHiddenMap] = useState({});     // { [id]: { earnedAt } }
  const [hiddenOpen, setHiddenOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('badges')
          .select('activity_id, earned_at')
          .eq('profile_id', profile.id)
          .order('earned_at', { ascending: false });
        if (alive) setBadgeRows(data || []);
      } catch { /* fall back to context-only earned set */ }
      try {
        const mems = await getMemories();
        if (alive) setMemories(mems);
      } catch { /* memories optional */ }
      try {
        const unlocked = await getUnlocked();
        if (alive) setHiddenMap(unlocked || {});
      } catch { /* none unlocked */ }
    })();
    return () => { alive = false; };
  }, [profile.id]);

  // ─── Derived: earned / locked sets ────────────────────────
  // Prefer DB rows; fall back to the AppContext myBadges (so the
  // screen still works when the badges query fails).
  const earnedActivityIds = useMemo(() => {
    if (badgeRows.length) return new Set(badgeRows.map(b => b.activity_id));
    return new Set(myBadges || []);
  }, [badgeRows, myBadges]);

  const earnedActivities = useMemo(
    () => ACTIVITIES.filter(a => earnedActivityIds.has(a.id)),
    [earnedActivityIds]
  );
  const lockedActivities = useMemo(
    () => ACTIVITIES.filter(a => !earnedActivityIds.has(a.id)),
    [earnedActivityIds]
  );

  const earnedHidden = useMemo(
    () => HIDDEN_BADGES.filter(h => hiddenMap[h.id]),
    [hiddenMap]
  );
  const lockedHidden = useMemo(
    () => HIDDEN_BADGES.filter(h => !hiddenMap[h.id]),
    [hiddenMap]
  );

  // Tier "earned" = badgeCount >= tier.min. Big Limer is always
  // locked until someone hits 50.
  const badgeCount = earnedActivityIds.size;
  const earnedTiers = useMemo(() => TIERS.filter(t => badgeCount >= t.min), [badgeCount]);
  const lockedTiers = useMemo(() => TIERS.filter(t => badgeCount <  t.min), [badgeCount]);

  // Flatten into a single "earned" list ordered: activities, hidden, tiers.
  const earnedAll = useMemo(() => {
    const list = [];
    earnedActivities.forEach(a => {
      const row = badgeRows.find(b => b.activity_id === a.id);
      list.push({
        kind: 'activity',
        key: `a-${a.id}`,
        emoji: a.badge || '🏅',
        name: a.name,
        earnedAt: row?.earned_at || null,
        activityId: a.id,
      });
    });
    earnedHidden.forEach(h => {
      list.push({
        kind: 'hidden',
        key: `h-${h.id}`,
        emoji: h.emoji,
        name: h.name,
        earnedAt: hiddenMap[h.id]?.earnedAt || null,
      });
    });
    earnedTiers.forEach(t => {
      list.push({
        kind: 'tier',
        key: `t-${t.name}`,
        emoji: t.emoji,
        name: t.name,
        earnedAt: null,
      });
    });
    return list;
  }, [earnedActivities, earnedHidden, earnedTiers, badgeRows, hiddenMap]);

  // Locked (visible) = locked activities + locked tiers.
  // Hidden gets its own collapsible section below.
  const lockedVisible = useMemo(() => {
    const list = [];
    lockedActivities.forEach(a => {
      list.push({
        kind: 'activity',
        key: `la-${a.id}`,
        emoji: a.badge || '🏅',
        name: a.name,
        hint: `lime "${a.name}" — ${a.tier} tier`,
      });
    });
    lockedTiers.forEach(t => {
      const more = Math.max(1, t.min - badgeCount);
      list.push({
        kind: 'tier',
        key: `lt-${t.name}`,
        emoji: t.emoji,
        name: t.name,
        hint: `${more} more adventure${more === 1 ? '' : 's'} to unlock`,
      });
    });
    return list;
  }, [lockedActivities, lockedTiers, badgeCount]);

  // Stats line
  const earnedCount = earnedAll.length;
  const toGoCount   = lockedVisible.length + lockedHidden.length;
  const hiddenCount = lockedHidden.length;
  const statsLine   = `${earnedCount} earned · ${toGoCount} to go · ${hiddenCount} hidden`;

  // ─── Tap handlers ─────────────────────────────────────────
  const onEarnedTap = (item) => {
    if (item.kind === 'activity') {
      const match = memories.find(m => m.activity_id === item.activityId);
      if (match) {
        navigation.navigate('Tabs', {
          screen: 'Scrapbook',
          params: { screen: 'MemoryDetail', params: { memory: match } },
        });
        return;
      }
      Alert.alert(item.name, 'earned through your scrapbook 🍋');
      return;
    }
    if (item.kind === 'hidden') {
      Alert.alert(item.name, 'secret badge unlocked ✨');
      return;
    }
    if (item.kind === 'tier') {
      Alert.alert(item.name, 'tier reached — keep going 🌴');
    }
  };
  const onLockedTap = (item) => {
    Alert.alert(item.name, item.hint);
  };
  const onHiddenSilhouetteTap = () => {
    Alert.alert('Hidden badge', "we'll tell you when it lands 🤫");
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.chev}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, HAND_500 && { fontFamily: HAND_500 }]}>badges</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 60, position: 'relative' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page-edge doodles */}
        <Sparkle    size={14} color={COLORS.coral}     opacity={0.55} style={{ right: 6,  top: -4 }} />
        <Star       size={12} color={COLORS.palmGreen} opacity={0.5}  style={{ left:  -2, top: 8 }} />

        {/* Stats card */}
        <View style={styles.statsCard}>
          <WashiTape color="coral" width="48%" height={12} rotation={-3} opacity={0.85} style={{ top: -6, left: '26%' }} />
          <Text style={styles.statsText}>{statsLine}</Text>
        </View>

        {/* ─── EARNED ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeader, HAND_500 && { fontFamily: HAND_500 }]}>earned</Text>
          <Star size={14} color={COLORS.amber} opacity={0.7} style={{ left: 6, top: 8 }} />
        </View>
        {earnedAll.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>nothing earned yet — go bus a lime 🍋</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {earnedAll.map((item, i) => (
              <BadgeCard
                key={item.key}
                item={item}
                index={i}
                onPress={() => onEarnedTap(item)}
              />
            ))}
          </View>
        )}

        {/* ─── LOCKED ─── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
          <Text style={[styles.sectionHeader, HAND_500 && { fontFamily: HAND_500 }]}>locked</Text>
          <Sparkle size={14} color={COLORS.coral} opacity={0.7} style={{ left: 6, top: 8 }} />
        </View>
        {lockedVisible.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>all caught up — only hidden ones left ✨</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {lockedVisible.map((item, i) => (
              <LockedCard
                key={item.key}
                item={item}
                index={i}
                onPress={() => onLockedTap(item)}
              />
            ))}
          </View>
        )}

        {/* ─── HIDDEN (collapsible) ─── */}
        <TouchableOpacity
          onPress={() => setHiddenOpen(o => !o)}
          activeOpacity={0.85}
          style={[styles.sectionHeaderRow, { marginTop: 28 }]}
        >
          <Text style={[styles.sectionHeader, HAND_500 && { fontFamily: HAND_500 }]}>hidden 🤫</Text>
          <Text style={styles.collapseChev}>{hiddenOpen ? '−' : '+'}</Text>
        </TouchableOpacity>
        <Text style={styles.sectionSub}>secret badges — unlock to reveal</Text>

        {hiddenOpen && (
          lockedHidden.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>all secrets cracked — wow 🤯</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {lockedHidden.map((h, i) => (
                <HiddenSilhouetteCard
                  key={`hs-${h.id}`}
                  index={i}
                  onPress={onHiddenSilhouetteTap}
                />
              ))}
            </View>
          )
        )}

        {/* Bottom-edge doodles */}
        <View pointerEvents="none" style={styles.bottomAccents}>
          <Sparkle    size={12} color={COLORS.amber}     opacity={0.55} style={{ left: 30,  top: 0 }} />
          <CurvedArrow size={32} color={COLORS.coral}    opacity={0.45} style={{ right: 28, top: 8, transform: [{ rotate: '110deg' }] }} />
          <Star       size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: '52%', top: 22 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Subcomponents ──────────────────────────────────────────
function BadgeCard({ item, index, onPress }) {
  const washi = WASHI_CYCLE[index % WASHI_CYCLE.length];
  const tilt  = TILT_CYCLE[index % TILT_CYCLE.length];
  const dateStr = item.earnedAt ? formatShortDate(item.earnedAt) : null;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, { transform: [{ rotate: `${tilt}deg` }] }]}
    >
      <WashiTape color={washi} width="60%" height={10} rotation={-3} opacity={0.85} style={{ top: -4, left: '20%' }} />
      <Text style={styles.cardEmoji}>{item.emoji}</Text>
      <Text style={styles.cardName} numberOfLines={1}>{item.name.toLowerCase()}</Text>
      {dateStr ? (
        <Text style={styles.cardDate}>earned {dateStr}</Text>
      ) : (
        <Text style={styles.cardDate}>{item.kind === 'tier' ? 'tier reached' : ''}</Text>
      )}
    </TouchableOpacity>
  );
}

function LockedCard({ item, index, onPress }) {
  const tilt = TILT_CYCLE[index % TILT_CYCLE.length];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, styles.cardLocked, { transform: [{ rotate: `${tilt}deg` }] }]}
    >
      <WashiTape color="lavender" width="60%" height={10} rotation={-3} opacity={0.7} style={{ top: -4, left: '20%' }} />
      <Text style={styles.lockedEmojiOverlay}>🔒</Text>
      <Text style={[styles.cardEmoji, { opacity: 0.5 }]}>{item.emoji}</Text>
      <Text style={[styles.cardName, styles.cardNameLocked]} numberOfLines={1}>{item.name.toLowerCase()}</Text>
      <Text style={styles.cardHint} numberOfLines={2}>{item.hint}</Text>
    </TouchableOpacity>
  );
}

function HiddenSilhouetteCard({ index, onPress }) {
  const tilt = TILT_CYCLE[index % TILT_CYCLE.length];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, styles.cardHidden, { transform: [{ rotate: `${tilt}deg` }] }]}
    >
      <WashiTape color="lavender" width="60%" height={10} rotation={-3} opacity={0.5} style={{ top: -4, left: '20%' }} />
      <Text style={styles.silhouetteMark}>?</Text>
      <Text style={[styles.cardName, styles.cardNameLocked]} numberOfLines={1}>—</Text>
      <Text style={styles.cardHint}>keep limin'</Text>
    </TouchableOpacity>
  );
}

function formatShortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },
  title: { fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 34, textTransform: 'lowercase' },

  // Stats card
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: 16, paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 22,
    position: 'relative',
    transform: [{ rotate: '-0.5deg' }],
  },
  statsText: { fontSize: 14, fontWeight: '500', color: COLORS.dark, letterSpacing: -0.2 },

  // Section headers
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, position: 'relative', height: 32 },
  sectionHeader: { fontSize: 22, color: COLORS.dark, letterSpacing: -0.3, lineHeight: 26 },
  sectionSub: { fontSize: 12, color: '#888', marginBottom: 10, marginTop: 2 },
  collapseChev: { fontSize: 22, color: '#888', fontWeight: '600', marginLeft: 'auto', width: 24, textAlign: 'center' },

  // Empty per-section block
  emptyBlock: {
    backgroundColor: PASTELS.lavenderBg,
    borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 18,
    marginTop: 8,
    alignItems: 'center',
  },
  emptyText: { fontSize: 12, color: '#888', fontStyle: 'italic', textTransform: 'lowercase', textAlign: 'center' },

  // Grid (3 columns)
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, marginTop: 8 },

  // Earned card
  card: {
    width: '31%',
    minHeight: 130,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingTop: 14, paddingBottom: 10, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'flex-start',
    position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  cardEmoji: { fontSize: 48, lineHeight: 54, marginBottom: 6 },
  cardName:  { fontSize: 11, fontWeight: '500', color: COLORS.dark, letterSpacing: -0.1, textAlign: 'center', marginBottom: 2 },
  cardDate:  { fontSize: 9, color: '#888', fontStyle: 'italic', textAlign: 'center' },

  // Locked card
  cardLocked: { backgroundColor: '#FAF6EB' },
  cardNameLocked: { color: '#BBB' },
  cardHint: { fontSize: 9, color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 2 },
  lockedEmojiOverlay: {
    position: 'absolute', top: 6, right: 6,
    fontSize: 12,
  },

  // Hidden silhouette
  cardHidden: { backgroundColor: '#F4EFE0' },
  silhouetteMark: {
    fontSize: 44, color: '#CCC', fontWeight: '700',
    lineHeight: 54, marginBottom: 6,
  },

  // Bottom decorative
  bottomAccents: { height: 50, marginTop: 18, position: 'relative' },
});
