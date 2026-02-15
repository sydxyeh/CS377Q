# Installing React Native Dependencies

The package.json has been updated with React Native dependencies. Now you need to install them:

## Step 1: Install Dependencies

```bash
npm install
```

This will install both web and React Native dependencies.

## Step 2: Start Expo

```bash
npm start
```

Or:

```bash
npx expo start
```

## Step 3: Open iOS Simulator

Once Expo starts, press `i` in the terminal to open iOS Simulator.

## Troubleshooting

If you get errors about missing packages, try:

```bash
npm install --legacy-peer-deps
```

If Expo still doesn't work, make sure you have the Expo CLI:

```bash
npm install -g expo-cli
```

Then try again:

```bash
npx expo start
```

