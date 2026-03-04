#!/usr/bin/env node
/**
 * CLI wrapper for @eluno/core audiobook generation
 *
 * Usage:
 *   eluno-audio extract [--lang es]
 *   eluno-audio generate [--lang es] [--only 1]
 *   eluno-audio assemble [--lang es]
 *   eluno-audio concat [--lang es]
 *   eluno-audio tag [--lang es]
 *   eluno-audio all [--lang es]
 */

import { audio } from '../lib/audio/index.js';

const args = process.argv.slice(2);
const command = args[0];

audio({ command, args: args.slice(1) }).catch(err => {
  console.error('Audio failed:', err);
  process.exit(1);
});
