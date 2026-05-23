import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Share, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { useNavigation } from '@react-navigation/native';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { COLORS, levelTitle, ACTIVITIES, TIER } from '../lib/constants';
import {
  getAllMembers, getTrendingActivities, getUserActivities,
  getMemories, getAcceptedInvites,
} from '../lib/supabase';

// ─── Design system primitives ─────────────────────────────
import Polaroid from '../components/Polaroid';
import WashiTape from '../components/WashiTape';
import { Star, Heart, Sparkle, CurvedArrow } from '../components/Doodles';
import { PASTELS, HANDWRITTEN_500 } from '../lib/theme';

const INVITE_LINK = 'https://welimin.app/join/squad';

// Washi cycle for member polaroids + memory polaroids (separate cycles
// but using the same token list).
const POLAROID_WASHI = ['pink', 'blue', 'coral', 'lavender', 'amber'];
const MEMORY_WASHI   = ['coral', 'blue', 'lavender', 'amber'];

export default function SquadScreen() {
  // ─── PRESERVED: all hooks, state, handlers, data wiring ───
  const { profile } = useContext(AppContext);
  const navigation = useNavigation();
  const [members, setMembers] = useState([]);
  const [trending, setTrending] = useState([]); // [{ activity, count }]
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acceptedInvites, setAcceptedInvites] = useState([]); // for "upcoming together"
  const [allMemories, setAllMemories] = useState([]);         // for "recent memories"
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#FFFFFF';

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const load = async () => {
    try {
      const all = await getAllMembers();
      setMembers(all);
    } catch (e) { console.error(e); }

    // Trending Limes — preserved behavior. The reactions logic isn't
    // touched; this query simply consumes the aggregate.
    try {
      const top = await getTrendingActivities({ days: 7, limit: 3 });
      const userActs = await getUserActivities(profile.id).catch(() => []);
      const byId = new Map();
      [...ACTIVITIES, ...userActs].forEach(a => byId.set(a.id, a));
      const resolved = top
        .map(({ activity_id, count }) => {
          const a = byId.get(activity_id);
          return a ? { activity: a, count } : null;
        })
        .filter(Boolean);
      setTrending(resolved);
    } catch (e) { setTrending([]); }

    // NEW: accepted invites for "upcoming together"
    try {
      const invites = await getAcceptedInvites(profile.id);
      setAcceptedInvites(invites);
    } catch (e) { setAcceptedInvites([]); }

    // NEW: recent memories preview (fallback when the dedicated
    // tagged_users column doesn't yet exist on the memories table —
    // we just show the most-recent shared memories)
    try {
      const mems = await getMemories();
      setAllMemories(mems);
    } catch (e) { setAllMemories([]); }
  };

  const openActivity = (activity) => {
    navigation.getParent()?.navigate('ActivityDetailModal', { activity, isModal: true });
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const copyInvite = async () => {
    await Clipboard.setStringAsync(INVITE_LINK);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareInvite = async () => {
    try {
      await Share.share({ message: `Join the lime — ${INVITE_LINK}` });
    } catch (e) { /* noop */ }
  };

  // Build the "your crew" horizontal list — current user first, then
  // other squad members in their server order.
  const crewRow = useMemo(() => {
    const others = members.filter(m => m.id !== profile.id);
    return [{ ...profile, _isMe: true }, ...others];
  }, [members, profile]);

  // Group accepted invites by activity_id and compute unique attendees.
  // Each group becomes one "upcoming together" card.
  const upcomingTogether = useMemo(() => {
    const byActivity = new Map();
    acceptedInvites.forEach(inv => {
      const aid = inv.activity_id;
      const bucket = byActivity.get(aid) || {
        activityId: aid,
        attendees: new Map(),
        suggestedTime: inv.suggested_time,
        latestAt: inv.created_at,
      };
      // Add both sides as attendees (de-duped via map)
      if (inv.from_profile) bucket.attendees.set(inv.from_profile.id, inv.from_profile);
      if (inv.to_profile)   bucket.attendees.set(inv.to_profile.id, inv.to_profile);
      if (inv.created_at > bucket.latestAt) {
        bucket.latestAt = inv.created_at;
        bucket.suggestedTime = inv.suggested_time;
      }
      byActivity.set(aid, bucket);
    });
    return [...byActivity.values()]
      .map(b => ({
        activity: ACTIVITIES.find(a => a.id === b.activityId)
               || { id: b.activityId, name: 'A lime', emoji: '🍋', tier: 'chill' },
        attendees: [...b.attendees.values()],
        suggestedTime: b.suggestedTime,
        latestAt: b.latestAt,
      }))
      .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1))
      .slice(0, 4);
  }, [acceptedInvites]);

  // Recent shared memories — newest 4. If the table is empty we'll
  // hide the whole section per spec.
  const recentSquadMemories = useMemo(
    () => allMemories.slice(0, 4),
    [allMemories]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dark} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, HAND_500 && { fontFamily: HAND_500 }]}>squad</Text>
            <Sparkle size={22} color={COLORS.palmGreen} opacity={0.6} style={{ left: 8, top: 6 }} />
            <Star size={12} color={COLORS.coral} opacity={0.5} style={{ right: 8, top: 4 }} />
            <Heart size={11} color={COLORS.amber} opacity={0.55} style={{ right: 30, top: 30 }} />
          </View>
          <Text style={styles.subtitle}>your people, your adventures</Text>
        </View>

        {/* ─── Invite card — mint pastel, coral washi ─── */}
        <View style={styles.inviteCard}>
          <WashiTape color="coral" width="40%" height={16} rotation={-3} style={{ top: -8, left: '30%' }} />

          {/* Floating palm sticker just outside the bottom-right corner */}
          <Text style={styles.palmSticker}>🌴</Text>

          {/* Soft inner accents */}
          <Sparkle size={14} color={COLORS.coral} opacity={0.6} style={{ left: 18, top: 20 }} />
          <Heart size={12} color="#D4475C" opacity={0.45} style={{ right: 28, bottom: 92 }} />

          <Text style={styles.inviteEmoji}>🔗</Text>
          <Text style={[styles.inviteTitle, HAND_500 && { fontFamily: HAND_500 }]}>bring someone in</Text>
          <Text style={styles.inviteSub}>the more the merrier — share the link</Text>

          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{INVITE_LINK}</Text>
          </View>

          <View style={styles.inviteBtns}>
            <TouchableOpacity onPress={copyInvite} style={styles.copyBtn}>
              <Text style={styles.copyBtnText}>{copied ? 'copied ✓' : 'copy link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareInvite} style={styles.shareBtn}>
              <Text style={styles.shareBtnText}>share</Text>
              <Text style={styles.shareArrow}>↗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Your crew — horizontal avatar strip ─── */}
        <Text style={styles.miniHeader}>YOUR CREW</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 22 }}
          style={{ marginBottom: 22, marginHorizontal: -22, paddingHorizontal: 22 }}
        >
          {crewRow.map(m => {
            const label = m._isMe ? 'You' : (m.name || '').slice(0, 8);
            return (
              <View key={m.id || m.name} style={styles.crewTile}>
                <ProfileAvatar
                  profile={m}
                  size={56}
                  ringColor={COLORS.palmGreen}
                  ringWidth={2}
                />
                <Text style={styles.crewName} numberOfLines={1}>{label}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* ─── Upcoming together (NEW) ─── */}
        <View style={styles.upcomingHead}>
          <WashiTape color="amber" width={210} height={22} rotation={-2} style={{ left: -10, top: 12, opacity: 0.55 }} />
          <Text style={[styles.crewTitle, HAND_500 && { fontFamily: HAND_500 }]}>upcoming together</Text>
        </View>

        {upcomingTogether.length === 0 ? (
          <View style={styles.upcomingEmpty}>
            <CurvedArrow size={56} color={COLORS.coral} opacity={0.7} style={{ right: 32, top: 4, transform: [{ rotate: '-180deg' }] }} />
            <Text style={styles.upcomingEmptyText}>
              no plans on the books yet — invite the squad
            </Text>
          </View>
        ) : (
          <View style={{ marginBottom: 22 }}>
            {upcomingTogether.map(item => {
              const t = TIER[item.activity.tier] || { bg: COLORS.cream, text: COLORS.dark };
              const visible = item.attendees.slice(0, 3);
              const overflow = item.attendees.length - visible.length;
              return (
                <TouchableOpacity
                  key={item.activity.id}
                  onPress={() => openActivity(item.activity)}
                  activeOpacity={0.85}
                  style={styles.upcomingCard}
                >
                  <View style={[styles.upcomingEmoji, { backgroundColor: t.bg }]}>
                    <Text style={{ fontSize: 26 }}>{item.activity.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.upcomingName} numberOfLines={1}>{item.activity.name}</Text>
                    {item.suggestedTime ? (
                      <Text style={styles.upcomingMeta}>{item.suggestedTime}</Text>
                    ) : null}
                    {item.activity.location ? (
                      <Text style={styles.upcomingMeta}>📍 {item.activity.location}</Text>
                    ) : null}
                  </View>
                  <View style={styles.attendeeStack}>
                    {visible.map((p, i) => (
                      <View
                        key={p.id}
                        style={[styles.attendeeAvatar, { right: i * 16, zIndex: 10 - i }]}
                      >
                        <ProfileAvatar profile={p} size={24} />
                      </View>
                    ))}
                    {overflow > 0 && (
                      <View style={[styles.attendeeMore, { right: visible.length * 16, zIndex: 0 }]}>
                        <Text style={styles.attendeeMoreText}>+{overflow}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── Recent memories (NEW; hidden if empty) ─── */}
        {recentSquadMemories.length > 0 && (
          <View style={{ marginBottom: 22 }}>
            <View style={styles.crewHead}>
              <WashiTape color="coral" width={180} height={22} rotation={-1.5} style={{ left: -10, top: 12, opacity: 0.5 }} />
              <Text style={[styles.crewTitle, HAND_500 && { fontFamily: HAND_500 }]}>recent memories</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Scrapbook')} style={styles.seeAllAbsolute} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 14, paddingTop: 10, paddingBottom: 8, paddingRight: 22 }}
              style={{ marginHorizontal: -22, paddingHorizontal: 22 }}
            >
              {recentSquadMemories.map((m, i) => {
                const a = ACTIVITIES.find(x => x.id === m.activity_id);
                return (
                  <View key={m.id} style={{ width: 132 }}>
                    <Polaroid
                      photoUri={m.photo_url || null}
                      emoji={a?.emoji || '📸'}
                      title={m.caption || a?.name || 'A lime'}
                      subtitle={timeAgo(m.created_at)}
                      washiColor={MEMORY_WASHI[i % MEMORY_WASHI.length]}
                      tiltDeg={i % 2 === 0 ? -2 : 2}
                      onPress={() => navigation.navigate('Scrapbook')}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ─── "the crew" — lavender washi highlight ─── */}
        <View style={styles.crewHead}>
          <WashiTape color="lavender" width={140} height={22} rotation={-2} style={{ left: -10, top: 12, opacity: 0.7 }} />
          <Text style={[styles.crewTitle, HAND_500 && { fontFamily: HAND_500 }]}>the crew</Text>
        </View>

        {members.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>just you so far — invite the squad to start liming 🍋</Text>
            <Star size={14} color={COLORS.amber} opacity={0.5} style={{ left: 24, bottom: 18 }} />
            <Sparkle size={14} color={COLORS.palmGreen} opacity={0.55} style={{ right: 22, bottom: 22 }} />
          </View>
        ) : (
          <View style={styles.grid}>
            {members.map((m, i) => {
              const badgeCount = m.badges?.[0]?.count || m.patches?.[0]?.count || 0;
              const isMe = m.id === profile.id;
              const initial = (m.name || '?').trim().charAt(0).toUpperCase();
              return (
                <View key={m.id} style={styles.gridCell}>
                  <Polaroid
                    emoji={initial}
                    title={m.name}
                    subtitle={levelTitle(badgeCount)}
                    washiColor={POLAROID_WASHI[i % POLAROID_WASHI.length]}
                    tiltDeg={i % 2 === 0 ? -2 : 2}
                    pill={isMe ? 'you' : null}
                    onPress={() => {}}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* ─── Trending Limes (preserved — squad-reactions UI) ─── */}
        {trending.length > 0 && (
          <View style={{ marginTop: 22, marginBottom: 12 }}>
            <View style={styles.upcomingHead}>
              <WashiTape color="coral" width={170} height={22} rotation={-2.5} style={{ left: -8, top: 14, opacity: 0.55 }} />
              <Text style={[styles.crewTitle, HAND_500 && { fontFamily: HAND_500 }]}>trending limes 🔥</Text>
            </View>
            <Text style={styles.trendingSub}>most-reacted in the last 7 days</Text>
            {trending.map(({ activity, count }, i) => {
              const t = TIER[activity.tier] || { bg: COLORS.cream, text: COLORS.dark, label: '' };
              return (
                <TouchableOpacity
                  key={activity.id}
                  onPress={() => openActivity(activity)}
                  activeOpacity={0.85}
                  style={styles.trendingCard}
                >
                  <View style={styles.trendRank}>
                    <Text style={styles.trendRankText}>{i + 1}</Text>
                  </View>
                  <View style={[styles.trendEmoji, { backgroundColor: t.bg }]}>
                    <Text style={{ fontSize: 26 }}>{activity.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trendName} numberOfLines={1}>{activity.name}</Text>
                    <Text style={styles.trendMeta}>{t.label} · {count} {count === 1 ? 'reaction' : 'reactions'}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Bottom-of-page decorative accents */}
        <View pointerEvents="none" style={styles.bottomAccents}>
          <Heart size={12} color={COLORS.coral} opacity={0.45} style={{ left: 18, top: 0 }} />
          <Sparkle size={14} color={COLORS.amber} opacity={0.55} style={{ right: 30, top: 10 }} />
          <Star size={11} color={COLORS.palmGreen} opacity={0.5} style={{ left: '45%', top: 22 }} />
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
  scroll: { padding: 22, paddingBottom: 48 },

  // Header
  header: { marginBottom: 22 },
  titleRow: { position: 'relative', flexDirection: 'row', alignItems: 'center', height: 46 },
  title: { fontSize: 32, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 42 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },

  // Invite card — mint pastel
  inviteCard: {
    backgroundColor: PASTELS.mintBg,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 26,
    position: 'relative',
    overflow: 'visible',
  },
  palmSticker: {
    position: 'absolute',
    right: -10, bottom: -14,
    fontSize: 36,
    transform: [{ rotate: '-5deg' }],
  },
  inviteEmoji: { fontSize: 36, marginBottom: 4 },
  inviteTitle: { color: COLORS.dark, fontSize: 30, marginBottom: 4, letterSpacing: -0.4, lineHeight: 36 },
  inviteSub: { color: '#666', fontSize: 13, marginBottom: 16, textAlign: 'center' },

  linkBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 14,
    width: '100%',
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  linkText: { color: '#444', fontSize: 12, textAlign: 'center' },

  inviteBtns: { flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' },
  copyBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8704F',
  },
  copyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
  shareBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  shareBtnText: { color: COLORS.dark, fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
  shareArrow: { color: COLORS.dark, fontSize: 14, fontWeight: '700' },

  // Crew strip
  miniHeader: { fontSize: 12, fontWeight: '700', color: '#888', letterSpacing: 1.5, marginBottom: 10 },
  crewTile: { width: 64, alignItems: 'center' },
  crewName: { fontSize: 11, color: COLORS.dark, marginTop: 6, maxWidth: 64, textAlign: 'center' },

  // Section headers (highlighter look)
  upcomingHead: { position: 'relative', alignSelf: 'flex-start', height: 46, justifyContent: 'center', paddingHorizontal: 4, marginBottom: 10 },
  crewHead: { position: 'relative', alignSelf: 'stretch', height: 46, justifyContent: 'center', paddingHorizontal: 4, marginBottom: 12 },
  crewTitle: { fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 36 },
  seeAllAbsolute: { position: 'absolute', right: 0, top: 18 },
  seeAllText: { color: COLORS.coral, fontSize: 13, fontWeight: '700' },

  // Upcoming together cards
  upcomingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  upcomingEmoji: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  upcomingName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  upcomingMeta: { fontSize: 12, color: '#888', marginTop: 2 },

  attendeeStack: { width: 72, height: 28, position: 'relative' },
  attendeeAvatar: {
    position: 'absolute', top: 0,
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: COLORS.cream,
  },
  attendeeMore: {
    position: 'absolute', top: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F0EAD8',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  attendeeMoreText: { fontSize: 10, color: '#666', fontWeight: '700' },

  upcomingEmpty: {
    backgroundColor: '#fff', borderRadius: 18, padding: 22,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', marginBottom: 22,
    position: 'relative',
  },
  upcomingEmptyText: { color: '#888', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },

  // Trending limes (preserved)
  trendingSub: { fontSize: 12, color: '#999', marginTop: 2, marginBottom: 12 },
  trendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1,
  },
  trendRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.coral, alignItems: 'center', justifyContent: 'center' },
  trendRankText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  trendEmoji: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  trendName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  trendMeta: { fontSize: 11, color: '#888', marginTop: 3 },
  chevron: { color: '#ccc', fontSize: 22 },

  // The crew grid + empty state
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 },
  gridCell: { width: '47%' },

  emptyCard: {
    backgroundColor: PASTELS.lavenderBg,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#555', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  bottomAccents: { height: 50, marginTop: 18, position: 'relative' },
});
