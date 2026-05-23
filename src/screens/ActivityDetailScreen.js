import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Animated,
  StyleSheet, ActivityIndicator, Linking, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Caveat_500Medium } from '@expo-google-fonts/caveat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../lib/AppContext';
import { COLORS, TIER, getTier } from '../lib/constants';
import {
  earnBadge, removeBadge, getPinnedLink, pinLink,
  getReactionsForActivity, setReaction, clearReaction,
  getWeekAvailability, sendInvite,
  supabase, getUserActivity,
} from '../lib/supabase';
import { getAISuggestions, getAIFallback } from '../lib/ai';
import BadgeUnlockModal from '../components/BadgeUnlockModal';
import ProfileAvatar from '../components/ProfileAvatar';
import { checkAndUnlockHiddenBadges } from '../lib/hiddenBadges';
import { getMondayOfThisWeek, weekStartISO } from './AvailabilityModal';

// ─── Design system primitives ─────────────────────────────
import WashiTape from '../components/WashiTape';
import { Star, Heart, Sparkle, CurvedArrow } from '../components/Doodles';
import { PASTELS, HANDWRITTEN_500 } from '../lib/theme';

const DAY_LABEL  = { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' };
const SLOT_LABEL = { morning: 'morning', afternoon: 'afternoon', evening: 'evening' };

// Pastel emoji-square color per tier (used in the hero polaroid).
const TIER_BG = {
  chill: PASTELS.mintBg,
  bold:  PASTELS.amberBg,
  wild:  PASTELS.lavenderBg,
};

const SAVED_KEY = 'lime_saved_activities';

export default function ActivityDetailScreen({ route, navigation }) {
  const { activity, isModal } = route.params || {};
  const { profile, myBadges, setMyBadges } = useContext(AppContext);
  const earned = myBadges.includes(activity.id);
  const t = TIER[activity.tier];
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#FFFFFF';
  const insets = useSafeAreaInsets();

  // PRESERVED: all state from prior version
  const [location, setLocation] = useState('NYC');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(true);
  const [aiError, setAIError] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [pinUrl, setPinUrl] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  // Queue of badge-unlock modal payloads (kept — fired from anywhere
  // that earns a badge, including the AddMemoryScreen flow).
  const [unlockQueue, setUnlockQueue] = useState([]);

  // "Who's free?" — squad availability matches.
  const [availMatches, setAvailMatches] = useState([]);
  const [inviteFor, setInviteFor] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState('Invite sent 🍋');
  const toastY = useRef(new Animated.Value(-80)).current;

  // Squad reactions (PRESERVED — state + handlers untouched)
  const [reactions, setReactions] = useState([]);
  const REACTION_SET = [
    { id: '🔥', label: 'Down' },
    { id: '🙌', label: "I'm in" },
    { id: '👀', label: 'Maybe' },
    { id: '💀', label: 'Absolutely not' },
  ];
  const myReaction = useMemo(
    () => reactions.find(r => r.profile_id === profile.id)?.reaction || null,
    [reactions, profile.id]
  );
  const reactionCounts = useMemo(() => {
    const m = {};
    reactions.forEach(r => { m[r.reaction] = (m[r.reaction] || 0) + 1; });
    return m;
  }, [reactions]);

  // NEW: small overflow sheet from the ⋮ button
  const [menuOpen, setMenuOpen] = useState(false);
  // NEW: lineup-saved tracking (reads same key the Explore screen
  // writes to). Drives the "in your lineup" status pill.
  const [savedSet, setSavedSet] = useState([]);
  // The user_activities row for (this profile, this activity) — drives
  // the adaptive CTA (STATE A "save as a dream" / B "capture this lime"
  // / C "limed it ✓"). Null until first load completes.
  const [ua, setUa] = useState(null);
  const [savingDream, setSavingDream] = useState(false);

  const [fontsLoaded] = useFonts({ Caveat_500Medium });
  const HAND_500 = fontsLoaded ? HANDWRITTEN_500 : undefined;

  const loadReactions = async () => {
    try { setReactions(await getReactionsForActivity(activity.id)); }
    catch (e) { /* silent */ }
  };
  const toggleReaction = async (emoji) => {
    const next = (myReaction === emoji)
      ? reactions.filter(r => r.profile_id !== profile.id)
      : [...reactions.filter(r => r.profile_id !== profile.id), { reaction: emoji, profile_id: profile.id }];
    setReactions(next);
    try {
      if (myReaction === emoji) await clearReaction({ activityId: activity.id, profileId: profile.id });
      else await setReaction({ activityId: activity.id, profileId: profile.id, reaction: emoji });
    } catch (e) { /* keep optimistic */ }
  };

  // Debounced AI fetch — PRESERVED logic
  const debounceRef = useRef(null);
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (!location.trim()) return;
    retryCountRef.current = 0;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { loadAI(); }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [location]);

  useEffect(() => {
    loadPinned();
    loadReactions();
    loadAvailMatches();
    loadSaved();
    loadUa();
  }, []);

  const loadUa = async () => {
    try { setUa(await getUserActivity(profile.id, activity.id)); }
    catch (e) { /* silent; treat as null */ }
  };

  // STATE A onPress: insert a 'dream' row, then refetch so the CTA flips
  // to STATE B ("capture this lime ✨") without a screen reload.
  const saveAsDream = async () => {
    if (savingDream) return;
    setSavingDream(true);
    try {
      const { error } = await supabase.from('user_activities').insert({
        profile_id: profile.id,
        activity_id: activity.id,
        source: 'dream',
        status: 'up_next',
      });
      if (error) throw error;
      await loadUa();
      flashToast('added to your dreams 💭');
    } catch (e) {
      console.warn('[detail] saveAsDream failed:', e?.message || e);
      Alert.alert('Oops', "Couldn't save that one. Try again?");
    }
    setSavingDream(false);
  };

  const loadSaved = async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      setSavedSet(raw ? JSON.parse(raw) : []);
    } catch (e) { setSavedSet([]); }
  };
  const inLineup = savedSet.includes(activity.id);

  const loadAvailMatches = async () => {
    try {
      const weekStart = weekStartISO(getMondayOfThisWeek());
      const rows = await getWeekAvailability(weekStart);
      const me = rows.find(r => r.profile_id === profile.id);
      const mySlots = me?.slots || {};
      const others = rows.filter(r => r.profile_id !== profile.id);
      const matches = others.map(member => {
        const overlap = [];
        Object.entries(mySlots).forEach(([day, slots]) => {
          (slots || []).forEach(slot => {
            if ((member.slots?.[day] || []).includes(slot)) overlap.push({ day, slot });
          });
        });
        return { member, overlap };
      }).filter(m => m.overlap.length > 0);
      setAvailMatches(matches);
    } catch (e) { /* empty state */ }
  };

  const flashToast = (text = 'Invite sent 🍋') => {
    setToastText(text);
    setToastVisible(true);
    toastY.setValue(-80);
    Animated.sequence([
      Animated.spring(toastY, { toValue: 12, useNativeDriver: true, friction: 6 }),
      Animated.delay(1800),
      Animated.timing(toastY, { toValue: -80, duration: 220, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };
  const handleInviteSent = () => { setInviteFor(null); flashToast(); };

  const loadAI = async () => {
    console.log('[detail] triggering AI fetch — activity=', activity.name, 'location=', location, 'retry=', retryCountRef.current);
    setLoadingAI(true);
    setAIError(null);
    try {
      const s = await getAISuggestions({
        activityName: activity.name,
        activityTier: activity.tier,
        isTripType: !!activity.tripType,
        location,
      });
      console.log('[detail] AI returned', Array.isArray(s) ? s.length : 'non-array', 'suggestions');
      setSuggestions(s);
      retryCountRef.current = 0;
    } catch (e) {
      console.warn('[detail] AI fetch failed:', e?.message || e);
      const overloaded = e?.code === 'lime_overloaded';
      if (retryCountRef.current >= 2) {
        setSuggestions(getAIFallback(activity.name, location));
        setAIError(null);
      } else {
        setSuggestions([]);
        setAIError(overloaded
          ? 'The lime is overloaded, try again in a min 🍋'
          : "Couldn't load suggestions — tap to retry");
      }
    }
    setLoadingAI(false);
  };
  const handleRetry = () => { retryCountRef.current += 1; loadAI(); };

  const loadPinned = async () => {
    try {
      const p = await getPinnedLink(activity.id);
      if (p) setPinned(p);
    } catch (e) { /* noop */ }
  };

  // NEW behavior: tapping the CTA navigates to AddMemoryScreen with
  // the activity pre-filled. The existing AddMemoryScreen flow calls
  // earnBadge() on save, so the user returning here will see the
  // "limed it ✓" state automatically — no extra wiring needed.
  const captureMemory = () => {
    navigation.navigate('Tabs', {
      screen: 'Scrapbook',
      params: {
        screen: 'AddMemory',
        params: {
          prefillActivity: {
            id: activity.id,
            name: activity.name,
            emoji: activity.emoji,
            tier: activity.tier,
          },
        },
      },
    });
  };
  const viewMemory = () => {
    navigation.navigate('Tabs', { screen: 'Scrapbook' });
  };

  // PRESERVED: the old toggleBadge stays defined; not bound to the new
  // CTA but available for any caller that still references it.
  const toggleBadge = async () => {
    try {
      if (earned) {
        await removeBadge(profile.id, activity.id);
        setMyBadges(myBadges.filter(id => id !== activity.id));
        return;
      }
      await earnBadge(profile.id, activity.id);
      const nextBadges = [activity.id, ...myBadges];
      setMyBadges(nextBadges);

      const prevTier = getTier(myBadges.length);
      const nextTier = getTier(nextBadges.length);
      const leveledUp = prevTier.name !== nextTier.name;

      const payloads = [{
        emoji:       activity.badge || '🏅',
        name:        activity.name,
        tierName:    nextTier.name,
        tierEmoji:   nextTier.emoji,
        tierTagline: nextTier.tagline,
        leveledUp,
      }];

      try {
        const newly = await checkAndUnlockHiddenBadges({
          trigger: 'activity_completed',
          activity,
          completedAt: new Date().toISOString(),
        });
        newly.forEach(b => payloads.push({
          emoji: b.emoji, name: b.name,
          tierName: 'Hidden badge', tierEmoji: '✨', tierTagline: b.hint,
          leveledUp: false,
        }));
      } catch (e) { /* non-fatal */ }

      setUnlockQueue(q => [...q, ...payloads]);
    } catch (e) { Alert.alert('Oops', 'Could not update badge'); }
  };
  const advanceUnlock = () => setUnlockQueue(q => q.slice(1));

  const openGoogle = () => {
    Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(activity.name + ' ' + location)}`);
  };

  const handlePinSubmit = async () => {
    if (!pinUrl.trim()) return;
    try {
      const p = await pinLink({ activityId: activity.id, profileId: profile.id, url: pinUrl.trim() });
      setPinned(p);
      setPinUrl('');
      setShowPinInput(false);
    } catch (e) { Alert.alert('Oops', 'Could not pin link'); }
  };

  // Tier text + label (lowercase)
  const tierLabel = (t?.label || '').toLowerCase();
  const tierBg = TIER_BG[activity.tier] || PASTELS.coralBg;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BadgeUnlockModal
        visible={unlockQueue.length > 0}
        payload={unlockQueue[0]}
        onClose={advanceUnlock}
      />
      <SendInviteModal
        visible={!!inviteFor}
        match={inviteFor}
        activity={activity}
        fromUserId={profile.id}
        onClose={() => setInviteFor(null)}
        onSent={handleInviteSent}
      />
      {toastVisible && (
        <Animated.View style={[styles.inviteToast, { transform: [{ translateY: toastY }] }]} pointerEvents="none">
          <Text style={styles.inviteToastText}>{toastText}</Text>
        </Animated.View>
      )}

      {/* ─── Header (chevron + ⋮ menu) ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.chev}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          style={styles.headerBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.menuDots}>⋮</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {/* Page-edge doodles */}
          <Sparkle    size={14} color={COLORS.coral}     opacity={0.55} style={{ right: 14, top: 6 }} />
          <Star       size={11} color={COLORS.palmGreen} opacity={0.5}  style={{ left: 18,  top: 20 }} />

          {/* ─── Hero polaroid ─── */}
          <View style={styles.heroWrap}>
            <View style={styles.heroPolaroid}>
              <WashiTape color="amber" width="38%" height={16} rotation={-3} style={{ top: -8, left: '31%' }} />
              <View style={[styles.heroPhotoBox, { backgroundColor: tierBg }]}>
                <Text style={styles.heroEmoji}>{activity.emoji}</Text>
              </View>
            </View>

            <Text style={styles.heroName} numberOfLines={2}>{activity.name}</Text>

            <View style={styles.pillsRow}>
              <View style={[styles.tierPill, { backgroundColor: t?.bg || PASTELS.coralBg }]}>
                <Text style={[styles.tierPillText, { color: t?.text || COLORS.dark }]}>{tierLabel} tier</Text>
              </View>
              {earned ? (
                <View style={[styles.statusPill, { backgroundColor: '#D4EBD8' }]}>
                  <Text style={[styles.statusPillText, { color: COLORS.palmGreen }]}>lived ✓</Text>
                </View>
              ) : inLineup ? (
                <View style={[styles.statusPill, { backgroundColor: PASTELS.coralBg }]}>
                  <Text style={[styles.statusPillText, { color: COLORS.deepCoral }]}>in your lineup ⭐</Text>
                </View>
              ) : null}
              {activity.tripType && (
                <View style={[styles.statusPill, { backgroundColor: PASTELS.blueBg }]}>
                  <Text style={[styles.statusPillText, { color: '#1F5F7A' }]}>trip vibes ✈️</Text>
                </View>
              )}
            </View>
          </View>

          {/* ─── Primary CTA (adaptive: dream → capture → lived) ─── */}
          <View style={styles.ctaWrap}>
            {(earned || ua?.status === 'lived') ? (
              // STATE C — already lived. Preserves existing limedBtn styling.
              <TouchableOpacity onPress={viewMemory} activeOpacity={0.85} style={styles.limedBtn}>
                <Text style={styles.limedBtnText}>limed it ✓</Text>
              </TouchableOpacity>
            ) : ua ? (
              // STATE B — saved (dream / lime_pick / squad_plan). Capture flow.
              <TouchableOpacity onPress={captureMemory} activeOpacity={0.85} style={styles.captureBtn}>
                <Text style={styles.captureBtnText}>capture this lime ✨</Text>
              </TouchableOpacity>
            ) : (
              // STATE A — not saved anywhere. Offer "save as a dream".
              <TouchableOpacity
                onPress={saveAsDream}
                disabled={savingDream}
                activeOpacity={0.85}
                style={[styles.captureBtn, savingDream && { opacity: 0.5 }]}
              >
                <Text style={styles.captureBtnText}>save as a dream 💭</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ─── Squad reactions (preserved, restyled label) ─── */}
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <Text style={styles.miniLabel}>squad reactions</Text>
            <View style={styles.reactionsRow}>
              {REACTION_SET.map(r => {
                const count = reactionCounts[r.id] || 0;
                const on = myReaction === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => toggleReaction(r.id)}
                    style={[styles.reactionBtn, on && { backgroundColor: COLORS.coral, borderColor: COLORS.coral }]}
                  >
                    <Text style={styles.reactionEmoji}>{r.id}</Text>
                    <Text style={[styles.reactionCount, on && { color: '#fff' }]}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ─── Where to do it ─── */}
          <View style={{ paddingHorizontal: 20 }}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={[styles.sectionHeader, HAND_500 && { fontFamily: HAND_500 }]}>where to do it</Text>
                <Sparkle size={16} color={COLORS.coral} opacity={0.7} style={{ left: 4, top: 6 }} />
              </View>
              <Text style={styles.sectionAside}>AI picks for you</Text>
            </View>

            <TextInput
              value={location}
              onChangeText={(v) => { console.log('[detail] location changed to', v); setLocation(v); }}
              placeholder="type a city..."
              placeholderTextColor="#bbb"
              returnKeyType="search"
              style={styles.locInput}
            />

            {loadingAI ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={COLORS.dark} />
                <Text style={styles.loadingText}>finding the spots...</Text>
              </View>
            ) : aiError ? (
              <TouchableOpacity onPress={handleRetry} style={styles.errorBox} activeOpacity={0.8}>
                <Text style={styles.errorText}>{aiError}</Text>
                <Text style={styles.errorHint}>tap to retry ↻</Text>
              </TouchableOpacity>
            ) : (
              suggestions.map((s, i) => {
                const tilt = i % 2 === 0 ? -1 : 1;
                const isFavorite = (s.tag || '').toLowerCase().includes('favorite')
                                || (s.tag || '').toLowerCase().includes('top')
                                || (s.tag || '').toLowerCase().includes('trending');
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => s.url && Linking.openURL(s.url)}
                    style={[styles.suggestCard, { transform: [{ rotate: `${tilt}deg` }] }]}
                    disabled={!s.url}
                    activeOpacity={0.85}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <Text style={styles.suggestName}>{s.name}</Text>
                      {s.url && <Text style={styles.suggestArrow}>↗</Text>}
                    </View>
                    <Text style={styles.suggestDesc}>{s.desc}</Text>
                    {isFavorite && (
                      <View style={styles.favoritePill}>
                        <Text style={styles.favoritePillText}>fan favorite 🔥</Text>
                      </View>
                    )}
                    {!isFavorite && s.tag ? (
                      <View style={styles.tagPill}>
                        <Text style={styles.tagPillText}>{(s.tag || '').toLowerCase()}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ─── Who's free? ─── */}
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionHeader, HAND_500 && { fontFamily: HAND_500 }]}>who's free?</Text>
              <Heart size={14} color={COLORS.coral} opacity={0.7} style={{ left: 6, top: 8 }} />
            </View>
            <Text style={styles.sectionSub}>matched on your shared week</Text>

            {availMatches.length === 0 ? (
              <View style={styles.emptyMatch}>
                <Text style={styles.emptyMatchText}>
                  nobody's free at the same time as you. update your availability or check back later.
                </Text>
              </View>
            ) : (
              availMatches.map(({ member, overlap }, i) => {
                const mAccent = member.accent_color || member.profiles?.accent_color || COLORS.coral;
                const tilt = i % 2 === 0 ? -1 : 1.5;
                return (
                  <View
                    key={member.profile_id}
                    style={[styles.matchPolaroid, { transform: [{ rotate: `${tilt}deg` }] }]}
                  >
                    <WashiTape color={i % 2 === 0 ? 'coral' : 'lavender'} width={48} height={12} rotation={-3} opacity={0.7} style={{ top: -4, left: 16 }} />
                    <ProfileAvatar profile={member.profiles || member} size={42} ringColor={mAccent} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.matchName} numberOfLines={1}>
                        {member.profiles?.name || member.name || 'Someone'}
                      </Text>
                      <View style={styles.slotChips}>
                        {overlap.slice(0, 3).map((s, idx) => (
                          <View key={idx} style={styles.slotPill}>
                            <Text style={styles.slotPillText}>{DAY_LABEL[s.day]} {SLOT_LABEL[s.slot]}</Text>
                          </View>
                        ))}
                        {overlap.length > 3 && (
                          <Text style={styles.slotMore}>+{overlap.length - 3}</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setInviteFor({ member, overlap })}
                      style={styles.inviteBtn}
                    >
                      <Text style={styles.inviteBtnText}>send invite</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          {/* ─── Pin a venue link ─── */}
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionHeader, HAND_500 && { fontFamily: HAND_500 }]}>pin a venue link</Text>
              <Star size={14} color={COLORS.amber} opacity={0.7} style={{ left: 6, top: 6 }} />
            </View>
            <Text style={styles.sectionSub}>pin the link that actually worked</Text>

            {pinned ? (
              <View style={styles.pinnedCard}>
                <TouchableOpacity onPress={() => Linking.openURL(pinned.url)} style={{ flex: 1 }}>
                  <Text style={styles.pinnedLabel}>PINNED</Text>
                  <Text style={styles.pinnedUrl} numberOfLines={2}>{pinned.url}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowPinInput(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.pinnedEdit}>EDIT</Text>
                </TouchableOpacity>
              </View>
            ) : !showPinInput ? (
              <TouchableOpacity onPress={() => setShowPinInput(true)} style={styles.pinAddBtn}>
                <Text style={styles.pinAddBtnText}>＋ pin a correct link</Text>
              </TouchableOpacity>
            ) : null}

            {showPinInput && (
              <View style={{ marginTop: 10 }}>
                <TextInput
                  value={pinUrl}
                  onChangeText={setPinUrl}
                  placeholder="https://..."
                  placeholderTextColor="#bbb"
                  autoCapitalize="none"
                  style={styles.pinInput}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => { setShowPinInput(false); setPinUrl(''); }} style={[styles.miniBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.cardBorder }]}>
                    <Text style={{ color: '#666', fontSize: 12, fontWeight: '700' }}>cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handlePinSubmit} style={[styles.miniBtn, { backgroundColor: COLORS.coral, flex: 1 }]}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>pin it</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Subtle Google fallback */}
          <TouchableOpacity onPress={openGoogle} style={styles.googleLink}>
            <Text style={styles.googleLinkText}>🔎 search "{activity.name}" on google</Text>
          </TouchableOpacity>

          {/* Bottom decorative scatter */}
          <View pointerEvents="none" style={styles.bottomAccents}>
            <Sparkle size={12} color={COLORS.amber}     opacity={0.55} style={{ left: 30,  top: 0 }} />
            <CurvedArrow size={36} color={COLORS.coral} opacity={0.45} style={{ right: 22, top: 8, transform: [{ rotate: '120deg' }] }} />
            <Star size={11} color={COLORS.palmGreen}    opacity={0.5}  style={{ left: '50%', top: 24 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ⋮ overflow sheet */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setMenuOpen(false)} style={menuStyles.backdrop}>
          <View style={menuStyles.sheet} onStartShouldSetResponder={() => true}>
            <MenuRow icon="✏️" label="edit lime"          onPress={() => { setMenuOpen(false); console.log('[detail] edit lime tap'); }} />
            <MenuRow icon="↗"  label="share lime"         onPress={() => { setMenuOpen(false); console.log('[detail] share lime tap'); }} />
            <MenuRow icon="🗑️" label="remove from lineup" onPress={() => { setMenuOpen(false); console.log('[detail] remove from lineup tap'); }} />
            <TouchableOpacity onPress={() => setMenuOpen(false)} style={menuStyles.cancel}>
              <Text style={menuStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={menuStyles.row}>
      <Text style={menuStyles.rowIcon}>{icon}</Text>
      <Text style={menuStyles.rowLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── SendInviteModal (PRESERVED — DB calls untouched) ─────
function SendInviteModal({ visible, match, activity, fromUserId, onClose, onSent }) {
  const insets = useSafeAreaInsets();
  const overlap = match?.overlap || [];
  const member = match?.member;
  const t = TIER[activity?.tier] || { bg: COLORS.cream, text: COLORS.dark };

  const [pickedIdx, setPickedIdx] = useState(0);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) { setPickedIdx(0); setNote(''); }
  }, [visible]);

  const slotLabel = (s) => `${DAY_LABEL[s.day]} ${SLOT_LABEL[s.slot]}`;
  const picked = overlap[pickedIdx];

  const submit = async () => {
    if (!picked || !member) return;
    setSending(true);
    try {
      await sendInvite({
        fromUserId,
        toUserId: member.profile_id,
        activityId: activity.id,
        suggestedTime: slotLabel(picked),
        customMessage: note.trim() || null,
      });
      setSending(false);
      onSent?.();
    } catch (e) {
      setSending(false);
      Alert.alert('Oops', "Could not send the invite. Try again?");
    }
  };

  if (!visible || !member) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={inviteStyles.backdrop}>
        <View style={[inviteStyles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Text style={inviteStyles.heading}>What yuh for? Leh we lime!</Text>

          <View style={inviteStyles.activityRow}>
            <Text style={{ fontSize: 30 }}>{activity?.emoji}</Text>
            <Text style={inviteStyles.activityName}>{activity?.name}</Text>
            <View style={[inviteStyles.tierPill, { backgroundColor: t.bg }]}>
              <Text style={[inviteStyles.tierPillText, { color: t.text }]}>{TIER[activity?.tier]?.label}</Text>
            </View>
          </View>

          <Text style={inviteStyles.label}>When?</Text>
          <View style={inviteStyles.slotRow}>
            {overlap.map((s, i) => {
              const on = i === pickedIdx;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setPickedIdx(i)}
                  style={[inviteStyles.slotChip, on && inviteStyles.slotChipOn]}
                >
                  <Text style={[inviteStyles.slotChipText, on && inviteStyles.slotChipTextOn]}>{slotLabel(s)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={inviteStyles.label}>To</Text>
          <View style={inviteStyles.recipientRow}>
            <ProfileAvatar profile={member.profiles || member} size={40} />
            <Text style={inviteStyles.recipientName}>{member.profiles?.name || 'Squad'}</Text>
          </View>

          <Text style={inviteStyles.label}>Add a note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="say something..."
            placeholderTextColor="#bbb"
            multiline
            style={inviteStyles.noteInput}
            maxLength={240}
          />

          <View style={inviteStyles.buttons}>
            <TouchableOpacity onPress={onClose} style={inviteStyles.cancelBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={inviteStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={sending}
              style={[inviteStyles.sendBtn, sending && { opacity: 0.6 }]}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <Text style={inviteStyles.sendText}>Send</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const inviteStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  heading: { fontSize: 17, fontWeight: '700', color: COLORS.dark, textAlign: 'center', letterSpacing: -0.2, marginBottom: 16 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  activityName: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.3 },
  tierPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  tierPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

  label: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },

  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.cardBorder },
  slotChipOn: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  slotChipText: { fontSize: 12, fontWeight: '700', color: COLORS.dark, letterSpacing: 0.2 },
  slotChipTextOn: { color: COLORS.cream },

  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recipientName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },

  noteInput: { backgroundColor: '#fff', borderRadius: 14, padding: 14, fontSize: 14, color: COLORS.dark, borderWidth: 1, borderColor: COLORS.cardBorder, minHeight: 80, textAlignVertical: 'top' },

  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { fontSize: 14, color: '#888', fontWeight: '700' },
  sendBtn: { backgroundColor: COLORS.coral, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12 },
  sendText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
});

const menuStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 20, padding: 8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  rowIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: COLORS.dark, textTransform: 'lowercase' },
  cancel: { paddingVertical: 14, alignItems: 'center', marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  cancelText: { fontSize: 14, color: '#888', fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 28, color: COLORS.dark, fontWeight: '500', lineHeight: 28 },
  menuDots: { fontSize: 24, color: COLORS.dark, fontWeight: '700' },

  // Hero polaroid + identity
  heroWrap: { alignItems: 'center', paddingHorizontal: 22, marginTop: 8, marginBottom: 22, position: 'relative' },
  heroPolaroid: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingTop: 18, paddingHorizontal: 14, paddingBottom: 14,
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2,
    position: 'relative',
    marginBottom: 16,
    width: 200,
    alignItems: 'center',
  },
  heroPhotoBox: {
    width: 160, height: 160,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  heroEmoji: { fontSize: 80 },

  heroName: { fontSize: 28, fontWeight: '600', color: COLORS.dark, letterSpacing: -0.6, textAlign: 'center', marginBottom: 10 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tierPill: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999 },
  tierPillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  statusPill: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },

  // CTA
  ctaWrap: { paddingHorizontal: 22, marginBottom: 18 },
  captureBtn: {
    backgroundColor: '#E8704F',
    height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  captureBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  limedBtn: {
    backgroundColor: COLORS.palmGreen,
    height: 40, borderRadius: 20,
    alignSelf: 'center', paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  limedBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Mini section label (existing pattern)
  miniLabel: { fontSize: 10, fontWeight: '700', color: '#888', letterSpacing: 1.5, marginBottom: 10, textTransform: 'lowercase' },

  // Squad reactions (preserved)
  reactionsRow: { flexDirection: 'row', gap: 8 },
  reactionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  reactionEmoji: { fontSize: 16 },
  reactionCount: { fontSize: 12, fontWeight: '700', color: '#555' },

  // Section headers (handwritten + doodle)
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 },
  sectionHeaderLeft: { position: 'relative', height: 38, justifyContent: 'center', paddingRight: 24 },
  sectionHeader: { fontSize: 22, color: COLORS.dark, letterSpacing: -0.4, lineHeight: 28 },
  sectionAside: { fontSize: 11, color: '#888', fontStyle: 'italic' },
  sectionSub: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 12 },

  // Location input (scoped to where-to-do-it)
  locInput: {
    backgroundColor: '#fff',
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    fontSize: 14, color: COLORS.dark,
    marginTop: 10, marginBottom: 14,
  },

  // AI loading + error states
  loadingBox: { backgroundColor: '#fff', borderRadius: 18, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  loadingText: { color: '#aaa', fontSize: 12, marginTop: 12 },
  errorBox: { backgroundColor: '#FDE7DD', borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#F0C5AE' },
  errorText: { color: '#993C1D', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  errorHint: { color: '#993C1D', fontSize: 11, marginTop: 6, opacity: 0.7, letterSpacing: 0.3 },

  // Venue suggestion cards
  suggestCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1,
  },
  suggestName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, flex: 1, marginRight: 8, letterSpacing: -0.2 },
  suggestArrow: { color: '#888', fontSize: 18 },
  suggestDesc: { fontSize: 12, color: '#777', lineHeight: 18, marginBottom: 10 },

  favoritePill: { alignSelf: 'flex-start', backgroundColor: PASTELS.coralBg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  favoritePillText: { fontSize: 11, fontWeight: '700', color: COLORS.deepCoral },
  tagPill: { alignSelf: 'flex-start', backgroundColor: '#F1EBDE', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  tagPillText: { fontSize: 11, fontWeight: '600', color: '#666', letterSpacing: 0.2 },

  // Who's free?
  matchPolaroid: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16, padding: 12,
    marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    position: 'relative',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1,
  },
  matchName: { fontSize: 14, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  slotChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' },
  slotPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#F1EBDE' },
  slotPillText: { fontSize: 10, fontWeight: '700', color: '#666' },
  slotMore: { fontSize: 11, color: '#888', fontWeight: '600' },
  inviteBtn: { backgroundColor: COLORS.coral, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  inviteBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyMatch: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.cardBorder },
  emptyMatchText: { color: '#888', fontSize: 13, lineHeight: 18, textAlign: 'center' },

  // Pin a venue link
  pinnedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.cardBorder },
  pinnedLabel: { color: COLORS.coral, fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 },
  pinnedUrl: { color: COLORS.dark, fontSize: 12 },
  pinnedEdit: { color: '#888', fontSize: 11, fontWeight: '700' },
  pinAddBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.cardBorder },
  pinAddBtnText: { color: '#666', fontSize: 13, fontWeight: '600' },
  pinInput: { backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder, fontSize: 13, color: COLORS.dark },
  miniBtn: { padding: 12, borderRadius: 12, alignItems: 'center', flex: 1 },

  // Invite-sent toast
  inviteToast: {
    position: 'absolute', left: 22, right: 22, top: 4, zIndex: 100,
    backgroundColor: COLORS.dark, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  inviteToastText: { color: COLORS.cream, fontSize: 14, fontWeight: '700', textAlign: 'center' },

  // Google fallback
  googleLink: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, marginTop: 16 },
  googleLinkText: { color: '#999', fontSize: 12, textDecorationLine: 'underline' },

  // Bottom decorative
  bottomAccents: { height: 50, marginTop: 10, position: 'relative' },
});
