// Pre-auth landing screen. Placeholder visuals using existing
// primitives — W6 polishes the layout. W1.2b wires real auth on the
// Auth screen this navigates to.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import Polaroid from '../components/Polaroid';
import { Star, Sparkle } from '../components/Doodles';
import { COLORS } from '../lib/constants';
import { HANDWRITTEN_500 } from '../lib/theme';

const { width: W } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const goAuth = () => navigation.navigate('Auth');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Scattered decorative polaroids — behind the center content,
          non-blocking via pointerEvents="none" */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.polaroidSlot, { top: 60,  left: -28 }]}>
          <Polaroid
            emoji="🌴"
            title="Beach Lime"
            subtitle="June 14"
            washiColor="coral"
            tiltDeg={-3}
          />
        </View>
        <View style={[styles.polaroidSlot, { top: 100, right: -32 }]}>
          <Polaroid
            emoji="🍹"
            title="Night Out"
            subtitle="last weekend"
            washiColor="blue"
            tiltDeg={2}
          />
        </View>
        <View style={[styles.polaroidSlot, { bottom: 230, left: -24 }]}>
          <Polaroid
            emoji="🚗"
            title="Roadtrip"
            subtitle="someday soon"
            washiColor="amber"
            tiltDeg={-1.5}
          />
        </View>

        {/* Doodles */}
        <Sparkle size={16} color={COLORS.coral}     opacity={0.5} style={{ top: 220, right: 60 }} />
        <Star    size={14} color={COLORS.palmGreen} opacity={0.5} style={{ top: 380, left: 60 }} />
        <Sparkle size={14} color={COLORS.amber}     opacity={0.5} style={{ bottom: 280, right: 40 }} />
      </View>

      {/* Center content */}
      <View style={styles.center}>
        <Text style={styles.lemon}>🍋</Text>
        <Text style={[styles.title, HAND_500 && { fontFamily: HAND_500 }]}>We Limin'</Text>
        <Text style={styles.tagline}>Stop saving life for later.</Text>
      </View>

      {/* Bottom buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity onPress={goAuth} activeOpacity={0.85} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Start Limin'</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goAuth} activeOpacity={0.85} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Polaroid slots are sized so the underlying Polaroid component
  // looks proportionate when tilted into the corners.
  polaroidSlot: { position: 'absolute', width: 140 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  lemon: { fontSize: 64, marginBottom: 12 },
  title: {
    fontSize: 36, color: COLORS.coral,
    textAlign: 'center', letterSpacing: -0.6,
    lineHeight: 42,
    fontWeight: '700',  // fallback when Caveat hasn't loaded yet
  },
  tagline: {
    fontSize: 16, color: '#888', fontStyle: 'italic',
    textAlign: 'center', marginTop: 8,
  },

  buttons: {
    width: '60%', alignSelf: 'center',
    paddingBottom: 28,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: COLORS.coral,
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.coral,
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: COLORS.coral, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
