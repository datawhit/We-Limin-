# 🍋 We Limin' — React Native App

## Quick Start (5 mins)

### 1. Install dependencies
```bash
npm install
```

### 2. Add your keys
Rename `.env.example` to `.env` and fill in:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_ANTHROPIC_KEY=sk-ant-your-key
```

### 3. Run the app
```bash
npx expo start
```

### 4. Open on your phone
- Download **Expo Go** from the App Store / Google Play
- Scan the QR code that appears in terminal
- App opens on your phone instantly 🍋

---

## Supabase Setup (~10 mins)

1. Go to **supabase.com** → new project → name it `lime-app`
2. SQL Editor → paste `SUPABASE_SETUP.sql` → Run
3. Storage → create bucket → name `lime-photos` → set **Public**
4. Project Settings → API → copy URL and anon key → paste in `.env`

---

## Share with the Squad (before App Store)

```bash
npx eas build --profile preview --platform all
```

This generates a shareable link. Friends click it, download, done.
No App Store needed yet.

---

## App Store / Google Play (V2)

```bash
# iOS
npx eas build --platform ios

# Android  
npx eas build --platform android
```

Then submit through App Store Connect / Google Play Console.

---

## Using Claude Code in VS Code

Open this folder in VS Code then run:
```bash
claude
```

Claude Code can see all your files and you can ask it to:
- Add new features
- Fix bugs
- Update the activities list
- Change designs
- Wire up new screens

---

## Project Structure

```
lime-native/
├── App.js                    ← Entry, navigation, global state
├── src/
│   ├── screens/
│   │   ├── SetupScreen.js    ← Onboarding + avatar builder
│   │   ├── HomeScreen.js     ← Profile, randomizer, recent memories
│   │   ├── ActivitiesScreen.js ← Full activity list
│   │   ├── ActivityDetailScreen.js ← AI suggestions, pin link
│   │   ├── SquadScreen.js    ← Everyone's patches
│   │   ├── ScrapbookScreen.js ← Memory feed
│   │   └── AddMemoryScreen.js ← Post a memory
│   ├── components/
│   │   └── AvatarSVG.js      ← Custom cartoon avatar
│   └── lib/
│       ├── constants.js      ← Activities, colors, ratings
│       ├── supabase.js       ← Database functions
│       └── ai.js             ← AI suggestions (Anthropic)
├── SUPABASE_SETUP.sql        ← Run this in Supabase
├── .env.example              ← Copy to .env and fill in keys
└── app.json                  ← Expo config
```

---

## Tech Stack

| Piece | Tool | Cost |
|---|---|---|
| App framework | React Native + Expo | Free |
| Database + photos | Supabase | Free |
| AI suggestions | Anthropic API | ~cents/day |
| App distribution | EAS Build | Free tier |
| App Store (V2) | Apple / Google | $99/yr Apple, $25 once Google |
