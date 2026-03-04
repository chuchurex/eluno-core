/**
 * Audio orchestrator for @eluno/core
 *
 * Provides: extract, generate, assemble, concat, tag, all
 */

import { resolveConfig } from '../config.js';
import { extract } from './extract.js';
import { generate } from './generate.js';
import { assemble } from './assemble.js';
import { concat } from './concat.js';
import { tag } from './tags.js';

function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--lang': options.lang = args[++i]; break;
      case '--only': options.only = parseInt(args[++i]); break;
      case '--voice': options.voice = args[++i]; break;
      case '--rate': options.rate = args[++i]; break;
      case '--pitch': options.pitch = args[++i]; break;
      case '--force': options.force = true; break;
      case '--dry-run': options.dryRun = true; break;
      case '--no-copy': options.noCopy = true; break;
    }
  }

  return options;
}

const COMMANDS = {
  extract: { fn: extract, desc: 'Extract chapter text for TTS' },
  generate: { fn: generate, desc: 'Generate MP3 with Edge TTS' },
  assemble: { fn: assemble, desc: 'Assemble chapters with intro/outro' },
  concat: { fn: concat, desc: 'Concatenate into complete audiobook' },
  tag: { fn: tag, desc: 'Update ID3 tags on MP3 files' },
};

function showHelp() {
  console.log(`
eluno-audio — Audiobook generation for @eluno/core

Usage:
  eluno-audio <command> [options]

Commands:
  extract    Extract chapter text for TTS
  generate   Generate MP3 with Edge TTS (free, no API key)
  assemble   Assemble chapters with intro/outro/silence
  concat     Concatenate into complete audiobook
  tag        Update ID3 tags on MP3 files
  all        Run full pipeline: extract → generate → assemble → concat → tag

Options:
  --lang <code>    Language (default: all configured languages)
  --only <N>       Single chapter number
  --voice <name>   Override TTS voice
  --rate <value>   Speech rate (e.g. -10%, default: -5%)
  --pitch <value>  Pitch adjustment (default: +0Hz)
  --force          Regenerate existing files
  --dry-run        Preview without generating
  --no-copy        Don't copy to dist/
  -h, --help       Show help
`);
}

export async function audio({ command, args = [] }) {
  if (!command || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  const config = await resolveConfig(process.cwd());
  const options = parseArgs(args);

  const bookName = config.audiobook.bookNames?.[config.baseLang] || 'Book';

  console.log('\n' + '='.repeat(50));
  console.log(` ${bookName} — Audio (@eluno/core)`);
  console.log('='.repeat(50));

  if (command === 'all') {
    await extract(config, options);
    await generate(config, options);
    await assemble(config, options);
    await concat(config, options);
    await tag(config, options);
    console.log('Full audio pipeline complete.\n');
    return;
  }

  const cmd = COMMANDS[command];
  if (!cmd) {
    console.error(`Unknown command: ${command}. Use --help for usage.`);
    process.exit(1);
  }

  await cmd.fn(config, options);
}
