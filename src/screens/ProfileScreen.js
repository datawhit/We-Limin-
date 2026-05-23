import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';

import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import WashiTape from '../components/WashiTape';
import { Star, Heart, Sparkle } from '../components/Doodles';
import { PASTELS, HANDWRITTEN_500 } from '../lib/theme';
import { COLORS, ACTIVITIES, getTier } from '../lib/constants';
import { getMemories } from '../lib/supabase';

// Settings, availability, and tiers all live as RN <Modal> components
// that open on top of Profile. Tiers is not a navigation route — it
// has always been rendered inline from HomeScreen via state, so we
// do the same here for the Badges row.
import SettingsModal from './SettingsModal';
import AvailabilityModal from './AvailabilityModal';
import TiersScreen from './TiersScreen';

// Season target shown as the denominator on the Adventures row.
// User can adjust this later when the lineup is persisted.
const SEASON_TARGET = 12;

export default function ProfileScreen({ navigation }) {
  // ─── Data wiring (mirrors HomeScreen patterns) ───
  const { profile, myBadges } = useContext(AppContext);
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const [memories, setMemories] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const [tiersOpen, setTiersOpen] = useState(false);

  useEffect(() => {
    // Memories fetched here are filtered down to the current user.
    // If the network/table isn't reachable we just keep counts at 0.
    getMemories().then(setMemories).catch(() => setMemories([]));
  }, []);

  const myMemoryCount = useMemo(
    () => memories.filter(m => m.profile_id === profile?.id).length,
    [memories, profile?.id]
  );

  const livedCount  = myBadges?.length || 0;
  const earnedCount = myBadges?.length || 0;
  const tier        = getTier(livedCount);

  const accent = profile?.accent_color || COLORS.coral;

  // ─── Row navigation handlers ───
  // Tiers + Settings + Availability are RN <Modal> components rendered
  // inline below — they open over Profile via state, not navigation.
  // Tab destinations are reached by navigating to "Tabs" with a nested
  // screen param; that pops the Profile modal off the root stack and
  // surfaces the requested tab in one shot.
  const goBack       = () => navigation.goBack();
  const goBadges     = () => setTiersOpen(true);
  const goScrapbook  = () => navigation.navigate('Tabs', { screen: 'Scrapbook' });
  const goAdventures = () => navigation.navigate('Tabs', { screen: 'Activities' });
  const openSettings = () => setSettingsOpen(true);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ─── Sticky header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerBtn}
        >
          <Text style={styles.chev}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, HAND_500 && { fontFamily: HAND_500 }]}>profile</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 48, paddingTop: 6 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Profile hero card ─── */}
        <View style={styles.profileCard}>
          <WashiTape color="coral" width="38%" height={16} rotation={-3} style={{ top: -8, left: '31%' }} />

          {/* Scattered decorative accents around the card */}
          <Sparkle size={14} color={COLORS.coral} opacity={0.55} style={{ left: 16, top: 22 }} />
          <Star    size={12} color={COLORS.amber} opacity={0.65} style={{ right: 24, top: 30 }} />
          <Heart   size={12} color="#D4475C"      opacity={0.5}  style={{ left: 32, top: 96 }} />
          <Sparkle size={12} color={COLORS.palmGreen} opacity={0.55} style={{ right: 32, top: 110 }} />

          {/* Avatar with palm-green ring */}
          <View style={styles.avatarWrap}>
            <ProfileAvatar
              profile={profile}
              size={96}
              ringColor={COLORS.palmGreen}
              ringWidth={3}
            />
          </View>

          <Text style={styles.name} numberOfLines={1}>{profile?.name || '—'}</Text>

          {/* Current tier pill */}
          <View style={styles.tierPill}>
            <Text style={styles.tierPillText}>{tier.emoji} {tier.name}</Text>
          </View>

          {/* Next unlock progress */}
          {tier.next ? (
            <View style={styles.nextBlock}>
              <Text style={styles.nextEyebrow}>NEXT UNLOCK</Text>
              <Text style={styles.nextName}>{tier.next.name}</Text>
              <Text style={styles.nextSub}>{tier.badgesToNext} more adventures to go</Text>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${Math.round(tier.progress * 100)}%` }]}
                />
              </View>
            </View>
          ) : (
            <View style={styles.nextBlock}>
              <Text style={styles.nextEyebrow}>TOP TIER</Text>
              <Text style={styles.nextName}>you are the function</Text>
            </View>
          )}

          {/* Inline stats */}
          <View style={styles.statsRow}>
            <Text style={styles.stat}>
              <Text style={styles.statNum}>{livedCount}</Text> Lived
            </Text>
            <Text style={styles.statDot}> · </Text>
            <Text style={styles.stat}>
              <Text style={styles.statNum}>{myMemoryCount}</Text> Memories
            </Text>
            <Text style={styles.statDot}> · </Text>
            <Text style={styles.stat}>
              <Text style={styles.statNum}>{earnedCount}</Text> Earned
            </Text>
          </View>
        </View>

        {/* ─── Navigation rows ─── */}
        <NavRow
          emoji="🏅"
          emojiBg={PASTELS.amberBg}
          title="badges"
          subtitle="view all your badges"
          rightText={String(earnedCount)}
          onPress={goBadges}
        />
        <NavRow
          emoji="📸"
          emojiBg={PASTELS.coralBg}
          title="scrapbook"
          subtitle="memories & stories"
          rightText={String(myMemoryCount)}
          onPress={goScrapbook}
        />
        <NavRow
          emoji="🌴"
          emojiBg={PASTELS.mintBg}
          title="adventures"
          subtitle="your lineup & progress"
          rightText={`${livedCount} of ${SEASON_TARGET}`}
          onPress={goAdventures}
        />
        <NavRow
          emoji="📅"
          emojiBg={PASTELS.mintBg}
          title="update my week"
          subtitle="set when you're free to lime"
          onPress={() => setAvailOpen(true)}
        />
        <NavRow
          emoji="⚙️"
          emojiBg={PASTELS.lavenderBg}
          title="settings"
          subtitle="notifications, privacy, more"
          onPress={openSettings}
        />

        {/* Bottom decorative scatter */}
        <View pointerEvents="none" style={styles.bottomAccents}>
          <Heart size={12} color={COLORS.coral}     opacity={0.45} style={{ left: 18, top: 0 }} />
          <Star  size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ right: 30, top: 10 }} />
          <Sparkle size={12} color={COLORS.amber}   opacity={0.55} style={{ left: '50%', top: 22 }} />
        </View>
      </ScrollView>

      {/* Settings + Availability + Tiers — same pattern as HomeScreen
          previously (locally-controlled state, modals render on top
          of Profile). Tiers is rendered here so the Badges row can
          open it without needing a navigation route. */}
      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenAvailability={() => { setSettingsOpen(false); setAvailOpen(true); }}
      />
      <AvailabilityModal visible={availOpen} onClose={() => setAvailOpen(false)} />
      <TiersScreen visible={tiersOpen} onClose={() => setTiersOpen(false)} />
    </SafeAreaView>
  );
}

// ─── Inline NavRow ───────────────────────────────────────
function NavRow({ emoji, emojiBg, title, subtitle, rightText, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.navRow}>
      <View style={[styles.navEmojiBox, { backgroundColor: emojiBg }]}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navSubtitle}>{subtitle}</Text>
      </View>
      {rightText ? <Text style={styles.navRight}>{rightText}</Text> : null}
      <Text style={styles.navChev}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },
  headerTitle: { fontSize: 28, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 34 },

  // Profile card
  profileCard: {
    backgroundColor: COLORS.warmWhite,
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 18,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    position: 'relative', overflow: 'visible',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2,
  },
  avatarWrap: { marginBottom: 16 },
  name: { fontSize: 26, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.4, marginBottom: 10 },

  tierPill: {
    height: 28, paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.amber,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  tierPillText: { fontSize: 13, fontWeight: '600', color: COLORS.deepAmber, letterSpacing: -0.2 },

  nextBlock: { alignSelf: 'stretch', alignItems: 'center', marginBottom: 16 },
  nextEyebrow: { fontSize: 10, fontWeight: '700', color: '#888', letterSpacing: 1.8 },
  nextName: { fontSize: 18, fontWeight: '600', color: COLORS.dark, marginTop: 4, letterSpacing: -0.3 },
  nextSub: { fontSize: 12, color: '#888', marginTop: 4 },
  progressTrack: {
    alignSelf: 'stretch',
    height: 6, borderRadius: 3,
    backgroundColor: '#F0EAD8',
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.coral },

  statsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline',
    alignSelf: 'stretch',
    paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  stat: { fontSize: 12, color: '#888' },
  statNum: { fontSize: 12, fontWeight: '700', color: COLORS.dark },
  statDot: { fontSize: 12, color: '#ccc' },

  // Nav rows
  navRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.warmWhite,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  navEmojiBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 15, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.2 },
  navSubtitle: { fontSize: 12, color: '#888', marginTop: 3 },
  navRight: { fontSize: 15, fontWeight: '600', color: COLORS.dark, marginRight: 8, letterSpacing: -0.2 },
  navChev: { fontSize: 22, color: '#ccc' },

  bottomAccents: { height: 50, marginTop: 16, position: 'relative' },
});
