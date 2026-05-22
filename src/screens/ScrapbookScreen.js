import React, { useContext, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../lib/AppContext';
import ProfileAvatar from '../components/ProfileAvatar';
import { ACTIVITIES, COLORS, RATINGS, TIER } from '../lib/constants';
import { getMemories, addComment } from '../lib/supabase';

export default function ScrapbookScreen({ navigation }) {
  const { profile } = useContext(AppContext);
  const accent = profile.accent_color || COLORS.coral;
  const accentText = profile.accent_text || '#FFFFFF';

  const [memories, setMemories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [commentText, setCommentText] = useState({});

  const load = async () => {
    try {
      const m = await getMemories();
      setMemories(m);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const submitComment = async (memoryId) => {
    const text = (commentText[memoryId] || '').trim();
    if (!text) return;
    try {
      await addComment({ memoryId, profileId: profile.id, text });
      setCommentText(c => ({ ...c, [memoryId]: '' }));
      await load();
    } catch (e) { console.error(e); }
  };

  const ratingOf = (label) => RATINGS.find(r => r.label === label) || RATINGS[0];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Scrapbook</Text>
            <Text style={styles.subtitle}>{memories.length} {memories.length === 1 ? 'memory' : 'memories'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddMemory')}
            style={[styles.addBtn, { backgroundColor: accent }]}
          >
            <Text style={[styles.addBtnText, { color: accentText }]}>＋ Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 22, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.dark} />}
        >
          {memories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📷</Text>
              <Text style={styles.emptyTitle}>No memories yet</Text>
              <Text style={styles.emptyText}>Go lime something then drop a photo</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AddMemory')}
                style={[styles.emptyBtn, { backgroundColor: accent }]}
              >
                <Text style={[styles.emptyBtnText, { color: accentText }]}>＋ Add the first one</Text>
              </TouchableOpacity>
            </View>
          ) : (
            memories.map(m => {
              const a = ACTIVITIES.find(x => x.id === m.activity_id);
              const r = ratingOf(m.rating);
              const isOpen = expanded[m.id];
              const t = a ? TIER[a.tier] : null;
              return (
                <View key={m.id} style={styles.memoryCard}>
                  {/* Header */}
                  <View style={styles.memoryHeader}>
                    <ProfileAvatar profile={m.profiles || {}} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.authorName}>{m.profiles?.name || 'Someone'}</Text>
                      <Text style={styles.timeAgo}>{timeAgo(m.created_at)}</Text>
                    </View>
                    {a && (
                      <View style={[styles.activityChip, { backgroundColor: t.bg }]}>
                        <Text style={{ fontSize: 14 }}>{a.emoji}</Text>
                        <Text style={[styles.activityChipText, { color: t.text }]}>{a.name}</Text>
                      </View>
                    )}
                  </View>

                  {/* Photo */}
                  {m.photo_url && (
                    <Image source={{ uri: m.photo_url }} style={styles.photo} />
                  )}

                  {/* Caption + rating */}
                  <View style={{ padding: 16 }}>
                    {m.caption ? <Text style={styles.caption}>{m.caption}</Text> : null}
                    <View style={styles.captionFoot}>
                      <View style={[styles.ratingBig, { backgroundColor: r.color }]}>
                        <Text style={[styles.ratingBigText, { color: r.textColor }]}>{r.icon} {r.label}</Text>
                      </View>
                      <TouchableOpacity onPress={() => toggle(m.id)}>
                        <Text style={styles.commentToggle}>
                          💬 {m.comments?.length || 0} {isOpen ? '▲' : '▼'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Comments */}
                  {isOpen && (
                    <View style={styles.commentsBlock}>
                      {(m.comments || []).map(c => (
                        <View key={c.id} style={styles.commentRow}>
                          <ProfileAvatar profile={c.profiles || {}} size={28} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.commentName}>{c.profiles?.name || 'Someone'}</Text>
                            <Text style={styles.commentText}>{c.text}</Text>
                          </View>
                        </View>
                      ))}

                      <View style={styles.commentInputRow}>
                        <TextInput
                          value={commentText[m.id] || ''}
                          onChangeText={(v) => setCommentText(c => ({ ...c, [m.id]: v }))}
                          placeholder="Add a comment…"
                          placeholderTextColor="#bbb"
                          style={styles.commentInput}
                          returnKeyType="send"
                          onSubmitEditing={() => submitComment(m.id)}
                        />
                        <TouchableOpacity onPress={() => submitComment(m.id)} style={[styles.sendBtn, { backgroundColor: accent }]}>
                          <Text style={{ color: accentText, fontWeight: '700', fontSize: 14 }}>→</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 22, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: '#999', marginTop: 4 },
  addBtn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12 },
  addBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 26, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.dark, marginBottom: 6, letterSpacing: -0.3 },
  emptyText: { color: '#aaa', fontSize: 13, marginBottom: 24, textAlign: 'center' },
  emptyBtn: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 12 },
  emptyBtnText: { fontSize: 13, fontWeight: '700' },

  memoryCard: { backgroundColor: '#fff', borderRadius: 22, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', overflow: 'hidden' },
  memoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  authorName: { fontSize: 14, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.2 },
  timeAgo: { fontSize: 11, color: '#aaa', marginTop: 2 },
  activityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10 },
  activityChipText: { fontSize: 11, fontWeight: '700' },

  photo: { width: '100%', height: 360, backgroundColor: '#f1ebde' },

  caption: { fontSize: 14, color: COLORS.dark, lineHeight: 21 },
  captionFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  ratingBig: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
  ratingBigText: { fontSize: 12, fontWeight: '700' },
  commentToggle: { fontSize: 12, color: '#888', fontWeight: '600' },

  commentsBlock: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', padding: 14, backgroundColor: '#faf7f0' },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  commentName: { fontSize: 12, fontWeight: '700', color: COLORS.dark, marginBottom: 2 },
  commentText: { fontSize: 12, color: '#555', lineHeight: 17 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  commentInput: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 12, fontSize: 13, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', color: COLORS.dark },
  sendBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
