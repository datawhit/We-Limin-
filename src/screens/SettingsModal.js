import React, { useContext, useEffect, useState } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { COLORS } from '../lib/constants';
import EditProfileModal from './EditProfileModal';

const NOTIF_KEY = 'lime_notification_prefs';
const DEFAULT_PREFS = { push: true, memoryReactions: true, weeklyReminder: true };

export default function SettingsModal({ visible, onClose, onOpenAvailability }) {
  const { profile, logout } = useContext(AppContext);
  const accent = profile?.accent_color || COLORS.coral;

  const [editOpen, setEditOpen] = useState(false);
  const [editFocus, setEditFocus] = useState('profile');
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(NOTIF_KEY)
      .then(raw => { if (raw) setPrefs(JSON.parse(raw)); })
      .catch(() => {});
  }, [visible]);

  const togglePref = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try { await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch {}
  };

  const openEdit = (focus) => {
    setEditFocus(focus);
    setEditOpen(true);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log out?',
      "You'll go back to setup. Your local profile and custom activities will be cleared from this device.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: async () => {
          onClose();
          await logout();
        }},
      ]
    );
  };

  if (!profile) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Settings</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 60 }}>
          {/* Identity card */}
          <View style={styles.idCard}>
            <ProfileAvatar profile={profile} size={64} ringColor={accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.idName}>{profile.name}</Text>
              <Text style={styles.idSub}>{profile.expression ? labelFor(profile.expression) : 'Profile'}</Text>
            </View>
          </View>

          {/* Profile group */}
          <Text style={styles.groupLabel}>Profile</Text>
          <View style={styles.group}>
            <SettingsRow
              icon="👤"
              title="Edit profile"
              sub="Name, photo, expression, color"
              onPress={() => openEdit('profile')}
            />
            <Divider />
            <SettingsRow
              icon="🎨"
              title="Edit avatar"
              sub="Skin, hair, fit, extras"
              onPress={() => openEdit('avatar')}
            />
            <Divider />
            <SettingsRow
              icon="📅"
              title="Update my week"
              sub="Tap free slots so the squad can plan"
              onPress={() => onOpenAvailability?.()}
            />
          </View>

          {/* Notifications */}
          <Text style={styles.groupLabel}>Notifications</Text>
          <View style={styles.group}>
            <SettingsRow
              icon="🔔"
              title="Notification preferences"
              sub={notifOpen ? 'Tap to collapse' : 'Push, reactions, reminders'}
              onPress={() => setNotifOpen(o => !o)}
              trailing={<Text style={styles.chevron}>{notifOpen ? '▲' : '▼'}</Text>}
            />
            {notifOpen && (
              <View style={styles.notifBlock}>
                <NotifToggle
                  label="Push notifications"
                  sub="Get pinged when squad stuff happens"
                  value={prefs.push}
                  onChange={() => togglePref('push')}
                  accent={accent}
                />
                <Divider />
                <NotifToggle
                  label="Memory reactions"
                  sub="When someone comments on your post"
                  value={prefs.memoryReactions}
                  onChange={() => togglePref('memoryReactions')}
                  accent={accent}
                />
                <Divider />
                <NotifToggle
                  label="Weekly availability reminder"
                  sub="Monday morning nudge"
                  value={prefs.weeklyReminder}
                  onChange={() => togglePref('weeklyReminder')}
                  accent={accent}
                />
              </View>
            )}
          </View>

          {/* Account */}
          <Text style={styles.groupLabel}>Account</Text>
          <View style={styles.group}>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutRow}>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.versionText}>We Limin' · v1.0</Text>
        </ScrollView>

        <EditProfileModal
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          initialFocus={editFocus}
        />
      </SafeAreaView>
    </Modal>
  );
}

function SettingsRow({ icon, title, sub, onPress, trailing }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {trailing ?? <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

function NotifToggle({ label, sub, value, onChange, accent }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: accent, false: '#e0d9c8' }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Divider() { return <View style={styles.divider} />; }

function labelFor(expression) {
  if (expression === 'feminine')  return 'Feminine';
  if (expression === 'masculine') return 'Masculine';
  return 'Non-binary';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, paddingBottom: 10 },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  close: { fontSize: 14, color: '#888', fontWeight: '600' },

  idCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 28, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  idName: { fontSize: 18, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.3 },
  idSub: { fontSize: 12, color: '#999', marginTop: 4 },

  groupLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  group: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: 28 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f0e8', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  rowSub: { fontSize: 12, color: '#999', marginTop: 3 },
  chevron: { color: '#bbb', fontSize: 18 },

  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 66 },

  notifBlock: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', backgroundColor: '#faf7f0' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.1 },
  toggleSub: { fontSize: 11, color: '#999', marginTop: 3 },

  logoutRow: { padding: 16, alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#d4475c', letterSpacing: 0.2 },

  versionText: { textAlign: 'center', color: '#bbb', fontSize: 11, marginTop: 12 },
});
