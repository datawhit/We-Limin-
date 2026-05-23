import React, { useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Animated,
  StyleSheet, FlatList, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../lib/AppContext';
import { ACTIVITIES, COLORS, TIER } from '../lib/constants';
import {
  getUserActivities, upsertUserActivity, deleteUserActivity, setReaction,
} from '../lib/supabase';

// ─── Design system primitives ─────────────────────────────
import WashiTape from '../components/WashiTape';
import { Star, Sparkle, CurvedArrow } from '../components/Doodles';
import { PASTELS, HANDWRITTEN_500 } from '../lib/theme';

const CUSTOM_KEY = 'lime_custom_activities';
const SAVED_KEY  = 'lime_saved_activities';

const TIER_OPTIONS = [
  { id: 'chill', emoji: '🌿', label: 'Chill', sub: 'low-key & easy' },
  { id: 'bold',  emoji: '🔥', label: 'Bold',  sub: 'step it up'    },
  { id: 'wild',  emoji: '😈', label: 'Wild',  sub: 'big swing'     },
];
const EMOJI_PRESETS = ['🎉','🍹','🌴','🌊','🎨','🍿','🏝️','🧘','🎶','🛼','⛵','🌅','🎪','🥥','🧗','🎤'];

// Washi color cycle for field labels in the activity editor.
// One color per label in render order: name, emoji, tier, location,
// notes, cost, tags — slight rotation alternated for the torn-tape feel.
const FIELD_WASHI = ['coral', 'blue', 'amber', 'lavender', 'pink', 'mint', 'coral'];
const FIELD_ROT   = [-3, 2, -2, 3, -3, 2, -2];

// Tier-tinted pastels for the emoji square on each activity row.
const TIER_BG = {
  chill: PASTELS.mintBg,
  bold:  PASTELS.amberBg,
  wild:  PASTELS.lavenderBg,
};

// Washi color cycle for activity row corner tape.
// Pink only appears 1-in-9 to keep the look from leaning pink.
const ROW_WASHI = ['coral', 'blue', 'amber', 'lavender', 'coral', 'blue', 'amber', 'lavender', 'pink'];

export default function ActivitiesScreen({ navigation }) {
  // ─── PRESERVED: all hooks, state, handlers, data wiring ───
  const { profile, myBadges } = useContext(AppContext);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null); // null = creating
  const [menuFor, setMenuFor] = useState(null); // ⋮ menu target
  const insets = useSafeAreaInsets();

  // NEW: lineup-save state + toast feedback
  const [saved, setSaved] = useState([]);              // array of activity ids
  const [toastMsg, setToastMsg] = useState('');
  const toastAnim = useRef(new Animated.Value(-60)).current;

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#2d5a00';

  useEffect(() => { loadCustom(); loadSaved(); }, []);

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

  const loadSaved = async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      setSaved(raw ? JSON.parse(raw) : []);
    } catch (e) { setSaved([]); }
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

  const saveActivity = async (item) => {
    const payload = toPayload(item);
    let savedRow = payload;
    try { savedRow = await upsertUserActivity(payload); }
    catch (e) { /* falls back to local cache */ }
    const without = custom.filter(c => c.id !== savedRow.id);
    persistCustom([savedRow, ...without]);
  };

  const removeActivity = async (item) => {
    if (!item._userOwned) return;
    try { await deleteUserActivity(item.id); } catch (e) { /* local fallback */ }
    persistCustom(custom.filter(c => c.id !== item.id));
  };

  const togglePin = async (item) => {
    const existing = custom.find(c => c.id === item.id);
    const base = existing || item;
    const updated = { ...base, pinned: !base.pinned };
    saveActivity(updated);
  };

  const suggestToSquad = async (item) => {
    try {
      await setReaction({ activityId: item.id, profileId: profile.id, reaction: '🙌' });
    } catch (e) { /* best-effort */ }
    Alert.alert("Sent to the squad",
      `"${item.name}" is in the squad mix. It'll show up in Trending Limes when reactions roll in.`);
  };

  // NEW — Save / unsave from Lineup. Locally persisted; will swap to
  // a lineup table when the schema lands.
  const showToast = (msg) => {
    setToastMsg(msg);
    toastAnim.stopAnimation();
    toastAnim.setValue(-60);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 12, useNativeDriver: true, friction: 6 }),
      Animated.delay(1400),
      Animated.timing(toastAnim, { toValue: -60, duration: 250, useNativeDriver: true }),
    ]).start();
  };
  const toggleSave = (item) => {
    const isSaved = saved.includes(item.id);
    const next = isSaved
      ? saved.filter(id => id !== item.id)
      : [...saved, item.id];
    setSaved(next); // optimistic
    AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)).catch(() => {});
    showToast(isSaved ? 'Removed from Lineup' : 'Added to Lineup ✓');
  };

  // Merge seeds with user_activities, overrides winning on shared ids.
  // _userOwned is set so the row menu can hide Delete for pure seeds.
  const all = useMemo(() => {
    const map = new Map();
    ACTIVITIES.forEach(a => map.set(a.id, { ...a, _userOwned: false }));
    custom.forEach(c => map.set(c.id, { ...c, custom: true, _userOwned: true }));
    const list = Array.from(map.values());
    const pinned   = list.filter(a => a.pinned);
    const unpinned = list.filter(a => !a.pinned);
    return [...pinned, ...unpinned];
  }, [custom]);

  const filtered = useMemo(() => {
    let list = all;
    if (filter !== 'all') list = list.filter(a => a.tier === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [filter, query, all]);

  const filters = useMemo(() => {
    // "All N" updates with the current search query so the counts
    // reflect what the user sees.
    const base = query.trim()
      ? all.filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
      : all;
    return [
      { id: 'all',   label: `all ${base.length}` },
      { id: 'chill', label: `chill ${base.filter(a => a.tier === 'chill').length}` },
      { id: 'bold',  label: `bold ${base.filter(a => a.tier === 'bold').length}` },
      { id: 'wild',  label: `wild ${base.filter(a => a.tier === 'wild').length}` },
    ];
  }, [all, query]);

  const renderItem = ({ item, index }) => {
    const earned = myBadges.includes(item.id);
    const t = TIER[item.tier] || { bg: COLORS.cream, text: COLORS.dark, label: '' };
    const isSaved = saved.includes(item.id);
    const washi = ROW_WASHI[index % ROW_WASHI.length];
    return (
      <View style={styles.activityCard}>
        <WashiTape
          color={washi}
          width={48}
          height={12}
          rotation={-3}
          opacity={0.75}
          style={{ top: -4, left: 18 }}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('ActivityDetail', { activity: item })}
          style={styles.activityMain}
          activeOpacity={0.85}
        >
          <View style={[styles.activityEmoji, { backgroundColor: TIER_BG[item.tier] || PASTELS.coralBg }]}>
            <Text style={{ fontSize: 26 }}>{earned ? (item.badge || item.emoji) : item.emoji}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.titleRow}>
              {item.pinned && <Text style={styles.pinChip}>📌</Text>}
              <Text style={styles.activityName} numberOfLines={1}>{item.name}</Text>
            </View>
            <View style={styles.tierRow}>
              <View style={[styles.tierDot, { backgroundColor: t.text }]} />
              <Text style={styles.tierText}>{(t.label || '').toLowerCase()}</Text>
              {item.tripType   && <Text style={styles.metaExtra}>· trip</Text>}
              {item._userOwned && <Text style={styles.metaExtra}>· yours</Text>}
              {earned          && <Text style={[styles.metaDone, { color: accentText }]}>· done ✓</Text>}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.activityActions}>
          <TouchableOpacity
            onPress={() => toggleSave(item)}
            style={[styles.saveBtn, isSaved && styles.saveBtnOn]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.saveBtnText, isSaved && styles.saveBtnTextOn]}>
              {isSaved ? '✓' : '+'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMenuFor(item)}
            style={styles.menuBtn}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text style={styles.menuDots}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Floating toast */}
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { top: insets.top + 12, transform: [{ translateY: toastAnim }] }]}
      >
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.titleHeaderRow}>
          <Text style={[styles.title, HAND_500 && { fontFamily: HAND_500 }]}>explore</Text>
          <Sparkle size={20} color={COLORS.palmGreen} opacity={0.55} style={{ left: 10, top: 6 }} />
          <Star size={11} color={COLORS.coral} opacity={0.5} style={{ right: 4, top: 4 }} />
        </View>
        <Text style={styles.subtitle}>find ideas, limes, and inspo</Text>
      </View>

      {/* ─── Search ─── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="search activities, places, vibes..."
          placeholderTextColor="#bbb"
          style={styles.search}
        />
      </View>

      {/* ─── Filter pills ─── */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 22, gap: 10, alignItems: 'center' }}
        >
          {filters.map(f => {
            const on = filter === f.id;
            return (
              <View key={f.id} style={styles.filterChipWrap}>
                {on && (
                  <WashiTape
                    color="amber"
                    width={110}
                    height={30}
                    rotation={-2}
                    opacity={0.7}
                    style={{ top: 3, left: -6 }}
                  />
                )}
                <TouchableOpacity
                  onPress={() => setFilter(f.id)}
                  style={[styles.filterChip, on && styles.filterChipOn]}
                >
                  <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── List ─── */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 140 }}
        renderItem={renderItem}
        ListHeaderComponent={
          <View pointerEvents="none" style={styles.listAccents}>
            <Sparkle size={14} color={COLORS.amber} opacity={0.55} style={{ right: -4, top: 2 }} />
            <Star size={11} color={COLORS.palmGreen} opacity={0.5} style={{ left: -6, top: 28 }} />
          </View>
        }
        ListFooterComponent={
          <View pointerEvents="none" style={styles.listFooterAccents}>
            <CurvedArrow size={42} color={COLORS.coral} opacity={0.45} style={{ left: 18, top: 14, transform: [{ rotate: '90deg' }] }} />
            <Sparkle size={12} color={COLORS.amber} opacity={0.55} style={{ right: 40, top: 28 }} />
            <Star size={11} color={COLORS.palmGreen} opacity={0.5} style={{ left: '50%', top: 60 }} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>🔍</Text>
            <Text style={{ color: '#aaa' }}>nothing matches that</Text>
          </View>
        }
      />

      {/* ─── FAB ─── */}
      <TouchableOpacity
        onPress={() => { setEditingActivity(null); setModalOpen(true); }}
        style={[
          styles.fab,
          {
            bottom: 24 + (insets.bottom || 0),
            backgroundColor: COLORS.coral,
            transform: [{ rotate: '-3deg' }],
          },
        ]}
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
          const isSeedOverride = it.id <= 59;
          Alert.alert(
            isSeedOverride ? 'Reset to default?' : 'Delete this activity?',
            isSeedOverride
              ? `Your edits to "${it.name}" will be cleared and the default values restored.`
              : `"${it.name}" will be removed.`,
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

  const canSubmit = !!name.trim();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={editorStyles.safe} edges={['bottom']}>
        <EditorHeader title={isEdit ? 'edit activity' : 'new activity'} onClose={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={editorStyles.scroll} keyboardShouldPersistTaps="handled">
            {/* Page-edge doodles (low opacity, non-blocking) */}
            <Sparkle    size={14} color={COLORS.coral}     opacity={0.5} style={{ right: 4,  top: 4 }} />
            <Star       size={11} color={COLORS.palmGreen} opacity={0.5} style={{ left: -4, top: 36 }} />

            {/* Intro pill — only on "new" mode */}
            {!isEdit && (
              <View style={editorStyles.introPillRow}>
                <View style={editorStyles.introPill}>
                  <Text style={[editorStyles.introPillText, { fontFamily: HANDWRITTEN_500 }]}>what's the plan? ✨</Text>
                </View>
              </View>
            )}

            <LabelWithTape index={0} label="name" />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="what is it?"
              placeholderTextColor="#bbb"
              style={editorStyles.input}
              autoFocus
            />

            <LabelWithTape index={1} label="emoji" />
            <View style={editorStyles.emojiGrid}>
              {EMOJI_PRESETS.map(e => {
                const on = emoji === e;
                return (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setEmoji(e)}
                    style={[editorStyles.emojiCell, on && editorStyles.emojiCellOn]}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                    {on && (
                      <Sparkle size={10} color={COLORS.amber} opacity={1} style={{ top: 4, right: 4 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <LabelWithTape index={2} label="tier" />
            <View style={editorStyles.tierRow}>
              {TIER_OPTIONS.map(t => {
                const on = tier === t.id;
                const bg = on ? (TIER_BG[t.id] || '#fff') : '#fff';
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setTier(t.id)}
                    activeOpacity={0.85}
                    style={[editorStyles.tierCard, { backgroundColor: bg }, on && editorStyles.tierCardOn]}
                  >
                    <Text style={editorStyles.tierEmoji}>{t.emoji}</Text>
                    <Text style={editorStyles.tierLabel}>{t.label.toLowerCase()}</Text>
                    <Text style={editorStyles.tierSub}>{t.sub}</Text>
                    {on && (
                      <Sparkle size={10} color={COLORS.amber} opacity={1} style={{ top: 6, right: 6 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <LabelWithTape index={3} label="location" />
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="where? (optional)"
              placeholderTextColor="#bbb"
              style={editorStyles.input}
            />

            <LabelWithTape index={4} label="notes" />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="details, links, anything (optional)"
              placeholderTextColor="#bbb"
              style={[editorStyles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              multiline
            />

            <LabelWithTape index={5} label="cost estimate" />
            <TextInput
              value={cost}
              onChangeText={setCost}
              placeholder="e.g. $30 / person (optional)"
              placeholderTextColor="#bbb"
              style={editorStyles.input}
            />

            <LabelWithTape index={6} label="tags" />
            <TextInput
              value={tags}
              onChangeText={setTags}
              placeholder="comma-separated (optional)"
              placeholderTextColor="#bbb"
              style={editorStyles.input}
              autoCapitalize="none"
            />

            {/* Save hero — coral, slight tilt, curved arrow doodle */}
            <View style={editorStyles.saveWrap}>
              {/* Optional washi over the button */}
              <WashiTape
                color="coral"
                width={70}
                height={14}
                rotation={-3}
                opacity={0.7}
                style={{ top: -6, left: '50%', marginLeft: -35 }}
              />
              <TouchableOpacity
                onPress={save}
                disabled={!canSubmit}
                activeOpacity={0.85}
                style={[
                  editorStyles.saveHero,
                  !canSubmit && { backgroundColor: '#E5BCAB' },
                ]}
              >
                <Text style={editorStyles.saveHeroText}>
                  {isEdit ? 'save changes' : 'add to the lineup'} ✨
                </Text>
              </TouchableOpacity>
              <CurvedArrow
                size={54}
                color={COLORS.coral}
                opacity={0.55}
                style={{ right: -4, bottom: -4, transform: [{ rotate: '24deg' }] }}
              />
            </View>

            {/* Bottom-of-form decorative scatter */}
            <View pointerEvents="none" style={editorStyles.bottomAccents}>
              <Sparkle size={12} color={COLORS.amber}     opacity={0.55} style={{ left: 30,  top: 0 }} />
              <Star    size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ right: 30, top: 12 }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// Inline component — field label resting on a torn-tape strip.
function LabelWithTape({ index, label }) {
  const washi = FIELD_WASHI[index % FIELD_WASHI.length];
  const rot   = FIELD_ROT[index % FIELD_ROT.length];
  return (
    <View style={editorStyles.labelWrap}>
      <WashiTape color={washi} width={120} height={22} rotation={rot} opacity={0.65} style={{ top: -2, left: -6 }} />
      <Text style={editorStyles.label}>{label}</Text>
    </View>
  );
}

function EditorHeader({ title, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[editorStyles.header, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={editorStyles.headerBtn}
      >
        <Text style={editorStyles.chev}>‹</Text>
      </TouchableOpacity>
      <Text style={[editorStyles.title, { fontFamily: HANDWRITTEN_500 }]}>{title}</Text>
      <View style={editorStyles.headerBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10 },
  titleHeaderRow: { position: 'relative', flexDirection: 'row', alignItems: 'center', height: 46 },
  title: { fontSize: 32, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 42 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },

  // Search
  searchWrap: {
    marginHorizontal: 22,
    marginTop: 6, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: { fontSize: 16, marginRight: 8, color: '#888' },
  search: { flex: 1, fontSize: 14, color: COLORS.dark, paddingVertical: 0 },

  // Filter pills
  filterRow: { height: 50, marginBottom: 10 },
  filterChipWrap: { position: 'relative' },
  filterChip: {
    paddingHorizontal: 16, height: 36, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.cardBorder,
    flexDirection: 'row',
  },
  filterChipOn: { backgroundColor: COLORS.coral, borderColor: COLORS.coral },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.dark, letterSpacing: 0.1, textTransform: 'lowercase' },
  filterTextOn: { color: '#fff' },

  // Activity row card
  activityCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 12,
    marginBottom: 10,
    position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1,
  },
  activityMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  activityEmoji: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { fontSize: 12, color: '#888', fontWeight: '600' },
  metaExtra: { fontSize: 11, color: '#aaa' },
  metaDone: { fontSize: 11, fontWeight: '700' },
  pinChip: { fontSize: 11 },

  activityActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6 },
  saveBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#aaa',
  },
  saveBtnOn: { backgroundColor: COLORS.coral, borderColor: COLORS.coral },
  saveBtnText: { fontSize: 16, color: '#888', fontWeight: '700', lineHeight: 18 },
  saveBtnTextOn: { color: '#fff' },
  menuBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  menuDots: { fontSize: 22, color: '#888', fontWeight: '700' },

  empty: { padding: 50, alignItems: 'center' },

  // Decorative accents inside the list
  listAccents: { height: 36, position: 'relative' },
  listFooterAccents: { height: 90, position: 'relative' },

  // FAB
  fab: {
    position: 'absolute', right: 22,
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.coral, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabPlus: { color: '#fff', fontSize: 30, fontWeight: '500', marginTop: -3 },

  // Toast
  toast: {
    position: 'absolute', left: 22, right: 22, zIndex: 9999, elevation: 10,
    backgroundColor: COLORS.dark, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
  },
  toastText: { color: COLORS.cream, fontSize: 14, fontWeight: '700', textAlign: 'center' },
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

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 26, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 32 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },

  // Scroll container — relative so doodles can be positioned inside
  scroll: { padding: 22, paddingBottom: 60, position: 'relative' },

  // Intro pill — "what's the plan? ✨"
  introPillRow: { alignItems: 'flex-start', marginBottom: 8 },
  introPill: {
    backgroundColor: '#F9E0A8',
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 999,
    transform: [{ rotate: '-2deg' }],
  },
  introPillText: { fontSize: 18, color: COLORS.dark, lineHeight: 22 },

  // Field label wrapped over washi tape
  labelWrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4,
    marginTop: 18, marginBottom: 8,
    position: 'relative',
  },
  label: {
    fontSize: 11, fontWeight: '500', color: '#888',
    letterSpacing: 1.5, textTransform: 'lowercase',
  },

  // Inputs
  input: {
    backgroundColor: '#fff', padding: 14, borderRadius: 14,
    fontSize: 15, borderWidth: 1, borderColor: '#EBE2D0', color: COLORS.dark,
  },

  // Emoji picker — 4-col grid
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiCell: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.cream,
    borderWidth: 1.5, borderColor: 'transparent',
    position: 'relative',
  },
  emojiCellOn: {
    borderColor: COLORS.coral, borderWidth: 2,
    backgroundColor: '#FBE5C8',
  },

  // Tier picker — 3 pills with emoji on top
  tierRow: { flexDirection: 'row', gap: 8 },
  tierCard: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#EBE2D0',
    position: 'relative',
  },
  tierCardOn: { borderColor: COLORS.coral, borderWidth: 2 },
  tierEmoji: { fontSize: 22, marginBottom: 4 },
  tierLabel: { fontSize: 14, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.1 },
  tierSub: { fontSize: 11, color: '#888', marginTop: 3, textAlign: 'center' },

  // Save hero
  saveWrap: { marginTop: 36, alignItems: 'center', position: 'relative' },
  saveHero: {
    width: '100%',
    backgroundColor: '#E8704F',
    height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  saveHeroText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  // Bottom decorative accents
  bottomAccents: { height: 50, marginTop: 14, position: 'relative' },
});
