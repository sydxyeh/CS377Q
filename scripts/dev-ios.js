#!/usr/bin/env node

import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get local IP address
async function getLocalIP() {
  try {
    const { stdout } = await execAsync('ipconfig getifaddr en0');
    return stdout.trim();
  } catch {
    try {
      const { stdout } = await execAsync('ipconfig getifaddr en1');
      return stdout.trim();
    } catch {
      return 'localhost';
    }
  }
}

async function main() {
  console.log('🚀 Starting dev server...');
  
  // Start Vite dev server
  const vite = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
  });

  // Wait a bit for server to start, then open simulator
  setTimeout(async () => {
    const ip = await getLocalIP();
    const url = `http://${ip}:5173`;
    
    console.log('\n📱 Opening iOS Simulator...');
    console.log(`🌐 URL: ${url}\n`);
    
    // Open iOS Simulator
    exec('open -a Simulator', (error) => {
      if (error) {
        console.error('❌ Could not open Simulator. Make sure Xcode is installed.');
        return;
      }
      
      // Wait a bit for simulator to boot, then open Safari
      setTimeout(() => {
        console.log('🌐 Opening Safari in Simulator...');
        exec(`xcrun simctl openurl booted "${url}"`, (error) => {
          if (error) {
            console.log(`\n✅ Simulator opened! Please navigate to: ${url}`);
          } else {
            console.log(`\n✅ Safari opened with your app!`);
          }
        });
      }, 3000);
    });
  }, 3000);

  // Handle cleanup
  process.on('SIGINT', () => {
    vite.kill();
    process.exit();
  });
}

main();

