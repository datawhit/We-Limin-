import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ACCENT_COLORS, COLORS, getTier } from '../lib/constants';
import AvatarSVG from '../components/AvatarSVG';

const EXPRESSIONS = [
  { id: 'feminine',  label: 'Feminine',   sub: 'she / her' },
  { id: 'masculine', label: 'Masculine',  sub: 'he / him'  },
  { id: 'nonbinary', label: 'Non-binary', sub: 'they / them' },
];

export default function SetupScreen({ onComplete }) {
  const [step, setStep] = useState('name');
  const [name, setName] = useState('');
  const [accent, setAccent] = useState(ACCENT_COLORS[0]); // coral
  const [expression, setExpression] = useState('nonbinary');
  const [photoUri, setPhotoUri] = useState(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload a real picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const tier = getTier(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* STEP: NAME */}
        {step === 'name' && (
          <View style={styles.centerContent}>
            <Text style={styles.lemon}>🍋</Text>
            <Text style={styles.title}>we limin'</Text>

            <View style={{ width: '100%', marginTop: 56 }}>
              <Text style={styles.stepTitle}>What's your name?</Text>
              <Text style={styles.stepSub}>So the squad knows it's you</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#bbb"
                style={styles.input}
                autoFocus
                returnKeyType="next"
                onSubmitEditing={() => name.trim() && setStep('photo')}
              />
              <TouchableOpacity
                onPress={() => name.trim() && setStep('photo')}
                style={[styles.btn, { backgroundColor: name.trim() ? COLORS.dark : '#e9e3d6' }]}
              >
                <Text style={[styles.btnText, { color: name.trim() ? COLORS.cream : '#aaa' }]}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP: PHOTO + PRONOUNS */}
        {step === 'photo' && (
          <View style={{ width: '100%' }}>
            <Text style={styles.stepTitle}>Add a photo</Text>
            <Text style={[styles.stepSub, { marginBottom: 28 }]}>It's how the squad will recognize you</Text>

            <View style={styles.previewBlock}>
              <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} style={styles.avatarWrap}>
                <View style={[styles.avatarCircle, { borderColor: accent.value }]}>
                  {photoUri
                    ? <Image source={{ uri: photoUri }} style={styles.previewPhoto} />
                    : <AvatarSVG name={name} color={accent.value} textColor={accent.text} size={110} />}
                </View>
                <View style={styles.cameraBtn}>
                  <Text style={{ fontSize: 14 }}>📷</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickPhoto}>
                <Text style={styles.uploadHint}>{photoUri ? 'Tap to change' : 'Tap to upload'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.groupLabel}>How you showing up?</Text>
            <View style={styles.expressionRow}>
              {EXPRESSIONS.map(e => {
                const on = expression === e.id;
                return (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => setExpression(e.id)}
                    style={[styles.expressionCard, on && { borderColor: accent.value, borderWidth: 2, backgroundColor: '#fff' }]}
                  >
                    <Text style={[styles.expressionLabel, on && { color: COLORS.dark }]}>{e.label}</Text>
                    <Text style={styles.expressionSub}>{e.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => setStep('accent')} style={[styles.btn, { backgroundColor: COLORS.coral, marginTop: 28 }]}>
              <Text style={[styles.btnText, { color: '#fff' }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP: ACCENT */}
        {step === 'accent' && (
          <View style={{ width: '100%' }}>
            <Text style={styles.stepTitle}>Pick your color</Text>
            <Text style={[styles.stepSub, { marginBottom: 28 }]}>This is your vibe throughout the app</Text>

            <View style={styles.previewBlock}>
              <View style={[styles.avatarCircle, { borderColor: accent.value, width: 90, height: 90 }]}>
                {photoUri
                  ? <Image source={{ uri: photoUri }} style={styles.previewPhoto} />
                  : <AvatarSVG name={name} color={accent.value} textColor={accent.text} size={84} />}
              </View>
              <Text style={[styles.previewName, { marginTop: 14 }]}>{name}</Text>
            </View>

            <View style={styles.accentGrid}>
              {ACCENT_COLORS.map(ac => {
                const on = accent.value === ac.value;
                return (
                  <TouchableOpacity key={ac.value} onPress={() => setAccent(ac)}
                    style={[styles.accentTile, on && { borderColor: ac.value, borderWidth: 2 }]}>
                    <View style={[styles.accentSwatch, { backgroundColor: ac.value }]} />
                    <Text style={styles.accentName}>{ac.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={() => setStep('done')}
              style={[styles.btn, { backgroundColor: accent.value, marginTop: 8 }]}>
              <Text style={[styles.btnText, { color: accent.text }]}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP: DONE */}
        {step === 'done' && (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <View style={styles.profileCard}>
              <View style={[styles.avatarLg, { borderColor: accent.value, shadowColor: accent.value }]}>
                {photoUri
                  ? <Image source={{ uri: photoUri }} style={styles.previewPhotoLg} />
                  : <AvatarSVG name={name} color={accent.value} textColor={accent.text} size={132} />}
              </View>
              <Text style={styles.profileName}>{name}</Text>
              <View style={styles.statsRow}>
                {[['0','badges'],['0','memories'],['59','to go']].map(([v, l]) => (
                  <View key={l} style={styles.statBox}>
                    <Text style={[styles.statNum, { color: accent.value }]}>{v}</Text>
                    <Text style={styles.statLabel}>{l}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.tierBox}>
                <Text style={styles.tierBoxLabel}>Badges</Text>
                <Text style={[styles.tierBoxSub, { color: accent.value }]}>{tier.emoji} {tier.name}</Text>
                <Text style={styles.tierBoxTagline}>{tier.tagline}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={() => setStep('photo')}
              style={[styles.btn, { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', marginBottom: 10 }]}>
              <Text style={[styles.btnText, { color: '#888' }]}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onComplete({ name, accentColor: accent, photoUri, expression })}
              style={[styles.btn, { backgroundColor: accent.value }]}>
              <Text style={[styles.btnText, { color: accent.text }]}>Leh we lime 🍋</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  container: { padding: 24, paddingBottom: 48, alignItems: 'center' },
  centerContent: { alignItems: 'center', width: '100%' },

  lemon: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 34, fontWeight: '700', color: COLORS.dark, letterSpacing: -1 },

  stepTitle: { fontSize: 22, fontWeight: '700', color: COLORS.dark, textAlign: 'center', marginBottom: 6, letterSpacing: -0.4 },
  stepSub: { fontSize: 13, color: '#999', textAlign: 'center' },

  input: { width: '100%', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', fontSize: 16, backgroundColor: '#fff', marginTop: 24, marginBottom: 14, textAlign: 'center', color: COLORS.dark },
  btn: { width: '100%', padding: 16, borderRadius: 14, alignItems: 'center' },
  btnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },

  previewBlock: { alignItems: 'center', marginBottom: 28 },
  avatarWrap: { position: 'relative' },
  avatarCircle: { width: 124, height: 124, borderRadius: 62, overflow: 'hidden', backgroundColor: COLORS.cream, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  previewPhoto: { width: '100%', height: '100%' },
  cameraBtn: { position: 'absolute', bottom: -2, right: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.dark },
  uploadHint: { fontSize: 12, color: '#999', fontWeight: '600', marginTop: 14 },

  previewName: { color: COLORS.dark, fontWeight: '700', fontSize: 20, letterSpacing: -0.3 },

  groupLabel: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  expressionRow: { flexDirection: 'row', gap: 8 },
  expressionCard: { flex: 1, backgroundColor: '#f1ebde', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  expressionLabel: { fontSize: 13, fontWeight: '700', color: '#666' },
  expressionSub: { fontSize: 10, color: '#aaa', marginTop: 2 },

  // Accent step grid — 3 columns, compact
  accentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  accentTile: { width: '31.5%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  accentSwatch: { width: 32, height: 32, borderRadius: 16, marginBottom: 6 },
  accentName: { fontSize: 12, fontWeight: '700', color: COLORS.dark },

  profileCard: { backgroundColor: COLORS.dark, borderRadius: 28, padding: 32, width: '100%', alignItems: 'center', marginBottom: 24 },
  avatarLg: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: COLORS.cream, borderWidth: 4, marginBottom: 18, shadowOpacity: 0.4, shadowRadius: 18, elevation: 8 },
  previewPhotoLg: { width: '100%', height: '100%' },
  profileName: { color: '#fff', fontWeight: '700', fontSize: 28, marginBottom: 24, letterSpacing: -0.5 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statBox: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, alignItems: 'center', flex: 1 },
  statNum: { fontWeight: '700', fontSize: 22 },
  statLabel: { color: '#666', fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
  tierBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, width: '100%' },
  tierBoxLabel: { color: '#888', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontWeight: '700' },
  tierBoxSub: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tierBoxTagline: { color: '#888', fontSize: 12, fontStyle: 'italic' },
});
