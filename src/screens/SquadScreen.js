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
import { COLORS, levelTitle, ACTIVITIES, TIER } from '../lib/constants';
import { getAllMembers, getTrendingActivities, getUserActivities } from '../lib/supabase';

const INVITE_LINK = 'https://welimin.app/join/squad';

export default function SquadScreen() {
  const { profile } = useContext(AppContext);
  const navigation = useNavigation();
  const [members, setMembers] = useState([]);
  const [trending, setTrending] = useState([]); // [{ activity, count }]
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#FFFFFF';

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
      >
        <View style={styles.header}>
          <Text style={styles.title}>Squad</Text>
          <Text style={styles.subtitle}>{members.length} {members.length === 1 ? 'member' : 'members'} liming</Text>
        </View>

        {/* Invite Card */}
        <View style={styles.inviteCard}>
          <Text style={styles.inviteEmoji}>🔗</Text>
          <Text style={styles.inviteTitle}>Bring someone in</Text>
          <Text style={styles.inviteSub}>The more the merrier — share the link</Text>

          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>{INVITE_LINK}</Text>
          </View>

          <View style={styles.inviteBtns}>
            <TouchableOpacity onPress={copyInvite} style={[styles.inviteBtn, { backgroundColor: accent }]}>
              <Text style={[styles.inviteBtnText, { color: accentText }]}>
                {copied ? 'Copied ✓' : 'Copy link'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareInvite} style={[styles.inviteBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.inviteBtnText, { color: '#fff' }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trending Limes — top 3 by 🔥 + 🙌 reactions in last 7 days */}
        {trending.length > 0 && (
          <View style={{ marginBottom: 22 }}>
            <Text style={styles.sectionTitle}>🔥 Trending Limes</Text>
            <Text style={styles.trendingSub}>Most-reacted in the last 7 days</Text>
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

        {/* Members */}
        <Text style={styles.sectionTitle}>The crew</Text>

        {members.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>Just you so far — invite the squad</Text>
          </View>
        ) : (
          members.map(m => {
            const badgeCount = m.badges?.[0]?.count || m.patches?.[0]?.count || 0;
            const isMe = m.id === profile.id;
            const mAccent = m.accent_color || COLORS.coral;
            return (
              <View key={m.id} style={styles.memberCard}>
                <ProfileAvatar profile={m} size={64} ringColor={mAccent} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    {isMe && (
                      <View style={[styles.youPill, { backgroundColor: accent }]}>
                        <Text style={[styles.youPillText, { color: accentText }]}>you</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.memberLevel, { color: mAccent }]}>{levelTitle(badgeCount)}</Text>
                  <Text style={styles.memberStats}>
                    {badgeCount} {badgeCount === 1 ? 'badge' : 'badges'} · {ACTIVITIES.length - badgeCount} to go
                  </Text>
                </View>
                <View style={[styles.badgeCountBox, { backgroundColor: mAccent }]}>
                  <Text style={[styles.badgeCount, { color: m.accent_text || '#FFFFFF' }]}>{badgeCount}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 22, paddingBottom: 48 },
  header: { marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: '#999', marginTop: 6 },

  inviteCard: { backgroundColor: COLORS.dark, borderRadius: 26, padding: 28, alignItems: 'center', marginBottom: 28 },
  inviteEmoji: { fontSize: 36, marginBottom: 10 },
  inviteTitle: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 6, letterSpacing: -0.3 },
  inviteSub: { color: '#888', fontSize: 13, marginBottom: 18, textAlign: 'center' },
  linkBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 14, width: '100%' },
  linkText: { color: '#ccc', fontSize: 12, textAlign: 'center' },
  inviteBtns: { flexDirection: 'row', gap: 8, marginTop: 14, width: '100%' },
  inviteBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  inviteBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

  sectionTitle: { fontSize: 19, fontWeight: '700', color: COLORS.dark, marginBottom: 6, letterSpacing: -0.3 },
  trendingSub: { fontSize: 12, color: '#999', marginBottom: 12 },
  trendingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.cardBorder },
  trendRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.coral, alignItems: 'center', justifyContent: 'center' },
  trendRankText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  trendEmoji: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  trendName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  trendMeta: { fontSize: 11, color: '#888', marginTop: 3 },
  chevron: { color: '#ccc', fontSize: 22 },

  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  memberName: { fontSize: 16, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  memberLevel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  memberStats: { fontSize: 11, color: '#999', marginTop: 3 },
  youPill: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  youPillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  badgeCountBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeCount: { fontWeight: '700', fontSize: 18 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyText: { color: '#aaa', fontSize: 13 },
});
