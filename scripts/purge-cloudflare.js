/**
 * Purge Cloudflare Cache
 * Clears the cache for specific URLs or entire zone
 */

require('dotenv').config();
const https = require('https');

const CF_API_KEY = process.env.CF_API_KEY;
const CF_EMAIL = process.env.CF_EMAIL;
const CF_ZONE_ID = process.env.CF_ZONE_ID;
const DOMAIN = process.env.DOMAIN || 'todo.eluno.org';

function purgeCache(urls = null) {
  if (!CF_API_KEY || !CF_EMAIL || !CF_ZONE_ID) {
    console.error('❌ Missing Cloudflare credentials in .env file');
    console.log('\nPlease add the following to your .env file:');
    console.log('CF_API_KEY=your_api_key');
    console.log('CF_EMAIL=your_email');
    console.log('CF_ZONE_ID=your_zone_id');
    console.log('\nYou can find these in your Cloudflare dashboard:');
    console.log('1. API Key: https://dash.cloudflare.com/profile/api-tokens');
    console.log('2. Zone ID: In your domain\'s overview page');
    process.exit(1);
  }

  const payload = urls ? { files: urls } : { purge_everything: true };
  const data = JSON.stringify(payload);

  const options = {
    hostname: 'api.cloudflare.com',
    port: 443,
    path: `/client/v4/zones/${CF_ZONE_ID}/purge_cache`,
    method: 'POST',
    headers: {
      'X-Auth-Email': CF_EMAIL,
      'X-Auth-Key': CF_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('🔄 Purging Cloudflare cache...');
  if (urls) {
    console.log(`📄 URLs: ${urls.join(', ')}`);
  } else {
    console.log('🌐 Purging entire zone');
  }

  const req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(responseData);

        if (response.success) {
          console.log('✅ Cache purged successfully!');
          console.log(`⏱️  Cache should be cleared in a few seconds`);
        } else {
          console.error('❌ Purge failed:', response.errors);
          process.exit(1);
        }
      } catch (e) {
        console.error('❌ Error parsing response:', e.message);
        console.error('Response:', responseData);
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
    process.exit(1);
  });

  req.write(data);
  req.end();
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // Purge specific files by default
  const urls = [
    `https://${DOMAIN}/`,
    `https://${DOMAIN}/revision.html`,
    `https://${DOMAIN}/index.html`,
    `https://${DOMAIN}/es/`,
    `https://${DOMAIN}/es/index.html`
  ];
  purgeCache(urls);
} else if (args[0] === '--all') {
  // Purge everything
  purgeCache();
} else {
  // Purge specific URLs
  const urls = args.map(arg => {
    if (arg.startsWith('http')) return arg;
    return `https://${DOMAIN}${arg.startsWith('/') ? '' : '/'}${arg}`;
  });
  purgeCache(urls);
}
