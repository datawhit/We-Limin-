import React, { useContext } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../lib/AppContext';
import { COLORS, TIERS, getTier } from '../lib/constants';

// All 7 tiers from constants.js, each rendered as a row with:
// emoji · title · range · tagline · locked/unlocked state · current-tier progress.
export default function TiersScreen({ visible, onClose }) {
  const { myBadges } = useContext(AppContext);
  const insets = useSafeAreaInsets();
  const count = myBadges?.length || 0;
  const current = getTier(count);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Header outside the scroll */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerBtn}
          >
            <Text style={styles.chev}>‹</Text>
            <Text style={styles.close}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>All tiers</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 60 }}>
          <Text style={styles.eyebrow}>YOUR LADDER</Text>
          <Text style={styles.headline}>{count} badges · {current.emoji} {current.name}</Text>
          {current.next ? (
            <Text style={styles.sub}>
              {current.badgesToNext} more till {current.next.emoji} {current.next.name}
            </Text>
          ) : (
            <Text style={styles.sub}>You ARE the function 👑🍋</Text>
          )}

          <View style={{ marginTop: 22 }}>
            {TIERS.map((tier, idx) => {
              const unlocked = count >= tier.min;
              const isCurrent = current.name === tier.name;
              return (
                <View
                  key={tier.name}
                  style={[
                    styles.tierRow,
                    unlocked && styles.tierRowUnlocked,
                    isCurrent && styles.tierRowCurrent,
                  ]}
                >
                  <View style={[styles.emojiBox, !unlocked && { opacity: 0.35 }]}>
                    <Text style={{ fontSize: 30 }}>{tier.emoji}</Text>
                    {!unlocked && (
                      <View style={styles.lockPip}>
                        <Text style={{ fontSize: 10 }}>🔒</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={styles.tierTitleRow}>
                      <Text style={[styles.tierName, !unlocked && { color: '#999' }]}>{tier.name}</Text>
                      {isCurrent && (
                        <View style={styles.currentPill}>
                          <Text style={styles.currentPillText}>YOU'RE HERE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.tierRange}>
                      {tier.min === Infinity ? '∞' : tier.min}
                      {tier.max === Infinity ? '+' : `–${tier.max}`} badges
                    </Text>
                    <Text style={[styles.tierTagline, !unlocked && { color: '#aaa' }]}>{tier.tagline}</Text>

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
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 60, minHeight: 44, gap: 2 },
  chev: { fontSize: 22, color: '#888', fontWeight: '500', lineHeight: 22, marginRight: 2 },
  close: { fontSize: 14, color: '#888', fontWeight: '600' },

  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: COLORS.deepCoral, marginBottom: 6 },
  headline: { fontSize: 24, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: '#888', marginTop: 6 },

  tierRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'flex-start',
  },
  tierRowUnlocked: { backgroundColor: '#FFFBF1' },
  tierRowCurrent: {
    borderColor: COLORS.coral,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.coral,
    backgroundColor: '#FFFFFF',
  },
  emojiBox: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F0E8',
    position: 'relative',
  },
  lockPip: {
    position: 'absolute', bottom: -4, right: -4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  tierTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tierName: { fontSize: 16, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  currentPill: {
    backgroundColor: COLORS.coral, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  currentPillText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },

  tierRange: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 4 },
  tierTagline: { fontSize: 13, color: '#555', fontStyle: 'italic' },

  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F0EAD8', overflow: 'hidden', marginTop: 12 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.coral },
});
