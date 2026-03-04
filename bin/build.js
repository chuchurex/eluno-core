#!/usr/bin/env node
/**
 * CLI wrapper for @eluno/core build
 *
 * Usage:
 *   eluno-build              # Build all languages
 *   eluno-build --lang es    # Build only Spanish
 */

import { build } from '../lib/build/index.js';

const args = process.argv.slice(2);
const langArg = args.find(a => a.startsWith('--lang='))?.split('=')[1]
  || (args.indexOf('--lang') !== -1 ? args[args.indexOf('--lang') + 1] : undefined);

build({ lang: langArg }).catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
