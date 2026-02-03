#!/usr/bin/env node

/**
 * Fish Audio TTS API Script
 *
 * Generates audio from text using fish.audio API with pause tags support.
 *
 * Usage:
 *   node scripts/fish-audio-tts.js <input.txt> <output.mp3>
 *   node scripts/fish-audio-tts.js --test  # Quick test
 *
 * Environment (via .env file):
 *   FISH_API_KEY - Your fish.audio API key (required)
 *   FISH_VOICE_ID - Voice/model reference ID (optional)
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');
const { encode } = require('@msgpack/msgpack');

const API_URL = 'https://api.fish.audio/v1/tts';
const DEFAULT_VOICE = process.env.FISH_VOICE_ID || '60f3d0bf60cd4f5e88d1116e22eb19a7';

async function textToSpeech(text, outputPath, options = {}) {
  const apiKey = process.env.FISH_API_KEY;

  if (!apiKey) {
    console.error('Error: FISH_API_KEY environment variable is required');
    console.error('Usage: FISH_API_KEY=your_key node scripts/fish-audio-tts.js <input.txt> <output.mp3>');
    process.exit(1);
  }

  const voiceId = process.env.FISH_VOICE_ID || options.voiceId || DEFAULT_VOICE;

  const requestData = {
    text: text,
    reference_id: voiceId,
    format: 'mp3',
    mp3_bitrate: 128,
    chunk_length: 200,
    latency: 'normal',
    normalize: false  // Required for (break) and (long-break) tags to work
  };

  const body = Buffer.from(encode(requestData));

  return new Promise((resolve, reject) => {
    const url = new URL(API_URL);

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/msgpack',
        'model': 's1',
        'Content-Length': body.length
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        let errorData = '';
        res.on('data', chunk => errorData += chunk);
        res.on('end', () => {
          reject(new Error(`API Error ${res.statusCode}: ${errorData}`));
        });
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const audioBuffer = Buffer.concat(chunks);
        fs.writeFileSync(outputPath, audioBuffer);
        console.log(`✅ Audio saved: ${outputPath} (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
        resolve(outputPath);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runTest() {
  console.log('🧪 Testing fish.audio API with pause tags...\n');

  const testText = `Esto es una prueba de pausas.

(long-break)

Primera sección con pausa larga antes.

(long-break)

Esta es una oración. (break) Esta es otra oración con pausa corta.

(long-break)

Y aquí terminamos con otra pausa larga.`;

  console.log('Text to synthesize:');
  console.log('---');
  console.log(testText);
  console.log('---\n');

  const outputPath = path.join(process.cwd(), 'dist', 'audiobook', 'test-pausas.mp3');

  try {
    await textToSpeech(testText, outputPath);
    console.log('\n🎧 Listen to the file and check if pauses are present.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--test') {
    return runTest();
  }

  if (args.length < 2) {
    console.log('Fish Audio TTS Script');
    console.log('');
    console.log('Usage:');
    console.log('  FISH_API_KEY=your_key node scripts/fish-audio-tts.js <input.txt> <output.mp3>');
    console.log('  FISH_API_KEY=your_key node scripts/fish-audio-tts.js --test');
    console.log('');
    console.log('Environment:');
    console.log('  FISH_API_KEY   - Your fish.audio API key (required)');
    console.log('  FISH_VOICE_ID  - Voice reference ID (optional)');
    process.exit(0);
  }

  const inputPath = args[0];
  const outputPath = args[1];

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(inputPath, 'utf8');
  console.log(`📄 Input: ${inputPath} (${text.length} chars)`);

  try {
    await textToSpeech(text, outputPath);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
