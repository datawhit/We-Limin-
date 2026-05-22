import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Animated, Easing,
  StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFonts, Caveat_500Medium, Caveat_700Bold } from '@expo-google-fonts/caveat';
import Svg, { Path } from 'react-native-svg';
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

// Washi-tape color cycle for the polaroids in The Lineup.
const TAPE_COLORS = ['#F4C3D2', '#B6D4E8', '#F2C8A0', '#D7CFEC', '#F6D78D'];
const POLAROID_TILTS = ['-2deg', '2deg', '-1.5deg', '2deg', '-2.5deg'];
const POLAROID_EMOJI_BGS = ['#FDEED7', '#D6F0F4', '#FCDCD0', '#E4DEF6', '#D6F0DD'];

// ─── Decorative SVG doodles ──────────────────────────────
function StarDoodle({ size = 16, color = COLORS.coral, opacity = 0.35, style }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path
          d="M10 1 L11.8 7.4 L18.5 8 L13.4 12.2 L15 19 L10 15.2 L5 19 L6.6 12.2 L1.5 8 L8.2 7.4 Z"
          fill={color} fillOpacity={opacity}
        />
      </Svg>
    </View>
  );
}

function HeartDoodle({ size = 16, color = COLORS.coral, opacity = 0.3, style }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Path
          d="M10 17 C 4 12 1 9 1 6 C 1 3.5 3 2 5 2 C 7 2 9 3.5 10 5 C 11 3.5 13 2 15 2 C 17 2 19 3.5 19 6 C 19 9 16 12 10 17 Z"
          fill={color} fillOpacity={opacity}
        />
      </Svg>
    </View>
  );
}

function SparkDoodle({ size = 14, color = COLORS.coral, opacity = 0.4, style }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 14 14">
        <Path d="M7 0 V14 M0 7 H14 M2 2 L12 12 M12 2 L2 12" stroke={color} strokeWidth={1.5} strokeLinecap="round" opacity={opacity} />
      </Svg>
    </View>
  );
}

// Hand-drawn coral underline that sits under a headline word.
function UnderlineDoodle({ width = 60, color = COLORS.coral, style }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <Svg width={width} height={10} viewBox="0 0 60 10">
        <Path
          d="M1 6 Q 12 1, 22 5 T 45 5 T 59 6"
          stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none"
        />
      </Svg>
    </View>
  );
}

// Curly "spin the lime ↩" arrow doodle.
function SpinArrowDoodle({ style }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <Svg width={50} height={28} viewBox="0 0 50 28">
        <Path
          d="M2 4 Q 22 -2, 36 8 Q 44 14, 30 22"
          stroke={COLORS.dark} strokeWidth={1.4} strokeLinecap="round" fill="none"
        />
        <Path
          d="M30 22 L34 20 M30 22 L32 26"
          stroke={COLORS.dark} strokeWidth={1.4} strokeLinecap="round" fill="none"
        />
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  // ─── PRESERVED: all hooks, state, effects, AppContext, navigation ───
  const { profile, myBadges, setMyBadges } = useContext(AppContext);
  const navigation = useNavigation();

  // Handwritten font — falls back to system if not yet loaded.
  const [fontsLoaded] = useFonts({ Caveat_500Medium, Caveat_700Bold });
  const HAND_500 = fontsLoaded ? 'Caveat_500Medium' : undefined;
  const HAND_700 = fontsLoaded ? 'Caveat_700Bold' : undefined;

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
  // Pulls from unearned ACTIVITIES so it always has content. If the
  // user just spun, the spin result takes one slot with "from spin".
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
        {/* ─── Greeting + icons ─── */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hey {profile.name} ✨</Text>
            <Text style={styles.subline}>{dayName} · {sessionTagline} 🌴</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => setMessagesOpen(true)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.iconText}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadDot}>
                  <Text style={styles.unreadDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsOpen(true)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.iconText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Randomizer card ─── */}
        <View style={styles.spinCard}>
          {/* Washi tape strip at top center */}
          <View style={styles.washiTopCenter} />

          <View style={styles.spinHeadlineWrap}>
            <Text style={[styles.spinHeadline, HAND_500 && { fontFamily: HAND_500 }]}>where we limin' today?</Text>
            <UnderlineDoodle width={64} style={{ right: 28, top: 30 }} />
            <SparkDoodle size={18} color={COLORS.coral} opacity={0.9} style={{ right: 4, top: 0 }} />
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
              <SpinArrowDoodle style={{ left: -10, top: -4 }} />
              <Text style={[styles.spinHintText, HAND_500 && { fontFamily: HAND_500 }]}>spin the{'\n'}lime</Text>
            </View>
          </View>

          <Text style={styles.spinPool}>
            {vibe
              ? `${VIBES.find(v => v.id === vibe).emoji} ${VIBES.find(v => v.id === vibe).label} pool only`
              : 'All 59 in the pool 🍋'}
          </Text>

          {/* Subtle "ask the lime" inline */}
          <TouchableOpacity onPress={limeFind} activeOpacity={0.85} style={styles.askLineBtn}>
            <Text style={styles.askLineText}>✨  or, ask the lime to pick →</Text>
          </TouchableOpacity>

          {/* Vibe result after spin */}
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
          {/* Decorative doodles scattered */}
          <StarDoodle size={14} style={{ left: 2, top: 220 }} />
          <HeartDoodle size={14} color="#E83E8C" opacity={0.4} style={{ right: 12, top: 220 }} />
          <SparkDoodle size={12} color="#9B6BD3" opacity={0.5} style={{ right: 4, bottom: 16 }} />

          <View style={styles.lineupHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineupEyebrow}>THE LINEUP 🍋</Text>
              <Text style={[styles.lineupTitle, HAND_500 && { fontFamily: HAND_500 }]}>things i'm chasing</Text>
              <Text style={styles.lineupSub}>{myBadges.length} of {total} lived · keep going 🌿</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Activities')} style={styles.addLineupBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.addLineupText}>+ add</Text>
              <UnderlineDoodle width={32} style={{ right: 0, top: 18 }} />
            </TouchableOpacity>
          </View>

          {/* 2-column polaroid grid */}
          <View style={styles.grid}>
            {lineup.map((p, i) => (
              <View key={p.activity.id} style={styles.gridCell}>
                <Polaroid
                  item={p}
                  index={i}
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
                <UnderlineDoodle width={70} color="#9B6BD3" style={{ bottom: 22, alignSelf: 'center', left: '50%', marginLeft: -35 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── Next Unlock ─── */}
        {nextTier ? (
          <View style={styles.unlockCard}>
            <View style={styles.lockedBadge}>
              <Text style={{ fontSize: 28, opacity: 0.5 }}>{nextTier.emoji}</Text>
              <View style={styles.lockBadge}><Text style={{ fontSize: 10 }}>🔒</Text></View>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.unlockEyebrow}>NEXT UNLOCK</Text>
              <Text style={styles.unlockName}>{nextTier.name} {nextTier.emoji}</Text>
              <Text style={styles.unlockSub}>{tier.badgesToNext} more adventures to go</Text>
            </View>
            {/* Palm sticker float */}
            <Text style={styles.unlockPalm}>🌴</Text>
            <SparkDoodle size={14} color={COLORS.coral} opacity={0.9} style={{ right: 90, top: -2 }} />
            <TouchableOpacity onPress={() => setTiersOpen(true)} style={styles.unlockCta}>
              <Text style={styles.unlockCtaText}>See all tiers</Text>
            </TouchableOpacity>
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
                    {/* Per-thumbnail decorative doodle */}
                    {i === 0 && <StarDoodle size={14} color="#fff" opacity={0.9} style={{ left: 8, top: 8 }} />}
                    {i === 1 && <HeartDoodle size={14} color="#fff" opacity={0.9} style={{ right: 10, bottom: 10 }} />}
                    {i === 2 && <Text style={styles.thumbCrown}>👑</Text>}
                    {i === 3 && <SparkDoodle size={14} color="#fff" opacity={0.9} style={{ left: 10, top: 10 }} />}
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

// ─── Polaroid card (inline) ──────────────────────────────
function Polaroid({ item, index, onPress }) {
  const { activity, pill } = item;
  const tilt = POLAROID_TILTS[index % POLAROID_TILTS.length];
  const tapeColor = TAPE_COLORS[index % TAPE_COLORS.length];
  const emojiBg = POLAROID_EMOJI_BGS[index % POLAROID_EMOJI_BGS.length];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.polaroid, { transform: [{ rotate: tilt }] }]}>
      <View style={[styles.washiTape, { backgroundColor: tapeColor }]} />
      <View style={[styles.polaroidEmojiBox, { backgroundColor: emojiBg }]}>
        <Text style={{ fontSize: 44 }}>{activity.emoji}</Text>
      </View>
      <Text style={styles.polaroidTitle} numberOfLines={1}>{activity.name}</Text>
      <Text style={styles.polaroidEarns} numberOfLines={1}>
        {pill === 'from spin'
          ? `From spin · Earns ${activity.badge}`
          : `Earns: ${activity.badge}`}
      </Text>
      {pill && pill !== 'from spin' && (
        <View style={styles.polaroidPill}>
          <Text style={styles.polaroidPillText}>{pill}</Text>
        </View>
      )}
    </TouchableOpacity>
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

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  greeting: { fontSize: 30, fontWeight: '500', color: COLORS.dark, letterSpacing: -0.8 },
  subline: { fontSize: 13, color: '#888', marginTop: 4 },
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
  washiTopCenter: {
    position: 'absolute', top: 0, left: '36%', width: '28%', height: 18,
    backgroundColor: '#F6D78D', opacity: 0.85,
    transform: [{ rotate: '-3deg' }, { translateY: -6 }],
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

  askLineBtn: { marginTop: 14, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)' },
  askLineText: { fontSize: 13, fontWeight: '700', color: COLORS.deepCoral, letterSpacing: 0.2, textAlign: 'center' },

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

  polaroid: {
    backgroundColor: '#fff', borderRadius: 10, paddingTop: 16, paddingHorizontal: 10, paddingBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    position: 'relative', minHeight: 184,
  },
  washiTape: {
    position: 'absolute', top: -8, left: '25%', width: '50%', height: 14,
    opacity: 0.85, transform: [{ rotate: '-3deg' }],
  },
  polaroidEmojiBox: {
    width: '100%', aspectRatio: 1.15, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  polaroidTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 2, letterSpacing: -0.2 },
  polaroidEarns: { fontSize: 11, color: '#888' },
  polaroidPill: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FCEDC9' },
  polaroidPillText: { fontSize: 11, fontWeight: '700', color: COLORS.deepAmber },

  polaroidEmpty: {
    minHeight: 184,
    borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  addPlus: { fontSize: 36, color: '#888', marginBottom: 6 },
  addDreamText: { fontSize: 13, color: '#666', fontWeight: '600' },

  // Next Unlock — light coral-bordered card
  unlockCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cream, borderRadius: 24, padding: 16, marginBottom: 22,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    borderLeftWidth: 4, borderLeftColor: COLORS.coral,
    position: 'relative', overflow: 'hidden',
  },
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
