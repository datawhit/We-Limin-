import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, Animated,
  StyleSheet, Alert, ActionSheetIOS, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { ACTIVITIES, COLORS, RATINGS, TIER, getTier } from '../lib/constants';
import {
  supabase, extractPhotoPath, deleteMemoryRow,
} from '../lib/supabase';
import WashiTape from '../components/WashiTape';
import { Star, Sparkle } from '../components/Doodles';
import { HANDWRITTEN_500, PASTELS } from '../lib/theme';

export default function MemoryDetailScreen({ route, navigation }) {
  const { memory } = route.params || {};
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  // Defensive: bail to scrapbook if the screen was somehow pushed
  // without a memory payload. Keeps the rest of the render simple.
  if (!memory) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.chev}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={styles.headerBtn} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#888' }}>Memory not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activity = ACTIVITIES.find(a => a.id === memory.activity_id);
  const tier = activity ? TIER[activity.tier] : null;
  const rating = RATINGS.find(r => r.label === memory.rating);

  const date = memory.created_at
    ? new Date(memory.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const subtitle = activity?.location ? `${date || ''} · ${activity.location}` : date;

  // Badge pill (mirror Scrapbook's pickBadge logic for consistency).
  const pickBadge = () => {
    const hour = memory.created_at ? new Date(memory.created_at).getHours() : 12;
    if (hour >= 0 && hour < 4) return { emoji: '🦉', name: 'Night Owl' };
    if (hour >= 5 && hour < 7) return { emoji: '🌅', name: 'Sunrise Crew' };
    if (activity)              return { emoji: activity.badge || '🏅', name: activity.name };
    const t = getTier(0);
    return { emoji: t.emoji, name: t.name };
  };
  const badge = pickBadge();

  // Toast (post-delete success)
  const [toastVisible, setToastVisible] = useState(false);
  const toastY = React.useRef(new Animated.Value(-80)).current;
  const flashToast = () => {
    setToastVisible(true);
    toastY.setValue(-80);
    Animated.sequence([
      Animated.spring(toastY, { toValue: 12, useNativeDriver: true, friction: 6 }),
      Animated.delay(900),
      Animated.timing(toastY, { toValue: -80, duration: 220, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const openMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete memory'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (idx) => { if (idx === 1) confirmDelete(); }
      );
    } else {
      Alert.alert(
        'Memory options',
        null,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete memory', style: 'destructive', onPress: confirmDelete },
        ],
      );
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this memory?',
      "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDelete },
      ],
    );
  };

  const runDelete = async () => {
    if (deleting) return;
    setDeleting(true);

    // 1. Best-effort storage cleanup — orphaning is acceptable.
    const photoPath = extractPhotoPath(memory.photo_url);
    if (photoPath) {
      try {
        const { error: storageError } = await supabase
          .storage
          .from('Lime-Photos')
          .remove([photoPath]);
        if (storageError) {
          console.log('[memory-detail] storage remove failed (continuing):', storageError);
        }
      } catch (e) {
        console.log('[memory-detail] storage remove threw (continuing):', e);
      }
    }

    // 2. Hard-delete the row. This is the authoritative step.
    try {
      await deleteMemoryRow(memory.id);
    } catch (dbError) {
      console.warn('[memory-detail] db delete failed:', dbError);
      setDeleting(false);
      Alert.alert('Oops', "Couldn't delete memory. Try again.");
      return;
    }

    setDeleting(false);
    // ScrapbookScreen reloads on focus, so simply pop back.
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Toast */}
      {toastVisible && (
        <Animated.View
          style={[styles.toast, { top: insets.top + 12, transform: [{ translateY: toastY }] }]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>Memory deleted</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.chev}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={openMenu}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          disabled={deleting}
        >
          <Text style={styles.menuDots}>⋮</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Page-edge doodles */}
        <Sparkle size={14} color={COLORS.coral}     opacity={0.55} style={{ right: 14, top: 6 }} />
        <Star    size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: 18,  top: 20 }} />

        {/* Hero polaroid */}
        <View style={styles.heroWrap}>
          <View style={styles.heroPolaroid}>
            <WashiTape color="amber" width="38%" height={16} rotation={-3} style={{ top: -8, left: '31%' }} />
            {memory.photo_url ? (
              <Image source={{ uri: memory.photo_url }} style={styles.heroPhoto} />
            ) : (
              <View style={[styles.heroPhotoBox, { backgroundColor: PASTELS.amberBg }]}>
                <Text style={styles.heroEmoji}>{activity?.emoji || '📸'}</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroName} numberOfLines={2}>
            {activity?.name || (memory.caption ? memory.caption : 'A lime')}
          </Text>

          <View style={styles.pillsRow}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{badge.emoji} {badge.name}</Text>
            </View>
            {tier && (
              <View style={[styles.tierPill, { backgroundColor: tier.bg }]}>
                <Text style={[styles.tierPillText, { color: tier.text }]}>{(tier.label || '').toLowerCase()} tier</Text>
              </View>
            )}
            {rating && (
              <View style={[styles.ratingPill, { backgroundColor: rating.color }]}>
                <Text style={[styles.ratingPillText, { color: rating.textColor }]}>{rating.icon} {rating.label}</Text>
              </View>
            )}
          </View>

          {subtitle ? <Text style={styles.dateLine}>{subtitle}</Text> : null}
        </View>

        {/* Caption */}
        {memory.caption ? (
          <View style={styles.captionWrap}>
            <Text style={[styles.captionLabel, HAND_500 && { fontFamily: HAND_500 }]}>the story</Text>
            <View style={styles.captionCard}>
              <Text style={styles.captionText}>{memory.caption}</Text>
            </View>
          </View>
        ) : null}

        {/* Deleting overlay (inline so the page doesn't jump) */}
        {deleting && (
          <View style={styles.deletingBox}>
            <ActivityIndicator color={COLORS.dark} />
            <Text style={styles.deletingText}>deleting...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header (matches ActivityDetailScreen pattern)
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },
  menuDots: { fontSize: 24, color: COLORS.dark, fontWeight: '700' },

  // Hero
  heroWrap: { alignItems: 'center', paddingHorizontal: 22, marginTop: 8, marginBottom: 22 },
  heroPolaroid: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingTop: 18, paddingHorizontal: 14, paddingBottom: 14,
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2,
    position: 'relative',
    marginBottom: 16,
    width: 240,
    alignItems: 'center',
  },
  heroPhoto: { width: 208, height: 260, borderRadius: 16 },
  heroPhotoBox: { width: 208, height: 208, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 80 },

  heroName: { fontSize: 26, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.6, textAlign: 'center', marginBottom: 10 },
  dateLine: { fontSize: 12, color: '#888', marginTop: 8 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  badgePill: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: '#F2C84B' },
  badgePillText: { fontSize: 11, fontWeight: '700', color: '#3C2A0E' },
  tierPill: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999 },
  tierPillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  ratingPill: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999 },
  ratingPillText: { fontSize: 11, fontWeight: '700' },

  // Caption
  captionWrap: { paddingHorizontal: 22, marginTop: 10 },
  captionLabel: { fontSize: 18, color: COLORS.dark, letterSpacing: -0.2, marginBottom: 8 },
  captionCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14 },
  captionText: { fontSize: 14, color: COLORS.dark, lineHeight: 21 },

  // Deleting overlay (inline)
  deletingBox: { alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  deletingText: { color: '#aaa', fontSize: 12, marginTop: 10 },

  // Toast — `top` is applied inline from useSafeAreaInsets() so it sits
  // below the Dynamic Island regardless of modal context.
  toast: {
    position: 'absolute', left: 22, right: 22, zIndex: 9999, elevation: 10,
    backgroundColor: COLORS.dark, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
  },
  toastText: { color: COLORS.cream, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
