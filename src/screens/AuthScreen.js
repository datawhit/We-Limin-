// Auth surface. Looks like the real sign-in flow — three provider
// buttons (Apple / Google / Email) all route through to the existing
// SetupScreen onboarding as a temporary bypass. W1.2b replaces each
// button with real magic-link / Apple / Google OAuth.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { Sparkle } from '../components/Doodles';
import { HANDWRITTEN_500 } from '../lib/theme';

// Local palette — inline for now (W2 moves to theme tokens)
const BG_CREAM    = '#F5EBDD';
const INK_DARK    = '#2B2620';
const INK_MUTED   = '#6B5D45';
const BTN_BORDER  = '#E5DDD0';
const GOLD_ACCENT = '#D4A445';

export default function AuthScreen({ navigation }) {
  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  // Temporary bypass — W1.2b will replace this with real magic-link /
  // Apple / Google flows. For now, every auth button routes the user
  // into the existing onboarding so they can finish setup → Tabs.
  const goSetup = () => navigation.navigate('Setup');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Decorative — single gold sparkle, upper right */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Sparkle size={18} color={GOLD_ACCENT} opacity={0.3} style={{ top: 80, right: 36 }} />
      </View>

      {/* Header — chevron back only */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Text style={styles.chev}>‹</Text>
        </TouchableOpacity>
      </View>

      {/* Center column */}
      <View style={styles.center}>
        <Text style={[styles.headline, HAND_500 && { fontFamily: HAND_500 }]}>
          Let's plan a lime
        </Text>
        <Text style={styles.subhead}>
          A few quick things and we'll build your board.
        </Text>

        {/* Auth provider buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity onPress={goSetup} activeOpacity={0.85} style={styles.appleBtn}>
            <Text style={styles.appleBtnText}>🍎  Continue with Apple</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goSetup} activeOpacity={0.85} style={styles.providerBtn}>
            <Text style={styles.providerBtnText}>🔵  Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goSetup} activeOpacity={0.85} style={styles.providerBtn}>
            <Text style={styles.providerBtnText}>✉️  Continue with Email</Text>
          </TouchableOpacity>
        </View>

        {/* Sign-in row */}
        <View style={styles.signInRow}>
          <Text style={styles.signInPrompt}>already limin'?</Text>
          <TouchableOpacity onPress={goSetup} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <Text style={styles.signInLink}> Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG_CREAM },

  // Header
  header: { paddingHorizontal: 12, paddingTop: 4 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: INK_DARK, fontWeight: '400', lineHeight: 28 },

  // Center column — sits about 30% down from top, fills remaining space
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  headline: {
    fontSize: 32, color: INK_DARK,
    textAlign: 'center', letterSpacing: -0.5,
    lineHeight: 38,
    fontWeight: '700', // fallback before Caveat loads
  },
  subhead: {
    fontSize: 14, color: INK_MUTED,
    textAlign: 'center', marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 24,
  },

  // Buttons
  buttons: {
    width: '80%', alignSelf: 'center',
    marginTop: 32,
  },
  appleBtn: {
    backgroundColor: INK_DARK,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  appleBtnText: { color: '#fff', fontSize: 15, fontWeight: '500', letterSpacing: 0.2 },

  providerBtn: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: BTN_BORDER,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  providerBtnText: { color: INK_DARK, fontSize: 15, fontWeight: '500', letterSpacing: 0.2 },

  // Sign-in row
  signInRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 24,
  },
  signInPrompt: { fontSize: 14, color: INK_MUTED },
  signInLink:   { fontSize: 14, color: INK_DARK, textDecorationLine: 'underline' },
});
