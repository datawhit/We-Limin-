import React, { useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { ACTIVITIES, COLORS, TIER } from '../lib/constants';
import {
  getInvitesReceived, getInvitesSent, setInviteStatus, markAllReceivedRead,
  supabase, getUserActivity,
} from '../lib/supabase';

// ─── Design system primitives ─────────────────────────────
import Polaroid from '../components/Polaroid';
import WashiTape from '../components/WashiTape';
import { Star, Sparkle, CurvedArrow } from '../components/Doodles';
import { HANDWRITTEN_500 } from '../lib/theme';

const INVITE_HEADING = 'What yuh for? Leh we lime!';
const WASHI_CYCLE = ['pink', 'blue', 'coral', 'lavender', 'amber'];
const TILT_CYCLE  = [-1, 1, -1.5, 1.5, -0.5];

export default function MessagesScreen({ visible, onClose }) {
  // ─── PRESERVED: all hooks, state, effects, fetch + accept/decline ───
  const { profile } = useContext(AppContext);
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const [tab, setTab] = useState('received'); // 'received' | 'sent'
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        getInvitesReceived(profile.id).catch(() => []),
        getInvitesSent(profile.id).catch(() => []),
      ]);
      setReceived(r);
      setSent(s);
    } catch (e) { /* table missing — show empty state */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!visible) return;
    load();
    // Mark everything in the Received tab as read once the user
    // opens the screen — the bell badge will clear on next refresh.
    markAllReceivedRead(profile.id).catch(() => {});
  }, [visible]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Per-invite in-flight flag so the Accept/Decline buttons can't be
  // double-tapped. Keyed by invite.id.
  const [pendingIds, setPendingIds] = useState({});
  const setPending = (id, v) => setPendingIds(p => ({ ...p, [id]: v }));

  // Toast for "you're in! ✨" and friends.
  const [toastText, setToastText] = useState(null);
  const toastY = useRef(new Animated.Value(-80)).current;
  const flashToast = (text) => {
    setToastText(text);
    toastY.setValue(-80);
    Animated.sequence([
      Animated.spring(toastY, { toValue: 12, useNativeDriver: true, friction: 6 }),
      Animated.delay(1700),
      Animated.timing(toastY, { toValue: -80, duration: 220, useNativeDriver: true }),
    ]).start(() => setToastText(null));
  };

  // Decline path — unchanged behavior, just adds in-flight guard.
  const declineInvite = async (invite) => {
    if (pendingIds[invite.id]) return;
    setPending(invite.id, true);
    setReceived(rs => rs.map(r => r.id === invite.id ? { ...r, status: 'declined' } : r));
    try { await setInviteStatus(invite.id, 'declined'); }
    catch (e) { Alert.alert('Oops', "Couldn't update the invite. Try again?"); load(); }
    setPending(invite.id, false);
  };

  // Accept path — updates invite, then writes to user_activities so
  // the activity shows up in the Lineup under the "squad plan" lens.
  const acceptInvite = async (invite) => {
    if (pendingIds[invite.id]) return;
    setPending(invite.id, true);
    setReceived(rs => rs.map(r => r.id === invite.id ? { ...r, status: 'accepted' } : r));
    try {
      await supabase
        .from('invites')
        .update({ status: 'accepted', read_at: new Date().toISOString() })
        .eq('id', invite.id);

      const existing = await getUserActivity(profile.id, invite.activity_id).catch(() => null);
      if (existing) {
        await supabase
          .from('user_activities')
          .update({
            source: 'squad_plan',
            status: 'planned',
            ...(invite.suggested_time ? { target_date: invite.suggested_time } : {}),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('user_activities').insert({
          profile_id: profile.id,
          activity_id: invite.activity_id,
          source: 'squad_plan',
          status: 'planned',
          ...(invite.suggested_time ? { target_date: invite.suggested_time } : {}),
        });
      }

      flashToast("you're in! ✨");
    } catch (e) {
      console.warn('[messages] acceptInvite failed:', e?.message || e);
      Alert.alert('Oops', "Couldn't accept the invite. Try again?");
      load();
    }
    setPending(invite.id, false);
  };

  const TABS = [
    { id: 'received', label: 'received', count: received.filter(r => r.status === 'pending').length },
    { id: 'sent',     label: 'sent',     count: sent.length },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Toast */}
        {!!toastText && (
          <Animated.View
            style={[styles.toast, { top: insets.top + 12, transform: [{ translateY: toastY }] }]}
            pointerEvents="none"
          >
            <Text style={styles.toastText}>{toastText}</Text>
          </Animated.View>
        )}

        {/* ─── Header (outside any ScrollView) ─── */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerBtn}
          >
            <Text style={styles.chev}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.title, HAND_500 && { fontFamily: HAND_500 }]}>messages</Text>
          <View style={styles.headerBtn} />
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map(t => {
            const on = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                activeOpacity={0.85}
                style={styles.tabWrap}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                {on && (
                  <WashiTape
                    color="amber"
                    width="78%"
                    height={14}
                    rotation={-2}
                    opacity={0.7}
                    style={{ top: 14, left: '11%' }}
                  />
                )}
                <View style={[styles.tab, on ? styles.tabOn : styles.tabOff]}>
                  <Text style={[styles.tabText, on ? styles.tabTextOn : styles.tabTextOff]}>
                    {t.label}{t.count > 0 ? ` · ${t.count}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 22, paddingBottom: 60, position: 'relative' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dark} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Page-edge doodles */}
          <Sparkle    size={14} color={COLORS.coral}     opacity={0.55} style={{ right: 6,  top: -4 }} />
          <Star       size={12} color={COLORS.palmGreen} opacity={0.5}  style={{ left:  -2, top: 8 }} />

          {loading ? (
            <ActivityIndicator color={COLORS.coral} style={{ marginTop: 40 }} />
          ) : tab === 'received' ? (
            received.length === 0 ? (
              <ScrapbookEmpty
                emoji="🔔"
                title="no invites yet"
                sub="when the squad sends a lime your way, it'll land here 🌴"
              />
            ) : (
              received.map((inv, i) => (
                <InviteCard
                  key={inv.id}
                  invite={inv}
                  outgoing={false}
                  pending={!!pendingIds[inv.id]}
                  index={i}
                  onAccept={() => acceptInvite(inv)}
                  onDecline={() => declineInvite(inv)}
                />
              ))
            )
          ) : (
            sent.length === 0 ? (
              <ScrapbookEmpty
                emoji="📤"
                title="no invites sent"
                sub="tap an activity → who's free? → send invite 🌿"
              />
            ) : (
              sent.map((inv, i) => (
                <InviteCard
                  key={inv.id}
                  invite={inv}
                  outgoing={true}
                  index={i}
                />
              ))
            )
          )}

          {/* Bottom decorative */}
          <View pointerEvents="none" style={styles.bottomAccents}>
            <Sparkle    size={12} color={COLORS.amber}     opacity={0.55} style={{ left: 30,  top: 0 }} />
            <CurvedArrow size={32} color={COLORS.coral}    opacity={0.45} style={{ right: 28, top: 8, transform: [{ rotate: '110deg' }] }} />
            <Star       size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: '52%', top: 22 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Empty state — polaroid frame with washi + scattered doodles ───
function ScrapbookEmpty({ emoji, title, sub }) {
  return (
    <View style={styles.emptyWrap}>
      <Star    size={16} color={COLORS.amber}     opacity={0.5} style={{ left: 24, top: 10 }} />
      <Sparkle size={14} color={COLORS.palmGreen} opacity={0.6} style={{ right: 30, top: 24 }} />
      <Sparkle size={12} color={COLORS.coral}     opacity={0.55} style={{ left: 36, bottom: 70 }} />
      <Star    size={12} color={COLORS.coral}     opacity={0.5} style={{ right: 40, bottom: 50 }} />

      <View style={styles.emptyPolaroidSlot}>
        <Polaroid
          emoji={emoji}
          title={title}
          subtitle={sub}
          washiColor="coral"
          tiltDeg={-2}
        />
      </View>
    </View>
  );
}

// ─── Invite card — white polaroid with cycling washi + restyled buttons ───
function InviteCard({ invite, outgoing, onAccept, onDecline, pending = false, index = 0 }) {
  const activity = useMemo(
    () => ACTIVITIES.find(a => a.id === invite.activity_id) || { name: 'Activity', emoji: '🍋', tier: 'chill' },
    [invite.activity_id]
  );
  const t = TIER[activity.tier] || { bg: COLORS.cream, text: COLORS.dark, label: '' };
  const counterpart = outgoing ? invite.to_profile : invite.from_profile;

  const washi = WASHI_CYCLE[index % WASHI_CYCLE.length];
  const tilt  = TILT_CYCLE[index % TILT_CYCLE.length];

  return (
    <View style={[styles.card, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <WashiTape color={washi} width="48%" height={14} rotation={-3} opacity={0.85} style={{ top: -6, left: '26%' }} />

      <View style={styles.cardHead}>
        <ProfileAvatar profile={counterpart || {}} size={36} ringColor={COLORS.coral} ringWidth={1.5} />
        <Text style={styles.cardName} numberOfLines={1}>
          {counterpart?.name || 'Someone'}
        </Text>
        <Text style={styles.cardTime}>{timeAgo(invite.created_at)}</Text>
      </View>

      <Text style={styles.invHeading}>{INVITE_HEADING}</Text>

      <View style={styles.activityRow}>
        <Text style={{ fontSize: 24 }}>{activity.emoji}</Text>
        <Text style={styles.activityName}>{activity.name}</Text>
      </View>

      {!!invite.suggested_time && (
        <View style={[styles.timePill, { backgroundColor: t.bg }]}>
          <Text style={[styles.timePillText, { color: t.text }]}>{invite.suggested_time}</Text>
        </View>
      )}

      {!!invite.custom_message && (
        <Text style={styles.note}>"{invite.custom_message}"</Text>
      )}

      <View style={styles.footer}>
        {outgoing ? (
          <StatusBadge status={invite.status} />
        ) : invite.status === 'pending' ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onDecline}
              disabled={pending}
              style={[styles.declineBtn, pending && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              <Text style={styles.declineText}>decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAccept}
              disabled={pending}
              style={[styles.acceptBtn, pending && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              {pending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.acceptText}>accept ✨</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <StatusBadge status={invite.status} />
        )}
      </View>
    </View>
  );
}

function StatusBadge({ status }) {
  if (status === 'accepted')
    return <View style={[styles.statusBadge, { backgroundColor: '#D6F0DD' }]}><Text style={{ color: COLORS.palmGreen, fontWeight: '700', fontSize: 11 }}>accepted ✓</Text></View>;
  if (status === 'declined')
    return <View style={[styles.statusBadge, { backgroundColor: '#F4D5DD' }]}><Text style={{ color: '#7c0024', fontWeight: '700', fontSize: 11 }}>declined</Text></View>;
  return <View style={[styles.statusBadge, { backgroundColor: '#F0EAD8' }]}><Text style={{ color: '#888', fontWeight: '700', fontSize: 11 }}>pending</Text></View>;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },
  title: { fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 34, textTransform: 'lowercase' },

  // Tab pills
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginTop: 4, marginBottom: 6 },
  tabWrap: { position: 'relative', justifyContent: 'center' },
  tab: {
    height: 38, borderRadius: 19,
    paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 96,
  },
  tabOn:  { backgroundColor: '#E8704F' },
  tabOff: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EBE2D0' },
  tabText: { fontSize: 13, letterSpacing: 0.1, textTransform: 'lowercase' },
  tabTextOn:  { color: '#fff', fontWeight: '500' },
  tabTextOff: { color: COLORS.dark, fontWeight: '400' },

  // Invite card — polaroid-style
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 4 },
  cardName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.2, textTransform: 'lowercase' },
  cardTime: { fontSize: 11, color: '#aaa' },

  invHeading: { fontSize: 13, fontWeight: '500', color: '#888', marginBottom: 8 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityName: { fontSize: 17, fontWeight: '500', color: COLORS.dark, letterSpacing: -0.3 },

  timePill: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, marginTop: 8 },
  timePillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, textTransform: 'lowercase' },

  note: { fontSize: 13, color: '#555', fontStyle: 'italic', marginTop: 10, lineHeight: 18 },

  // Footer buttons — side by side, equal weight
  footer: { marginTop: 14 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  declineBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#EBE2D0',
    paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  declineText: { color: COLORS.dark, fontSize: 13, fontWeight: '500', textTransform: 'lowercase' },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#E8704F',
    paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptText: { color: '#fff', fontSize: 13, fontWeight: '600', textTransform: 'lowercase' },

  statusBadge: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },

  // Empty state — polaroid + scattered doodles
  emptyWrap: {
    minHeight: 360,
    paddingVertical: 32,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  emptyPolaroidSlot: { width: '70%' },

  // Toast
  toast: {
    position: 'absolute', left: 22, right: 22, zIndex: 9999, elevation: 10,
    backgroundColor: COLORS.dark, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
  },
  toastText: { color: COLORS.cream, fontSize: 14, fontWeight: '700', textAlign: 'center' },

  // Bottom decorative
  bottomAccents: { height: 50, marginTop: 18, position: 'relative' },
});
