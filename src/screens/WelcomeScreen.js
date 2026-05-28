// Pre-auth landing. Warm editorial scrapbook aesthetic — layered
// polaroids, sticky notes, restrained gold accents. No coral, no
// childish overload. Both buttons route to the Auth screen, which
// hosts the real sign-in surface (wired in W1.2b).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import Polaroid from '../components/Polaroid';
import WashiTape from '../components/WashiTape';
import { Star, Sparkle } from '../components/Doodles';
import { HANDWRITTEN_500 } from '../lib/theme';

const { width: W, height: H } = Dimensions.get('window');

// Local palette — inline for now (W2 moves to theme tokens)
const BG_CREAM     = '#F5EBDD'; // warmer than COLORS.cream
const INK_DARK     = '#2B2620'; // warm charcoal — replaces pure black
const INK_MUTED    = '#6B5D45'; // warm muted brown
const PAPER_NOTE   = '#FDF6E3'; // sticky-note paper
const GOLD_ACCENT  = '#D4A445'; // warm gold for doodles

export default function WelcomeScreen({ navigation }) {
  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const goAuth = () => navigation.navigate('Auth');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ─── Decorative layer ─── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* Layered polaroids */}
        <View style={[styles.polaroidSlot, { top: H * 0.10, left:  W * 0.08 }]}>
          <Polaroid emoji="🌅" title="Sunrise walk" subtitle="early start"
            washiColor="amber" tiltDeg={-4} />
        </View>
        <View style={[styles.polaroidSlot, { top: H * 0.14, right: W * 0.06 }]}>
          <Polaroid emoji="🪔" title="Slow dinner" subtitle="friday night"
            washiColor="mint" tiltDeg={3} />
        </View>
        <View style={[styles.polaroidSlot, { top: H * 0.28, right: W * 0.16 }]}>
          <Polaroid emoji="🌴" title="Long lunch" subtitle="someday soon"
            washiColor="amber" tiltDeg={-2} />
        </View>

        {/* Sticky notes */}
        <View style={[styles.stickyNote, { top: H * 0.06, right: W * 0.05, transform: [{ rotate: '4deg' }] }]}>
          <WashiTape color="coral" width="55%" height={8} rotation={-4} opacity={0.85}
            style={{ top: -4, left: '22%' }} />
          <Text style={[styles.stickyText, HAND_500 && { fontFamily: HAND_500 }]}>
            good people, good vibes
          </Text>
        </View>
        <View style={[styles.stickyNote, { top: H * 0.36, left: W * 0.04, transform: [{ rotate: '-3deg' }] }]}>
          <WashiTape color="amber" width="55%" height={8} rotation={3} opacity={0.85}
            style={{ top: -4, left: '22%' }} />
          <Text style={[styles.stickyText, HAND_500 && { fontFamily: HAND_500 }]}>
            outside today?
          </Text>
        </View>

        {/* Restrained gold doodles */}
        <Star    size={18} color={GOLD_ACCENT} opacity={0.35} style={{ top: H * 0.05, right: W * 0.18 }} />
        <Sparkle size={16} color={GOLD_ACCENT} opacity={0.35} style={{ bottom: H * 0.28, left: W * 0.10 }} />
      </View>

      {/* ─── Center column ─── */}
      <View style={[styles.center, { top: H * 0.55 }]}>
        <Text style={[styles.headline, HAND_500 && { fontFamily: HAND_500 }]}>
          What's your next vibe?
        </Text>
        <Text style={styles.subhead}>
          Let's plan something you'll love.
        </Text>
      </View>

      {/* ─── Bottom action zone ─── */}
      <View style={styles.bottom}>
        <TouchableOpacity onPress={goAuth} activeOpacity={0.85} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Start Limin'</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goAuth} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} style={styles.signInLinkWrap}>
          <Text style={styles.signInLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG_CREAM },

  // Polaroid slots — fixed width so the underlying card looks
  // proportionate after tilt; the Polaroid component sets its own height.
  polaroidSlot: { position: 'absolute', width: 140 },

  // Sticky notes — torn-paper feel with a washi strip on top
  stickyNote: {
    position: 'absolute',
    width: 130,
    backgroundColor: PAPER_NOTE,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 3 }, shadowRadius: 5, elevation: 2,
  },
  stickyText: {
    fontSize: 14, color: INK_DARK,
    fontStyle: 'italic',
    letterSpacing: -0.1, lineHeight: 18,
    textAlign: 'center',
  },

  // Center column anchored at 55% from top so polaroids breathe above
  center: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  headline: {
    fontSize: 32, color: INK_DARK,
    textAlign: 'center', letterSpacing: -0.5,
    lineHeight: 38,
    fontWeight: '700',  // fallback before Caveat loads
  },
  subhead: {
    fontSize: 16, color: INK_MUTED,
    fontStyle: 'italic',
    textAlign: 'center', marginTop: 8,
    lineHeight: 22,
  },

  // Bottom action zone
  bottom: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingBottom: 32, paddingTop: 24,
    alignItems: 'center',
  },
  primaryBtn: {
    width: '75%',
    backgroundColor: INK_DARK,
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '500', letterSpacing: 0.2 },

  signInLinkWrap: { marginTop: 16, paddingVertical: 4 },
  signInLink: {
    fontSize: 14, color: INK_MUTED,
    textDecorationLine: 'underline',
  },
});
