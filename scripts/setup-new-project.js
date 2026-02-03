#!/usr/bin/env node
/**
 * Setup New Project - Interactive Configuration
 *
 * Creates a new book site based on book-template with correct configuration
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function yesNo(answer) {
  return answer.toLowerCase() === 's' || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'si' || answer.toLowerCase() === 'yes';
}

async function main() {
  console.log('\n📚 Configuración de Nuevo Proyecto - Book Template\n');
  console.log('Este asistente te ayudará a configurar tu nuevo sitio de libro.\n');

  const config = {};

  // 1. INFORMACIÓN BÁSICA
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣  INFORMACIÓN BÁSICA DEL SITIO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  config.domain = await question('Dominio/subdominio (ej: miproyecto.eluno.org): ');
  config.titleES = await question('Título del sitio en español: ');
  config.titleEN = await question('Título del sitio en inglés: ');

  const wantsSubtitle = await question('¿Quieres agregar un subtítulo? (s/n): ');
  if (yesNo(wantsSubtitle)) {
    config.subtitleES = await question('  Subtítulo en español: ');
    config.subtitleEN = await question('  Subtítulo en inglés: ');
  } else {
    config.subtitleES = '';
    config.subtitleEN = '';
  }

  // 2. FUNCIONALIDADES
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2️⃣  FUNCIONALIDADES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const wantsNotes = await question('¿Quieres sistema de notas/glosario? (s/n): ');
  config.hasNotes = yesNo(wantsNotes);

  // Feedback y About siempre deshabilitados por defecto hasta configurar
  config.hasFeedback = false;
  config.hasAbout = false;

  // PDFs siempre habilitados
  config.hasPDFs = true;

  console.log('\n💡 Nota: Formulario de feedback y página "Acerca de" estarán deshabilitados');
  console.log('   hasta que los configures manualmente en ui.json');

  // 3. CONTENIDO INICIAL
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3️⃣  CONTENIDO INICIAL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const wantsIntro = await question('¿Quieres sección de introducción en portada? (s/n): ');
  config.hasIntro = yesNo(wantsIntro);

  const wantsDisclaimer = await question('¿Quieres sección de disclaimer/información? (s/n): ');
  config.hasDisclaimer = yesNo(wantsDisclaimer);

  const wantsFooter = await question('¿Quieres mostrar créditos en el footer? (s/n): ');
  if (yesNo(wantsFooter)) {
    config.footerCredits = await question('  Texto del footer (ej: © 2026 Mi Proyecto): ');
  } else {
    config.footerCredits = '';
  }

  // RESUMEN
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 RESUMEN DE CONFIGURACIÓN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Dominio: ${config.domain}`);
  console.log(`Título ES: ${config.titleES}`);
  console.log(`Título EN: ${config.titleEN}`);
  console.log(`Subtítulo: ${config.subtitleES || config.subtitleEN || '(vacío)'}`);
  console.log(`\nIdioma base: Inglés (EN)`);
  console.log(`Detección automática: Sí`);
  console.log(`\nNotas/Glosario: ${config.hasNotes ? 'Sí' : 'No'}`);
  console.log(`Sidebar colapsado: ${config.hasNotes ? 'No (tiene notas)' : 'Sí (sin notas)'}`);
  console.log(`PDFs: Sí`);
  console.log(`\nIntroducción: ${config.hasIntro ? 'Sí' : 'No'}`);
  console.log(`Disclaimer: ${config.hasDisclaimer ? 'Sí' : 'No'}`);
  console.log(`Footer: ${config.footerCredits || '(vacío)'}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const confirm = await question('¿Confirmas esta configuración? (s/n): ');

  if (!yesNo(confirm)) {
    console.log('\n❌ Configuración cancelada.\n');
    rl.close();
    return;
  }

  // GENERAR CONFIGURACIÓN
  console.log('\n⚙️  Generando archivos de configuración...\n');

  generateConfig(config);

  console.log('\n✅ ¡Configuración completada!\n');
  console.log('📝 Próximos pasos:\n');
  console.log('1. Edita i18n/en/chapters/ para agregar tus capítulos');
  console.log('2. Ejecuta: npm install');
  console.log('3. Ejecuta: npm run dev (para desarrollo local)');
  console.log('4. Ejecuta: node scripts/build.js (para generar el sitio)\n');
  console.log('📚 Para deploy, consulta: docs/DEPLOYMENT_GUIDE.md\n');

  rl.close();
}

function generateConfig(config) {
  // Generar ui.json para inglés
  const uiEN = {
    siteTitle: config.titleEN,
    bookTitle: config.titleEN,
    subtitle: config.subtitleEN || '',
    description: config.subtitleEN || config.titleEN,
    language: 'en',
    languageName: 'English',
    nav: {
      home: 'Home',
      about: 'About',
      chapters: 'Chapters',
      index: 'Index',
      notes: 'Notes',
      notesPanel: 'Notes & References',
      notesEmpty: "Click on <span class=\"term-hint\">highlighted terms</span> to see notes here.",
      backToIndex: 'Back to Index',
      chapter: 'Chapter',
      previousChapter: 'Previous',
      nextChapter: 'Next',
      tableOfContents: 'Table of Contents',
      learnMore: 'Learn more'
    },
    home: {
      readButton: 'Start Reading',
      chapterPrefix: 'Chapter'
    },
    introduction: {
      title: '',
      content: []
    },
    disclaimer: config.hasDisclaimer ? {
      title: 'About This Material',
      text1: 'Add your disclaimer text here.',
      text2: '',
      text3: '',
      text3b: ''
    } : {},
    chapter: {
      previous: 'Previous',
      next: 'Next',
      downloadPDF: 'Download PDF'
    },
    about: {
      title: 'About this Book',
      content: 'Add your about content here.'
    },
    footer: {
      credits: config.footerCredits || '',
      madeWith: 'Made with',
      basedOn: ''
    },
    meta: {
      version: ''
    }
  };

  // Guardar ui.json
  const uiPath = path.join(process.cwd(), 'i18n', 'en', 'ui.json');
  fs.writeFileSync(uiPath, JSON.stringify(uiEN, null, 2), 'utf8');
  console.log('✓ Generado: i18n/en/ui.json');

  // Generar .env si no existe
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    const envContent = `# ${config.titleEN} - Environment Configuration
# ============================================================================

# DOMAIN CONFIGURATION
DOMAIN=${config.domain}
PROJECT_NAME=${config.domain.split('.')[0]}

# HOSTINGER - SSH/RSYNC Deploy + API
UPLOAD_HOST=YOUR_SERVER_IP
UPLOAD_PORT=YOUR_SSH_PORT
UPLOAD_USER=YOUR_SSH_USER
UPLOAD_PASS=YOUR_SSH_PASSWORD
HOSTINGER_API_TOKEN=YOUR_HOSTINGER_API_TOKEN

# CLOUDFLARE - DNS y Cache
CF_API_KEY=YOUR_CF_API_KEY
CF_EMAIL=your-email@example.com
CF_ZONE_ID=YOUR_CF_ZONE_ID
`;
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✓ Generado: .env');
  }

  // Generar configuración de build según tenga o no notas
  const buildConfigPath = path.join(process.cwd(), 'build.config.json');
  const buildConfig = {
    hasNotes: config.hasNotes,
    hasFeedback: config.hasFeedback,
    hasAbout: config.hasAbout,
    hasPDFs: config.hasPDFs,
    sidebarCollapsed: !config.hasNotes,
    autoLanguageDetection: true,
    baseLanguage: 'en'
  };
  fs.writeFileSync(buildConfigPath, JSON.stringify(buildConfig, null, 2), 'utf8');
  console.log('✓ Generado: build.config.json');

  // Instrucciones sobre español
  console.log('\n💡 Para agregar versión en español:');
  console.log('   1. Copia i18n/en/ a i18n/es/');
  console.log('   2. Traduce ui.json y chapters/');
  console.log('   3. Actualiza scripts/build.js LANGUAGES a ["en", "es"]');
}

// Ejecutar
main().catch(err => {
  console.error('\n❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
