import React, { useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Animated, Easing,
  StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useFonts, Caveat_500Medium, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { ACTIVITIES, COLORS, TIER } from '../lib/constants';
import { getMemories, getBadges, getAllMembers, getUserActivities } from '../lib/supabase';
import AvailabilityModal from './AvailabilityModal';
import SettingsModal from './SettingsModal';
import EditProfileModal from './EditProfileModal';
import TiersScreen from './TiersScreen';
import MessagesScreen from './MessagesScreen';
import { getUnreadInviteCount } from '../lib/supabase';

// ─── Design system primitives ─────────────────────────────
import WashiTape from '../components/WashiTape';
import { Sparkle, CurvedArrow, Underline } from '../components/Doodles';
import { HANDWRITTEN_500 } from '../lib/theme';

// Time-of-day greeting helper. Falls back to "Hey" overnight.
const timeOfDay = () => {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return { word: 'Morning',   icon: '☀️' };
  if (h >= 12 && h < 17) return { word: 'Afternoon', icon: '🌴' };
  if (h >= 17 && h < 22) return { word: 'Evening',   icon: '🌙' };
  return { word: 'Hey', icon: '✨' };
};

// Source → status-pill label mapping used by the Soon Come strip.
// (Visual layer only — no DB writes.)
const SOON_COME_PILL = {
  explore_saved: { label: 'soon',     bg: '#FBE7C6', fg: '#A86A1E' },
  squad_plan:    { label: 'open',     bg: '#DDF1E2', fg: '#2F7A3D' },
  dream:         { label: 'dreaming', bg: '#E4DEF6', fg: '#5B3FA3' },
};

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

  const refreshUnread = async () => {
    try { setUnreadCount(await getUnreadInviteCount(profile.id)); }
    catch { /* table may not exist yet — silent */ }
  };
  useEffect(() => { refreshUnread(); }, []);

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

  // Count of memories posted by the current user.
  const myMemoryCount = useMemo(
    () => memories.filter(m => m.profile_id === profile.id).length,
    [memories, profile.id]
  );

  // Memories the user logged in the current calendar month — drives
  // the greeting subline ("You've made N memories this month").
  const memoriesThisMonth = useMemo(() => {
    const now = new Date();
    return memories.filter(m => {
      if (m.profile_id !== profile.id) return false;
      const d = new Date(m.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [memories, profile.id]);

  // On This Day — most recent prior-year memory whose month+day matches today.
  // Falls back to null if the user has any memories but none from prior years;
  // the "no memories at all" case is handled by the empty-state CTA in render.
  const onThisDayMemory = useMemo(() => {
    const now = new Date();
    const mm = now.getMonth();
    const dd = now.getDate();
    const yy = now.getFullYear();
    const matches = memories
      .filter(m => m.profile_id === profile.id)
      .filter(m => {
        const d = new Date(m.created_at);
        return d.getMonth() === mm && d.getDate() === dd && d.getFullYear() < yy;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return matches[0] || null;
  }, [memories, profile.id]);

  // Squad activity — preference order:
  //   1. unread invite count > 0 → show invite teaser
  //   2. most recent memory tagged with someone other than the current user
  //   3. null (no card)
  const squadActivity = useMemo(() => {
    if (unreadCount > 0) {
      return { kind: 'invite', count: unreadCount };
    }
    const recentOther = memories
      .filter(m => m.profile_id && m.profile_id !== profile.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    if (recentOther) {
      const member = members.find(x => x.id === recentOther.profile_id);
      const activity = ACTIVITIES.find(a => a.id === recentOther.activity_id);
      return { kind: 'memory', memory: recentOther, member, activity };
    }
    return null;
  }, [unreadCount, memories, members, profile.id]);

  const spinSpin = spinRotation.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '360deg'],
  });

  // ─── The Lineup data — fetched from user_activities ─────────
  // The Lineup is the user's *saved* activities — dreams from Activity
  // Detail, "+ saves" from Explore, and squad-plan invites that were
  // accepted on Messages. spinPick is ephemeral and never bleeds in.
  const [lineupRows, setLineupRows] = useState([]);

  const fetchLineup = useCallback(async () => {
    console.log('[home/fetchLineup] called, profile.id =', profile?.id);
    if (!profile?.id) return;
    try {
      const rows = await getUserActivities(profile.id);
      console.log('[home/fetchLineup] got', rows?.length ?? 0, 'rows for', profile.id, '→', rows);
      setLineupRows(rows || []);
    } catch (e) {
      console.warn('[home] fetchLineup failed:', e?.message || e);
    }
  }, [profile?.id]);

  useEffect(() => { fetchLineup(); }, [fetchLineup]);
  useFocusEffect(useCallback(() => { fetchLineup(); }, [fetchLineup]));

  // Join each row with its ACTIVITIES catalog entry. Drop rows whose
  // activity_id doesn't resolve (defensive).
  const lineup = useMemo(() => {
    const pillBySource = {
      dream:         'dream',
      explore_saved: 'saved',
      squad_plan:    'invited',
    };
    console.log('[home/lineup] joining', lineupRows.length, 'rows against', ACTIVITIES.length, 'activities');
    const joined = lineupRows
      .map(row => {
        const activity = ACTIVITIES.find(a => a.id === row.activity_id);
        if (!activity) {
          console.warn('[home] lineup row has no matching activity:', row);
          return null;
        }
        return {
          activity,
          source: row.source || null,
          status: row.status || null,
          pill:   pillBySource[row.source] || null,
        };
      })
      .filter(Boolean);
    console.log('[home/lineup] joined →', joined.length, 'items, sources:', joined.map(j => j.source));
    return joined;
  }, [lineupRows]);

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
            <ProfileAvatar profile={profile} size={40} ringColor={COLORS.coral} ringWidth={2} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              {(() => {
                const tod = timeOfDay();
                return (
                  <Text style={[styles.greeting, HAND_500 && { fontFamily: HAND_500 }]} numberOfLines={1}>
                    {tod.word}, {profile.name} {tod.icon}
                  </Text>
                );
              })()}
              <Text style={styles.subline} numberOfLines={1}>
                {memoriesThisMonth === 0
                  ? "let's collect your first memory this month 🍋"
                  : `you've made ${memoriesThisMonth} ${memoriesThisMonth === 1 ? 'memory' : 'memories'} this month`}
              </Text>
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

        {/* ─── SOON COME strip ─── */}
        {/* Compact horizontal preview of the user's lineup. The full
            view (filters, dream-tile, all sources) still lives on the
            Activities screen; "see all" deep-links there. */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionHeadline, HAND_500 && { fontFamily: HAND_500 }]}>soon come 🍋</Text>
              <Text style={styles.sectionSub}>your plans, your way</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Activities')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.linkText}>see all</Text>
            </TouchableOpacity>
          </View>

          {lineup.length === 0 ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Activities')}
              activeOpacity={0.85}
              style={styles.soonComeEmpty}
            >
              <Text style={styles.soonComeEmptyPlus}>+</Text>
              <Text style={styles.soonComeEmptyText}>nothing on deck — go find some limes</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.soonComeRow}
            >
              {lineup.slice(0, 3).map((p, i) => {
                const pill = SOON_COME_PILL[p.source] || SOON_COME_PILL.explore_saved;
                const washi = POLAROID_WASHI[i % POLAROID_WASHI.length];
                const tilt  = POLAROID_TILT[i % POLAROID_TILT.length];
                const bg    = POLAROID_EMOJI_BG[i % POLAROID_EMOJI_BG.length];
                return (
                  <TouchableOpacity
                    key={p.activity.id}
                    activeOpacity={0.85}
                    onPress={() => openDetail(p.activity)}
                    style={[styles.soonComeCard, { transform: [{ rotate: `${tilt}deg` }] }]}
                  >
                    <WashiTape color={washi} width="46%" rotation={-3} style={{ top: -8, left: '27%' }} />
                    <View style={[styles.soonComeEmojiBox, { backgroundColor: bg }]}>
                      <Text style={{ fontSize: 32 }}>{p.activity.emoji}</Text>
                    </View>
                    <Text style={styles.soonComeTitle} numberOfLines={1}>{p.activity.name}</Text>
                    {p.activity.location ? (
                      <Text style={styles.soonComeLoc} numberOfLines={1}>{p.activity.location}</Text>
                    ) : null}
                    <View style={[styles.soonComePill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.soonComePillText, { color: pill.fg }]}>{pill.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ─── ON THIS DAY ─── */}
        {(() => {
          // Three states:
          //   - user has zero memories → "first memory" CTA
          //   - user has memories AND a prior-year match → flashback card
          //   - user has memories but no prior-year match → hide section
          if (myMemoryCount === 0) {
            return (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionHeadline, HAND_500 && { fontFamily: HAND_500 }]}>your first lime</Text>
                  <Text style={styles.sectionSub} />
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Activities')}
                  activeOpacity={0.85}
                  style={styles.firstMemoryCard}
                >
                  <Text style={styles.firstMemoryEmoji}>📸</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.firstMemoryTitle}>capture your first memory</Text>
                    <Text style={styles.firstMemorySub}>every scrapbook starts somewhere — pick a lime, live it, post it</Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          }

          if (!onThisDayMemory) return null;

          const a = ACTIVITIES.find(x => x.id === onThisDayMemory.activity_id);
          const d = new Date(onThisDayMemory.created_at);
          const dateStr = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
          const years = new Date().getFullYear() - d.getFullYear();
          const yearStr = years === 1 ? '1 year ago' : `${years} years ago`;

          return (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionHeadline, HAND_500 && { fontFamily: HAND_500 }]}>on this day</Text>
                <Text style={styles.sectionSub}>{yearStr}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { try { navigation.navigate('Scrapbook'); } catch {} }}
                style={styles.onThisDayCard}
              >
                <View style={styles.onThisDayThumb}>
                  {onThisDayMemory.photo_url ? (
                    <Image source={{ uri: onThisDayMemory.photo_url }} style={styles.onThisDayThumbImg} />
                  ) : (
                    <View style={[styles.onThisDayThumbImg, { backgroundColor: tierOf(a?.tier).bg, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 28 }}>{a?.emoji || '📸'}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.onThisDayDate}>{dateStr}</Text>
                  <Text style={styles.onThisDayTitle} numberOfLines={1}>{a?.name || 'A memory'}</Text>
                  <Text style={styles.onThisDayCaption} numberOfLines={2}>
                    {onThisDayMemory.caption || onThisDayMemory.note || 'tap to relive it'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ─── SQUAD ACTIVITY ─── */}
        {squadActivity && (
          <View style={styles.section}>
            {squadActivity.kind === 'invite' ? (
              <TouchableOpacity
                onPress={() => setMessagesOpen(true)}
                activeOpacity={0.85}
                style={styles.squadCard}
              >
                <View style={styles.squadAvatarFallback}>
                  <Text style={{ fontSize: 22 }}>📬</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.squadEyebrow}>YOUR SQUAD</Text>
                  <Text style={styles.squadTitle} numberOfLines={2}>
                    you have {squadActivity.count} new {squadActivity.count === 1 ? 'invite' : 'invites'} waiting
                  </Text>
                </View>
                <View style={styles.squadCta}>
                  <Text style={styles.squadCtaText}>open</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { try { navigation.navigate('Scrapbook'); } catch {} }}
                activeOpacity={0.85}
                style={styles.squadCard}
              >
                {squadActivity.member ? (
                  <ProfileAvatar profile={squadActivity.member} size={44} ringColor={COLORS.palmGreen} ringWidth={2} />
                ) : (
                  <View style={styles.squadAvatarFallback}>
                    <Text style={{ fontSize: 22 }}>👥</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.squadEyebrow}>SQUAD MOMENT</Text>
                  <Text style={styles.squadTitle} numberOfLines={2}>
                    {(squadActivity.member?.name || 'someone in your lime') + ' just lived '}
                    <Text style={{ fontWeight: '700' }}>{squadActivity.activity?.name || 'a moment'}</Text>
                  </Text>
                </View>
                <View style={styles.squadCta}>
                  <Text style={styles.squadCtaText}>view</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
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

  // ─── Sections ──────────────────────────────────────────────
  section: { marginBottom: 26 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeadline: {
    fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 32,
    fontWeight: '700', // Caveat fallback
  },
  sectionSub: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 2 },
  linkText: { fontSize: 13, color: COLORS.coral, fontWeight: '700' },

  // ─── Soon Come strip ───────────────────────────────────────
  soonComeRow: { gap: 14, paddingRight: 22, paddingTop: 10, paddingBottom: 6 },
  soonComeCard: {
    width: 156,
    backgroundColor: '#fff', borderRadius: 12,
    paddingTop: 16, paddingHorizontal: 10, paddingBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    position: 'relative',
  },
  soonComeEmojiBox: {
    width: '100%', aspectRatio: 1.25, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  soonComeTitle: { fontSize: 13, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  soonComeLoc:   { fontSize: 11, color: '#888', marginTop: 2 },
  soonComePill:  {
    alignSelf: 'flex-start', marginTop: 8,
    paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999,
  },
  soonComePillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  soonComeEmpty: {
    backgroundColor: '#fff',
    borderRadius: 16, paddingVertical: 26, paddingHorizontal: 22,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  soonComeEmptyPlus: { fontSize: 28, color: '#888', marginBottom: 4 },
  soonComeEmptyText: { fontSize: 13, color: '#666', fontStyle: 'italic' },

  // ─── On This Day ────────────────────────────────────────────
  onThisDayCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFE3F5', // soft lavender, mockup-aligned
    borderRadius: 18, padding: 14,
  },
  onThisDayThumb: {
    width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  onThisDayThumbImg: { width: '100%', height: '100%' },
  onThisDayDate:    { fontSize: 11, color: '#7A5C9C', fontWeight: '700', letterSpacing: 0.3 },
  onThisDayTitle:   { fontSize: 15, color: COLORS.dark, fontWeight: '700', marginTop: 2, letterSpacing: -0.2 },
  onThisDayCaption: { fontSize: 12, color: '#6F6685', fontStyle: 'italic', marginTop: 2, lineHeight: 16 },

  // First-memory CTA — replaces On This Day when user has zero memories
  firstMemoryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FCEDC9',
    borderRadius: 18, padding: 16,
  },
  firstMemoryEmoji: { fontSize: 30, marginRight: 14 },
  firstMemoryTitle: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  firstMemorySub:   { fontSize: 12, color: '#7A6B3F', fontStyle: 'italic', marginTop: 2, lineHeight: 16 },

  // ─── Squad activity ────────────────────────────────────────
  squadCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#DDF1E2',
    borderRadius: 18, padding: 14,
  },
  squadAvatarFallback: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.palmGreen,
  },
  squadEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: '#2F7A3D' },
  squadTitle:   { fontSize: 14, color: COLORS.dark, marginTop: 3, letterSpacing: -0.15, lineHeight: 19 },
  squadCta: {
    backgroundColor: COLORS.palmGreen, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11,
    marginLeft: 10,
  },
  squadCtaText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
