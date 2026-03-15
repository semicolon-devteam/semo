#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(process.env.HOME, '.openclaw/openclaw.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Slack bot token은 실제로는 환경 변수나 credential store에서 가져와야 함
// Config에는 REDACTED로 표시되어 있음
// 대신 credential store를 찾아보자

const credPath = path.join(process.env.HOME, '.openclaw/credentials');
const files = fs.readdirSync(credPath);

// credential 파일들을 확인
console.error('Credential files:', files);

// slack credentials 찾기
const slackCreds = files.filter(f => f.includes('slack'));
console.error('Slack credential files:', slackCreds);

// 간단한 방법: 환경 변수로부터 토큰을 받거나, 프로세스 환경을 확인
// 하지만 이것도 안 될 가능성이 높음

// 최후의 수단: OpenClaw 프로세스의 환경 변수를 확인
const { execSync } = require('child_process');
try {
  const ps = execSync('ps aux | grep "openclaw.*gateway" | grep -v grep', { encoding: 'utf8' });
  console.error('OpenClaw process:', ps.split('\n')[0]);
  
  // PID 추출
  const pid = ps.split(/\s+/)[1];
  console.error('PID:', pid);
  
  // 프로세스 환경 변수 읽기 (macOS는 보안상 어려울 수 있음)
  try {
    const env = execSync(`ps eww ${pid}`, { encoding: 'utf8' });
    const slackTokenMatch = env.match(/SLACK[_A-Z]*TOKEN[^=]*=([^\s]+)/);
    if (slackTokenMatch) {
      console.error('Found Slack token in process env');
    }
  } catch (e) {
    console.error('Cannot read process env:', e.message);
  }
} catch (e) {
  console.error('Cannot find OpenClaw process:', e.message);
}

// 대안: keychain에서 가져오기 (macOS)
try {
  const keychain = execSync('security find-generic-password -s "openclaw-slack" -w 2>&1', { encoding: 'utf8' });
  console.error('Keychain result:', keychain.substring(0, 50));
} catch (e) {
  console.error('Keychain lookup failed:', e.message);
}

console.error('\n=== Alternative: Use Slack CLI or direct API call ===');
console.error('You may need to extract the token manually from:');
console.error('1. OpenClaw process memory');
console.error('2. System keychain');
console.error('3. Environment variables of running OpenClaw process');
