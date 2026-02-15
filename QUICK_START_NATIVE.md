# Quick Start: React Native Version

Your app has been converted to React Native! Here's how to run it:

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Expo CLI globally (if needed):**
   ```bash
   npm install -g expo-cli
   ```

## Running the App

### Option 1: Use Expo Go (Easiest)

1. **Start the development server:**
   ```bash
   npx expo start
   ```

2. **On your phone:**
   - Install "Expo Go" from App Store (iOS) or Play Store (Android)
   - Scan the QR code that appears in your terminal
   - The app will load on your phone!

### Option 2: iOS Simulator (Mac only)

1. **Start Expo:**
   ```bash
   npx expo start
   ```

2. **Press `i`** in the terminal to open iOS Simulator
   - Or run: `npx expo start --ios`

### Option 3: Android Emulator

1. **Start Expo:**
   ```bash
   npx expo start
   ```

2. **Press `a`** in the terminal to open Android Emulator
   - Or run: `npx expo start --android`

## Project Structure

- **Web version**: `src/app/` (original React web app)
- **React Native version**: `src/native/` (new mobile app)
- **Entry point**: `App.native.tsx` (React Native app)

## What's Different?

### Components Converted:
✅ **App.native.tsx** - Main app with React Navigation tabs
✅ **Header** - Top bar with level and XP
✅ **BraindumpMode** - Text input for brain dumps
✅ **TaskList** - Task management with expandable tasks
✅ **AvatarCompanion** - Chat interface with avatar
✅ **GameStats** - Statistics and achievements
✅ **CuteAvatar** - Animated avatar with moods

### Key Changes:
- `localStorage` → `AsyncStorage` (persistent storage)
- `lucide-react` → `@expo/vector-icons` (Ionicons)
- `motion/react` → `react-native-reanimated` (animations)
- CSS/Tailwind → `StyleSheet` (React Native styles)
- Custom tabs → `@react-navigation/bottom-tabs`

## Next Steps

1. **Test the app** on iOS/Android simulator or your phone
2. **Add voice recording** (using `expo-av` or `expo-speech`)
3. **Customize styling** to match your preferences
4. **Add push notifications** (optional, using Expo Notifications)

## Troubleshooting

- **"Expo not found"**: Run `npm install -g expo-cli`
- **Simulator won't open**: Make sure Xcode is installed (for iOS) or Android Studio (for Android)
- **Build errors**: Try `npx expo start --clear` to clear cache

## Switching Between Web and Native

- **Web**: `npm run dev` (runs Vite web server)
- **Native**: `npx expo start` (runs Expo mobile app)

Both versions share the same business logic and data structures!

