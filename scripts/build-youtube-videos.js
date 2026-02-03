#!/usr/bin/env node
/**
 * YouTube Video Generator for book-template Audiobook
 *
 * Generates videos with animated starfield background + MP3 audio
 * Uses FFmpeg with minimal CPU usage (pre-rendered loop)
 *
 * Usage:
 *   node scripts/build-youtube-videos.js           # Generate all 16 videos
 *   node scripts/build-youtube-videos.js --chapter=5  # Generate single chapter
 *   node scripts/build-youtube-videos.js --loop-only  # Only generate the star loop
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = process.cwd();
const AUDIO_DIR = path.join(PROJECT_ROOT, 'audiobook', 'audio', 'es');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'video', 'youtube');
const LOOP_FILE = path.join(OUTPUT_DIR, 'stars-loop-60s.mp4');

// Video settings
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const LOOP_DURATION = 60; // seconds

// Chapter metadata (Spanish)
const CHAPTERS = {
  '01': 'Cosmología y Génesis',
  '02': 'El Creador y la Creación',
  '03': 'Las Densidades de Consciencia',
  '04': 'La Historia Espiritual de la Tierra',
  '05': 'Polaridad: Los Dos Caminos',
  '06': 'Errantes: Los Que Regresan',
  '07': 'La Cosecha',
  '08': 'El Velo del Olvido',
  '09': 'La Muerte y el Viaje Entre Vidas',
  '10': 'Los Centros de Energía',
  '11': 'Catalizador y Experiencia',
  '12': 'El Yo Superior y la Guía Interior',
  '13': 'Libre Albedrío y la Ley de Confusión',
  '14': 'La Cosecha y la Transición',
  '15': 'Viviendo la Ley del Uno',
  '16': 'El Retorno'
};

// Ensure output directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Generate random star positions (for FFmpeg drawtext/geq filter)
function generateStarFilter() {
  // Create a simple moving starfield using FFmpeg's geq filter
  // This creates white dots on black background with slow upward movement
  return `
    geq=
      r='if(lt(random(1)*1000,2),255,0)':
      g='if(lt(random(1)*1000,2),255,0)':
      b='if(lt(random(1)*1000,2),255,0)'
  `.replace(/\s+/g, '');
}

// Generate the 60-second star loop video using Puppeteer to capture a single frame
// then animate it with FFmpeg (much faster than capturing all frames)
async function generateStarLoop() {
  console.log('🌟 Generating 60-second star loop...');

  ensureDir(OUTPUT_DIR);

  const htmlFile = path.join(OUTPUT_DIR, 'stars.html');
  const starfieldPng = path.join(OUTPUT_DIR, 'starfield.png');

  // Generate CSS stars (similar to astro.cl)
  function generateStarsShadow(count, maxX, maxY) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * maxX);
      const y = Math.floor(Math.random() * maxY);
      stars.push(`${x}px ${y}px #FFF`);
    }
    return stars.join(', ');
  }

  // Generate a tall image (3x height for scrolling effect)
  const imgHeight = HEIGHT * 3;
  const stars1 = generateStarsShadow(1500, WIDTH, imgHeight);
  const stars2 = generateStarsShadow(500, WIDTH, imgHeight);
  const stars3 = generateStarsShadow(200, WIDTH, imgHeight);

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; }
    html, body {
      background: linear-gradient(to bottom, #090A0F 0%, #1B2838 50%, #090A0F 100%);
      width: ${WIDTH}px;
      height: ${imgHeight}px;
      overflow: hidden;
      position: relative;
    }
    .stars, .stars2, .stars3 {
      position: absolute;
      top: 0;
      left: 0;
    }
    .stars {
      width: 1px;
      height: 1px;
      box-shadow: ${stars1};
    }
    .stars2 {
      width: 2px;
      height: 2px;
      box-shadow: ${stars2};
    }
    .stars3 {
      width: 3px;
      height: 3px;
      box-shadow: ${stars3};
    }
  </style>
</head>
<body>
  <div class="stars"></div>
  <div class="stars2"></div>
  <div class="stars3"></div>
</body>
</html>`;

  fs.writeFileSync(htmlFile, htmlContent);
  console.log('   ✓ Created stars.html');

  // Use Puppeteer to capture a single tall image
  console.log('   Capturing starfield with Puppeteer...');

  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: WIDTH, height: imgHeight });
  await page.goto(`file://${htmlFile}`);
  await page.screenshot({ path: starfieldPng, type: 'png' });
  await browser.close();

  console.log('   ✓ Captured starfield image');

  // Animate the image with FFmpeg - scroll from bottom to top
  console.log('   Animating starfield (60 seconds)...');

  // Calculate scroll speed: we want to scroll (imgHeight - HEIGHT) pixels over LOOP_DURATION seconds
  const scrollDistance = imgHeight - HEIGHT;
  const pixelsPerSecond = scrollDistance / LOOP_DURATION;

  execSync(`ffmpeg -y -loop 1 -i "${starfieldPng}" \
    -vf "crop=${WIDTH}:${HEIGHT}:0:'(ih-${HEIGHT})-mod(t*${pixelsPerSecond},ih-${HEIGHT})',format=yuv420p" \
    -t ${LOOP_DURATION} \
    -c:v libx264 -preset fast -crf 20 \
    -r ${FPS} \
    "${LOOP_FILE}"`, { stdio: 'inherit' });

  // Cleanup
  fs.unlinkSync(htmlFile);
  fs.unlinkSync(starfieldPng);

  console.log(`✅ Star loop created: ${LOOP_FILE}`);

  const stats = fs.statSync(LOOP_FILE);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
}

// Generate video for a single chapter
function generateChapterVideo(chapterNum) {
  const paddedNum = chapterNum.toString().padStart(2, '0');
  const title = CHAPTERS[paddedNum];

  if (!title) {
    console.error(`❌ Unknown chapter: ${chapterNum}`);
    return false;
  }

  // Find the audio file
  const audioFiles = fs.readdirSync(AUDIO_DIR).filter(f => f.startsWith(paddedNum));
  if (audioFiles.length === 0) {
    console.error(`❌ Audio file not found for chapter ${paddedNum}`);
    return false;
  }

  const audioFile = path.join(AUDIO_DIR, audioFiles[0]);
  const outputFile = path.join(OUTPUT_DIR, `${paddedNum}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp4`);

  console.log(`\n🎬 Chapter ${paddedNum}: ${title}`);
  console.log(`   Audio: ${audioFiles[0]}`);

  // Get audio duration
  const durationOutput = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFile}"`).toString().trim();
  const duration = parseFloat(durationOutput);
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  console.log(`   Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);

  // Generate video: loop the star background and add chapter title overlay
  // Escape special characters for FFmpeg drawtext filter
  function escapeFFmpegText(text) {
    return text
      .replace(/\\/g, '\\\\\\\\')
      .replace(/'/g, "'\\\\\\''")
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');
  }

  const titleText = escapeFFmpegText(`Capítulo ${parseInt(chapterNum)} - ${title}`);
  const subtitleText = escapeFFmpegText('La Ley del Uno - Audiolibro');

  // FFmpeg command: loop video, add audio, add title overlay
  // Using simpler filter without special characters
  const cmd = `ffmpeg -y \
    -stream_loop -1 -i "${LOOP_FILE}" \
    -i "${audioFile}" \
    -filter_complex "[0:v]drawtext=text='${titleText}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h/2-30,drawtext=text='${subtitleText}':fontsize=28:fontcolor=0xAAAAAA:x=(w-text_w)/2:y=h/2+40[v]" \
    -map "[v]" -map 1:a \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -b:a 192k \
    -shortest \
    "${outputFile}"`;

  try {
    execSync(cmd, { stdio: 'inherit' });

    const stats = fs.statSync(outputFile);
    console.log(`   ✅ Output: ${path.basename(outputFile)} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    return true;
  } catch (e) {
    console.error(`   ❌ Error generating video`);
    return false;
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📹 YouTube Video Generator - La Ley del Uno Audiolibro');
  console.log('═══════════════════════════════════════════════════════════\n');

  ensureDir(OUTPUT_DIR);

  // Check if loop exists
  const loopExists = fs.existsSync(LOOP_FILE);

  // Parse arguments
  const loopOnly = args.includes('--loop-only');
  const chapterArg = args.find(a => a.startsWith('--chapter='));
  const singleChapter = chapterArg ? parseInt(chapterArg.split('=')[1]) : null;

  // Generate loop if needed
  if (!loopExists || loopOnly) {
    await generateStarLoop();
    if (loopOnly) {
      console.log('\n✨ Loop generation complete!');
      return;
    }
  } else {
    console.log(`✓ Using existing star loop: ${LOOP_FILE}`);
  }

  // Generate videos
  if (singleChapter) {
    generateChapterVideo(singleChapter);
  } else {
    console.log('\n📚 Generating all 16 chapter videos...\n');

    let success = 0;
    let failed = 0;

    for (let i = 1; i <= 16; i++) {
      if (generateChapterVideo(i)) {
        success++;
      } else {
        failed++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  ✅ Complete: ${success} videos generated`);
    if (failed > 0) {
      console.log(`  ❌ Failed: ${failed} videos`);
    }
    console.log(`  📁 Output: ${OUTPUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════════\n');
  }
}

main().catch(console.error);
