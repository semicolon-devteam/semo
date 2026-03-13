#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

// Read OpenClaw config to get Slack bot token
const configPath = '/Users/reus/.openclaw/openclaw.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const botToken = config.channels?.slack?.botToken;

if (!botToken) {
  console.error('Slack bot token not found in config');
  process.exit(1);
}

const channelId = process.argv[2] || 'C0AE4N0LSKV';
const limit = process.argv[3] || 50;

const url = `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`;

const options = {
  headers: {
    'Authorization': `Bearer ${botToken}`
  }
};

https.get(url, options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
