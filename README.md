# CS377Q
Avatar companion for ADHD

## ADHD Task Management App (Mobile)

This is a React Native mobile application designed specifically for people with ADHD, featuring an avatar companion, gamification elements, and a braindump mode with voice transcription to help organize thoughts into actionable tasks.

## Features

- **Braindump Mode**: Voice input with real-time transcription using Google Cloud Speech-to-Text to capture all your thoughts without structure
- **Task Management**: Break down tasks into manageable subtasks with progress tracking
- **Avatar Companion**: A supportive AI companion that provides encouragement and support
- **Gamification**: Earn XP, level up, maintain streaks, and unlock achievements
- **Game Stats**: Track your progress, streaks, and achievements

## Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for Mac) or Android Emulator, or Expo Go app on your phone

## Setup

1. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Configure Google Cloud Speech-to-Text API key:**
   - Get your API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the Speech-to-Text API for your project
   - Create an API key in the Credentials section
   - Create a `.env` file in the root directory:
     ```
     EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY=your_api_key_here
     ```

## Running the App

### Option 1: Expo Go (Easiest)

1. **Start the development server:**
   ```bash
   npm start
   ```

2. **On your phone:**
   - Install "Expo Go" from App Store (iOS) or Play Store (Android)
   - Scan the QR code that appears in your terminal
   - The app will load on your phone!

### Option 2: iOS Simulator (Mac only)

1. **Start Expo:**
   ```bash
   npm start
   ```

2. **Press `i`** in the terminal to open iOS Simulator
   - Or run: `npm run ios`

### Option 3: Android Emulator

1. **Start Expo:**
   ```bash
   npm start
   ```

2. **Press `a`** in the terminal to open Android Emulator
   - Or run: `npm run android`

## Project Structure

- `App.native.tsx` - Main app entry point
- `src/native/components/` - React Native components
- `src/native/services/` - Audio recording and transcription services
- `app.json` - Expo configuration

## Building for Production

To build standalone apps:

- **iOS:** Use `eas build --platform ios` (requires Expo EAS account)
- **Android:** Use `eas build --platform android` (requires Expo EAS account)

Or use `expo build` for classic builds (deprecated but still works).
