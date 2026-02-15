# Fixing npm Permission Issues

You're getting a permissions error with npm. Here are solutions:

## Solution 1: Use npx directly (Quick Fix)

Instead of `npm install`, try:

```bash
npx npm install
```

## Solution 2: Fix npm Permissions

```bash
# Fix npm directory permissions
sudo chown -R $(whoami) /opt/homebrew/lib/node_modules
sudo chown -R $(whoami) /Users/sydney/.npm
```

## Solution 3: Use Yarn (Alternative)

Install yarn first:
```bash
brew install yarn
```

Then use yarn:
```bash
yarn install
```

## Solution 4: Use pnpm (Alternative)

Install pnpm:
```bash
npm install -g pnpm
# or
brew install pnpm
```

Then:
```bash
pnpm install
```

## Solution 5: Reinstall npm via Homebrew

```bash
brew reinstall node
```

## Solution 6: Use nvm instead of Homebrew Node

If the above don't work, consider using nvm:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node via nvm
nvm install 20
nvm use 20

# Then try npm install again
npm install
```

## Recommended: Try Solution 1 or 3 first

The quickest fix is usually `npx npm install` or switching to `yarn`.

