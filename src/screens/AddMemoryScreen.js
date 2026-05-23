import React, { useContext, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import * as ImagePicker from 'expo-image-picker';
import { AppContext } from '../lib/AppContext';
import { ACTIVITIES, COLORS, RATINGS, TIER, getTier } from '../lib/constants';
import { addMemory, uploadPhoto, earnBadge, getMemories } from '../lib/supabase';
import BadgeUnlockModal from '../components/BadgeUnlockModal';
import { checkAndUnlockHiddenBadges } from '../lib/hiddenBadges';

// ─── Design system primitives ─────────────────────────────
import WashiTape from '../components/WashiTape';
import { Star, Sparkle, CurvedArrow } from '../components/Doodles';
import { PASTELS, HANDWRITTEN_500 } from '../lib/theme';

// Pastel emoji-square color per tier (used in the prefill card).
const TIER_BG = {
  chill: PASTELS.mintBg,
  bold:  PASTELS.amberBg,
  wild:  PASTELS.lavenderBg,
};

// Mood tiles (id → emoji/label/pastel). The id is what we persist to
// the `mood` column on memories; the rest is display-only.
const MOODS = [
  { id: 'good_vibes',  emoji: '😊', label: 'good vibes',  bg: PASTELS.amberBg    },
  { id: 'lit',         emoji: '🔥', label: 'lit',         bg: PASTELS.coralBg    },
  { id: 'chill',       emoji: '💚', label: 'chill',       bg: PASTELS.mintBg     },
  { id: 'core_memory', emoji: '🥹', label: 'core memory', bg: PASTELS.lavenderBg },
];

export default function AddMemoryScreen({ navigation, route }) {
  const { profile, myBadges, setMyBadges } = useContext(AppContext);
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#FFFFFF';
  const insets = useSafeAreaInsets();

  // ─── PRESERVED hooks ───
  const [activity, setActivity] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [rating, setRating] = useState(null); // legacy — no longer rendered, kept for hook parity
  const [saving, setSaving] = useState(false);
  const [unlockQueue, setUnlockQueue] = useState([]);

  // ─── NEW state ───
  const [mood, setMood] = useState(null);       // selected mood id, e.g. 'lit'
  const [location, setLocation] = useState(''); // free-text venue/city

  // Pre-fill from "capture this lime" navigation. ActivityDetailScreen
  // passes route.params.prefillActivity = { id, name, emoji, tier }.
  // Resolve to a full ACTIVITIES entry so the prefill card renders the
  // tier-tinted square and the save payload carries activity_id.
  const prefillActivity = route?.params?.prefillActivity;
  useEffect(() => {
    if (!prefillActivity?.id) return;
    const match = ACTIVITIES.find(a => a.id === prefillActivity.id);
    setActivity(match || {
      id: prefillActivity.id,
      name: prefillActivity.name,
      emoji: prefillActivity.emoji,
      tier: prefillActivity.tier,
    });
  }, [prefillActivity?.id]);

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

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
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setPhoto({ uri: a.uri, base64: a.base64, mimeType: a.mimeType });
    }
  };

  // A photo is the one required input. Mood/caption/location are all
  // optional; activity is only attached when prefilled from
  // "capture this lime".
  const canSave = !!photo && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const photoUrl = await uploadPhoto(
        { base64: photo.base64, mimeType: photo.mimeType, fileName: 'memory' },
        profile.id,
        'memories'
      );
      await addMemory({
        profile_id: profile.id,
        activity_id: activity?.id || null,
        photo_url: photoUrl,
        caption: caption.trim() || null,
        rating: rating?.label || null,
        mood: mood || null,
        location: location.trim() || null,
      });

      // Only run badge logic when an activity is attached. Standalone
      // memories don't unlock activity badges.
      const justEarnedBadge = !!activity && !myBadges.includes(activity.id);
      let nextBadges = myBadges;
      if (justEarnedBadge) {
        await earnBadge(profile.id, activity.id);
        nextBadges = [activity.id, ...myBadges];
        setMyBadges(nextBadges);
      }

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
        const allMems = await getMemories().catch(() => []);
        const mineAfter = allMems.filter(m => m.profile_id === profile.id);
        const newly = await checkAndUnlockHiddenBadges({
          trigger: 'memory_added',
          memory: { created_at: new Date().toISOString(), activity_id: activity?.id || null, profile_ids: [profile.id] },
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

  const tierBg = activity ? (TIER_BG[activity.tier] || PASTELS.coralBg) : PASTELS.coralBg;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BadgeUnlockModal
        visible={unlockQueue.length > 0}
        payload={unlockQueue[0]}
        onClose={advanceUnlock}
      />

      {/* Header — outside ScrollView so it never scrolls under status bar */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.chev}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, HAND_500 && { fontFamily: HAND_500 }]}>new memory</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 22, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top-edge decorative doodles */}
          <Sparkle    size={14} color={COLORS.coral}     opacity={0.55} style={{ right: 8,  top: -8 }} />
          <Star       size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: -4, top: 4 }} />

          {/* ─── Pre-filled activity card (only if navigated from ActivityDetail) ─── */}
          {activity && (
            <View style={styles.prefillCard}>
              <WashiTape color="coral" width={56} height={12} rotation={-6} opacity={0.85} style={{ top: -4, left: 14 }} />
              <View style={[styles.prefillEmojiBox, { backgroundColor: tierBg }]}>
                <Text style={{ fontSize: 22 }}>{activity.emoji}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.prefillName} numberOfLines={1}>{activity.name}</Text>
                <Text style={styles.prefillSub}>capturing this lime ✨</Text>
              </View>
            </View>
          )}

          {/* ─── Photo ─── */}
          <View style={{ position: 'relative', marginTop: activity ? 18 : 6 }}>
            {photo ? (
              <TouchableOpacity onPress={pickPhoto} style={styles.photoBox} activeOpacity={0.9}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={pickPhoto} style={styles.photoPlaceholder} activeOpacity={0.9}>
                <Text style={styles.photoPlaceholderEmoji}>📸</Text>
                <Text style={[styles.photoPlaceholderTitle, HAND_500 && { fontFamily: HAND_500 }]}>add a photo</Text>
                <Text style={styles.photoPlaceholderSub}>tap to pick or take one</Text>
              </TouchableOpacity>
            )}
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

          {/* ─── Caption ─── */}
          <WashiLabel text="caption" color="coral" rotation={-3} hand500={HAND_500} />
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="what happened? any stories?"
            placeholderTextColor="#bbb"
            multiline
            style={styles.textField}
            maxLength={280}
          />
          <Text style={styles.charCount}>{caption.length}/280</Text>

          {/* ─── Mood ─── */}
          <WashiLabel text="mood" color="amber" rotation={2} hand500={HAND_500} />
          <View style={styles.moodRow}>
            {MOODS.map(m => {
              const on = mood === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMood(prev => prev === m.id ? null : m.id)}
                  style={({ pressed }) => [
                    styles.moodTile,
                    on && { backgroundColor: m.bg, borderColor: '#E8704F', borderWidth: 2 },
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  {on && <Sparkle size={10} color={COLORS.amber} opacity={0.9} style={{ right: 6, top: 4 }} />}
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={styles.moodLabel}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ─── Location ─── */}
          <WashiLabel text="location" color="mint" rotation={-2} hand500={HAND_500} />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="where did this happen? (optional)"
            placeholderTextColor="#bbb"
            style={[styles.textField, { minHeight: 0, paddingVertical: 14 }]}
          />

          {/* ─── Hero save ─── */}
          <View style={styles.saveWrap}>
            <Pressable
              onPress={save}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveBtn,
                !canSave && { opacity: 0.45 },
                pressed && { transform: [{ rotate: '-2deg' }, { scale: 0.97 }] },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>save this memory ✨</Text>
              )}
            </Pressable>
            <Sparkle size={18} color={COLORS.coral} opacity={0.55} style={{ right: 18, top: 6 }} />
          </View>

          {activity && !myBadges.includes(activity.id) && (
            <Text style={styles.badgeHint}>
              ✨ You'll also earn the {activity.badge || '🏅'} badge
            </Text>
          )}

          {/* Bottom-edge decorative doodles */}
          <View pointerEvents="none" style={styles.bottomAccents}>
            <Star       size={12} color={COLORS.amber}     opacity={0.55} style={{ left: 28,  top: 0 }} />
            <CurvedArrow size={32} color={COLORS.coral}    opacity={0.45} style={{ right: 28, top: 8, transform: [{ rotate: '110deg' }] }} />
            <Sparkle    size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: '52%', top: 22 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Reusable washi-tape field label ─────────────────────
function WashiLabel({ text, color, rotation, hand500 }) {
  return (
    <View style={labelStyles.wrap}>
      <WashiTape color={color} width={92} height={14} rotation={rotation} opacity={0.85} style={{ top: 8, left: -6 }} />
      <Text style={[labelStyles.text, hand500 && { fontFamily: hand500 }]}>{text}</Text>
    </View>
  );
}

const labelStyles = StyleSheet.create({
  wrap: { position: 'relative', alignSelf: 'flex-start', marginTop: 24, marginBottom: 10 },
  text: { fontSize: 20, color: COLORS.dark, letterSpacing: -0.3, lineHeight: 24 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header (matches Settings/ActivityDetail pattern)
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },
  topTitle: { fontSize: 26, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 32, textTransform: 'lowercase' },

  // Pre-filled activity card (locked, from ActivityDetail)
  prefillCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14, borderWidth: 1, borderColor: '#EBE2D0',
    padding: 12,
    position: 'relative',
    marginBottom: 4,
    transform: [{ rotate: '-1deg' }],
  },
  prefillEmojiBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prefillName: { fontSize: 14, fontWeight: '500', color: COLORS.dark, letterSpacing: -0.2, textTransform: 'lowercase' },
  prefillSub: { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 3 },

  // Photo (no-photo placeholder)
  photoPlaceholder: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#EBE2D0',
    height: 240,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-1deg' }],
  },
  photoPlaceholderEmoji: { fontSize: 56, marginBottom: 10 },
  photoPlaceholderTitle: { fontSize: 20, color: COLORS.dark, letterSpacing: -0.3, lineHeight: 24 },
  photoPlaceholderSub: { fontSize: 12, color: '#888', marginTop: 4, textTransform: 'lowercase' },

  // Photo (selected preview)
  photoBox: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#EBE2D0' },
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

  // Text field (caption + location)
  textField: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#EBE2D0',
    padding: 14,
    fontSize: 14, color: COLORS.dark,
    minHeight: 96, textAlignVertical: 'top',
    lineHeight: 21,
  },
  charCount: { fontSize: 10, color: '#bbb', textAlign: 'right', marginTop: 6 },

  // Mood tiles
  moodRow: { flexDirection: 'row', gap: 8 },
  moodTile: {
    flex: 1,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#EBE2D0',
    padding: 12,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  moodEmoji: { fontSize: 28, marginBottom: 4 },
  moodLabel: { fontSize: 11, fontWeight: '500', color: COLORS.dark, textTransform: 'lowercase', textAlign: 'center' },

  // Hero save
  saveWrap: { marginTop: 28, position: 'relative' },
  saveBtn: {
    backgroundColor: '#E8704F',
    height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  badgeHint: { textAlign: 'center', color: '#888', fontSize: 12, marginTop: 14 },

  // Bottom decorative
  bottomAccents: { height: 50, marginTop: 18, position: 'relative' },
});
