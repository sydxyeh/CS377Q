# React Native Setup Guide

This project now has both a **web version** (React + Vite) and a **React Native version** (Expo).

## Quick Start for React Native

1. **Install dependencies:**
   ```bash
   # First, backup your current package.json
   cp package.json package-web.json
   
   # Install React Native dependencies
   npm install --save expo@~51.0.0 react-native@0.74.5 @react-navigation/native@^6.1.9 @react-navigation/bottom-tabs@^6.5.11 @expo/vector-icons@^14.0.0 react-native-reanimated@~3.10.1 react-native-gesture-handler@~2.16.1 @react-native-async-storage/async-storage@1.23.1 expo-av@~14.0.7 expo-speech@~12.0.1 react-native-safe-area-context@4.10.5 react-native-screens@~3.31.1
   ```

2. **Start the Expo development server:**
   ```bash
   npx expo start
   ```

3. **Run on iOS Simulator:**
   - Press `i` in the terminal (after Expo starts)
   - Or run: `npx expo start --ios`

4. **Run on Android:**
   - Press `a` in the terminal
   - Or run: `npx expo start --android`

## Project Structure

- **Web version**: `src/app/` - Original React web components
- **React Native version**: `src/native/` - React Native components
- **Main entry**: `App.native.tsx` - React Native app entry point

## Key Differences

### Web → React Native Conversions:

1. **Components:**
   - `<div>` → `<View>`
   - `<span>`, `<p>` → `<Text>`
   - `<button>` → `<Pressable>` or `<TouchableOpacity>`
   - `<input>`, `<textarea>` → `<TextInput>`

2. **Styling:**
   - CSS classes → `StyleSheet.create()`
   - Tailwind → React Native StyleSheet
   - No CSS gradients (use `LinearGradient` from `expo-linear-gradient`)

3. **Storage:**
   - `localStorage` → `AsyncStorage` from `@react-native-async-storage/async-storage`

4. **Icons:**
   - `lucide-react` → `@expo/vector-icons` (Ionicons)

5. **Animations:**
   - `motion/react` → `react-native-reanimated`

6. **Navigation:**
   - Custom tabs → `@react-navigation/bottom-tabs`

## Next Steps

The React Native components are being created. You'll need to:

1. Complete the component conversions in `src/native/components/`
2. Test on iOS/Android simulators
3. Add any missing native features (voice recording, etc.)

## Switching Between Web and Native

- **Web**: Use `npm run dev` (runs Vite)
- **Native**: Use `npx expo start` (runs Expo)

