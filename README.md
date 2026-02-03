# @eluno/core

Shared build tools, SCSS styles, and web fonts for [eluno.org](https://eluno.org) book projects.

## What's inside

- **scripts/** — Build pipeline (HTML from JSON, PDF generation, deploy via SSH, TTS audiobook tools)
- **scss/** — 7-1 architecture SCSS stylesheets
- **fonts/** — Cormorant Garamond + Spectral web fonts
- **_headers.template** — Cloudflare Pages security headers

## Usage

Install as a git dependency:

```bash
npm install github:chuchurex/eluno-core
```

### Build a book

```bash
# From your book project root (must have i18n/ with content)
npx eluno-build          # Generate HTML
npx eluno-pdf 01         # Generate PDF for chapter 1
npx eluno-deploy         # Deploy to server
```

### Compile SCSS

```bash
sass node_modules/@eluno/core/scss/main.scss:dist/css/main.css --style=compressed
```

## Environment variables

Each project needs a `.env` with:

```env
DOMAIN=your-domain.org
LANGUAGES=en,es
BASE_LANG=en
UPLOAD_HOST=your-server
UPLOAD_USER=your-user
UPLOAD_KEY_PATH=~/.ssh/id_rsa
UPLOAD_PORT=22
```

## License

AGPL-3.0
