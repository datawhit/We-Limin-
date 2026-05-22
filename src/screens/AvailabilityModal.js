import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../lib/AppContext';
import { COLORS } from '../lib/constants';
import { saveAvailability, getWeekAvailability } from '../lib/supabase';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = [
  { id: 'morning',   emoji: '☀️',  label: 'AM'  },
  { id: 'afternoon', emoji: '🌤️', label: 'Noon' },
  { id: 'evening',   emoji: '🌙',  label: 'PM'  },
];

export function getMondayOfThisWeek() {
  const now = new Date();
  const dow = now.getDay();              // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  const m = new Date(now);
  m.setDate(now.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

export function weekStartISO(monday) {
  return monday.toISOString().slice(0, 10);
}

export function isMondayToday() {
  return new Date().getDay() === 1;
}

function formatRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}`;
}

export default function AvailabilityModal({ visible, onClose }) {
  const { profile } = useContext(AppContext);
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#2d5a00';

  const monday = useMemo(() => getMondayOfThisWeek(), [visible]);
  const weekStart = weekStartISO(monday);

  const [mySlots, setMySlots] = useState({});
  const [squad, setSquad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    load();
  }, [visible]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getWeekAvailability(weekStart);
      setSquad(data);
      const mine = data.find(d => d.profile_id === profile.id);
      setMySlots(mine?.slots || {});
    } catch (e) {
      console.warn('[lime] availability load failed:', e?.message || e);
    }
    setLoading(false);
  };

  const toggle = (day, slot) => {
    setMySlots(prev => {
      const dayList = prev[day] || [];
      const has = dayList.includes(slot);
      const next = has ? dayList.filter(s => s !== slot) : [...dayList, slot];
      return { ...prev, [day]: next };
    });
  };

  const isOn = (day, slot) => (mySlots[day] || []).includes(slot);

  const save = async () => {
    setSaving(true);
    try {
      await saveAvailability({ profileId: profile.id, weekStart, slots: mySlots });
      onClose();
    } catch (e) {
      Alert.alert('Oops', 'Could not save your availability. Try again?');
    }
    setSaving(false);
  };

  // Build day×slot → [member names] for the overlap view, using local edits
  // for the current user so the squad view updates as they tap.
  const overlap = useMemo(() => {
    const grouped = {};
    DAYS.forEach(d => { grouped[d] = { morning: [], afternoon: [], evening: [] }; });
    const merged = squad.map(m =>
      m.profile_id === profile.id
        ? { ...m, slots: mySlots, profiles: { name: profile.name } }
        : m
    );
    const hasMe = merged.some(m => m.profile_id === profile.id);
    if (!hasMe) merged.push({ profile_id: profile.id, slots: mySlots, profiles: { name: profile.name } });
    merged.forEach(member => {
      const slots = member.slots || {};
      DAYS.forEach(d => {
        (slots[d] || []).forEach(slot => {
          if (grouped[d][slot] !== undefined) {
            grouped[d][slot].push(member.profiles?.name || 'someone');
          }
        });
      });
    });
    return grouped;
  }, [squad, mySlots, profile.id, profile.name]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>📅 This week</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <Text style={styles.range}>{formatRange(monday)}</Text>
          <Text style={styles.sub}>Tap when you free — just for this week, no recurring</Text>

          {loading ? (
            <ActivityIndicator color={COLORS.dark} style={{ marginTop: 32 }} />
          ) : (
            <>
              {/* Grid */}
              <View style={styles.gridCard}>
                <View style={styles.gridHeaderRow}>
                  <View style={{ width: 44 }} />
                  {SLOTS.map(s => (
                    <View key={s.id} style={styles.gridHeaderCell}>
                      <Text style={styles.gridHeaderEmoji}>{s.emoji}</Text>
                      <Text style={styles.gridHeaderLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
                {DAYS.map(d => (
                  <View key={d} style={styles.gridRow}>
                    <Text style={styles.dayLabel}>{d}</Text>
                    {SLOTS.map(s => {
                      const on = isOn(d, s.id);
                      const all = overlap[d]?.[s.id] || [];
                      const others = all.filter(n => n !== profile.name).length;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          onPress={() => toggle(d, s.id)}
                          style={[
                            styles.cell,
                            { backgroundColor: on ? accent : '#fff', borderColor: on ? accent : COLORS.border },
                          ]}
                        >
                          {on ? (
                            <Text style={[styles.cellTick, { color: accentText }]}>✓</Text>
                          ) : others > 0 ? (
                            <Text style={styles.cellOthers}>+{others}</Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
                <Text style={styles.legend}>+N = squad members also free</Text>
              </View>

              {/* Squad this week */}
              <Text style={styles.sectionTitle}>Squad this week 👥</Text>
              {(() => {
                const cards = DAYS
                  .map(d => {
                    const day = overlap[d] || {};
                    const hasAny = SLOTS.some(s => (day[s.id] || []).length > 0);
                    if (!hasAny) return null;
                    return (
                      <View key={d} style={styles.overlapCard}>
                        <Text style={styles.overlapDay}>{d}</Text>
                        {SLOTS.map(s => {
                          const names = (day[s.id] || []);
                          if (!names.length) return null;
                          return (
                            <View key={s.id} style={styles.overlapRow}>
                              <Text style={styles.overlapSlot}>{s.emoji} {s.id}</Text>
                              <Text style={styles.overlapNames} numberOfLines={2}>{names.join(', ')}</Text>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                  .filter(Boolean);
                return cards.length
                  ? cards
                  : <Text style={styles.emptySquad}>Nobody set their week yet. Be the first 🍋</Text>;
              })()}
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: accent, opacity: saving ? 0.7 : 1 }]}>
            <Text style={[styles.saveText, { color: accentText }]}>
              {saving ? 'Saving...' : '🍋 Save my week'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, paddingBottom: 8 },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  closeText: { fontSize: 14, color: '#888', fontWeight: '600' },

  range: { fontSize: 28, fontWeight: '700', color: COLORS.dark, marginBottom: 6, letterSpacing: -0.6 },
  sub: { fontSize: 13, color: '#999', marginBottom: 24 },

  gridCard: { backgroundColor: '#fff', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', marginBottom: 28 },
  gridHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 6 },
  gridHeaderCell: { flex: 1, alignItems: 'center' },
  gridHeaderEmoji: { fontSize: 16 },
  gridHeaderLabel: { fontSize: 10, color: '#aaa', fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  gridRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  dayLabel: { width: 44, fontSize: 13, fontWeight: '700', color: COLORS.dark },
  cell: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cellTick: { fontWeight: '700', fontSize: 16 },
  cellOthers: { fontSize: 10, color: '#aaa', fontWeight: '700' },
  legend: { fontSize: 10, color: '#bbb', marginTop: 12, textAlign: 'center' },

  sectionTitle: { fontSize: 19, fontWeight: '700', color: COLORS.dark, marginBottom: 14, letterSpacing: -0.3 },
  overlapCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  overlapDay: { fontSize: 13, fontWeight: '700', color: COLORS.dark, marginBottom: 10 },
  overlapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 10 },
  overlapSlot: { fontSize: 12, color: '#888', textTransform: 'capitalize' },
  overlapNames: { fontSize: 12, color: COLORS.dark, fontWeight: '600', flex: 1, textAlign: 'right' },
  emptySquad: { color: '#aaa', textAlign: 'center', marginTop: 12, fontSize: 13 },

  footer: { padding: 22, paddingTop: 10, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  saveBtn: { padding: 17, borderRadius: 14, alignItems: 'center' },
  saveText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
});
