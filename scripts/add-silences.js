#!/usr/bin/env node

/**
 * Add silences to audio at detected pause points
 *
 * Detects natural pauses in audio and extends them with real silence.
 *
 * Usage:
 *   node scripts/add-silences.js input.mp3 output.mp3
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SILENCE_SHORT = 0.8;  // segundos para pausas cortas (entre oraciones)
const SILENCE_LONG = 1.5;   // segundos para pausas largas (entre párrafos/secciones)
const PAUSE_THRESHOLD = 0.5; // pausas naturales > 0.5s se consideran "largas"
const FADE_DURATION = 0.15; // duración del fade out/in para transiciones suaves

function detectSilences(inputFile) {
  const output = execSync(
    `ffmpeg -i "${inputFile}" -af silencedetect=noise=-30dB:d=0.25 -f null - 2>&1`,
    { encoding: 'utf8' }
  );

  const silences = [];
  const regex = /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g;
  let match;

  while ((match = regex.exec(output)) !== null) {
    silences.push({
      start: parseFloat(match[1]),
      end: parseFloat(match[2]),
      duration: parseFloat(match[3])
    });
  }

  return silences;
}

function getDuration(inputFile) {
  const output = execSync(
    `ffmpeg -i "${inputFile}" 2>&1 | grep Duration`,
    { encoding: 'utf8' }
  );
  const match = output.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (match) {
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
  }
  return 0;
}

function processAudio(inputFile, outputFile) {
  console.log(`📄 Input: ${inputFile}`);

  const silences = detectSilences(inputFile);
  const totalDuration = getDuration(inputFile);

  console.log(`🔍 Detected ${silences.length} pauses`);

  // Filtrar pausas significativas (> 0.3s)
  const significantPauses = silences.filter(s => s.duration > 0.3);

  if (significantPauses.length === 0) {
    console.log('No significant pauses found, copying file as-is');
    fs.copyFileSync(inputFile, outputFile);
    return;
  }

  // Crear directorio temporal
  const tmpDir = path.join(path.dirname(outputFile), '.tmp-audio');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Generar archivos de silencio
  const silenceShort = path.join(tmpDir, 'silence-short.mp3');
  const silenceLong = path.join(tmpDir, 'silence-long.mp3');

  execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${SILENCE_SHORT} -q:a 9 "${silenceShort}" 2>/dev/null`);
  execSync(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${SILENCE_LONG} -q:a 9 "${silenceLong}" 2>/dev/null`);

  // Cortar audio en segmentos
  const segments = [];
  let lastEnd = 0;

  significantPauses.forEach((pause, idx) => {
    // Segmento de audio antes de la pausa
    const segmentFile = path.join(tmpDir, `segment-${idx}.mp3`);
    const duration = pause.start - lastEnd;

    if (duration > 0.1) {
      // Aplicar fade in al inicio (excepto primer segmento) y fade out al final
      const fadeIn = idx > 0 ? `afade=t=in:st=0:d=${FADE_DURATION},` : '';
      const fadeOut = `afade=t=out:st=${Math.max(0, duration - FADE_DURATION)}:d=${FADE_DURATION}`;
      execSync(`ffmpeg -y -i "${inputFile}" -ss ${lastEnd} -t ${duration} -af "${fadeIn}${fadeOut}" -q:a 2 "${segmentFile}" 2>/dev/null`);
      segments.push(segmentFile);
    }

    // Agregar silencio (largo si la pausa natural es > threshold, corto si no)
    if (pause.duration > PAUSE_THRESHOLD) {
      segments.push(silenceLong);
    } else {
      segments.push(silenceShort);
    }

    lastEnd = pause.end;
  });

  // Último segmento (con fade in al inicio)
  if (lastEnd < totalDuration - 0.1) {
    const lastSegment = path.join(tmpDir, 'segment-last.mp3');
    execSync(`ffmpeg -y -i "${inputFile}" -ss ${lastEnd} -af "afade=t=in:st=0:d=${FADE_DURATION}" -q:a 2 "${lastSegment}" 2>/dev/null`);
    segments.push(lastSegment);
  }

  // Crear archivo de concatenación (usar rutas relativas al directorio del concat.txt)
  const concatFile = path.join(tmpDir, 'concat.txt');
  const concatContent = segments.map(s => `file '${path.basename(s)}'`).join('\n');
  fs.writeFileSync(concatFile, concatContent);

  // Concatenar todo
  try {
    execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -q:a 2 "${outputFile}"`, { stdio: 'pipe' });
  } catch (e) {
    console.error('FFmpeg concat error:', e.stderr?.toString() || e.message);
    throw e;
  }

  // Limpiar
  fs.rmSync(tmpDir, { recursive: true });

  const newDuration = getDuration(outputFile);
  console.log(`✅ Output: ${outputFile}`);
  console.log(`⏱️  Duration: ${totalDuration.toFixed(1)}s → ${newDuration.toFixed(1)}s`);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/add-silences.js input.mp3 output.mp3');
  process.exit(1);
}

processAudio(args[0], args[1]);
