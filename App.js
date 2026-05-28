import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SetupScreen from './src/screens/SetupScreen';
import HomeScreen from './src/screens/HomeScreen';
import ActivitiesScreen from './src/screens/ActivitiesScreen';
import ActivityDetailScreen from './src/screens/ActivityDetailScreen';
import SquadScreen from './src/screens/SquadScreen';
import ScrapbookScreen from './src/screens/ScrapbookScreen';
import AddMemoryScreen from './src/screens/AddMemoryScreen';
import MemoryDetailScreen from './src/screens/MemoryDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BadgesScreen from './src/screens/BadgesScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import AuthScreen from './src/screens/AuthScreen';

import { getProfile, getBadges, upsertProfile, uploadPhoto, supabase } from './src/lib/supabase';
import { COLORS } from './src/lib/constants';
import { AppContext } from './src/lib/AppContext';
import { markFirstOpenToday } from './src/lib/hiddenBadges';

const PROFILE_KEY = 'lime_profile';
const USER_ID_KEY = 'lime_user_id';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseConfigured =
  !!supabaseUrl && !!supabaseKey && !supabaseUrl.includes('your-project');

console.log('[lime] Supabase URL:', supabaseUrl || '(missing)');
console.log('[lime] Supabase key present:', !!supabaseKey);
console.log('[lime] Supabase configured:', supabaseConfigured);

const Tab          = createBottomTabNavigator();
const TabStack     = createNativeStackNavigator();
const RootStack    = createNativeStackNavigator();
const WelcomeStack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: 'rgba(0,0,0,0.05)', height: 86, paddingBottom: 22, paddingTop: 10 },
        tabBarActiveTintColor: COLORS.coral,
        tabBarInactiveTintColor: '#bbb',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, marginTop: 4 },
        tabBarIcon: ({ focused }) => {
          // Lime-pin / lime-slice / palm / scrapbook — branded set.
          const icons = { Home: '🍋', Activities: '🧭', Squad: '🌴', Scrapbook: '📔' };
          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{
                  position: 'absolute', top: -2, width: 36, height: 26, borderRadius: 13,
                  backgroundColor: 'rgba(232,112,79,0.12)',
                }} />
              )}
              <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.4 }}>{icons[route.name]}</Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Activities" component={ActivitiesStack} options={{ tabBarLabel: 'Explore' }} />
      <Tab.Screen name="Squad" component={SquadScreen} />
      <Tab.Screen name="Scrapbook" component={ScrapbookStack} />
    </Tab.Navigator>
  );
}

function ActivitiesStack() {
  return (
    <TabStack.Navigator screenOptions={{ headerShown: false }}>
      <TabStack.Screen name="ActivitiesList" component={ActivitiesScreen} />
      <TabStack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
    </TabStack.Navigator>
  );
}

function ScrapbookStack() {
  return (
    <TabStack.Navigator screenOptions={{ headerShown: false }}>
      <TabStack.Screen name="ScrapbookList" component={ScrapbookScreen} />
      <TabStack.Screen name="AddMemory" component={AddMemoryScreen} />
      <TabStack.Screen name="MemoryDetail" component={MemoryDetailScreen} />
    </TabStack.Navigator>
  );
}

// Root stack — wraps the tab navigator and exposes ActivityDetail
// as a true modal screen. HomeScreen randomizer dives straight here
// so there's no back-state mismatch with the Activities tab stack.
function RootNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Tabs" component={TabNavigator} />
      <RootStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <RootStack.Screen
        name="ActivityDetailModal"
        component={ActivityDetailScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        initialParams={{ isModal: true }}
      />
      <RootStack.Screen
        name="Badges"
        component={BadgesScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </RootStack.Navigator>
  );
}

// Pre-auth stack — only mounted when the user has neither a Supabase
// session nor a legacy synthetic-id profile. W1.2b will replace the
// Auth screen's three buttons with real magic-link / Apple / Google
// flows; until then, those buttons route to the existing SetupScreen
// as a temporary bypass so the user can complete onboarding → Tabs.
function WelcomeStackNavigator({ onSetupComplete }) {
  return (
    <WelcomeStack.Navigator screenOptions={{ headerShown: false }}>
      <WelcomeStack.Screen name="Welcome" component={WelcomeScreen} />
      <WelcomeStack.Screen name="Auth" component={AuthScreen} />
      <WelcomeStack.Screen name="Setup">
        {(props) => <SetupScreen {...props} onComplete={onSetupComplete} />}
      </WelcomeStack.Screen>
    </WelcomeStack.Navigator>
  );
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [myBadges, setMyBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => { init(); }, []);

  // Subscribe to auth state changes — keeps `session` in sync with
  // sign-in / sign-out events fired by supabase-js anywhere in the app.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  const init = async () => {
    // Record first-open time of the day so the Spontaneous hidden
    // badge can check whether a completion happened within 2h.
    markFirstOpenToday();
    try {
      // Session detection first — drives the pre-auth routing branch
      // below. Profile hydration for authed users is deferred to W4.
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        setSession(currentSession);
      }

      const id = await AsyncStorage.getItem(USER_ID_KEY);
      if (!id) { setLoading(false); return; }

      let remote = null;
      if (supabaseConfigured) {
        try {
          remote = await getProfile(id);
        } catch (e) {
          console.warn('[lime] getProfile failed, falling back to local cache:', e?.message || e);
        }
      }

      if (remote) {
        setProfile(remote);
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(remote));
        try {
          const badges = await getBadges(id);
          setMyBadges(badges);
        } catch (e) { console.warn('[lime] getBadges failed:', e?.message || e); }
      } else {
        const cached = await AsyncStorage.getItem(PROFILE_KEY);
        if (cached) setProfile(JSON.parse(cached));
      }
    } catch (e) {
      console.error('[lime] init error:', e);
    }
    setLoading(false);
  };

  const handleSetupComplete = async ({ name, accentColor, photoUri, photoAsset, expression }) => {
    let id = await AsyncStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem(USER_ID_KEY, id);
    }

    let photoUrl = null;
    if (photoAsset?.base64 && supabaseConfigured) {
      try {
        photoUrl = await uploadPhoto(photoAsset, id, 'profiles');
      } catch (e) {
        console.warn('[lime] profile photo upload failed:', e?.message || e);
        photoUrl = photoUri || null;
      }
    } else if (photoUri) {
      photoUrl = photoUri;
    }

    const localProfile = {
      id,
      name,
      emoji: '🦋',
      accent_color: accentColor.value,
      accent_text: accentColor.text,
      color: accentColor.value,
      expression,
      photo_url: photoUrl,
    };

    if (supabaseConfigured) {
      try {
        const p = await upsertProfile(localProfile);
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
        setProfile(p);
        return;
      } catch (e) {
        console.warn('[lime] upsertProfile failed, continuing in local-only mode:', e?.message || e);
      }
    }

    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(localProfile));
    setProfile(localProfile);
  };

  const updateProfile = async (updates) => {
    let nextPhotoUrl = profile.photo_url;
    if (updates.photoAsset?.base64) {
      // A new photo was picked — upload it.
      nextPhotoUrl = updates.photoUri || profile.photo_url;
      if (supabaseConfigured) {
        try { nextPhotoUrl = await uploadPhoto(updates.photoAsset, profile.id, 'profiles'); }
        catch (e) { console.warn('[lime] profile photo upload failed:', e?.message || e); }
      }
    } else if (updates.photoUri === null) {
      // Explicit clear.
      nextPhotoUrl = null;
    }

    const next = {
      ...profile,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.expression !== undefined ? { expression: updates.expression } : {}),
      ...(updates.accentColor !== undefined ? {
        accent_color: updates.accentColor.value,
        accent_text: updates.accentColor.text,
        color: updates.accentColor.value,
      } : {}),
      photo_url: nextPhotoUrl,
    };

    if (supabaseConfigured) {
      try {
        const saved = await upsertProfile(next);
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(saved));
        setProfile(saved);
        return saved;
      } catch (e) {
        console.warn('[lime] updateProfile failed, falling back to local:', e?.message || e);
      }
    }
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setProfile(next);
    return next;
  };

  const logout = async () => {
    try {
      if (supabaseConfigured) {
        try { await supabase.auth.signOut(); } catch (e) { /* we don't use auth, no-op */ }
      }
      await AsyncStorage.clear();
    } catch (e) {
      console.warn('[lime] logout error:', e?.message || e);
    }
    setMyBadges([]);
    setProfile(null);
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🍋</Text>
          <ActivityIndicator color={COLORS.coral} />
        </View>
      </SafeAreaProvider>
    );
  }

  const needsAuth = !session && !profile;
  if (needsAuth) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <WelcomeStackNavigator onSetupComplete={handleSetupComplete} />
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  return (
    <AppContext.Provider value={{ profile, myBadges, setMyBadges, updateProfile, logout }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center' },
});
