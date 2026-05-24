import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── PROFILES ──────────────────────────────────────────────
export async function getProfile(id) {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
  return data;
}

export async function upsertProfile(profile) {
  const { data, error } = await supabase.from('profiles').upsert(profile).select().single();
  if (error) throw error;
  return data;
}

export async function getAllMembers() {
  const { data } = await supabase
    .from('profiles')
    .select('*, badges(count)')
    .order('created_at', { ascending: true });
  return data || [];
}

// ── BADGES ────────────────────────────────────────────────
export async function getBadges(profileId) {
  const { data } = await supabase
    .from('badges')
    .select('activity_id, earned_at')
    .eq('profile_id', profileId)
    .order('earned_at', { ascending: false });
  return (data || []).map(b => b.activity_id);
}

export async function earnBadge(profileId, activityId) {
  await supabase.from('badges').upsert({ profile_id: profileId, activity_id: activityId });
}

export async function removeBadge(profileId, activityId) {
  await supabase.from('badges').delete().eq('profile_id', profileId).eq('activity_id', activityId);
}

// Legacy aliases — keep until callers migrate.
export const getPatches  = getBadges;
export const earnPatch   = earnBadge;
export const removePatch = removeBadge;

// ── MEMORIES ─────────────────────────────────────────────
export async function getMemories() {
  const { data } = await supabase
    .from('memories')
    .select('*, profiles(name, emoji, avatar, photo_url, accent_color), comments(*, profiles(name, emoji, avatar, photo_url, accent_color))')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function addMemory(payload) {
  const { data, error } = await supabase.from('memories').insert(payload).select().single();
  if (error) throw error;
  return data;
}

// Pull "memories/<profileId>/<file>" out of a public Lime-Photos URL so it
// can be passed to storage.remove(). Returns null if the URL doesn't
// match the bucket.
export function extractPhotoPath(photoUrl, bucketName = 'Lime-Photos') {
  if (!photoUrl) return null;
  const marker = `/${bucketName}/`;
  const idx = photoUrl.indexOf(marker);
  if (idx === -1) return null;
  return photoUrl.slice(idx + marker.length);
}

export async function deleteMemoryRow(memoryId) {
  const { error } = await supabase.from('memories').delete().eq('id', memoryId);
  if (error) throw error;
}

// ── COMMENTS ─────────────────────────────────────────────
export async function addComment({ memoryId, profileId, text }) {
  const { data, error } = await supabase.from('comments').insert({
    memory_id: memoryId, profile_id: profileId, text,
  }).select().single();
  if (error) throw error;
  return data;
}

// ── PINNED LINKS ─────────────────────────────────────────
export async function getPinnedLink(activityId) {
  const { data } = await supabase.from('pinned_links').select('*').eq('activity_id', activityId).single();
  return data;
}

export async function pinLink({ activityId, profileId, url }) {
  const { data, error } = await supabase.from('pinned_links')
    .upsert({ activity_id: activityId, profile_id: profileId, url })
    .select().single();
  if (error) throw error;
  return data;
}

// ── USER ACTIVITIES (CRUD) ────────────────────────────────
// Row shape: id, profile_id, activity_id, source, status, created_at, target_date, notes.
export async function getUserActivities(profileId) {
  const { data, error } = await supabase
    .from('user_activities')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[supabase/getUserActivities] failed:', error.message);
    return [];
  }
  return data || [];
}

export async function upsertUserActivity(activity) {
  const { data, error } = await supabase
    .from('user_activities')
    .upsert(activity)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUserActivity(id) {
  const { error } = await supabase.from('user_activities').delete().eq('id', id);
  if (error) throw error;
}

// One row's worth of "the user's relationship to this seed activity":
// source ('dream' | 'squad_plan'), status ('up_next' | 'planned' |
// 'lived'), and target_date. Returns null when nothing is saved.
// NOTE: existing schema uses profile_id, not user_id.
export async function getUserActivity(profileId, activityId) {
  const { data } = await supabase
    .from('user_activities')
    .select('id, source, status, target_date')
    .eq('profile_id', profileId)
    .eq('activity_id', activityId)
    .maybeSingle();
  return data || null;
}

// ── SQUAD REACTIONS ───────────────────────────────────────
// One row per (activity_id, profile_id). Replacing one user's reaction
// is just an upsert. Removing = delete.
export async function setReaction({ activityId, profileId, reaction }) {
  const { data, error } = await supabase
    .from('squad_reactions')
    .upsert({ activity_id: activityId, profile_id: profileId, reaction })
    .select().single();
  if (error) throw error;
  return data;
}

export async function clearReaction({ activityId, profileId }) {
  await supabase
    .from('squad_reactions')
    .delete()
    .eq('activity_id', activityId)
    .eq('profile_id', profileId);
}

export async function getReactionsForActivity(activityId) {
  const { data } = await supabase
    .from('squad_reactions')
    .select('reaction, profile_id')
    .eq('activity_id', activityId);
  return data || [];
}

// Top N activities by positive reactions (🔥 + 🙌) in the last `days` days.
export async function getTrendingActivities({ days = 7, limit = 3 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('squad_reactions')
    .select('activity_id, reaction, created_at')
    .in('reaction', ['🔥', '🙌'])
    .gte('created_at', since);
  // Aggregate client-side (tiny dataset, no need for SQL window fn)
  const counts = {};
  (data || []).forEach(r => { counts[r.activity_id] = (counts[r.activity_id] || 0) + 1; });
  return Object.entries(counts)
    .map(([activity_id, count]) => ({ activity_id: Number(activity_id), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── INVITES ───────────────────────────────────────────────
// In-app invites tied to an activity + suggested time slot.
// Heading "What yuh for? Leh we lime!" is fixed and rendered
// client-side — never stored in the row.
export async function sendInvite({ fromUserId, toUserId, activityId, suggestedTime, customMessage }) {
  const { data, error } = await supabase
    .from('invites')
    .insert({
      from_user_id:    fromUserId,
      to_user_id:      toUserId,
      activity_id:     activityId,
      suggested_time:  suggestedTime,
      custom_message:  customMessage || null,
      status:          'pending',
    })
    .select().single();
  if (error) throw error;
  return data;
}

// Received invites for a user, joined with sender profile.
export async function getInvitesReceived(profileId) {
  const { data } = await supabase
    .from('invites')
    .select('*, from_profile:profiles!invites_from_user_id_fkey(id, name, photo_url, accent_color, avatar, emoji)')
    .eq('to_user_id', profileId)
    .order('created_at', { ascending: false });
  return data || [];
}

// Sent invites by a user, joined with recipient profile.
export async function getInvitesSent(profileId) {
  const { data } = await supabase
    .from('invites')
    .select('*, to_profile:profiles!invites_to_user_id_fkey(id, name, photo_url, accent_color, avatar, emoji)')
    .eq('from_user_id', profileId)
    .order('created_at', { ascending: false });
  return data || [];
}

// Count of unread + pending received invites — drives the bell badge.
export async function getUnreadInviteCount(profileId) {
  const { count } = await supabase
    .from('invites')
    .select('id', { count: 'exact', head: true })
    .eq('to_user_id', profileId)
    .eq('status', 'pending')
    .is('read_at', null);
  return count || 0;
}

export async function markInviteRead(inviteId) {
  await supabase
    .from('invites')
    .update({ read_at: new Date().toISOString() })
    .eq('id', inviteId);
}

export async function markAllReceivedRead(profileId) {
  await supabase
    .from('invites')
    .update({ read_at: new Date().toISOString() })
    .eq('to_user_id', profileId)
    .is('read_at', null);
}

export async function setInviteStatus(inviteId, status) {
  await supabase.from('invites').update({ status }).eq('id', inviteId);
}

// All accepted invites the current user is part of (either sender or
// receiver), with both sides' profiles joined. SquadScreen groups
// these client-side by activity_id to build "upcoming together".
export async function getAcceptedInvites(profileId) {
  const { data } = await supabase
    .from('invites')
    .select(`
      *,
      from_profile:profiles!invites_from_user_id_fkey(id, name, photo_url, accent_color, avatar, emoji),
      to_profile:profiles!invites_to_user_id_fkey(id, name, photo_url, accent_color, avatar, emoji)
    `)
    .eq('status', 'accepted')
    .or(`from_user_id.eq.${profileId},to_user_id.eq.${profileId}`)
    .order('created_at', { ascending: false });
  return data || [];
}

// ── PHOTO UPLOAD ──────────────────────────────────────────
// Takes a picked-image asset (NOT a URI). Required: { base64, mimeType }.
// In React Native, fetch(file://...).blob() produces a malformed Blob that
// supabase-js uploads as near-empty bytes; decoding base64 → ArrayBuffer
// avoids that path entirely.
export async function uploadPhoto({ base64, mimeType, fileName } = {}, profileId, folder = 'memories') {
  if (!base64) throw new Error('uploadPhoto: missing base64 data');
  const arrayBuffer = decode(base64);
  const ext = (mimeType?.split('/')[1] || 'jpg').toLowerCase();
  const contentType = mimeType || 'image/jpeg';
  const path = `${folder}/${profileId}/${Date.now()}.${ext}`;

  const { data: { session } } = await supabase.auth.getSession();
  console.log('[upload] auth session exists:', !!session);
  console.log('[upload] auth user id:', session?.user?.id);
  console.log('[upload] upload path:', path);
  console.log('[upload] bucket name being used:', 'Lime-Photos');
  console.log('[upload data check]', {
    hasBase64: !!base64,
    base64Length: base64?.length,
    arrayBufferSize: arrayBuffer?.byteLength,
    contentType,
  });

  const { error } = await supabase.storage.from('Lime-Photos').upload(path, arrayBuffer, {
    contentType, upsert: false,
  });
  if (error) {
    console.warn('[upload] storage error:', error);
    throw error;
  }
  const { data } = supabase.storage.from('Lime-Photos').getPublicUrl(path);
  return data.publicUrl;
}

// ── AVAILABILITY ──────────────────────────────────────────
export async function saveAvailability({ profileId, weekStart, slots }) {
  await supabase.from('availability').upsert({ profile_id: profileId, week_start: weekStart, slots });
}

export async function getWeekAvailability(weekStart) {
  const { data } = await supabase
    .from('availability')
    .select('*, profiles(name, emoji)')
    .eq('week_start', weekStart);
  return data || [];
}
