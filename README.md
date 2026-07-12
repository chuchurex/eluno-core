# @eluno/core v2

Shared build system, SCSS styles, and audiobook tooling for [eluno.org](https://eluno.org) book projects.

## What's inside

- **lib/build/** - Modular ESM build system (HTML from JSON, search index, sitemap, media URL resolution)
- **lib/audio/** - Audiobook pipeline (edge-TTS narration, mp3 concat, ID3 tags)
- **scss/** - 7-1 architecture SCSS stylesheets (Editorial Minimal: terracotta accent, warm cream, light default)
- **js/** - Client-side scripts (theme, search, glossary, chapter interactions)
- **defaults/ui.json** - Default UI strings (EN/ES/PT)
- **bin/build.js** - `eluno-build` CLI entry point
- **bin/audio.js** - `eluno-audio` CLI entry point

Fonts are loaded from Google Fonts CDN (Fraunces, Source Serif 4, JetBrains Mono), so there is no bundled `fonts/` directory.

## Usage

Install as a git dependency (the consumers `eluno` and `eluno-books` pin the `v2` branch):

```bash
npm install github:chuchurex/eluno-core#v2
```

### Configure your book

Create `eluno.config.mjs` (preferred, so a CJS consumer can stay CJS) or `eluno.config.js` in your project root:

```js
export default {
  siteUrl: 'https://your-book.org',
  languages: ['en', 'es'],
  baseLang: 'en',
  baseLangPrefix: true,
  bookTitles: { en: 'My Book', es: 'Mi Libro' },
  chapterUrlPattern: 'slug', // or 'numeric'
  features: {
    glossary: true,
    search: true,
    mediaToolbar: true,
    termMarkup: true,
  }
}
```

### Build

```bash
npx eluno-build              # Build all languages
npx eluno-build --lang es    # Build only Spanish
```

The build renders chapters, index, about and glossary pages per language, generates the root index (with language detection), `sitemap.xml`, `robots.txt`, copies `static/` and (if `features.search`) a per-language search index. It then compiles SCSS: if your project has `src/scss/main.scss` it uses that, otherwise it falls back to the core `scss/main.scss`. `sass` is a peer dependency.

### Compile SCSS manually

```bash
sass node_modules/@eluno/core/scss/main.scss:dist/css/main.css --style=compressed
```

### Audiobook

`eluno-audio` turns chapter JSON into narrated mp3s (requires the optional peer deps `node-edge-tts` and `node-id3`):

```bash
npx eluno-audio extract  [--lang es]            # chapters -> plain text
npx eluno-audio generate [--lang es] [--only 1] # TTS per chapter
npx eluno-audio concat   [--lang es]            # merge mp3s
npx eluno-audio assemble [--lang es]            # orchestrate the pipeline
npx eluno-audio tag      [--lang es]            # write ID3 tags
npx eluno-audio all      [--lang es]            # run everything
```

## Content structure

```
your-project/
├── eluno.config.mjs
├── i18n/
│   ├── en/
│   │   ├── chapters/01.json, 02.json, ...
│   │   ├── glossary.json
│   │   ├── about.json
│   │   ├── media.json
│   │   └── ui.json (optional overrides)
│   ├── es/
│   │   └── ...
│   ├── glossary-meta.json
│   └── provenance/
│       └── ch01_provenance.json, ...
├── static/         # Copied to dist/ as-is
└── src/
    ├── js/         # Override core JS (optional)
    └── scss/       # Override core SCSS (optional)
```

## Feature flags

All flags default to `false`.

| Flag | Description |
|------|-------------|
| `glossary` | Generate glossary page and notes sidebar |
| `glossaryCategories` | Enable category view in glossary |
| `provenance` | Show source citations (from `i18n/provenance/`) |
| `search` | Generate search index and search UI |
| `mediaToolbar` | Show PDF/audio/YouTube buttons |
| `termMarkup` | Parse `{term:keyword}` markup |
| `refMarkup` | Parse `{ref:category:id}` markup |

## Environment variables

`lib/config.js` reads only three values from the consumer's `.env` (via `dotenv`): `SITE_URL` (fallback for `siteUrl`), `GA_ID` and `GITHUB_REPO`. Everything else comes from `eluno.config.{mjs,js}`.

## License

AGPL-3.0
