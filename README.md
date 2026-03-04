# @eluno/core v2

Shared build system, SCSS styles, and web fonts for [eluno.org](https://eluno.org) book projects.

## What's inside

- **lib/build/** — Modular ESM build system (HTML from JSON, search index, sitemap)
- **scss/** — 7-1 architecture SCSS stylesheets
- **fonts/** — Cormorant Garamond + Spectral web fonts (WOFF2)
- **js/** — Client-side scripts (theme, search, glossary)
- **defaults/ui.json** — Default UI strings (EN/ES/PT)
- **bin/build.js** — CLI entry point

## Usage

Install as a git dependency:

```bash
npm install github:chuchurex/eluno-core#v2
```

### Configure your book

Create `eluno.config.js` in your project root:

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

### Compile SCSS

```bash
sass node_modules/@eluno/core/scss/main.scss:dist/css/main.css --style=compressed
```

## Content structure

```
your-project/
├── eluno.config.js
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
    ├── fonts/      # Override core fonts (optional)
    └── scss/       # Override core SCSS (optional)
```

## Feature flags

| Flag | Default | Description |
|------|---------|-------------|
| `glossary` | false | Generate glossary page and notes sidebar |
| `glossaryCategories` | false | Enable category view in glossary |
| `provenance` | false | Show source citations (Ra Material) |
| `search` | false | Generate search index and search UI |
| `mediaToolbar` | false | Show PDF/audio/YouTube buttons |
| `termMarkup` | false | Parse {term:keyword} markup |
| `refMarkup` | false | Parse {ref:category:id} markup |

## License

AGPL-3.0
