import React, { useContext, useEffect, useState } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../lib/AppContext';
import { COLORS } from '../lib/constants';
import { PASTELS, HANDWRITTEN_500 } from '../lib/theme';
import { Star, Sparkle, CurvedArrow } from '../components/Doodles';

const NOTIF_KEY = 'lime_notification_prefs';
const DEFAULT_PREFS = { push: true, memoryReactions: true, weeklyReminder: true };

export default function SettingsModal({ visible, onClose, onOpenAvailability }) {
  // ─── PRESERVED: hooks, state, logout handler, notif prefs ───
  const { profile, logout } = useContext(AppContext);
  const accent = profile?.accent_color || COLORS.coral;
  const insets = useSafeAreaInsets();

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [notifOpen, setNotifOpen] = useState(false);

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

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

  // Preserved: Alert confirm → supabase.auth.signOut() (inside logout) →
  // AsyncStorage.clear() (inside logout) → AppContext reset (setProfile(null))
  // → app shell renders SetupScreen.
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

  const comingSoon = (label) => () => Alert.alert(label, `${label} coming soon 🍋`);

  if (!profile) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* ─── Header — pinned outside ScrollView, safe-area-padded ─── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerBtn}
          >
            <Text style={styles.chev}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.topTitle, HAND_500 && { fontFamily: HAND_500 }]}>settings</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Scattered decorative accents (low opacity, non-blocking) */}
          <View pointerEvents="none" style={styles.scatterTop}>
            <Sparkle size={14} color={COLORS.coral}     opacity={0.5}  style={{ left: 8, top: 0 }} />
            <Star    size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ right: 12, top: 4 }} />
          </View>

          {/* ─── APP ─── */}
          <Text style={styles.groupLabel}>app</Text>

          <SettingsRow
            emoji="🎨"
            emojiBg={PASTELS.lavenderBg}
            title="theme"
            subtitle="customize your vibe"
            trailingPill="coming soon"
            onPress={comingSoon('Theme presets')}
          />
          <SettingsRow
            emoji="🔔"
            emojiBg={PASTELS.amberBg}
            title="notifications"
            subtitle="push, reactions, reminders"
            onPress={() => setNotifOpen(o => !o)}
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
          <SettingsRow
            emoji="🔒"
            emojiBg={PASTELS.mintBg}
            title="privacy"
            subtitle="who can see your stuff"
            trailingPill="coming soon"
            onPress={comingSoon('Privacy controls')}
          />

          {/* ─── ABOUT ─── */}
          <Text style={[styles.groupLabel, { marginTop: 18 }]}>about</Text>
          <SettingsRow
            emoji="🍋"
            emojiBg={PASTELS.coralBg}
            title="about"
            subtitle="we limin' v1.0"
            onPress={() => Alert.alert("We Limin'", "v1.0\nLimin' season — summer 2026 🍋")}
          />

          {/* ─── ACCOUNT ─── */}
          <Text style={[styles.groupLabel, { marginTop: 18 }]}>account</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.destructiveBtn}>
            <Text style={[styles.destructiveText, { color: '#E24B4A' }]}>log out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={comingSoon('Account deletion — contact support to delete your account.')}
            style={[styles.destructiveBtn, { marginTop: 10 }]}
          >
            <Text style={[styles.destructiveText, { color: '#A6353F' }]}>delete account</Text>
          </TouchableOpacity>

          {/* Bottom-of-page decorative accents */}
          <View pointerEvents="none" style={styles.scatterBottom}>
            <CurvedArrow size={36} color={COLORS.coral}     opacity={0.4}  style={{ left: 24, top: 8, transform: [{ rotate: '110deg' }] }} />
            <Sparkle    size={12} color={COLORS.amber}     opacity={0.55} style={{ right: 30, top: 22 }} />
            <Star       size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: '50%', top: 40 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Settings row (uniform card) ──────────────────────────
function SettingsRow({ emoji, emojiBg, title, subtitle, trailingPill, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: emojiBg || PASTELS.amberBg }]}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {trailingPill ? (
        <View style={styles.comingPill}><Text style={styles.comingPillText}>{trailingPill}</Text></View>
      ) : (
        <Text style={styles.chevR}>›</Text>
      )}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },
  topTitle: { fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 34 },

  // Scroll
  scroll: { padding: 22, paddingBottom: 60, position: 'relative' },
  scatterTop: { height: 24, position: 'relative' },
  scatterBottom: { height: 70, marginTop: 18, position: 'relative' },

  // Group label
  groupLabel: { fontSize: 11, fontWeight: '500', color: '#888', letterSpacing: 2, marginBottom: 10, textTransform: 'lowercase' },

  // Per-row card
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 12,
    marginBottom: 10,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.2, textTransform: 'lowercase' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 3 },
  chevR: { color: '#bbb', fontSize: 22 },

  // "coming soon" pill on the right of a row
  comingPill: { backgroundColor: '#F0EAD8', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  comingPillText: { fontSize: 11, fontWeight: '600', color: '#888' },

  // Inline notif preferences block, appears under the notifications row
  notifBlock: {
    backgroundColor: '#FAF6EB',
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: 4,
    marginTop: -4, marginBottom: 10,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.1 },
  toggleSub: { fontSize: 11, color: '#999', marginTop: 3 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 14 },

  // Destructive (log out, delete account)
  destructiveBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  destructiveText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2, textTransform: 'lowercase' },
});
