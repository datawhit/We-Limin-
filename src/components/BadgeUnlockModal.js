// One-shot "you unlocked" celebration modal. Fires after a memory save
// that earned a new badge and/or pushed the user into a new tier.
//
//   <BadgeUnlockModal
//     visible={!!unlock}
//     badge={{ emoji, name, tagline } | null}
//     tier={{ emoji, name, tagline } | null}
//     onDismiss={() => { setUnlock(null); navigation.goBack(); }}
//   />
//
// Either `badge` or `tier` (or both) must be provided to show anything.
// If only `tier` is set, only the level-up section renders.

import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, Animated, Easing,
  Dimensions, StyleSheet,
} from 'react-native';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { COLORS } from '../lib/constants';
import { HANDWRITTEN_500 } from '../lib/theme';
import WashiTape from './WashiTape';
import { Sparkle, Star } from './Doodles';

const { width: W, height: H } = Dimensions.get('window');

const CONFETTI_COUNT  = 8;
const CONFETTI_COLORS = [COLORS.coral, COLORS.amber, COLORS.palmGreen, '#C4B5F0']; // lavender = tape color

export default function BadgeUnlockModal({ visible, badge, tier, onDismiss }) {
  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const hand500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  // Backdrop fade-in (200ms) + card scale-in (spring, slight overshoot).
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale       = useRef(new Animated.Value(0)).current;

  // 8 confetti dots — each falls once from above the screen to below.
  // Position + delay + duration randomized for visual variety.
  const confettiDots = useRef(
    Array.from({ length: CONFETTI_COUNT }).map(() => ({
      color:      CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      x:          Math.random() * (W - 12),
      delay:      Math.random() * 500,
      duration:   1500 + Math.random() * 1000,
      size:       8 + Math.random() * 6,
      translateY: new Animated.Value(-40),
    }))
  ).current;

  useEffect(() => {
    if (!visible) {
      backdropOpacity.setValue(0);
      cardScale.setValue(0);
      confettiDots.forEach(d => d.translateY.setValue(-40));
      return;
    }

    Animated.timing(backdropOpacity, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();
    Animated.spring(cardScale, {
      toValue: 1, friction: 5, tension: 70, useNativeDriver: true,
    }).start();

    confettiDots.forEach(d => {
      d.translateY.setValue(-40);
      Animated.timing(d.translateY, {
        toValue:  H + 40,
        duration: d.duration,
        delay:    d.delay,
        easing:   Easing.bezier(0.2, 0.8, 0.4, 1),
        useNativeDriver: true,
      }).start();
    });

    // Auto-dismiss after 2.5s. Tapping anywhere also dismisses.
    const t = setTimeout(() => { onDismiss?.(); }, 2500);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible || (!badge && !tier)) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      {/* Tappable backdrop covers the whole screen */}
      <TouchableOpacity activeOpacity={1} onPress={onDismiss} style={styles.flex}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          {/* Confetti dots — behind the card, pointer-events none */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {confettiDots.map((d, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left:     d.x,
                  top:      0,
                  width:    d.size,
                  height:   d.size,
                  borderRadius: d.size / 2,
                  backgroundColor: d.color,
                  transform: [{ translateY: d.translateY }],
                }}
              />
            ))}
          </View>

          {/* Centered card */}
          <View style={styles.center} pointerEvents="box-none">
            {/* Scattered decorative doodles around the card */}
            <View pointerEvents="none" style={styles.doodleLayer}>
              <Sparkle size={18} color={COLORS.coral}     opacity={0.5} style={{ left:  '12%', top: '24%' }} />
              <Star    size={14} color={COLORS.amber}     opacity={0.5} style={{ right: '14%', top: '22%' }} />
              <Sparkle size={14} color={COLORS.palmGreen} opacity={0.5} style={{ left:  '18%', bottom: '24%' }} />
              <Star    size={16} color={COLORS.coral}     opacity={0.5} style={{ right: '16%', bottom: '22%' }} />
              <Sparkle size={12} color={COLORS.amber}     opacity={0.5} style={{ left:  '50%', top: '14%' }} />
              <Star    size={12} color={COLORS.palmGreen} opacity={0.5} style={{ left:  '50%', bottom: '14%' }} />
            </View>

            <Animated.View
              style={[
                styles.card,
                { transform: [{ scale: cardScale }, { rotate: '-2deg' }] },
              ]}
            >
              <WashiTape color="amber" width="50%" rotation={-3} style={{ top: -8, left: '25%' }} />

              {/* Top section — primary badge */}
              {badge && (
                <View style={styles.section}>
                  <Text style={[styles.eyebrow, hand500 && { fontFamily: hand500 }]}>you unlocked</Text>
                  <Text style={styles.bigEmoji}>{badge.emoji || '🏅'}</Text>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                  {badge.tagline ? (
                    <Text style={styles.badgeTagline}>{badge.tagline}</Text>
                  ) : null}
                </View>
              )}

              {/* Divider only when both sections are present */}
              {badge && tier && <View style={styles.divider} />}

              {/* Bottom section — tier crossover */}
              {tier && (
                <View style={styles.section}>
                  <Text style={[styles.levelEyebrow, hand500 && { fontFamily: hand500 }]}>level up</Text>
                  <Text style={styles.tierEmoji}>{tier.emoji || '🍋'}</Text>
                  <Text style={styles.tierName}>{tier.name}</Text>
                  {tier.tagline ? (
                    <Text style={styles.tierTagline}>{tier.tagline}</Text>
                  ) : null}
                </View>
              )}

              <Text style={styles.dismissHint}>tap anywhere to continue</Text>
            </Animated.View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const CARD_WIDTH = Math.round(W * 0.8);

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Semi-transparent cream backdrop (per spec)
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(245, 240, 232, 0.92)',
  },

  // Centers the card + doodle layer on top of the backdrop
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Doodle layer mirrors the centered card area so corner-positioned
  // doodles sit just outside the card edges.
  doodleLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },

  // White polaroid-style card, washi tape on top, -2deg tilt
  card: {
    backgroundColor: '#fff',
    width: CARD_WIDTH,
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 18,
    paddingHorizontal: 22,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1, borderColor: COLORS.cardBorder,
    shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24,
    elevation: 12,
  },

  section: { alignItems: 'center', width: '100%' },

  // Primary badge section
  eyebrow:      { fontSize: 20, color: COLORS.palmGreen, letterSpacing: -0.2, lineHeight: 24, marginBottom: 6 },
  bigEmoji:     { fontSize: 96, lineHeight: 110, marginBottom: 6 },
  badgeName:    { fontSize: 24, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.5, textAlign: 'center', marginBottom: 6 },
  badgeTagline: { fontSize: 14, color: '#888', fontStyle: 'italic', textAlign: 'center' },

  // Divider between badge and tier sections
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#EBE2D0',
    marginVertical: 18,
  },

  // Level-up section
  levelEyebrow: { fontSize: 16, color: COLORS.coral, letterSpacing: -0.1, lineHeight: 20, marginBottom: 4 },
  tierEmoji:    { fontSize: 56, lineHeight: 66, marginBottom: 4 },
  tierName:     { fontSize: 20, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.3, textAlign: 'center', marginBottom: 4 },
  tierTagline:  { fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center' },

  // Bottom dismiss hint
  dismissHint: { marginTop: 18, fontSize: 11, color: '#BBB', letterSpacing: 0.4, textAlign: 'center' },
});
