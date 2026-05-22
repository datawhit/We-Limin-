import React, { useContext, useState, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Image, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { ACCENT_COLORS, COLORS } from '../lib/constants';

const EXPRESSIONS = [
  { id: 'feminine',  label: 'Feminine',   sub: 'she / her' },
  { id: 'masculine', label: 'Masculine',  sub: 'he / him'  },
  { id: 'nonbinary', label: 'Non-binary', sub: 'they / them' },
];

export default function EditProfileModal({ visible, onClose, initialFocus = 'profile' }) {
  const { profile, updateProfile } = useContext(AppContext);
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(profile?.name || '');
  const [expression, setExpression] = useState(profile?.expression || 'nonbinary');
  const [photoUri, setPhotoUri] = useState(profile?.photo_url || null);
  const [accent, setAccent] = useState(
    ACCENT_COLORS.find(a => a.value === profile?.accent_color) || ACCENT_COLORS[0]
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !profile) return;
    setName(profile.name || '');
    setExpression(profile.expression || 'nonbinary');
    setPhotoUri(profile.photo_url || null);
    setAccent(ACCENT_COLORS.find(a => a.value === profile.accent_color) || ACCENT_COLORS[0]);
  }, [visible, profile]);

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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name needed', 'Give yourself a name first.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        expression,
        accentColor: accent,
        photoUri,
      });
      onClose();
    } catch (e) {
      Alert.alert('Oops', 'Could not save. Try again?');
    }
    setSaving(false);
  };

  if (!profile) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Header — explicit safe-area paddingTop so Save/Cancel are
              never clipped by the status bar / Dynamic Island. Lives
              outside the ScrollView so it stays pinned. */}
          <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.headerBtn}
            >
              <Text style={styles.chev}>‹</Text>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.topTitle}>Edit profile</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.headerBtn}
            >
              {saving
                ? <ActivityIndicator color={accent.value} />
                : <Text style={[styles.save, { color: accent.value }]}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {/* Photo */}
            <View style={styles.previewBlock}>
              <View style={{ position: 'relative' }}>
                <View style={[styles.avatarCircle, { borderColor: accent.value }]}>
                  {photoUri
                    ? <Image source={{ uri: photoUri }} style={styles.photo} />
                    : <ProfileAvatar
                        profile={{ name, accent_color: accent.value, accent_text: accent.text }}
                        size={114}
                      />}
                </View>
                <TouchableOpacity onPress={pickPhoto} style={styles.cameraBtn}>
                  <Text style={{ fontSize: 14 }}>📷</Text>
                </TouchableOpacity>
              </View>
              {photoUri && (
                <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.removePhotoBtn}>
                  <Text style={styles.removePhotoText}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Name */}
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#bbb"
              style={styles.input}
            />

            {/* Pronouns */}
            <Text style={styles.label}>Pronouns</Text>
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

            {/* Color — compact 3-column grid */}
            <Text style={styles.label}>Your color · {accent.name}</Text>
            <View style={styles.accentGrid}>
              {ACCENT_COLORS.map(ac => {
                const on = accent.value === ac.value;
                return (
                  <TouchableOpacity
                    key={ac.value}
                    onPress={() => setAccent(ac)}
                    style={[styles.accentTile, on && { borderColor: ac.value, borderWidth: 2 }]}
                  >
                    <View style={[styles.accentSwatch, { backgroundColor: ac.value }]} />
                    <Text style={styles.accentName}>{ac.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  // Header buttons — minimum 44x44 hit target so Save/Cancel are always tappable
  headerBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 44, minHeight: 44, gap: 2 },
  chev: { fontSize: 22, color: '#888', fontWeight: '500', lineHeight: 22, marginRight: 2 },
  cancel: { fontSize: 14, color: '#888', fontWeight: '600' },
  save: { fontSize: 14, fontWeight: '700' },

  previewBlock: { alignItems: 'center', marginBottom: 8 },
  avatarCircle: { width: 124, height: 124, borderRadius: 62, overflow: 'hidden', backgroundColor: COLORS.cream, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  cameraBtn: { position: 'absolute', bottom: -2, right: -2, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.dark },
  removePhotoBtn: { marginTop: 14, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  removePhotoText: { fontSize: 12, color: '#666', fontWeight: '600' },

  label: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 24 },
  input: { backgroundColor: '#fff', padding: 16, borderRadius: 14, fontSize: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', color: COLORS.dark },

  expressionRow: { flexDirection: 'row', gap: 8 },
  expressionCard: { flex: 1, backgroundColor: '#f1ebde', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  expressionLabel: { fontSize: 13, fontWeight: '700', color: '#666' },
  expressionSub: { fontSize: 10, color: '#aaa', marginTop: 2 },

  // Compact 3-column color grid — 6 colors fit in 2 rows
  accentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accentTile: { width: '31.5%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  accentSwatch: { width: 32, height: 32, borderRadius: 16, marginBottom: 6 },
  accentName: { fontSize: 12, fontWeight: '700', color: COLORS.dark },
});
