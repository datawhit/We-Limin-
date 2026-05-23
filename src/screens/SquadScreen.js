import React, { useContext, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { useNavigation } from '@react-navigation/native';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { COLORS, levelTitle, ACTIVITIES, TIER } from '../lib/constants';
import { getAllMembers, getTrendingActivities, getUserActivities } from '../lib/supabase';

// ─── Design system primitives ─────────────────────────────
import Polaroid from '../components/Polaroid';
import WashiTape from '../components/WashiTape';
import { Star, Heart, Sparkle, CurvedArrow } from '../components/Doodles';
import { PASTELS, HANDWRITTEN_500 } from '../lib/theme';

const INVITE_LINK = 'https://welimin.app/join/squad';

// Washi color cycle for member polaroids — matches Home's lineup.
const POLAROID_WASHI = ['pink', 'blue', 'coral', 'lavender', 'amber'];

export default function SquadScreen() {
  // ─── PRESERVED: all hooks, state, handlers, data wiring ───
  const { profile } = useContext(AppContext);
  const navigation = useNavigation();
  const [members, setMembers] = useState([]);
  const [trending, setTrending] = useState([]); // [{ activity, count }]
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#FFFFFF';

  // Handwritten font for headlines — falls back to system if not loaded.
  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const load = async () => {
    try {
      const all = await getAllMembers();
      setMembers(all);
    } catch (e) { console.error(e); }

    // Trending Limes — top 3 activities by 🔥 + 🙌 in the last 7 days.
    // Resolve activity_id → full activity object using the seed list
    // plus any user-created activities.
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
  };

  const openActivity = (activity) => {
    // Use the root-stack modal so this works from inside the Squad tab.
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
            <Sparkle size={22} color={COLORS.palmGreen} opacity={0.85} style={{ left: 8, top: 6 }} />
            {/* Scattered accents on the header area */}
            <Star size={12} color={COLORS.coral} opacity={0.55} style={{ right: 8, top: 0 }} />
            <Heart size={11} color={COLORS.amber} opacity={0.6} style={{ right: 32, top: 28 }} />
          </View>
          <Text style={styles.subtitle}>
            {members.length} {members.length === 1 ? 'member' : 'members'} liming
          </Text>
        </View>

        {/* ─── Invite card — mint pastel, washi-taped ─── */}
        <View style={styles.inviteCard}>
          <WashiTape color="amber" width="40%" height={16} rotation={-3} style={{ top: -8, left: '30%' }} />

          {/* Floating palm sticker, top-right outside the content area */}
          <Text style={styles.palmSticker}>🌴</Text>

          {/* Decorative doodles around the card */}
          <Sparkle size={14} color={COLORS.coral} opacity={0.7} style={{ left: 18, top: 18 }} />
          <Heart size={12} color="#D4475C" opacity={0.5} style={{ right: 26, bottom: 18 }} />

          <Text style={styles.inviteEmoji}>🔗</Text>
          <Text style={[styles.inviteTitle, HAND_500 && { fontFamily: HAND_500 }]}>bring someone in</Text>
          <Text style={styles.inviteSub}>the more the merrier — share the link</Text>

          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{INVITE_LINK}</Text>
          </View>

          <View style={styles.inviteBtns}>
            <TouchableOpacity onPress={copyInvite} style={styles.copyBtn}>
              <Text style={styles.copyBtnText}>
                {copied ? 'copied ✓' : 'copy link'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareInvite} style={styles.shareBtn}>
              <Text style={styles.shareBtnText}>share</Text>
              <Text style={styles.shareArrow}>↗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Trending Limes ─── */}
        {trending.length > 0 && (
          <View style={{ marginBottom: 22 }}>
            <View style={styles.trendingHead}>
              <WashiTape color="coral" width={150} height={18} rotation={-2.5} style={{ left: -6, top: 18, opacity: 0.55 }} />
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

        {/* ─── "the crew" — lavender washi highlight ─── */}
        <View style={styles.crewHead}>
          <WashiTape color="lavender" width={140} height={22} rotation={-2} style={{ left: -10, top: 12, opacity: 0.7 }} />
          <Text style={[styles.crewTitle, HAND_500 && { fontFamily: HAND_500 }]}>the crew</Text>
        </View>

        {members.length === 0 ? (
          <View style={styles.emptyCard}>
            <CurvedArrow size={56} color={COLORS.coral} opacity={0.7} style={{ right: 24, top: 8, transform: [{ rotate: '-180deg' }] }} />
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>just you so far — invite the squad</Text>
            <Star size={14} color={COLORS.amber} opacity={0.55} style={{ left: 22, bottom: 18 }} />
            <Sparkle size={14} color={COLORS.palmGreen} opacity={0.6} style={{ right: 22, bottom: 24 }} />
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

        {/* Bottom-of-page decorative accents */}
        <View style={styles.bottomAccents} pointerEvents="none">
          <Heart size={12} color={COLORS.coral} opacity={0.45} style={{ left: 18, top: 0 }} />
          <Sparkle size={14} color={COLORS.amber} opacity={0.55} style={{ right: 30, top: 10 }} />
          <Star size={11} color={COLORS.palmGreen} opacity={0.5} style={{ left: '45%', top: 22 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: 22, paddingBottom: 48 },

  // Header
  header: { marginBottom: 22 },
  titleRow: { position: 'relative', flexDirection: 'row', alignItems: 'center', height: 48 },
  title: { fontSize: 36, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 46 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 4 },

  // Invite card — mint pastel with washi tape + palm sticker
  inviteCard: {
    backgroundColor: PASTELS.mintBg,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    position: 'relative',
    overflow: 'visible',
  },
  palmSticker: {
    position: 'absolute',
    top: -14, right: -8,
    fontSize: 34,
    transform: [{ rotate: '5deg' }],
  },
  inviteEmoji: { fontSize: 36, marginBottom: 6 },
  inviteTitle: { color: COLORS.dark, fontSize: 28, marginBottom: 4, letterSpacing: -0.4, lineHeight: 34 },
  inviteSub: { color: '#666', fontSize: 13, marginBottom: 18, textAlign: 'center' },

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
  copyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  shareBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  shareBtnText: { color: COLORS.dark, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  shareArrow: { color: COLORS.dark, fontSize: 14, fontWeight: '700' },

  // Trending section
  trendingHead: { position: 'relative', alignSelf: 'flex-start', height: 40, justifyContent: 'center', paddingHorizontal: 4 },
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

  // "the crew" section header — lavender highlighter feel
  crewHead: { position: 'relative', alignSelf: 'flex-start', height: 44, justifyContent: 'center', paddingHorizontal: 4, marginBottom: 14 },
  crewTitle: { fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 34 },

  // Empty state — lavender Polaroid-style frame, dashed border
  emptyCard: {
    backgroundColor: PASTELS.lavenderBg,
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 14 },
  emptyText: { color: '#555', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  // Member grid — when the crew exists, render as small polaroids
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 },
  gridCell: { width: '47%' },

  bottomAccents: { height: 50, marginTop: 22, position: 'relative' },
});
