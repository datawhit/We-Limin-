import React, { useContext, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  StyleSheet, ActivityIndicator, Alert, Modal, FlatList,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AppContext } from '../lib/AppContext';
import { ACTIVITIES, COLORS, RATINGS, TIER, getTier } from '../lib/constants';
import { addMemory, uploadPhoto, earnBadge, getMemories } from '../lib/supabase';
import BadgeUnlockModal from '../components/BadgeUnlockModal';
import { checkAndUnlockHiddenBadges } from '../lib/hiddenBadges';

export default function AddMemoryScreen({ navigation }) {
  const { profile, myBadges, setMyBadges } = useContext(AppContext);
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#2d5a00';

  const [activity, setActivity] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [rating, setRating] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Queue of badge unlock payloads — popped off as the user dismisses.
  // When the queue empties, we finally navigate back.
  const [unlockQueue, setUnlockQueue] = useState([]);

  const filteredActivities = search.trim()
    ? ACTIVITIES.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : ACTIVITIES;

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'We need photo library access to add a memory.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const canSave = activity && photo && rating && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const photoUrl = await uploadPhoto(photo, profile.id);
      await addMemory({
        profile_id: profile.id,
        activity_id: activity.id,
        photo_url: photoUrl,
        caption: caption.trim(),
        rating: rating.label,
      });

      const justEarnedBadge = !myBadges.includes(activity.id);
      let nextBadges = myBadges;
      if (justEarnedBadge) {
        await earnBadge(profile.id, activity.id);
        nextBadges = [activity.id, ...myBadges];
        setMyBadges(nextBadges);
      }

      // Build the unlock queue: activity badge first (if newly earned),
      // then hidden badges triggered by adding this memory.
      const payloads = [];
      if (justEarnedBadge) {
        const prevTier = getTier(myBadges.length);
        const nextTier = getTier(nextBadges.length);
        payloads.push({
          emoji:       activity.badge || '🏅',
          name:        activity.name,
          tierName:    nextTier.name,
          tierEmoji:   nextTier.emoji,
          tierTagline: nextTier.tagline,
          leveledUp:   prevTier.name !== nextTier.name,
        });
      }

      try {
        // Pull all memories for first-memory ("Bus' a Lime") detection.
        const allMems = await getMemories().catch(() => []);
        const mineAfter = allMems.filter(m => m.profile_id === profile.id);
        const newly = await checkAndUnlockHiddenBadges({
          trigger: 'memory_added',
          memory: { created_at: new Date().toISOString(), activity_id: activity.id, profile_ids: [profile.id] },
          allMemoriesForUser: mineAfter,
        });
        newly.forEach(b => payloads.push({
          emoji: b.emoji, name: b.name,
          tierName: 'Hidden badge', tierEmoji: '✨', tierTagline: b.hint,
          leveledUp: false,
        }));
      } catch (e) { /* hidden-badge check is best-effort */ }

      setSaving(false);
      if (payloads.length === 0) {
        navigation.goBack();
        return;
      }
      setUnlockQueue(payloads);
    } catch (e) {
      console.error(e);
      Alert.alert('Oops', 'Could not save memory. Try again?');
      setSaving(false);
    }
  };

  const advanceUnlock = () => {
    setUnlockQueue(q => {
      const next = q.slice(1);
      if (next.length === 0) navigation.goBack();
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BadgeUnlockModal
        visible={unlockQueue.length > 0}
        payload={unlockQueue[0]}
        onClose={advanceUnlock}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>New memory</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Activity picker */}
          <Text style={styles.label}>What'd y'all do?</Text>
          <TouchableOpacity onPress={() => setPickerOpen(true)} style={styles.activityPicker}>
            {activity ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={[styles.actEmojiBox, { backgroundColor: TIER[activity.tier].bg }]}>
                  <Text style={{ fontSize: 24 }}>{activity.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actName}>{activity.name}</Text>
                  <Text style={[styles.actTier, { color: TIER[activity.tier].text }]}>{TIER[activity.tier].label} tier</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.pickerPlaceholder}>Tap to pick an activity...</Text>
            )}
            <Text style={{ color: '#aaa', fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          {/* Photo */}
          <Text style={styles.label}>Drop a photo</Text>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity onPress={pickPhoto} style={styles.photoBox}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoEmpty}>
                  <Text style={{ fontSize: 48, marginBottom: 8 }}>📷</Text>
                  <Text style={{ color: '#888', fontWeight: '600' }}>Tap to pick from camera roll</Text>
                  <Text style={{ color: '#bbb', fontSize: 11, marginTop: 4 }}>1 photo per memory</Text>
                </View>
              )}
            </TouchableOpacity>
            {photo && (
              <Pressable
                onPress={() => setPhoto(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [
                  styles.photoX,
                  pressed && { transform: [{ scale: 0.9 }] },
                ]}
              >
                <Text style={styles.photoXIcon}>✕</Text>
              </Pressable>
            )}
          </View>
          {photo && (
            <TouchableOpacity onPress={pickPhoto} style={styles.changePhoto}>
              <Text style={{ color: '#666', fontSize: 12, fontWeight: '600' }}>Change photo</Text>
            </TouchableOpacity>
          )}

          {/* Caption */}
          <Text style={styles.label}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Spill the tea…"
            placeholderTextColor="#bbb"
            multiline
            style={styles.caption}
            maxLength={280}
          />
          <Text style={styles.charCount}>{caption.length}/280</Text>

          {/* Rating */}
          <Text style={styles.label}>How was it?</Text>
          <View style={styles.ratingGrid}>
            {RATINGS.map(r => {
              const active = rating?.label === r.label;
              return (
                <TouchableOpacity
                  key={r.label}
                  onPress={() => setRating(r)}
                  style={[styles.ratingBtn, { backgroundColor: active ? r.color : '#fff', borderColor: active ? r.textColor : COLORS.border, borderWidth: active ? 2 : 1 }]}
                >
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>{r.icon}</Text>
                  <Text style={[styles.ratingLabel, { color: active ? r.textColor : '#666' }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save */}
          <TouchableOpacity
            onPress={save}
            disabled={!canSave}
            style={[styles.saveBtn, { backgroundColor: canSave ? accent : '#e0e0e0' }]}
          >
            {saving ? (
              <ActivityIndicator color={accentText} />
            ) : (
              <Text style={[styles.saveBtnText, { color: canSave ? accentText : '#aaa' }]}>
                {canSave ? '🍋 Post memory' : 'Fill in the bits above'}
              </Text>
            )}
          </TouchableOpacity>

          {activity && !myBadges.includes(activity.id) && (
            <Text style={styles.badgeHint}>
              ✨ You'll also earn the {activity.badge} badge
            </Text>
          )}
        </ScrollView>

        {/* Activity picker modal */}
        <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Text style={{ fontSize: 14, color: '#888', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Pick activity</Text>
              <View style={{ width: 50 }} />
            </View>
            <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search..."
                placeholderTextColor="#bbb"
                style={styles.modalSearch}
              />
            </View>
            <FlatList
              data={filteredActivities}
              keyExtractor={(i) => String(i.id)}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setActivity(item); setPickerOpen(false); setSearch(''); }}
                  style={styles.modalRow}
                >
                  <View style={[styles.actEmojiBox, { backgroundColor: TIER[item.tier].bg }]}>
                    <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actName}>{item.name}</Text>
                    <Text style={[styles.actTier, { color: TIER[item.tier].text }]}>{TIER[item.tier].label}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },

  label: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 22 },

  activityPicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', gap: 12 },
  pickerPlaceholder: { color: '#bbb', fontSize: 14, flex: 1 },
  actEmojiBox: { width: 52, height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  actTier: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  photoBox: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  photoEmpty: { aspectRatio: 4 / 5, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)', borderRadius: 20, margin: 4 },
  photoPreview: { width: '100%', aspectRatio: 4 / 5 },
  photoX: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#EBE2D0',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3,
  },
  photoXIcon: { fontSize: 16, color: '#555', fontWeight: '600', lineHeight: 18 },
  changePhoto: { alignSelf: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },

  caption: { backgroundColor: '#fff', borderRadius: 16, padding: 16, fontSize: 15, color: COLORS.dark, minHeight: 110, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', lineHeight: 22 },
  charCount: { fontSize: 10, color: '#bbb', textAlign: 'right', marginTop: 6 },

  ratingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ratingBtn: { width: '47%', padding: 18, borderRadius: 16, alignItems: 'center' },
  ratingLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  saveBtn: { marginTop: 32, padding: 17, borderRadius: 14, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  badgeHint: { textAlign: 'center', color: '#888', fontSize: 12, marginTop: 14 },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 22, paddingBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  modalSearch: { backgroundColor: '#fff', padding: 14, borderRadius: 14, fontSize: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', color: COLORS.dark },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
});
