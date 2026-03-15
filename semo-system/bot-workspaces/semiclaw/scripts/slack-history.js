#!/usr/bin/env node
const fs = require('fs');
const https = require('https');

// Read Slack token from openclaw config
const configPath = '/Users/reus/.openclaw/openclaw.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const botToken = config.channels.slack.botToken;

const channelId = process.argv[2] || 'C0AE4N0LSKV';
const limit = process.argv[3] || 50;

// Calculate timestamp for 30 minutes ago
const thirtyMinutesAgo = Math.floor(Date.now() / 1000) - (30 * 60);

const options = {
  hostname: 'slack.com',
  path: `/api/conversations.history?channel=${channelId}&limit=${limit}&oldest=${thirtyMinutesAgo}`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${botToken}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.error('Failed to parse response:', e);
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e);
});

req.end();
