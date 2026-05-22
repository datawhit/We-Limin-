import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Animated, Easing,
  StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
const BADGE_DOT_COLORS = [COLORS.turquoise, COLORS.palmGreen, COLORS.amber];

// Safe TIER accessor — never crash on undefined / unknown tier values
// (stale activity rows, custom activities with no tier set, the brief
// window before a spin preview is populated, etc.)
const TIER_FALLBACK = { bg: COLORS.cream, label: '', text: COLORS.dark, dot: COLORS.muted };
const tierOf = (key) => (key && TIER[key]) || TIER_FALLBACK;

// Vibe filter pool for the spin.
const VIBES = [
  { id: 'chill', label: 'Chill', emoji: '🌿', bg: '#D6F0F4', fg: COLORS.turquoise },
  { id: 'bold',  label: 'Bold',  emoji: '🔥', bg: '#FCEDC9', fg: COLORS.deepAmber },
  { id: 'wild',  label: 'Wild',  emoji: '😈', bg: '#D4E8DD', fg: COLORS.palmGreen },
];

// Approximate floating-badge decoration around the avatar.
const STICKER_OFFSETS = [
  { x:  -8, y:  -4, rot: -14, size: 28 },
  { x:  72, y: -10, rot:  12, size: 24 },
  { x: -14, y:  62, rot:  -8, size: 26 },
];

export default function HomeScreen() {
  const { profile, myBadges, setMyBadges } = useContext(AppContext);
  const navigation = useNavigation();

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

  // Refresh unread invite count on mount + every time the messages
  // modal closes (user may have just read everything).
  const refreshUnread = async () => {
    try { setUnreadCount(await getUnreadInviteCount(profile.id)); }
    catch { /* table may not exist yet — silent */ }
  };
  useEffect(() => { refreshUnread(); }, []);

  // Per-session: pick a tagline once on mount.
  const sessionTagline = useMemo(
    () => HOME_TAGLINES[Math.floor(Math.random() * HOME_TAGLINES.length)],
    []
  );
  const dayName = DAYS[new Date().getDay()];

  const tier = getTier(myBadges.length);
  const total = ACTIVITIES.length;

  // ─── Spin / vibe state ───
  const [vibe, setVibe] = useState(null);          // null | 'chill' | 'bold' | 'wild'
  const [spinning, setSpinning] = useState(false);
  const [spinPick, setSpinPick] = useState(null);  // landed activity
  const [previewPick, setPreviewPick] = useState(null); // shown while spinning
  const spinRotation = useRef(new Animated.Value(0)).current;

  const eligible = useMemo(
    () => (vibe ? ACTIVITIES.filter(a => a.tier === vibe) : ACTIVITIES),
    [vibe]
  );

  // Badge unlock celebration now lives in BadgeUnlockModal at the
  // source (ActivityDetailScreen / AddMemoryScreen). Home no longer
  // double-fires a toast when the user returns.


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

  // ─── Spin ───
  const startSpin = () => {
    if (!eligible.length || spinning) return;
    // Preset a preview so the result block has data on the first
    // render — avoids a transient null tier reference.
    setPreviewPick(eligible[Math.floor(Math.random() * eligible.length)]);
    setSpinning(true);
    setSpinPick(null);

    // Continuous rotation animation
    spinRotation.setValue(0);
    Animated.loop(
      Animated.timing(spinRotation, {
        toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true,
      })
    ).start();

    // Random cycling preview
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

  // ─── AI Lime Finder ───
  const limeFind = () => {
    // For now: AI Finder = surprise pick from all activities, opens modal
    // where the in-screen AI suggestions populate venues for that activity.
    const pick = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
    openDetail(pick);
  };

  // Recent badges (newest 3) → emoji list for the fanning dots
  const recentBadgeEmojis = useMemo(() => {
    const ids = myBadges.slice(0, 3);
    return ids.map(id => ACTIVITIES.find(x => x.id === id)?.badge || null);
  }, [myBadges]);

  // Sticker emojis around the avatar (decorative — show recent or sample badges)
  const stickerEmojis = useMemo(() => {
    if (myBadges.length >= 3) {
      return myBadges.slice(0, 3).map(id => ACTIVITIES.find(x => x.id === id)?.badge || '🍋');
    }
    return ['🍋', '🌴', '🏖️']; // friendly default while empty
  }, [myBadges]);

  const ratingOf = (label) => RATINGS.find(r => r.label === label) || RATINGS[0];

  const recentMemories = memories.slice(0, 3);
  const leaderboard = useMemo(() => {
    return [...members]
      .map(m => ({ ...m, count: m.badges?.[0]?.count || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [members]);

  // Tier emoji for current tier
  const nextTier = tier.next;
  const morePhrase = nextTier
    ? `${tier.badgesToNext} more till ${nextTier.emoji} ${nextTier.name}`
    : `You ARE the function`;

  const spinSpin = spinRotation.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dark} />}
      >
        {/* ─── Top bar ─── */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hey {profile.name}</Text>
            <Text style={styles.subline}>{dayName} · {sessionTagline}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
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

        {/* ─── Profile / game card ─── */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            {/* Avatar + fanning + floating sticker decorations */}
            <View style={styles.avatarArea}>
              {/* Floating decorative stickers (rotated badges) */}
              {STICKER_OFFSETS.map((s, i) => (
                <View
                  key={i}
                  style={[
                    styles.sticker,
                    {
                      left: s.x, top: s.y,
                      width: s.size, height: s.size, borderRadius: s.size / 2,
                      transform: [{ rotate: `${s.rot}deg` }],
                      backgroundColor: BADGE_DOT_COLORS[i % BADGE_DOT_COLORS.length] + '33', // 20% alpha
                    },
                  ]}
                >
                  <Text style={{ fontSize: s.size * 0.55 }}>{stickerEmojis[i]}</Text>
                </View>
              ))}

              <TouchableOpacity activeOpacity={0.85} onPress={() => setEditOpen(true)} style={styles.avatarTap}>
                <View style={styles.avatarRing}>
                  <ProfileAvatar profile={profile} size={74} />
                </View>
                <View style={styles.editPip}><Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>✎</Text></View>
              </TouchableOpacity>

              {/* Three earned-badge dots fanning from bottom-right */}
              {[0, 45, 90].map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const cx = 40 + 56 * Math.cos(rad);
                const cy = 40 + 56 * Math.sin(rad);
                const emoji = recentBadgeEmojis[i];
                return (
                  <View
                    key={angle}
                    style={[styles.fanDot, {
                      left: cx - 12, top: cy - 12,
                      backgroundColor: emoji ? BADGE_DOT_COLORS[i] : '#F0EAD8',
                    }]}
                  >
                    {emoji
                      ? <Text style={{ fontSize: 11 }}>{emoji}</Text>
                      : <Text style={{ fontSize: 10, color: '#bbb' }}>·</Text>}
                  </View>
                );
              })}
            </View>

            {/* Right column */}
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>

              <View style={styles.tierPill}>
                <Text style={styles.tierPillText}>{tier.emoji} {tier.name}</Text>
              </View>

              <Text style={styles.badgeCountLine}>
                <Text style={styles.badgeCountNum}>{myBadges.length}</Text>
                <Text style={styles.badgeCountSlash}> / {total}</Text>
                <Text style={styles.badgeCountWord}>  badges earned</Text>
              </Text>
              <Text style={styles.toNextLine}>{morePhrase}</Text>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(tier.progress * 100)}%` }]} />
              </View>
            </View>
          </View>

          <Text style={styles.tagline}>{tier.tagline}</Text>
        </View>

        {/* ─── Spin section — also acts as the AI Lime Finder ─── */}
        <View style={styles.spinCard}>
          <Text style={styles.spinHeadline}>Where we limin' today?</Text>
          <Text style={styles.spinSub}>Pick a vibe + spin the lime, or get an AI suggestion.</Text>

          <View style={styles.vibeRow}>
            {VIBES.map(v => {
              const on = vibe === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setVibe(on ? null : v.id)}
                  style={[
                    styles.vibeBtn,
                    { backgroundColor: on ? v.fg : v.bg, borderColor: on ? v.fg : 'transparent' },
                  ]}
                >
                  <Text style={styles.vibeEmoji}>{v.emoji}</Text>
                  <Text style={[styles.vibeLabel, { color: on ? '#fff' : v.fg }]}>{v.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={startSpin} disabled={spinning} activeOpacity={0.85} style={styles.spinBtnWrap}>
            <Animated.View style={[styles.spinBtn, { transform: [{ rotate: spinSpin }] }]}>
              <Text style={styles.spinSliceEmoji}>🍋</Text>
            </Animated.View>
            <Text style={styles.spinBtnLabel}>{spinning ? 'SHAKING…' : 'SPIN THE LIME'}</Text>
            <Text style={styles.spinBtnSub}>
              {vibe ? `${VIBES.find(v => v.id === vibe).emoji} ${VIBES.find(v => v.id === vibe).label} pool only` : 'All 59 in the pool'}
            </Text>
          </TouchableOpacity>

          {/* AI suggestion entry — merged from the old standalone card */}
          <TouchableOpacity onPress={limeFind} activeOpacity={0.85} style={styles.askLineBtn}>
            <Text style={styles.askLineText}>✨  or, ask the lime to pick →</Text>
          </TouchableOpacity>

          {(() => {
            const shown = previewPick || spinPick;
            if (!(spinning || spinPick) || !shown) return null;
            const t = tierOf(shown.tier);
            return (
              <View style={styles.spinResult}>
                <Text style={styles.spinResultEmoji}>{shown.emoji}</Text>
                <Text style={styles.spinResultName}>{shown.name}</Text>
                <View style={[styles.spinResultTier, { backgroundColor: t.bg }]}>
                  <Text style={[styles.spinResultTierText, { color: t.text }]}>
                    {t.label} tier
                  </Text>
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

        {/* ─── Summer 2026 progress ─── */}
        <View style={styles.summerCard}>
          <Text style={styles.summerPalm}>🌴</Text>
          <Text style={styles.summerEyebrow}>SUMMER 2026</Text>
          <Text style={styles.summerHeadline}>Your summer story in progress</Text>
          <View style={styles.summerStats}>
            <Text style={styles.summerCount}>
              <Text style={styles.summerCountNum}>{myBadges.length}</Text> / {total}
            </Text>
            <Text style={styles.summerCountLabel}>badges collected</Text>
          </View>
          <View style={styles.summerTrack}>
            <View style={[styles.summerFill, { width: `${Math.round((myBadges.length / total) * 100)}%` }]} />
          </View>
        </View>

        {/* ─── Next Unlock ─── */}
        {nextTier ? (
          <View style={styles.unlockCard}>
            <View style={styles.lockedBadge}>
              <Text style={{ fontSize: 28, opacity: 0.45 }}>{nextTier.emoji}</Text>
              <View style={styles.lockBadge}><Text style={{ fontSize: 10 }}>🔒</Text></View>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.unlockEyebrow}>NEXT UNLOCK</Text>
              <Text style={styles.unlockName}>{nextTier.name} {nextTier.emoji}</Text>
              <Text style={styles.unlockSub}>{tier.badgesToNext} more badges to go</Text>
            </View>
            <TouchableOpacity onPress={() => setTiersOpen(true)} style={styles.unlockCta}>
              <Text style={styles.unlockCtaText}>See all tiers</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ─── Squad leaderboard preview ─── */}
        {leaderboard.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>🏆 Squad standings</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Squad')}>
                <Text style={styles.linkText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
              {leaderboard.map((m, i) => {
                const mAccent = m.accent_color || COLORS.coral;
                return (
                  <View key={m.id} style={styles.boardTile}>
                    <View style={styles.boardRank}><Text style={styles.boardRankText}>{i + 1}</Text></View>
                    <ProfileAvatar profile={m} size={52} ringColor={mAccent} />
                    <Text style={styles.boardName} numberOfLines={1}>{m.name}</Text>
                    <Text style={styles.boardCount}>{m.count} 🏅</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

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
            recentMemories.map(m => {
              const a = ACTIVITIES.find(x => x.id === m.activity_id);
              const r = ratingOf(m.rating);
              return (
                <View key={m.id} style={styles.memCard}>
                  {/* Photo with tape corners for scrapbook feel */}
                  <View style={styles.memPhotoWrap}>
                    {m.photo_url ? (
                      <Image source={{ uri: m.photo_url }} style={styles.memPhoto} />
                    ) : (
                      <View style={[styles.memPhoto, { backgroundColor: tierOf(a?.tier).bg || COLORS.softCoral, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 36 }}>{a?.emoji || '📸'}</Text>
                      </View>
                    )}
                    <View style={[styles.tape, styles.tapeLeft]} />
                    <View style={[styles.tape, styles.tapeRight]} />
                    <View style={[styles.memRatingChip, { backgroundColor: r.color }]}>
                      <Text style={[styles.memRatingText, { color: r.textColor }]}>{r.icon}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.memActivity} numberOfLines={1}>{a?.name || 'A lime'}</Text>
                    {m.caption ? (
                      <Text style={styles.memCaption} numberOfLines={2}>“{m.caption}”</Text>
                    ) : null}
                    <View style={styles.memMetaRow}>
                      <Text style={styles.memAuthor} numberOfLines={1}>
                        {m.profiles?.name || 'someone'} · {timeAgo(m.created_at)}
                      </Text>
                      <Text style={styles.memHeart}>♡</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ─── Secret badges teaser ─── */}
        <View style={styles.secretCard}>
          <Text style={styles.secretEyebrow}>HIDDEN STICKERS</Text>
          <Text style={styles.secretHeadline}>Some badges you only earn by being outside</Text>
          <View style={styles.secretRow}>
            {[
              { emoji: '🦉', name: 'Night Owl', hint: 'Out past midnight' },
              { emoji: '🌅', name: 'Sunrise Crew', hint: 'See the sun come up' },
              { emoji: '🚲', name: 'Spontaneous', hint: 'No plans, all plans' },
            ].map(s => (
              <View key={s.name} style={styles.secretTile}>
                <View style={styles.secretEmojiWrap}>
                  <Text style={{ fontSize: 26, opacity: 0.35 }}>{s.emoji}</Text>
                  <Text style={styles.secretLock}>🔒</Text>
                </View>
                <Text style={styles.secretName}>{s.name}</Text>
                <Text style={styles.secretHint}>{s.hint}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
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
  scroll: { padding: 22, paddingBottom: 60 },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  greeting: { fontSize: 28, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.7 },
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

  // Profile / game card
  profileCard: {
    backgroundColor: COLORS.warmWhite, borderRadius: 26, padding: 22, marginBottom: 22,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarArea: { width: 116, height: 116, position: 'relative' },

  // Floating sticker decoration
  sticker: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
    zIndex: 3,
  },

  avatarTap: { position: 'relative' },
  avatarRing: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.coral,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream,
  },
  editPip: {
    position: 'absolute', left: 56, top: 56,
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.coral,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
    zIndex: 4,
  },
  fanDot: {
    position: 'absolute',
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },

  profileName: { fontSize: 22, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.3, marginBottom: 8 },
  tierPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.amber, height: 28, borderRadius: 14,
    paddingHorizontal: 12, justifyContent: 'center', marginBottom: 10,
  },
  tierPillText: { fontSize: 13, fontWeight: '600', color: COLORS.deepAmber, letterSpacing: -0.2 },
  badgeCountLine: { fontSize: 13, color: '#666' },
  badgeCountNum:   { color: COLORS.dark, fontWeight: '700', fontSize: 14 },
  badgeCountSlash: { color: COLORS.dark, fontWeight: '500' },
  badgeCountWord:  { color: '#888' },
  toNextLine: { fontSize: 13, color: '#999', marginTop: 2, marginBottom: 10 },

  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F0EAD8', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.coral },

  tagline: { marginTop: 16, textAlign: 'center', fontSize: 11, color: '#888', fontStyle: 'italic' },

  // Spin section
  spinCard: {
    backgroundColor: COLORS.softCoral, borderRadius: 26, padding: 22, marginBottom: 22,
    alignItems: 'center', overflow: 'hidden',
  },
  spinEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: COLORS.deepCoral, marginBottom: 6 },
  spinHeadline: { fontSize: 22, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.4, marginBottom: 6, textAlign: 'center' },
  spinSub: { fontSize: 12, color: COLORS.deepCoral, opacity: 0.85, marginBottom: 18, textAlign: 'center' },
  askLineBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)' },
  askLineText: { fontSize: 13, fontWeight: '700', color: COLORS.deepCoral, letterSpacing: 0.2, textAlign: 'center' },
  vibeRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignSelf: 'stretch' },
  vibeBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, gap: 2,
  },
  vibeEmoji: { fontSize: 18 },
  vibeLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, marginTop: 2 },

  spinBtnWrap: { alignItems: 'center' },
  spinBtn: {
    width: 132, height: 132, borderRadius: 66,
    backgroundColor: COLORS.limeGreen,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 6, borderColor: '#fff',
    shadowColor: COLORS.coral, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  spinSliceEmoji: { fontSize: 64 },
  spinBtnLabel: { fontSize: 13, fontWeight: '800', color: COLORS.deepCoral, letterSpacing: 1.4, marginTop: 14 },
  spinBtnSub: { fontSize: 11, color: '#A56657', marginTop: 4 },

  spinResult: {
    marginTop: 22, alignSelf: 'stretch',
    backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  spinResultEmoji: { fontSize: 52, marginBottom: 6 },
  spinResultName: { fontSize: 20, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.3, marginBottom: 10, textAlign: 'center' },
  spinResultTier: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10, marginBottom: 14 },
  spinResultTierText: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  spinResultCta: { backgroundColor: COLORS.coral, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  spinResultCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // AI Lime Finder
  aiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#E8F4F6', borderRadius: 22, padding: 18, marginBottom: 22,
    borderWidth: 1, borderColor: '#C6E5EB',
  },
  aiSparkle: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  aiTitle: { fontSize: 16, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  aiSub: { fontSize: 12, color: '#0F6E7B', marginTop: 3 },
  aiCta: { backgroundColor: COLORS.turquoise, paddingHorizontal: 14, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  aiCtaText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Summer 2026
  summerCard: {
    backgroundColor: '#FCF1D7', borderRadius: 24, padding: 22, marginBottom: 22,
    borderWidth: 1, borderColor: '#F2E3B9', overflow: 'hidden',
  },
  summerPalm: { position: 'absolute', right: -2, bottom: -8, fontSize: 86, opacity: 0.18 },
  summerEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: COLORS.deepAmber, marginBottom: 6 },
  summerHeadline: { fontSize: 18, fontWeight: '600', color: COLORS.dark, marginBottom: 12, letterSpacing: -0.2 },
  summerStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  summerCount: { fontSize: 24, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.4 },
  summerCountNum: { color: COLORS.deepAmber },
  summerCountLabel: { fontSize: 12, color: '#8B6F2F', fontWeight: '600' },
  summerTrack: { height: 8, borderRadius: 4, backgroundColor: '#F2E3B9', overflow: 'hidden' },
  summerFill: { height: 8, borderRadius: 4, backgroundColor: COLORS.amber },

  // Next Unlock — light card with coral left border
  unlockCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cream, borderRadius: 24, padding: 18, marginBottom: 22,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    borderLeftWidth: 4, borderLeftColor: COLORS.coral,
  },
  lockedBadge: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff',
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
  unlockCta: { backgroundColor: COLORS.coral, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 11 },
  unlockCtaText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Sections
  section: { marginBottom: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  linkText: { fontSize: 13, color: '#888', fontWeight: '600' },

  // Leaderboard
  boardTile: { width: 80, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6, borderWidth: 1, borderColor: COLORS.cardBorder, position: 'relative' },
  boardRank: { position: 'absolute', top: -8, left: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.amber, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  boardRankText: { fontSize: 10, fontWeight: '700', color: COLORS.deepAmber },
  boardName: { fontSize: 12, fontWeight: '700', color: COLORS.dark, marginTop: 8, maxWidth: 70 },
  boardCount: { fontSize: 11, color: '#999', marginTop: 2 },

  // Squad Memories scrapbook cards
  memCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  memPhotoWrap: { width: 92, height: 92, borderRadius: 14, overflow: 'visible', position: 'relative' },
  memPhoto: { width: 92, height: 92, borderRadius: 14 },
  tape: { position: 'absolute', width: 28, height: 12, backgroundColor: 'rgba(255,235,160,0.85)', borderRadius: 2 },
  tapeLeft: { top: -4, left: 6, transform: [{ rotate: '-22deg' }] },
  tapeRight: { top: -4, right: 6, transform: [{ rotate: '20deg' }] },
  memRatingChip: { position: 'absolute', bottom: -8, right: -6, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },
  memRatingText: { fontSize: 12 },
  memActivity: { fontSize: 14, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  memCaption: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic', lineHeight: 17 },
  memMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  memAuthor: { fontSize: 11, color: '#999', flex: 1, marginRight: 8 },
  memHeart: { fontSize: 18, color: COLORS.coral },

  // Secret badges
  secretCard: {
    backgroundColor: '#fff', borderRadius: 22, padding: 20, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  secretEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: COLORS.palmGreen, marginBottom: 4 },
  secretHeadline: { fontSize: 15, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.1, marginBottom: 14 },
  secretRow: { flexDirection: 'row', gap: 10 },
  secretTile: { flex: 1, alignItems: 'center', backgroundColor: '#FAFAF6', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6, borderWidth: 1, borderColor: COLORS.cardBorder },
  secretEmojiWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#F0EAD8', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  secretLock: { position: 'absolute', bottom: -2, right: -2, fontSize: 12 },
  secretName: { fontSize: 12, fontWeight: '700', color: COLORS.dark, marginTop: 8, letterSpacing: -0.1 },
  secretHint: { fontSize: 10, color: '#999', marginTop: 2, textAlign: 'center' },

  // Empty memories
  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyText: { color: '#999', fontSize: 13 },
});
