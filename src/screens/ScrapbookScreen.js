import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { ACTIVITIES, COLORS, RATINGS, TIER, getTier } from '../lib/constants';
import { getMemories, addComment } from '../lib/supabase';

// ─── Design system primitives ─────────────────────────────
import Polaroid from '../components/Polaroid';
import { Star, Heart, Sparkle, Underline } from '../components/Doodles';
import { HANDWRITTEN_500 } from '../lib/theme';

// Cycle washi colors per memory card position.
const MEMORY_WASHI = ['coral', 'blue', 'amber', 'lavender', 'pink'];

// Filter tabs — visual only this turn ("all" is the only one wired).
// TODO: extend the filter logic so the other tabs narrow the feed
// once memory rows carry the necessary metadata (trip, etc.).
const TABS = [
  { id: 'all',        label: 'all' },
  { id: 'adventures', label: 'adventures' },
  { id: 'trips',      label: 'trips' },
  { id: 'limes',      label: 'limes' },
  { id: 'squad',      label: 'squad' },
];

export default function ScrapbookScreen({ navigation }) {
  // ─── PRESERVED: all hooks, state, fetching, handlers ───
  const { profile } = useContext(AppContext);
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#FFFFFF';

  const [memories, setMemories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [commentText, setCommentText] = useState({});
  const [activeTab, setActiveTab] = useState('all');

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const load = async () => {
    try {
      const m = await getMemories();
      setMemories(m);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const submitComment = async (memoryId) => {
    const text = (commentText[memoryId] || '').trim();
    if (!text) return;
    try {
      await addComment({ memoryId, profileId: profile.id, text });
      setCommentText(c => ({ ...c, [memoryId]: '' }));
      await load();
    } catch (e) { console.error(e); }
  };

  const ratingOf = (label) => RATINGS.find(r => r.label === label) || RATINGS[0];

  // Group memories into [{ type: 'header', label }, { type: 'memory', memory }]
  // for rendering. Memories already come back DESC by created_at from
  // getMemories(). Filter (placeholder) is applied here too.
  const grouped = useMemo(() => {
    // Only 'all' is wired today — other tabs short-circuit to the
    // same list. See TABS comment above.
    const filtered = memories;

    const out = [];
    let lastKey = null;
    filtered.forEach(m => {
      const d = new Date(m.created_at);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== lastKey) {
        out.push({
          type: 'header',
          key,
          label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase(),
        });
        lastKey = key;
      }
      out.push({ type: 'memory', memory: m, key: m.id });
    });
    return out;
  }, [memories, activeTab]);

  // Priority pill picker — one badge per memory card.
  //   1. Hidden badge (time-of-day heuristic for Night Owl / Sunrise Crew)
  //   2. (special event — no data model yet, skip)
  //   3+4. Adventure/Regular badge → activity badge emoji + activity name
  //   5. Tier fallback → tier emoji + tier name (uses memory author's tier
  //      proxy via current viewer's badge count — best-effort fallback)
  const pickBadge = (m, activity) => {
    const hour = m.created_at ? new Date(m.created_at).getHours() : 12;
    if (hour >= 0 && hour < 4) return { emoji: '🦉', name: 'Night Owl' };
    if (hour >= 5 && hour < 7) return { emoji: '🌅', name: 'Sunrise Crew' };
    if (activity)              return { emoji: activity.badge || '🏅', name: activity.name };
    const t = getTier(0);
    return { emoji: t.emoji, name: t.name };
  };

  const formatDateLine = (m, activity) => {
    if (!m.created_at) return activity?.location || '';
    const d = new Date(m.created_at);
    const date = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return activity?.location ? `${date} · ${activity.location}` : date;
  };

  const isEmpty = memories.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, HAND_500 && { fontFamily: HAND_500 }]}>scrapbook</Text>
              <Heart size={18} color={COLORS.coral} opacity={0.55} style={{ left: 10, top: 8 }} />
            </View>
            <Text style={styles.subtitle}>your memories, your story</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddMemory')}
            style={styles.addBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.addBtnText}>+ add</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Filter tabs ─── */}
        <View style={styles.tabRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 22, gap: 8 }}
          >
            {TABS.map(t => {
              const on = activeTab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  style={[styles.tab, on && styles.tabActive]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 22, paddingTop: 14, paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dark} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Page-edge decorative accents */}
          <Sparkle size={14} color={COLORS.amber}     opacity={0.55} style={{ right: -4, top: 8 }} />
          <Star    size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: -8, top: 60 }} />

          {isEmpty ? (
            <EmptyState
              hand500={HAND_500}
              onAdd={() => navigation.navigate('AddMemory')}
            />
          ) : (
            grouped.map(entry => {
              if (entry.type === 'header') {
                return (
                  <Text key={entry.key} style={styles.monthHeader}>{entry.label}</Text>
                );
              }
              const m = entry.memory;
              const a = ACTIVITIES.find(x => x.id === m.activity_id);
              const idx = grouped.filter(e => e.type === 'memory').findIndex(e => e.key === m.id);
              const washi = MEMORY_WASHI[idx % MEMORY_WASHI.length];
              const tilt = idx % 2 === 0 ? -2 : 2;
              const badge = pickBadge(m, a);
              const subtitle = formatDateLine(m, a);
              return (
                <View key={m.id} style={styles.memoryWrap}>
                  <Polaroid
                    photoUri={m.photo_url || null}
                    emoji={a?.emoji || '📸'}
                    title={a?.name || (m.caption || 'A lime')}
                    subtitle={subtitle}
                    washiColor={washi}
                    tiltDeg={tilt}
                    pill={`${badge.emoji} ${badge.name}`}
                    pillVariant="badge"
                    onPress={() => { /* memory detail screen: future */ }}
                  />
                </View>
              );
            })
          )}

          {/* Bottom-of-page accents */}
          <View pointerEvents="none" style={styles.bottomAccents}>
            <Heart   size={12} color={COLORS.coral}     opacity={0.45} style={{ left: 22, top: 0 }} />
            <Sparkle size={14} color={COLORS.amber}     opacity={0.55} style={{ right: 30, top: 10 }} />
            <Star    size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: '50%', top: 22 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Empty state ─────────────────────────────────────────
function EmptyState({ hand500, onAdd }) {
  return (
    <View style={emptyStyles.wrap}>
      <Star    size={16} color={COLORS.amber}     opacity={0.55} style={{ left: 20,  top: 0 }} />
      <Sparkle size={14} color={COLORS.palmGreen} opacity={0.6}  style={{ right: 28, top: 16 }} />
      <Heart   size={14} color={COLORS.coral}     opacity={0.5}  style={{ right: 60, bottom: 60 }} />
      <Sparkle size={12} color={COLORS.coral}     opacity={0.65} style={{ left: 36,  bottom: 90 }} />

      <View style={emptyStyles.polaroidSlot}>
        <Polaroid
          emoji="📸"
          title="no memories yet"
          subtitle="go lime something then drop a photo 🍋"
          washiColor="coral"
          tiltDeg={-2}
          onPress={onAdd}
        />
      </View>

      <TouchableOpacity onPress={onAdd} style={emptyStyles.addLinkWrap} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={[emptyStyles.addLink, hand500 && { fontFamily: hand500 }]}>add the first one →</Text>
        <Underline size={170} color={COLORS.coral} opacity={1} style={{ top: 26, left: '50%', marginLeft: -85 }} />
      </TouchableOpacity>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 20, paddingBottom: 30, position: 'relative' },
  polaroidSlot: { width: 240, marginBottom: 32 },
  addLinkWrap: { position: 'relative', paddingVertical: 4, paddingHorizontal: 12, alignItems: 'center' },
  addLink: { fontSize: 22, color: COLORS.dark, lineHeight: 28 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  titleRow: { position: 'relative', flexDirection: 'row', alignItems: 'center', height: 44 },
  title: { fontSize: 32, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 40 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  addBtn: {
    backgroundColor: COLORS.coral,
    paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Filter tabs
  tabRowWrap: { paddingBottom: 6 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.cardBorder,
    minHeight: 36, alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: COLORS.coral, borderColor: COLORS.coral },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.dark, letterSpacing: 0.1 },
  tabTextActive: { color: '#fff' },

  // Month headers between memory groups
  monthHeader: {
    fontSize: 11, fontWeight: '700', color: '#888',
    letterSpacing: 2,
    marginTop: 10, marginBottom: 14,
  },

  // Memory polaroid wrap
  memoryWrap: { marginBottom: 22 },

  // Scattered bottom accents
  bottomAccents: { height: 50, marginTop: 12, position: 'relative' },
});
