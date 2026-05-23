import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Animated, Easing,
  StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFonts, Caveat_500Medium, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import {
  ACTIVITIES, COLORS, TIER, RATINGS, HOME_TAGLINES, TIERS, getTier,
} from '../lib/constants';
import { getMemories, getBadges, getAllMembers } from '../lib/supabase';
import AvailabilityModal, { isMondayToday } from './AvailabilityModal';
import SettingsModal from './SettingsModal';
import EditProfileModal from './EditProfileModal';
import TiersScreen from './TiersScreen';
import MessagesScreen from './MessagesScreen';
import { getUnreadInviteCount } from '../lib/supabase';

// ─── Design system primitives ─────────────────────────────
import Polaroid from '../components/Polaroid';
import WashiTape from '../components/WashiTape';
import { Star, Heart, Sparkle, CurvedArrow, Underline } from '../components/Doodles';
import { HANDWRITTEN_500 } from '../lib/theme';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Safe TIER accessor — never crash on undefined / unknown tier values.
const TIER_FALLBACK = { bg: COLORS.cream, label: '', text: COLORS.dark, dot: COLORS.muted };
const tierOf = (key) => (key && TIER[key]) || TIER_FALLBACK;

// Vibe filter pool for the spin.
const VIBES = [
  { id: 'chill', label: 'Chill', emoji: '🌿', bg: '#DDF1E2', fg: COLORS.palmGreen },
  { id: 'bold',  label: 'Bold',  emoji: '🔥', bg: '#FBE7C6', fg: COLORS.deepAmber },
  { id: 'wild',  label: 'Wild',  emoji: '😈', bg: '#E4DEF6', fg: '#5B3FA3' },
];

// Polaroid cycling — paired arrays keep the original look untouched.
// Index modulo 5 picks washi color, emoji-box bg, and tilt.
const POLAROID_WASHI    = ['pink',     'blue',    'coral',   'lavender', 'amber'];
const POLAROID_EMOJI_BG = ['#FDEED7',  '#D6F0F4', '#FCDCD0', '#E4DEF6',  '#D6F0DD'];
const POLAROID_TILT     = [-2,         2,         -1.5,      2,          -2.5];

export default function HomeScreen() {
  // ─── PRESERVED: all hooks, state, effects, AppContext, navigation ───
  const { profile, myBadges, setMyBadges } = useContext(AppContext);
  const navigation = useNavigation();

  // Handwritten font — falls back to system if not yet loaded.
  const [fontsLoaded] = useFonts({ Caveat_500Medium, Caveat_700Bold });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const [memories, setMemories] = useState([]);
  const [members, setMembers]   = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const mondayNudge = isMondayToday();

  const refreshUnread = async () => {
    try { setUnreadCount(await getUnreadInviteCount(profile.id)); }
    catch { /* table may not exist yet — silent */ }
  };
  useEffect(() => { refreshUnread(); }, []);

  const sessionTagline = useMemo(
    () => HOME_TAGLINES[Math.floor(Math.random() * HOME_TAGLINES.length)],
    []
  );
  const dayName = DAYS[new Date().getDay()];

  const tier = getTier(myBadges.length);
  const total = ACTIVITIES.length;

  // ─── Spin / vibe state ───
  const [vibe, setVibe] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [spinPick, setSpinPick] = useState(null);
  const [previewPick, setPreviewPick] = useState(null);
  const spinRotation = useRef(new Animated.Value(0)).current;

  const eligible = useMemo(
    () => (vibe ? ACTIVITIES.filter(a => a.tier === vibe) : ACTIVITIES),
    [vibe]
  );

  const load = async () => {
    try {
      const [mems, badges, allMembers] = await Promise.all([
        getMemories(),
        getBadges(profile.id),
        getAllMembers().catch(() => []),
      ]);
      setMemories(mems);
      setMyBadges(badges);
      setMembers(allMembers);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const startSpin = () => {
    if (!eligible.length || spinning) return;
    setPreviewPick(eligible[Math.floor(Math.random() * eligible.length)]);
    setSpinning(true);
    setSpinPick(null);

    spinRotation.setValue(0);
    Animated.loop(
      Animated.timing(spinRotation, {
        toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true,
      })
    ).start();

    let count = 0;
    const interval = setInterval(() => {
      setPreviewPick(eligible[Math.floor(Math.random() * eligible.length)]);
      count += 1;
      if (count > 14) {
        clearInterval(interval);
        const final = eligible[Math.floor(Math.random() * eligible.length)];
        setPreviewPick(final);
        setSpinPick(final);
        spinRotation.stopAnimation(() => spinRotation.setValue(0));
        setSpinning(false);
      }
    }, 90);
  };

  const openDetail = (activity) => {
    navigation.getParent()?.navigate('ActivityDetailModal', { activity, isModal: true });
  };

  const limeFind = () => {
    const pick = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
    openDetail(pick);
  };

  const ratingOf = (label) => RATINGS.find(r => r.label === label) || RATINGS[0];

  const recentMemories = memories.slice(0, 4);

  // Count of memories posted by the current user — drives the
  // "Memories" stat under the Next Unlock card.
  const myMemoryCount = useMemo(
    () => memories.filter(m => m.profile_id === profile.id).length,
    [memories, profile.id]
  );

  // Leaderboard is computed but no longer rendered in the refreshed
  // layout — kept memoed in case other call sites consume it.
  const leaderboard = useMemo(() => {
    return [...members]
      .map(m => ({ ...m, count: m.badges?.[0]?.count || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [members]);

  const nextTier = tier.next;

  const spinSpin = spinRotation.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '360deg'],
  });

  // ─── The Lineup data — 5 polaroids + "add a dream" tile ─────
  const lineup = useMemo(() => {
    const unearned = ACTIVITIES.filter(a => !myBadges.includes(a.id));
    const picks = [];
    if (spinPick && !myBadges.includes(spinPick.id)) {
      picks.push({ activity: spinPick, pill: 'from spin' });
    }
    let i = 0;
    while (picks.length < 5 && i < unearned.length) {
      const a = unearned[i++];
      if (picks.some(p => p.activity.id === a.id)) continue;
      picks.push({
        activity: a,
        pill: picks.length === 0 ? 'up next' : picks.length === 1 ? 'next up' : null,
      });
    }
    return picks;
  }, [myBadges, spinPick]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dark} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Greeting + bell ─── */}
        {/* Avatar + name is one tappable target → Profile screen.
            Profile route may not be registered yet; React Navigation
            will warn but the app keeps running. */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              try { navigation.navigate('Profile'); }
              catch { console.log('Profile tap'); }
            }}
            activeOpacity={0.85}
            style={styles.identityRow}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <ProfileAvatar profile={profile} size={36} ringColor={COLORS.coral} ringWidth={2} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={[styles.greeting, HAND_500 && { fontFamily: HAND_500 }]} numberOfLines={1}>
                Hey {profile.name} ✨
              </Text>
              <Text style={styles.subline}>{dayName} · {sessionTagline} 🌴</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMessagesOpen(true)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.iconText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadDot}>
                <Text style={styles.unreadDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Randomizer card ─── */}
        <View style={styles.spinCard}>
          <WashiTape color="amber" width="28%" height={18} rotation={-3} style={{ top: -6, left: '36%' }} />

          <View style={styles.spinHeadlineWrap}>
            <Text style={[styles.spinHeadline, HAND_500 && { fontFamily: HAND_500 }]}>where we limin' today?</Text>
            <Underline size={64} style={{ right: 28, top: 30 }} />
            <Sparkle size={18} color={COLORS.coral} opacity={0.9} style={{ right: 4, top: 0 }} />
          </View>

          <View style={styles.vibeRow}>
            {VIBES.map(v => {
              const on = vibe === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setVibe(on ? null : v.id)}
                  style={[
                    styles.vibeBtn,
                    { backgroundColor: v.bg, borderColor: on ? v.fg : 'rgba(255,255,255,0.7)' },
                  ]}
                >
                  <Text style={styles.vibeEmoji}>{v.emoji}</Text>
                  <Text style={[styles.vibeLabel, { color: v.fg }]}>{v.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.spinBtnRow}>
            <View style={{ width: 60 }} />
            <TouchableOpacity onPress={startSpin} disabled={spinning} activeOpacity={0.85} style={styles.spinBtnWrap}>
              <Animated.View style={[styles.spinBtn, { transform: [{ rotate: spinSpin }] }]}>
                <Text style={styles.spinSliceEmoji}>🍋</Text>
              </Animated.View>
            </TouchableOpacity>
            <View style={styles.spinHint}>
              <CurvedArrow style={{ left: -10, top: -4 }} />
              <Text style={[styles.spinHintText, HAND_500 && { fontFamily: HAND_500 }]}>spin the{'\n'}lime</Text>
            </View>
          </View>

          <Text style={styles.spinPool}>
            {vibe
              ? `${VIBES.find(v => v.id === vibe).emoji} ${VIBES.find(v => v.id === vibe).label} pool only`
              : 'All 59 in the pool 🍋'}
          </Text>

          {(() => {
            const shown = previewPick || spinPick;
            if (!(spinning || spinPick) || !shown) return null;
            const t = tierOf(shown.tier);
            return (
              <View style={styles.spinResult}>
                <Text style={styles.spinResultEmoji}>{shown.emoji}</Text>
                <Text style={styles.spinResultName}>{shown.name}</Text>
                <View style={[styles.spinResultTier, { backgroundColor: t.bg }]}>
                  <Text style={[styles.spinResultTierText, { color: t.text }]}>{t.label} tier</Text>
                </View>
                {spinPick && !spinning && (
                  <TouchableOpacity onPress={() => openDetail(spinPick)} style={styles.spinResultCta}>
                    <Text style={styles.spinResultCtaText}>Let's do it →</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
        </View>

        {/* ─── THE LINEUP ─── */}
        <View style={styles.lineupCard}>
          <Star size={14} style={{ left: 2, top: 220 }} />
          <Heart size={14} color="#E83E8C" opacity={0.4} style={{ right: 12, top: 220 }} />
          <Sparkle size={12} color="#9B6BD3" opacity={0.5} style={{ right: 4, bottom: 16 }} />

          <View style={styles.lineupHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineupEyebrow}>THE LINEUP 🍋</Text>
              <Text style={[styles.lineupTitle, HAND_500 && { fontFamily: HAND_500 }]}>things i'm chasing</Text>
              <Text style={styles.lineupSub}>{myBadges.length} of {total} lived · keep going 🌿</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Activities')} style={styles.addLineupBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.addLineupText}>+ add</Text>
              <Underline size={32} style={{ right: 0, top: 18 }} />
            </TouchableOpacity>
          </View>

          {/* 2-column polaroid grid */}
          <View style={styles.grid}>
            {lineup.map((p, i) => (
              <View key={p.activity.id} style={styles.gridCell}>
                <Polaroid
                  emoji={p.activity.emoji}
                  title={p.activity.name}
                  subtitle={
                    p.pill === 'from spin'
                      ? `From spin · Earns ${p.activity.badge}`
                      : `Earns: ${p.activity.badge}`
                  }
                  washiColor={POLAROID_WASHI[i % POLAROID_WASHI.length]}
                  emojiBg={POLAROID_EMOJI_BG[i % POLAROID_EMOJI_BG.length]}
                  tiltDeg={POLAROID_TILT[i % POLAROID_TILT.length]}
                  pill={p.pill}
                  onPress={() => openDetail(p.activity)}
                />
              </View>
            ))}
            {/* Add a dream tile */}
            <View style={styles.gridCell}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Activities')}
                activeOpacity={0.85}
                style={[styles.polaroidEmpty, { transform: [{ rotate: '1.5deg' }] }]}
              >
                <Text style={styles.addPlus}>+</Text>
                <Text style={styles.addDreamText}>add a dream</Text>
                <Underline size={70} color="#9B6BD3" style={{ bottom: 22, alignSelf: 'center', left: '50%', marginLeft: -35 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── Next Unlock ─── */}
        {nextTier ? (
          <View style={styles.unlockCard}>
            <View style={styles.unlockTopRow}>
              <View style={styles.lockedBadge}>
                <Text style={{ fontSize: 28, opacity: 0.5 }}>{nextTier.emoji}</Text>
                <View style={styles.lockBadge}><Text style={{ fontSize: 10 }}>🔒</Text></View>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.unlockEyebrow}>NEXT UNLOCK</Text>
                <Text style={styles.unlockName}>{nextTier.name} {nextTier.emoji}</Text>
                <Text style={styles.unlockSub}>{tier.badgesToNext} more adventures to go</Text>
              </View>
              <Text style={styles.unlockPalm}>🌴</Text>
              <Sparkle size={14} color={COLORS.coral} opacity={0.9} style={{ right: 90, top: -2 }} />
              <TouchableOpacity onPress={() => setTiersOpen(true)} style={styles.unlockCta}>
                <Text style={styles.unlockCtaText}>See all tiers</Text>
              </TouchableOpacity>
            </View>

            {/* Inline stats — pulled from user data */}
            <View style={styles.unlockStatsRow}>
              <Text style={styles.unlockStat}>
                <Text style={styles.unlockStatNum}>{myBadges.length}</Text> Adventures
              </Text>
              <Text style={styles.unlockStatDot}> · </Text>
              <Text style={styles.unlockStat}>
                <Text style={styles.unlockStatNum}>{myMemoryCount}</Text> Memories
              </Text>
              <Text style={styles.unlockStatDot}> · </Text>
              <Text style={styles.unlockStat}>
                <Text style={styles.unlockStatNum}>{myBadges.length}</Text> Badges
              </Text>
            </View>
          </View>
        ) : null}

        {/* ─── Squad Memories ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>📸 Squad Memories</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Scrapbook')}>
              <Text style={styles.linkText}>See all</Text>
            </TouchableOpacity>
          </View>

          {recentMemories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📷</Text>
              <Text style={styles.emptyText}>No memories yet — bus' a lime</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 22 }}>
              {recentMemories.map((m, i) => {
                const a = ACTIVITIES.find(x => x.id === m.activity_id);
                return (
                  <View key={m.id} style={styles.memThumb}>
                    {m.photo_url ? (
                      <Image source={{ uri: m.photo_url }} style={styles.memThumbImg} />
                    ) : (
                      <View style={[styles.memThumbImg, { backgroundColor: tierOf(a?.tier).bg, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 32 }}>{a?.emoji || '📸'}</Text>
                      </View>
                    )}
                    {i === 0 && <Star size={14} color="#fff" opacity={0.9} style={{ left: 8, top: 8 }} />}
                    {i === 1 && <Heart size={14} color="#fff" opacity={0.9} style={{ right: 10, bottom: 10 }} />}
                    {i === 2 && <Text style={styles.thumbCrown}>👑</Text>}
                    {i === 3 && <Sparkle size={14} color="#fff" opacity={0.9} style={{ left: 10, top: 10 }} />}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* ─── Modals (preserved) ─── */}
      <AvailabilityModal visible={availOpen} onClose={() => setAvailOpen(false)} />
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenAvailability={() => { setSettingsOpen(false); setAvailOpen(true); }}
      />
      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} initialFocus="profile" />
      <TiersScreen visible={tiersOpen} onClose={() => setTiersOpen(false)} />
      <MessagesScreen
        visible={messagesOpen}
        onClose={() => { setMessagesOpen(false); refreshUnread(); }}
      />
    </SafeAreaView>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: 22, paddingBottom: 64 },

  // Top bar — avatar + name (tappable) on the left, bell on the right
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 34 },
  subline: { fontSize: 13, color: '#888', marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.cardBorder, position: 'relative' },
  iconText: { fontSize: 18 },
  unreadDot: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#E5484D',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: COLORS.cream,
  },
  unreadDotText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Randomizer card
  spinCard: {
    backgroundColor: '#FDE3DA', borderRadius: 28, padding: 24, marginBottom: 22,
    overflow: 'hidden', alignItems: 'center', position: 'relative',
  },
  spinHeadlineWrap: { width: '100%', alignItems: 'center', position: 'relative', marginTop: 8, marginBottom: 18 },
  spinHeadline: { fontSize: 30, color: COLORS.dark, textAlign: 'center', lineHeight: 36 },

  vibeRow: { flexDirection: 'row', gap: 10, marginBottom: 22, alignSelf: 'stretch' },
  vibeBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5,
  },
  vibeEmoji: { fontSize: 16 },
  vibeLabel: { fontSize: 14, fontWeight: '600' },

  spinBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  spinBtnWrap: { alignItems: 'center' },
  spinBtn: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#A5D854',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 5, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  spinSliceEmoji: { fontSize: 50 },
  spinHint: { width: 60, paddingLeft: 6, justifyContent: 'center', position: 'relative' },
  spinHintText: { fontSize: 18, color: COLORS.dark, lineHeight: 22, marginTop: 16, marginLeft: 8 },

  spinPool: { marginTop: 10, fontSize: 13, color: '#6B6B6B' },

  spinResult: {
    marginTop: 16, alignSelf: 'stretch',
    backgroundColor: '#fff', borderRadius: 20, padding: 18, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  spinResultEmoji: { fontSize: 46, marginBottom: 4 },
  spinResultName: { fontSize: 18, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.3, marginBottom: 8, textAlign: 'center' },
  spinResultTier: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, marginBottom: 12 },
  spinResultTierText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  spinResultCta: { backgroundColor: COLORS.coral, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  spinResultCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // The Lineup card
  lineupCard: {
    backgroundColor: '#FAF1DD', borderRadius: 28, padding: 22, marginBottom: 22,
    borderWidth: 1, borderColor: '#EEDFB3', position: 'relative', overflow: 'hidden',
  },
  lineupHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  lineupEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: COLORS.deepCoral },
  lineupTitle: { fontSize: 26, color: COLORS.dark, marginTop: 2, letterSpacing: -0.4, lineHeight: 32 },
  lineupSub: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 4 },
  addLineupBtn: { paddingTop: 6, paddingRight: 0, position: 'relative' },
  addLineupText: { color: COLORS.coral, fontSize: 16, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 },
  gridCell: { width: '47%' },

  polaroidEmpty: {
    minHeight: 184,
    borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  addPlus: { fontSize: 36, color: '#888', marginBottom: 6 },
  addDreamText: { fontSize: 13, color: '#666', fontWeight: '600' },

  // Next Unlock — light coral-bordered card
  // Outer is a column so we can stack the existing horizontal row
  // on top of the new inline stats row.
  unlockCard: {
    backgroundColor: COLORS.cream, borderRadius: 24, padding: 16, marginBottom: 22,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    borderLeftWidth: 4, borderLeftColor: COLORS.coral,
    position: 'relative', overflow: 'hidden',
  },
  unlockTopRow: { flexDirection: 'row', alignItems: 'center' },

  unlockStatsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline',
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  unlockStat: { fontSize: 11, color: '#888' },
  unlockStatNum: { fontSize: 11, fontWeight: '700', color: COLORS.dark },
  unlockStatDot: { fontSize: 11, color: '#ccc' },
  lockedBadge: {
    width: 54, height: 54, borderRadius: 14, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.cardBorder, borderStyle: 'dashed',
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.coral,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  unlockEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: COLORS.deepCoral },
  unlockName: { fontSize: 16, fontWeight: '700', color: COLORS.dark, marginTop: 4, letterSpacing: -0.2 },
  unlockSub: { fontSize: 12, color: '#888', marginTop: 2 },
  unlockPalm: { position: 'absolute', right: 110, top: 8, fontSize: 26, transform: [{ rotate: '12deg' }] },
  unlockCta: { backgroundColor: COLORS.coral, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11 },
  unlockCtaText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Sections
  section: { marginBottom: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  linkText: { fontSize: 13, color: COLORS.coral, fontWeight: '700' },

  // Memory thumbnails
  memThumb: { width: 116, height: 116, borderRadius: 16, overflow: 'hidden', position: 'relative', backgroundColor: '#F0EAD8' },
  memThumbImg: { width: '100%', height: '100%' },
  thumbCrown: { position: 'absolute', top: 6, left: 8, fontSize: 16 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyText: { color: '#999', fontSize: 13 },
});
