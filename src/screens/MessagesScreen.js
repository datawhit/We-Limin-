import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { ACTIVITIES, COLORS, TIER } from '../lib/constants';
import {
  getInvitesReceived, getInvitesSent, setInviteStatus, markAllReceivedRead,
} from '../lib/supabase';

const INVITE_HEADING = 'What yuh for? Leh we lime!';

export default function MessagesScreen({ visible, onClose }) {
  const { profile } = useContext(AppContext);
  const insets = useSafeAreaInsets();

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

  const updateStatus = async (invite, status) => {
    setReceived(rs => rs.map(r => r.id === invite.id ? { ...r, status } : r));
    try { await setInviteStatus(invite.id, status); }
    catch (e) { Alert.alert('Oops', "Couldn't update the invite. Try again?"); load(); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerBtn}
          >
            <Text style={styles.chev}>‹</Text>
            <Text style={styles.headerLink}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Messages</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {[
            { id: 'received', label: 'Received', count: received.filter(r => r.status === 'pending').length },
            { id: 'sent',     label: 'Sent',     count: sent.length },
          ].map(t => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}{t.count > 0 ? ` · ${t.count}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dark} />}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.coral} style={{ marginTop: 40 }} />
          ) : tab === 'received' ? (
            received.length === 0 ? (
              <EmptyState
                emoji="🔔"
                title="No invites yet"
                sub="When the squad sends a lime your way, it'll land here."
              />
            ) : (
              received.map(inv => (
                <InviteRow
                  key={inv.id}
                  invite={inv}
                  outgoing={false}
                  onAccept={() => updateStatus(inv, 'accepted')}
                  onDecline={() => updateStatus(inv, 'declined')}
                />
              ))
            )
          ) : (
            sent.length === 0 ? (
              <EmptyState
                emoji="📤"
                title="No invites sent"
                sub="Tap an activity → Who's free → Send invite."
              />
            ) : (
              sent.map(inv => (
                <InviteRow key={inv.id} invite={inv} outgoing={true} />
              ))
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function InviteRow({ invite, outgoing, onAccept, onDecline }) {
  const activity = useMemo(
    () => ACTIVITIES.find(a => a.id === invite.activity_id) || { name: 'Activity', emoji: '🍋', tier: 'chill' },
    [invite.activity_id]
  );
  const t = TIER[activity.tier] || { bg: COLORS.cream, text: COLORS.dark, label: '' };
  const counterpart = outgoing ? invite.to_profile : invite.from_profile;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <ProfileAvatar profile={counterpart || {}} size={36} />
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={onDecline} style={styles.declineBtn}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onAccept} style={styles.acceptBtn}>
              <Text style={styles.acceptText}>Accept</Text>
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
    return <View style={[styles.statusBadge, { backgroundColor: '#D6F0DD' }]}><Text style={{ color: COLORS.palmGreen, fontWeight: '700', fontSize: 11 }}>Accepted ✓</Text></View>;
  if (status === 'declined')
    return <View style={[styles.statusBadge, { backgroundColor: '#F4D5DD' }]}><Text style={{ color: '#7c0024', fontWeight: '700', fontSize: 11 }}>Declined</Text></View>;
  return <View style={[styles.statusBadge, { backgroundColor: '#F0EAD8' }]}><Text style={{ color: '#888', fontWeight: '700', fontSize: 11 }}>Pending</Text></View>;
}

function EmptyState({ emoji, title, sub }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 60, minHeight: 44, gap: 2 },
  chev: { fontSize: 22, color: '#888', fontWeight: '500', lineHeight: 22, marginRight: 2 },
  headerLink: { fontSize: 14, color: '#888', fontWeight: '600' },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, marginBottom: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.cardBorder },
  tabActive: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  tabText: { fontSize: 13, fontWeight: '700', color: '#888' },
  tabTextActive: { color: COLORS.cream },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.cardBorder },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  cardTime: { fontSize: 11, color: '#aaa' },

  invHeading: { fontSize: 13, fontWeight: '500', color: '#888', marginBottom: 8 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityName: { fontSize: 17, fontWeight: '500', color: COLORS.dark, letterSpacing: -0.3 },

  timePill: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, marginTop: 8 },
  timePillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  note: { fontSize: 13, color: '#555', fontStyle: 'italic', marginTop: 10, lineHeight: 18 },

  footer: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end' },
  acceptBtn: { backgroundColor: COLORS.coral, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  acceptText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  declineBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  declineText: { color: '#888', fontSize: 13, fontWeight: '700' },

  statusBadge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, marginTop: 8, letterSpacing: -0.2 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center', paddingHorizontal: 32 },
});
