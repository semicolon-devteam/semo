const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');

const html = fs.readFileSync('debate-card-leejm-economy.html', 'utf8');

nodeHtmlToImage({
  output: './debate-card-leejm-economy.png',
  html: html,
  transparent: false,
  puppeteerArgs: {
    args: ['--no-sandbox']
  }
}).then(() => {
  console.log('Image created successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
