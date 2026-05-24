import React, { useContext } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { AppContext } from '../lib/AppContext';
import { COLORS, TIERS, getTier } from '../lib/constants';

// ─── Design system primitives ─────────────────────────────
import WashiTape from '../components/WashiTape';
import { Star, Sparkle, CurvedArrow } from '../components/Doodles';
import { HANDWRITTEN_500 } from '../lib/theme';

// Washi color cycle per tier row, in order.
const TIER_WASHI = ['mint', 'amber', 'coral', 'lavender', 'blue', 'pink', 'mint'];
// Alternating tilts (±2deg).
const TIER_TILT  = [-2, 2, -1.5, 1.5, -1.5, 2, -2];

const rangeText = (tier) => {
  if (tier.max === Infinity) return `${tier.min}+ adventures`;
  return `${tier.min}–${tier.max} adventures`;
};

export default function TiersScreen({ visible, onClose }) {
  // ─── PRESERVED: hook, tier detection, progress calculation ───
  const { myBadges } = useContext(AppContext);
  const insets = useSafeAreaInsets();
  const count = myBadges?.length || 0;
  const current = getTier(count);

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Sticky header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerBtn}
          >
            <Text style={styles.chev}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.title, HAND_500 && { fontFamily: HAND_500 }]}>tiers</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 22, paddingBottom: 60, position: 'relative' }}
          showsVerticalScrollIndicator={false}
        >
          {/* Page-edge doodles */}
          <Sparkle    size={14} color={COLORS.coral}     opacity={0.55} style={{ right: 6,  top: -4 }} />
          <Star       size={12} color={COLORS.palmGreen} opacity={0.5}  style={{ left:  -2, top: 8 }} />

          {/* Subtitle */}
          <Text style={[styles.subtitle, HAND_500 && { fontFamily: HAND_500 }]}>
            your lime journey
          </Text>

          {/* Tier cards */}
          <View style={{ marginTop: 16 }}>
            {TIERS.map((tier, idx) => {
              const unlocked  = count >= tier.min;
              const isCurrent = current.name === tier.name;
              const washi     = TIER_WASHI[idx % TIER_WASHI.length];
              const tilt      = TIER_TILT[idx % TIER_TILT.length];

              return (
                <View
                  key={tier.name}
                  style={[
                    styles.card,
                    { transform: [{ rotate: `${tilt}deg` }] },
                    isCurrent && styles.cardCurrent,
                    !unlocked && styles.cardLocked,
                  ]}
                >
                  <WashiTape
                    color={washi}
                    width="48%"
                    height={14}
                    rotation={-3}
                    opacity={unlocked ? 0.85 : 0.5}
                    style={{ top: -6, left: '26%' }}
                  />

                  {/* Status pill (inside, top-right of the card) */}
                  {isCurrent && (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>you are here ✨</Text>
                    </View>
                  )}
                  {unlocked && !isCurrent && (
                    <View style={styles.unlockedPill}>
                      <Text style={styles.unlockedPillText}>✓ unlocked</Text>
                    </View>
                  )}

                  {/* Tier emoji */}
                  <View style={[styles.emojiWrap, !unlocked && { opacity: 0.5 }]}>
                    <Text style={styles.emoji}>{tier.emoji}</Text>
                    {!unlocked && (
                      <View style={styles.lockOverlay}>
                        <Text style={styles.lockText}>🔒</Text>
                      </View>
                    )}
                  </View>

                  {/* Tier name */}
                  <Text style={[styles.tierName, !unlocked && { color: '#BBB' }]} numberOfLines={1}>
                    {tier.name}
                  </Text>

                  {/* Tagline */}
                  <Text style={[styles.tagline, !unlocked && { color: '#CCC' }]}>
                    {tier.tagline}
                  </Text>

                  {/* Range */}
                  <Text style={[styles.range, !unlocked && { color: '#CCC' }]}>
                    {rangeText(tier)}
                  </Text>

                  {/* Progress bar — only on the current tier card */}
                  {isCurrent && current.next && (
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(current.progress * 100)}%` },
                        ]}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Bottom-edge doodles */}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },
  title: { fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 34, textTransform: 'lowercase' },

  subtitle: {
    fontSize: 16, color: '#888', fontStyle: 'italic',
    textAlign: 'center', letterSpacing: -0.1, lineHeight: 22,
    marginTop: 4, marginBottom: 4,
    textTransform: 'lowercase',
  },

  // Tier card
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingTop: 24, paddingBottom: 18, paddingHorizontal: 18,
    marginBottom: 18,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 2,
  },
  cardCurrent: {
    borderWidth: 2, borderColor: COLORS.coral,
  },
  cardLocked: {
    backgroundColor: '#FAF6EB',
  },

  // Status pills (top-right inside the card)
  currentPill: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: COLORS.coral,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  currentPillText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.2, textTransform: 'lowercase' },

  unlockedPill: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: '#D6F0DD',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  unlockedPillText: { color: COLORS.palmGreen, fontSize: 10, fontWeight: '700', letterSpacing: 0.2, textTransform: 'lowercase' },

  // Emoji
  emojiWrap: { position: 'relative', marginTop: 6, marginBottom: 8 },
  emoji: { fontSize: 72, lineHeight: 80, textAlign: 'center' },
  lockOverlay: {
    position: 'absolute', bottom: 4, right: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: COLORS.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  lockText: { fontSize: 12 },

  tierName: { fontSize: 20, fontWeight: '500', color: COLORS.dark, letterSpacing: -0.3, textAlign: 'center', marginBottom: 4 },
  tagline:  { fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center', marginBottom: 6 },
  range:    { fontSize: 11, color: '#888', fontWeight: '500', textAlign: 'center', letterSpacing: 0.2, textTransform: 'lowercase' },

  // Progress (current tier only)
  progressTrack: {
    width: '78%',
    height: 6, borderRadius: 3,
    backgroundColor: '#F0EAD8',
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.coral },

  bottomAccents: { height: 50, marginTop: 6, position: 'relative' },
});
