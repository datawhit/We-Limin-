// Stub. W1.2b replaces the body with the real magic-link / Apple /
// Google surface and wires the deep-link callback.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import { COLORS } from '../lib/constants';
import { HANDWRITTEN_500 } from '../lib/theme';

export default function AuthScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.chev}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerBtn} />
        <View style={styles.headerBtn} />
      </View>

      {/* Center column */}
      <View style={styles.center}>
        <Text style={[styles.title, HAND_500 && { fontFamily: HAND_500 }]}>✨ Let's plan a lime</Text>
        <Text style={styles.sub}>auth wiring lands in W1.2b</Text>
      </View>

      {/* Back button */}
      <View style={styles.buttons}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back to welcome</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },

  center: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28, color: COLORS.dark,
    textAlign: 'center', letterSpacing: -0.4, lineHeight: 34,
    fontWeight: '600',  // fallback when Caveat hasn't loaded yet
    marginBottom: 10,
  },
  sub: { fontSize: 14, color: '#888', fontStyle: 'italic', textAlign: 'center' },

  buttons: {
    width: '60%', alignSelf: 'center',
    paddingBottom: 28,
  },
  backBtn: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: COLORS.coral,
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: COLORS.coral, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
