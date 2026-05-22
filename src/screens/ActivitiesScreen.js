import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  StyleSheet, FlatList, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../lib/AppContext';
import { ACTIVITIES, COLORS, TIER } from '../lib/constants';
import {
  getUserActivities, upsertUserActivity, deleteUserActivity, setReaction,
} from '../lib/supabase';

const CUSTOM_KEY = 'lime_custom_activities';
const TIER_OPTIONS = [
  { id: 'chill', label: 'Chill', sub: 'low-key & easy' },
  { id: 'bold',  label: 'Bold',  sub: 'step it up'    },
  { id: 'wild',  label: 'Wild',  sub: 'big swing'     },
];
const EMOJI_PRESETS = ['🎉','🍹','🌴','🌊','🎨','🍿','🏝️','🧘','🎶','🛼','⛵','🌅','🎪','🥥','🧗','🎤'];

export default function ActivitiesScreen({ navigation }) {
  const { profile, myBadges } = useContext(AppContext);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null); // null = creating
  const [menuFor, setMenuFor] = useState(null); // activity object whose ⋮ menu is open
  const insets = useSafeAreaInsets();

  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#2d5a00';

  useEffect(() => { loadCustom(); }, []);

  const loadCustom = async () => {
    // Try Supabase first; fall back to AsyncStorage cache when remote
    // is unavailable or the user is offline.
    try {
      const remote = await getUserActivities(profile.id);
      if (remote && remote.length >= 0) {
        setCustom(remote);
        AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(remote)).catch(() => {});
        return;
      }
    } catch (e) { /* falls through */ }
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_KEY);
      setCustom(raw ? JSON.parse(raw) : []);
    } catch (e) { setCustom([]); }
  };

  const persistCustom = async (next) => {
    setCustom(next);
    AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(next)).catch(() => {});
  };

  // Strip internal/transient fields before writing to user_activities.
  const toPayload = (item) => {
    const { _userOwned, custom: _isCustom, ...rest } = item;
    return { ...rest, profile_id: profile.id };
  };

  // Edits to seed activities create per-user override rows in
  // user_activities (same id as the seed). New activities use a
  // timestamp id. Either way it's a single upsert.
  const saveActivity = async (item) => {
    const payload = toPayload(item);
    let saved = payload;
    try { saved = await upsertUserActivity(payload); }
    catch (e) { /* falls back to local cache */ }
    const without = custom.filter(c => c.id !== saved.id);
    persistCustom([saved, ...without]);
  };

  // Delete semantics:
  //   - Override row on a seed id → row is removed (seed defaults reappear)
  //   - Net-new custom row → row is removed
  //   - Pure seed (no override) → Delete is hidden in the menu; this is a no-op
  const removeActivity = async (item) => {
    if (!item._userOwned) return;
    try { await deleteUserActivity(item.id); } catch (e) { /* local fallback */ }
    persistCustom(custom.filter(c => c.id !== item.id));
  };

  // Pinning a pure seed creates an override row carrying the seed's
  // fields + pinned: true. Pinning an existing custom/override just
  // flips the flag.
  const togglePin = async (item) => {
    const existing = custom.find(c => c.id === item.id);
    const base = existing || item; // start from override if present, else seed
    const updated = { ...base, pinned: !base.pinned };
    saveActivity(updated);
  };

  const suggestToSquad = async (item) => {
    try {
      await setReaction({ activityId: item.id, profileId: profile.id, reaction: '🙌' });
    } catch (e) { /* best-effort */ }
    Alert.alert("Sent to the squad",
      `“${item.name}” is in the squad mix. It'll show up in Trending Limes when reactions roll in.`);
  };

  // Merge seeds with user_activities, overrides winning on shared ids.
  // Result is tagged with _userOwned so the row menu can hide Delete
  // for pure seeds. Order: pinned first (overrides + seeds), then the
  // rest in their original sequence.
  const all = useMemo(() => {
    const map = new Map();
    ACTIVITIES.forEach(a => map.set(a.id, { ...a, _userOwned: false }));
    custom.forEach(c => map.set(c.id, { ...c, custom: true, _userOwned: true }));
    const list = Array.from(map.values());
    const pinned = list.filter(a => a.pinned);
    const unpinned = list.filter(a => !a.pinned);
    return [...pinned, ...unpinned];
  }, [custom]);

  const filters = useMemo(() => ([
    { id: 'all',   label: 'All',   count: all.length },
    { id: 'chill', label: 'Chill', count: all.filter(a => a.tier === 'chill').length },
    { id: 'bold',  label: 'Bold',  count: all.filter(a => a.tier === 'bold').length },
    { id: 'wild',  label: 'Wild',  count: all.filter(a => a.tier === 'wild').length },
  ]), [all]);

  const filtered = useMemo(() => {
    let list = all;
    if (filter !== 'all') list = list.filter(a => a.tier === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [filter, query, all]);

  const renderItem = ({ item }) => {
    const earned = myBadges.includes(item.id);
    const t = TIER[item.tier] || { bg: COLORS.cream, text: COLORS.dark, label: '' };
    // _userOwned tells us whether the row originates from user_activities
    // (a seed override OR a net-new custom). Pure seeds without an
    // override are read-only for Delete but editable in every other way.
    return (
      <View style={[styles.card, earned && styles.cardEarned]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ActivityDetail', { activity: item })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}
          activeOpacity={0.7}
        >
          <View style={[styles.emojiBox, { backgroundColor: earned ? accent : t.bg }]}>
            <Text style={{ fontSize: 28 }}>{earned ? (item.badge || item.emoji) : item.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {item.pinned && <Text style={styles.pinChip}>📌</Text>}
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            </View>
            <View style={styles.cardMeta}>
              <View style={[styles.tierDot, { backgroundColor: t.text }]} />
              <Text style={styles.tierText}>{t.label}</Text>
              {item.tripType && <Text style={styles.tripText}>· Trip</Text>}
              {item._userOwned && <Text style={styles.tripText}>· Yours</Text>}
              {earned && <Text style={[styles.doneText, { color: accentText }]}>· Done ✓</Text>}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMenuFor(item)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={styles.menuBtn}>
          <Text style={styles.menuDots}>⋮</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Activities</Text>
          <Text style={styles.subtitle}>{myBadges.length} of {all.length} done</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, marginBottom: 14 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search activities…"
          placeholderTextColor="#bbb"
          style={styles.search}
        />
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 8 }}>
          {filters.map(f => {
            const active = filter === f.id;
            const isAll = f.id === 'all';
            const activeBg   = isAll ? COLORS.dark : TIER[f.id].bg;
            const activeFg   = isAll ? COLORS.cream : TIER[f.id].text;
            return (
              <TouchableOpacity key={f.id} onPress={() => setFilter(f.id)}
                style={[styles.filterChip, {
                  backgroundColor: active ? activeBg : '#fff',
                  borderColor:    active ? activeBg : 'rgba(0,0,0,0.05)',
                }]}>
                <Text style={[styles.filterText, { color: active ? activeFg : '#888' }]}>
                  {f.label} <Text style={{ opacity: 0.7 }}>{f.count}</Text>
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 120 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>🔍</Text>
            <Text style={{ color: '#aaa' }}>Nothing matches that</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => { setEditingActivity(null); setModalOpen(true); }}
        style={[styles.fab, { bottom: 24 + (insets.bottom || 0), backgroundColor: COLORS.coral }]}
        activeOpacity={0.85}
      >
        <Text style={styles.fabPlus}>＋</Text>
      </TouchableOpacity>

      {/* Create / Edit modal */}
      <ActivityEditorModal
        visible={modalOpen}
        initial={editingActivity}
        onClose={() => { setModalOpen(false); setEditingActivity(null); }}
        onSave={(item) => { saveActivity(item); setModalOpen(false); setEditingActivity(null); }}
        accent={accent}
        accentText={accentText}
      />

      {/* ⋮ row menu */}
      <RowMenu
        item={menuFor}
        onClose={() => setMenuFor(null)}
        onEdit={(it)    => { setMenuFor(null); setEditingActivity(it); setModalOpen(true); }}
        onDelete={(it)  => {
          setMenuFor(null);
          // Seeds (id 1-59) can only be "reset" — we drop the override
          // and the default seed values reappear. Net-new customs are
          // deleted outright.
          const isSeedOverride = it.id <= 59;
          Alert.alert(
            isSeedOverride ? 'Reset to default?' : 'Delete this activity?',
            isSeedOverride
              ? `Your edits to “${it.name}” will be cleared and the default values restored.`
              : `“${it.name}” will be removed.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: isSeedOverride ? 'Reset' : 'Delete', style: 'destructive', onPress: () => removeActivity(it) },
            ]
          );
        }}
        onPin={(it)     => { setMenuFor(null); togglePin(it); }}
        onSuggest={(it) => { setMenuFor(null); suggestToSquad(it); }}
      />
    </SafeAreaView>
  );
}

// ─── ⋮ Menu ───────────────────────────────────────────────
function RowMenu({ item, onClose, onEdit, onDelete, onPin, onSuggest }) {
  // Pure seeds (no override yet) can be edited, pinned, suggested —
  // but not deleted, since deleting the seed globally isn't a thing
  // we want to expose to one user. Editing first creates an override
  // row, which is then deletable from this same menu.
  const canDelete = !!item?._userOwned;
  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={menuStyles.backdrop}>
        <View style={menuStyles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={menuStyles.title} numberOfLines={1}>{item?.name}</Text>
          <MenuRow icon="✏️" label="Edit"            onPress={() => onEdit(item)} />
          <MenuRow icon="📌" label={item?.pinned ? 'Unpin from top' : 'Pin to top'} onPress={() => onPin(item)} />
          <MenuRow icon="🙌" label="Suggest to squad" onPress={() => onSuggest(item)} />
          {canDelete && (
            <MenuRow icon="🗑️" label={item?.id <= 59 ? 'Reset to default' : 'Delete'} danger onPress={() => onDelete(item)} />
          )}
          <TouchableOpacity onPress={onClose} style={menuStyles.cancel}>
            <Text style={menuStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function MenuRow({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity onPress={onPress} style={menuStyles.row}>
      <Text style={menuStyles.rowIcon}>{icon}</Text>
      <Text style={[menuStyles.rowLabel, danger && { color: '#d4475c' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Create / Edit modal ──────────────────────────────────
function ActivityEditorModal({ visible, initial, onClose, onSave, accent, accentText }) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎉');
  const [tier, setTier] = useState('chill');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name || '');
    setEmoji(initial?.emoji || '🎉');
    setTier(initial?.tier || 'chill');
    setLocation(initial?.location || '');
    setNotes(initial?.notes || '');
    setCost(initial?.cost || '');
    setTags(Array.isArray(initial?.tags) ? initial.tags.join(', ') : (initial?.tags || ''));
  }, [visible, initial]);

  const save = () => {
    if (!name.trim()) {
      Alert.alert('Almost there', 'Give it a name first.');
      return;
    }
    const id = initial?.id || Date.now();
    onSave({
      id,
      name: name.trim(),
      emoji,
      badge: emoji,
      tier,
      // Preserve seed-only flags (e.g. tripType on River Lime / Bush
      // Lime) when overriding — the editor doesn't expose them.
      tripType: initial?.tripType ?? false,
      pinned: !!initial?.pinned,
      location: location.trim() || null,
      notes: notes.trim() || null,
      cost: cost.trim() || null,
      tags: tags.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={editorStyles.safe} edges={['bottom']}>
        <EditorHeader title={isEdit ? 'Edit activity' : 'New activity'} onClose={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={editorStyles.label}>Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="What is it?" placeholderTextColor="#bbb" style={editorStyles.input} autoFocus />

            <Text style={editorStyles.label}>Emoji</Text>
            <View style={editorStyles.emojiGrid}>
              {EMOJI_PRESETS.map(e => (
                <TouchableOpacity key={e} onPress={() => setEmoji(e)}
                  style={[editorStyles.emojiCell, emoji === e && { borderColor: accent, borderWidth: 2, backgroundColor: '#fff' }]}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={editorStyles.label}>Tier</Text>
            <View style={editorStyles.tierRow}>
              {TIER_OPTIONS.map(t => {
                const on = tier === t.id;
                const c = TIER[t.id];
                return (
                  <TouchableOpacity key={t.id} onPress={() => setTier(t.id)}
                    style={[editorStyles.tierCard, on && { borderColor: c.text, borderWidth: 2, backgroundColor: c.bg }]}>
                    <Text style={[editorStyles.tierLabel, on && { color: c.text }]}>{t.label}</Text>
                    <Text style={editorStyles.tierSub}>{t.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={editorStyles.label}>Location</Text>
            <TextInput value={location} onChangeText={setLocation} placeholder="Where? (optional)" placeholderTextColor="#bbb" style={editorStyles.input} />

            <Text style={editorStyles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} placeholder="Details, links, anything (optional)" placeholderTextColor="#bbb" style={[editorStyles.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline />

            <Text style={editorStyles.label}>Cost estimate</Text>
            <TextInput value={cost} onChangeText={setCost} placeholder="e.g. $30 / person (optional)" placeholderTextColor="#bbb" style={editorStyles.input} />

            <Text style={editorStyles.label}>Tags</Text>
            <TextInput value={tags} onChangeText={setTags} placeholder="comma-separated (optional)" placeholderTextColor="#bbb" style={editorStyles.input} autoCapitalize="none" />

            <TouchableOpacity onPress={save}
              style={[editorStyles.save, { backgroundColor: name.trim() ? accent : '#e9e3d6' }]}
              disabled={!name.trim()}>
              <Text style={[editorStyles.saveText, { color: name.trim() ? accentText : '#aaa' }]}>{isEdit ? 'Save changes' : 'Add to list'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function EditorHeader({ title, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[editorStyles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={editorStyles.headerBtn}>
        <Text style={editorStyles.chev}>‹</Text>
        <Text style={editorStyles.cancel}>Cancel</Text>
      </TouchableOpacity>
      <Text style={editorStyles.title}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: { padding: 22, paddingBottom: 14 },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: '#999', marginTop: 4 },
  search: { backgroundColor: '#fff', padding: 14, borderRadius: 14, fontSize: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', color: COLORS.dark },
  filterRow: { height: 44, marginBottom: 14 },
  filterChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '700' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  cardEarned: { backgroundColor: '#fcfaf3' },
  emojiBox: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { fontSize: 11, color: '#999', fontWeight: '600' },
  tripText: { fontSize: 11, color: '#aaa' },
  doneText: { fontSize: 11, fontWeight: '700' },
  chevron: { color: '#ccc', fontSize: 22, paddingHorizontal: 4 },
  pinChip: { fontSize: 11 },
  menuBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  menuDots: { fontSize: 22, color: '#888', fontWeight: '700' },

  empty: { padding: 50, alignItems: 'center' },

  fab: {
    position: 'absolute', right: 22,
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.coral, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabPlus: { color: '#fff', fontSize: 30, fontWeight: '500', marginTop: -3 },
});

const menuStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 20, padding: 8, marginBottom: 8 },
  title: { fontSize: 13, fontWeight: '700', color: '#888', textAlign: 'center', paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  rowIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: COLORS.dark },
  cancel: { paddingVertical: 14, alignItems: 'center', marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  cancelText: { fontSize: 14, color: '#888', fontWeight: '700' },
});

const editorStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 60, minHeight: 44, gap: 2 },
  chev: { fontSize: 22, color: '#888', fontWeight: '500', lineHeight: 22 },
  cancel: { fontSize: 14, color: '#888', fontWeight: '600' },

  label: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 18 },
  input: { backgroundColor: '#fff', padding: 14, borderRadius: 14, fontSize: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', color: COLORS.dark },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiCell: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1ebde', borderWidth: 1.5, borderColor: 'transparent' },

  tierRow: { flexDirection: 'row', gap: 8 },
  tierCard: { flex: 1, backgroundColor: '#fff', padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.05)' },
  tierLabel: { fontSize: 13, fontWeight: '700', color: '#666' },
  tierSub: { fontSize: 10, color: '#aaa', marginTop: 3 },

  save: { marginTop: 28, padding: 16, borderRadius: 14, alignItems: 'center' },
  saveText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
});
