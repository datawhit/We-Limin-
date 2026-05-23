// Polaroid card — the building block of "The Lineup" grid and any
// other scrapbook surface that wants an off-kilter photo-card feel.
//
//   <Polaroid
//     emoji="🌴"          // required
//     title="Visit Japan" // required
//     subtitle="Earns: 🗺️"
//     washiColor="pink"   // 'pink' | 'blue' | 'coral' | 'lavender' | 'amber'
//     emojiBg="#FDEED7"   // optional override; defaults to washi-paired pastel
//     tiltDeg={-2}        // optional; defaults to a stable random in [-2, 2]
//     pill="up next"      // optional; if "from spin" it shows in the subtitle line instead
//     completed={false}   // optional; adds a small ✓ corner badge
//     onPress={() => …}
//   />

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../lib/constants';
import { WASHI_TO_EMOJI_BG } from '../lib/theme';
import WashiTape from './WashiTape';

export default function Polaroid({
  emoji,
  title,
  subtitle,
  washiColor = 'amber',
  emojiBg,
  tiltDeg,
  pill,
  completed = false,
  onPress,
  style,
}) {
  // Stable random tilt within ±2deg if the caller didn't specify one.
  // Recomputes only when the prop actually changes.
  const tilt = useMemo(
    () => (typeof tiltDeg === 'number' ? tiltDeg : -2 + Math.random() * 4),
    [tiltDeg]
  );

  const boxBg = emojiBg || WASHI_TO_EMOJI_BG[washiColor] || COLORS.cream;
  const fromSpin = pill === 'from spin';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.polaroid, { transform: [{ rotate: `${tilt}deg` }] }, style]}
    >
      <WashiTape color={washiColor} width="50%" rotation={-3} style={{ top: -8, left: '25%' }} />

      <View style={[styles.emojiBox, { backgroundColor: boxBg }, completed && { opacity: 0.7 }]}>
        <Text style={{ fontSize: 44 }}>{emoji}</Text>
      </View>

      {completed && (
        <View style={styles.completedPip}>
          <Text style={styles.completedPipText}>✓</Text>
        </View>
      )}

      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {subtitle ? (
        <Text
          style={[styles.subtitle, fromSpin && styles.subtitleFromSpin]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}

      {pill && !fromSpin && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{pill}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  polaroid: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingTop: 16,
    paddingHorizontal: 10,
    paddingBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    position: 'relative',
    minHeight: 184,
  },
  emojiBox: {
    width: '100%', aspectRatio: 1.15, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 2, letterSpacing: -0.2 },
  subtitle: { fontSize: 11, color: '#888' },
  subtitleFromSpin: { color: COLORS.deepCoral, fontWeight: '600' },
  pill: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FCEDC9' },
  pillText: { fontSize: 11, fontWeight: '700', color: COLORS.deepAmber },
  completedPip: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.palmGreen,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  completedPipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
