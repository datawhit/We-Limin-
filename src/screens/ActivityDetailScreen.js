import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Animated,
  StyleSheet, ActivityIndicator, Linking, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../lib/AppContext';
import { COLORS, TIER, getTier } from '../lib/constants';
import {
  earnBadge, removeBadge, getPinnedLink, pinLink,
  getReactionsForActivity, setReaction, clearReaction,
  getWeekAvailability, sendInvite,
} from '../lib/supabase';
import { getAISuggestions, getAIFallback } from '../lib/ai';
import BadgeUnlockModal from '../components/BadgeUnlockModal';
import ProfileAvatar from '../components/ProfileAvatar';
import { checkAndUnlockHiddenBadges } from '../lib/hiddenBadges';
import { getMondayOfThisWeek, weekStartISO } from './AvailabilityModal';

const DAY_LABEL = { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' };
const SLOT_LABEL = { morning: 'morning', afternoon: 'afternoon', evening: 'evening' };

export default function ActivityDetailScreen({ route, navigation }) {
  const { activity, isModal } = route.params || {};
  const { profile, myBadges, setMyBadges } = useContext(AppContext);
  const earned = myBadges.includes(activity.id);
  const t = TIER[activity.tier];
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#FFFFFF';

  const [location, setLocation] = useState('NYC');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingAI, setLoadingAI] = useState(true);
  const [aiError, setAIError] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [pinUrl, setPinUrl] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  // Queue of unlock-modal payloads. The badge itself is enqueued first,
  // followed by any hidden badges. We render the head; advancing pops it.
  const [unlockQueue, setUnlockQueue] = useState([]);

  // "Who's free?" — squad availability matches with the current user.
  const [availMatches, setAvailMatches] = useState([]); // [{ member, overlap: [{day, slot}] }]
  const [inviteFor, setInviteFor] = useState(null); // { member, overlap } when modal open
  const [toastVisible, setToastVisible] = useState(false);
  const toastY = useRef(new Animated.Value(-80)).current;

  // Squad reactions
  const [reactions, setReactions] = useState([]); // [{ reaction, profile_id }]
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

  const loadReactions = async () => {
    try { setReactions(await getReactionsForActivity(activity.id)); }
    catch (e) { /* offline or table missing — silent */ }
  };
  const toggleReaction = async (emoji) => {
    const next = (myReaction === emoji)
      ? reactions.filter(r => r.profile_id !== profile.id)
      : [...reactions.filter(r => r.profile_id !== profile.id), { reaction: emoji, profile_id: profile.id }];
    setReactions(next); // optimistic
    try {
      if (myReaction === emoji) await clearReaction({ activityId: activity.id, profileId: profile.id });
      else await setReaction({ activityId: activity.id, profileId: profile.id, reaction: emoji });
    } catch (e) { /* keep optimistic state on failure */ }
  };

  // Debounce timer for the location input — new keystrokes cancel
  // the pending fire. Retry counter is a ref so the catch block
  // reads the current value synchronously (state updates wouldn't
  // be visible inside the same invocation).
  const debounceRef = useRef(null);
  const retryCountRef = useRef(0);

  // Fire on mount AND whenever location changes (debounced 600ms).
  // Replaces the old mount-only effect + onSubmitEditing path.
  useEffect(() => {
    if (!location.trim()) return;
    retryCountRef.current = 0;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { loadAI(); }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [location]);

  useEffect(() => { loadPinned(); loadReactions(); loadAvailMatches(); }, []);

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
            if ((member.slots?.[day] || []).includes(slot)) {
              overlap.push({ day, slot });
            }
          });
        });
        return { member, overlap };
      }).filter(m => m.overlap.length > 0);
      setAvailMatches(matches);
    } catch (e) { /* table missing or offline — empty state shows */ }
  };

  const flashToast = () => {
    setToastVisible(true);
    toastY.setValue(-80);
    Animated.sequence([
      Animated.spring(toastY, { toValue: 12, useNativeDriver: true, friction: 6 }),
      Animated.delay(1800),
      Animated.timing(toastY, { toValue: -80, duration: 220, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const handleInviteSent = () => {
    setInviteFor(null);
    flashToast();
  };

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
        // Two retries already burned — drop to the static fallback so
        // the user always sees *something* bookable.
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

  const handleRetry = () => {
    retryCountRef.current += 1;
    loadAI();
  };

  const loadPinned = async () => {
    try {
      const p = await getPinnedLink(activity.id);
      if (p) setPinned(p);
    } catch (e) { /* noop */ }
  };

  const toggleBadge = async () => {
    try {
      if (earned) {
        await removeBadge(profile.id, activity.id);
        setMyBadges(myBadges.filter(id => id !== activity.id));
        return;
      }
      // Earning path — celebrate.
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

      // Hidden badge: Spontaneous (completed within 2h of first app open today)
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
      } catch (e) { /* hidden badge check failed — non-fatal */ }

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

  return (
    <SafeAreaView style={styles.safe}>
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
          <Text style={styles.inviteToastText}>Invite sent 🍋</Text>
        </Animated.View>
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Top bar — X to dismiss modal, ← to pop stack */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={{ fontSize: 18, color: COLORS.dark }}>{isModal ? '✕' : '←'}</Text>
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: t.bg }]}>
            <Text style={styles.heroEmoji}>{activity.emoji}</Text>
            <View style={[styles.heroTierPill, { borderColor: t.text }]}>
              <Text style={[styles.heroTierText, { color: t.text }]}>{t.label} tier</Text>
            </View>
            <Text style={[styles.heroName, { color: t.text }]}>{activity.name}</Text>
            {activity.tripType && (
              <Text style={[styles.heroSub, { color: t.text }]}>✈️ Trip vibes</Text>
            )}
          </View>

          {/* Badge button */}
          <View style={{ padding: 20 }}>
            <TouchableOpacity
              onPress={toggleBadge}
              style={[styles.badgeBtn, { backgroundColor: earned ? '#fff' : accent, borderColor: earned ? accent : 'transparent', borderWidth: earned ? 2 : 0 }]}
            >
              <Text style={[styles.badgeBtnText, { color: earned ? accent : accentText }]}>
                {earned ? `${activity.badge} Earned ✓ — tap to remove` : `🏅 Mark as done — earn ${activity.badge}`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Squad reactions */}
          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            <Text style={styles.reactionsLabel}>SQUAD REACTIONS</Text>
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

          {/* AI Suggestions */}
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>✨ Where to do it</Text>
              <Text style={styles.sectionSub}>AI picks for you</Text>
            </View>

            {/* Location search — debounced; no return-key required */}
            <TextInput
              value={location}
              onChangeText={(v) => { console.log('[detail] location changed to', v); setLocation(v); }}
              placeholder="Type a city..."
              placeholderTextColor="#bbb"
              returnKeyType="search"
              style={styles.locInput}
            />

            {loadingAI ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={COLORS.dark} />
                <Text style={styles.loadingText}>Finding the spots...</Text>
              </View>
            ) : aiError ? (
              <TouchableOpacity onPress={handleRetry} style={styles.errorBox} activeOpacity={0.8}>
                <Text style={styles.errorText}>{aiError}</Text>
                <Text style={styles.errorHint}>Tap to retry ↻</Text>
              </TouchableOpacity>
            ) : (
              suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => s.url && Linking.openURL(s.url)}
                  style={styles.suggestCard}
                  disabled={!s.url}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <Text style={styles.suggestName}>{s.name}</Text>
                    {s.url && <Text style={{ color: '#aaa', fontSize: 18 }}>↗</Text>}
                  </View>
                  <Text style={styles.suggestDesc}>{s.desc}</Text>
                  <View style={[styles.suggestTag, { backgroundColor: accent }]}>
                    <Text style={[styles.suggestTagText, { color: accentText }]}>{s.tag}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Who's free? */}
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Who's free?</Text>
            <Text style={[styles.sectionSub, { marginBottom: 12 }]}>
              Matched on your shared week
            </Text>

            {availMatches.length === 0 ? (
              <View style={styles.emptyMatch}>
                <Text style={styles.emptyMatchText}>
                  Nobody's free at the same time as you. Update your availability or check back later.
                </Text>
              </View>
            ) : (
              availMatches.map(({ member, overlap }) => {
                const mAccent = member.accent_color || member.profiles?.accent_color || COLORS.coral;
                return (
                  <View key={member.profile_id} style={styles.matchRow}>
                    <ProfileAvatar profile={member.profiles || member} size={44} ringColor={mAccent} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.matchName} numberOfLines={1}>
                        {member.profiles?.name || member.name || 'Someone'}
                      </Text>
                      <View style={styles.slotChips}>
                        {overlap.slice(0, 3).map((s, i) => (
                          <View key={i} style={styles.slotPill}>
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
                      <Text style={styles.inviteBtnText}>Send invite</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>

          {/* Pinned link */}
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <Text style={styles.sectionTitle}>📌 Squad pick</Text>
            <Text style={[styles.sectionSub, { marginBottom: 10 }]}>Pin the link that actually worked</Text>

            {pinned ? (
              <View style={styles.pinnedCard}>
                <TouchableOpacity onPress={() => Linking.openURL(pinned.url)} style={{ flex: 1 }}>
                  <Text style={styles.pinnedLabel}>PINNED</Text>
                  <Text style={styles.pinnedUrl} numberOfLines={2}>{pinned.url}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowPinInput(true)}>
                  <Text style={{ color: '#888', fontSize: 11, fontWeight: '700' }}>EDIT</Text>
                </TouchableOpacity>
              </View>
            ) : !showPinInput ? (
              <TouchableOpacity onPress={() => setShowPinInput(true)} style={styles.pinAddBtn}>
                <Text style={{ color: '#666', fontSize: 13, fontWeight: '600' }}>＋ Pin a correct link</Text>
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
                  <TouchableOpacity onPress={() => { setShowPinInput(false); setPinUrl(''); }} style={[styles.miniBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border }]}>
                    <Text style={{ color: '#666', fontSize: 12, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handlePinSubmit} style={[styles.miniBtn, { backgroundColor: accent, flex: 1 }]}>
                    <Text style={{ color: accentText, fontSize: 12, fontWeight: '700' }}>📌 Pin it</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Subtle Google link */}
          <TouchableOpacity onPress={openGoogle} style={styles.googleLink}>
            <Text style={styles.googleLinkText}>🔎 Search "{activity.name}" on Google</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── SendInviteModal ──────────────────────────────────────
// Fixed heading "What yuh for? Leh we lime!" + activity + chosen
// matching time slot + optional note. Inserts into invites table.
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { padding: 18, paddingBottom: 0 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },

  hero: { margin: 22, marginTop: 14, padding: 36, borderRadius: 30, alignItems: 'center' },
  heroEmoji: { fontSize: 84, marginBottom: 14 },
  heroTierPill: { borderWidth: 1.5, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 10, marginBottom: 12 },
  heroTierText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroName: { fontSize: 30, fontWeight: '700', textAlign: 'center', letterSpacing: -0.6 },
  heroSub: { fontSize: 13, marginTop: 8, opacity: 0.7, fontWeight: '600' },

  badgeBtn: { padding: 17, borderRadius: 14, alignItems: 'center' },
  badgeBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },

  // Who's free?
  matchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  matchName: { fontSize: 14, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  slotChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' },
  slotPill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#F1EBDE' },
  slotPillText: { fontSize: 10, fontWeight: '700', color: '#666' },
  slotMore: { fontSize: 11, color: '#888', fontWeight: '600' },
  inviteBtn: { backgroundColor: COLORS.coral, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11 },
  inviteBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyMatch: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.cardBorder },
  emptyMatchText: { color: '#888', fontSize: 13, lineHeight: 18, textAlign: 'center' },

  inviteToast: {
    position: 'absolute', left: 22, right: 22, top: 4, zIndex: 100,
    backgroundColor: COLORS.dark, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  inviteToastText: { color: COLORS.cream, fontSize: 14, fontWeight: '700', textAlign: 'center' },

  reactionsLabel: { fontSize: 10, fontWeight: '700', color: '#888', letterSpacing: 1.5, marginBottom: 10 },
  reactionsRow: { flexDirection: 'row', gap: 8 },
  reactionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  reactionEmoji: { fontSize: 16 },
  reactionCount: { fontSize: 12, fontWeight: '700', color: '#555' },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, color: '#999', letterSpacing: 0.2 },

  locInput: { backgroundColor: '#fff', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', fontSize: 14, color: COLORS.dark, marginBottom: 16 },

  googleLink: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, marginTop: 16 },
  googleLinkText: { color: '#999', fontSize: 12, textDecorationLine: 'underline' },

  loadingBox: { backgroundColor: '#fff', borderRadius: 18, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  loadingText: { color: '#aaa', fontSize: 12, marginTop: 12 },

  errorBox: { backgroundColor: '#FDE7DD', borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#F0C5AE' },
  errorText: { color: '#993C1D', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  errorHint: { color: '#993C1D', fontSize: 11, marginTop: 6, opacity: 0.7, letterSpacing: 0.3 },

  suggestCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  suggestName: { fontSize: 15, fontWeight: '700', color: COLORS.dark, flex: 1, marginRight: 8, letterSpacing: -0.2 },
  suggestDesc: { fontSize: 12, color: '#777', lineHeight: 18, marginBottom: 12 },
  suggestTag: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 11, borderRadius: 8 },
  suggestTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  pinnedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.dark, borderRadius: 16, padding: 16 },
  pinnedLabel: { color: COLORS.coral, fontSize: 9, letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 },
  pinnedUrl: { color: '#fff', fontSize: 12 },
  pinAddBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.12)' },
  pinInput: { backgroundColor: '#fff', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', fontSize: 13, color: COLORS.dark },
  miniBtn: { padding: 12, borderRadius: 12, alignItems: 'center', flex: 1 },
});
