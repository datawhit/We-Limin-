import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, Animated, Easing, Dimensions, StyleSheet,
} from 'react-native';
import { COLORS } from '../lib/constants';

// Best-effort library import — falls back to the in-file Animated
// confetti if the library isn't installed or fails to load.
let ConfettiCannon = null;
try { ConfettiCannon = require('react-native-confetti-cannon').default; } catch { /* noop */ }

const { width: W, height: H } = Dimensions.get('window');

// Tiny self-contained confetti burst — no native deps. ~30 emoji
// particles fall from the top with randomized x drift + rotation.
const CONFETTI = ['🍋', '✨', '🌴', '🎉', '🟢', '🟡', '🟠'];
const PARTICLE_COUNT = 30;

function Confetti({ visible }) {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }).map(() => ({
      x: Math.random() * W,
      drift: (Math.random() - 0.5) * 80,
      delay: Math.random() * 250,
      duration: 1600 + Math.random() * 900,
      emoji: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
      progress: new Animated.Value(0),
      rot: new Animated.Value(0),
      size: 16 + Math.random() * 14,
    }))
  ).current;

  useEffect(() => {
    if (!visible) {
      particles.forEach(p => { p.progress.setValue(0); p.rot.setValue(0); });
      return;
    }
    particles.forEach(p => {
      Animated.parallel([
        Animated.timing(p.progress, {
          toValue: 1, duration: p.duration, delay: p.delay,
          easing: Easing.bezier(0.2, 0.8, 0.4, 1), useNativeDriver: true,
        }),
        Animated.loop(
          Animated.timing(p.rot, {
            toValue: 1, duration: 900 + Math.random() * 600,
            easing: Easing.linear, useNativeDriver: true,
          })
        ),
      ]).start();
    });
  }, [visible]);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => {
        const translateY = p.progress.interpolate({ inputRange: [0, 1], outputRange: [-40, H + 40] });
        const translateX = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const rotate = p.rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
        const opacity = p.progress.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.Text
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              fontSize: p.size,
              transform: [{ translateY }, { translateX }, { rotate }],
              opacity,
            }}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

export default function BadgeUnlockModal({ visible, payload, onClose }) {
  // payload: { emoji, name, tierName, tierEmoji, tierTagline, leveledUp }
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      scale.setValue(0);
      opacity.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 70 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 2.5s
    closeTimerRef.current = setTimeout(() => { onClose?.(); }, 2500);
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [visible]);

  if (!visible || !payload) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.backdrop}>
        <Confetti visible={visible} />
        {ConfettiCannon && visible && (
          <ConfettiCannon
            count={140}
            origin={{ x: Dimensions.get('window').width / 2, y: -10 }}
            fadeOut
            explosionSpeed={420}
            fallSpeed={2600}
            colors={[COLORS.coral, COLORS.amber, COLORS.turquoise, COLORS.palmGreen, COLORS.limeGreen]}
          />
        )}

        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <Text style={styles.eyebrow}>BADGE UNLOCKED</Text>
          <Animated.Text style={[styles.bigEmoji, { transform: [{ scale }] }]}>
            {payload.emoji || '🏅'}
          </Animated.Text>
          <Text style={styles.badgeName}>{payload.name}</Text>

          {payload.leveledUp ? (
            <View style={styles.levelUp}>
              <Text style={styles.levelUpEyebrow}>LEVEL UP</Text>
              <Text style={styles.levelUpText}>
                {payload.tierEmoji} {payload.tierName}
              </Text>
              {payload.tierTagline ? (
                <Text style={styles.tagline}>{payload.tierTagline}</Text>
              ) : null}
            </View>
          ) : (
            payload.tierName ? (
              <Text style={styles.tierLine}>
                {payload.tierEmoji} {payload.tierName}
              </Text>
            ) : null
          )}

          <Text style={styles.dismiss}>tap to dismiss</Text>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: COLORS.cream,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 18 }, shadowRadius: 30,
    elevation: 10,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', color: COLORS.deepCoral, letterSpacing: 1.8, marginBottom: 14 },
  bigEmoji: { fontSize: 100, marginBottom: 14 },
  badgeName: { fontSize: 22, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.4, textAlign: 'center' },
  tierLine: { marginTop: 12, fontSize: 14, color: COLORS.deepAmber, fontWeight: '700' },

  levelUp: {
    marginTop: 18,
    backgroundColor: COLORS.amber,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  levelUpEyebrow: { fontSize: 10, fontWeight: '700', color: COLORS.deepAmber, letterSpacing: 1.8 },
  levelUpText: { fontSize: 18, fontWeight: '700', color: COLORS.deepAmber, marginTop: 4, letterSpacing: -0.3 },
  tagline: { fontSize: 12, fontStyle: 'italic', color: COLORS.deepAmber, marginTop: 4, opacity: 0.85 },

  dismiss: { marginTop: 22, fontSize: 11, color: '#aaa', letterSpacing: 0.4 },
});
