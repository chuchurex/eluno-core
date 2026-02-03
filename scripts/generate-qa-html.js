const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'qa-dashboard.html');

const PROJECTS = [
    { 
        id: 'eluno', 
        name: 'EL UNO - Reinterpretación Narrativa', 
        domain: 'https://eluno.org', 
        static: 'https://static.eluno.org/eluno',
        langs: [
            { code: 'es', label: 'Español', prefix: '/es' },
            { code: 'en', label: 'English', prefix: '/en' },
            { code: 'pt', label: 'Português', prefix: '/pt' }
        ],
        chapters: 16
    },
    { 
        id: 'todo', 
        name: 'TODO - La Ley del Uno', 
        domain: 'https://todo.eluno.org', 
        static: 'https://static.eluno.org/todo',
        langs: [
            { code: 'en', label: 'English', prefix: '' },
            { code: 'es', label: 'Español', prefix: '/es' },
            { code: 'pt', label: 'Português', prefix: '/pt' }
        ],
        chapters: 11
    },
    { 
        id: 'sanacion', 
        name: 'SANACIÓN - Libro Sanación', 
        domain: 'https://sanacion.eluno.org',
        static: 'https://static.eluno.org/sanacion',
        langs: [
            { code: 'en', label: 'English', prefix: '' },
            { code: 'es', label: 'Español', prefix: '/es' }
        ],
        chapters: 11
    },
    { 
        id: 'jesus', 
        name: 'JESÚS - El Camino del Amor', 
        domain: 'https://jesus.eluno.org',
        static: 'https://static.eluno.org/jesus',
        langs: [
            { code: 'es', label: 'Español', prefix: '' }, // Root is ES
            { code: 'en', label: 'English', prefix: '/en' },
            { code: 'pt', label: 'Português', prefix: '/pt' }
        ],
        chapters: 11
    }
];

function getMediaConfig(project, langCode) {
    const jsonPath = path.join(ROOT_DIR, 'packages', project, 'i18n', langCode, 'media.json');
    if (!fs.existsSync(jsonPath)) return null;
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function generateHTML() {
    let html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QA Dashboard - Eluno.org</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f0f2f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; color: #1a202c; }
        h2 { margin-top: 30px; color: #2d3748; background: #edf2f7; padding: 10px; border-radius: 4px; border-left: 5px solid #4a5568; }
        h3 { color: #2b6cb0; margin-top: 25px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
        th, td { padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; }
        th { background: #f7fafc; font-weight: 600; color: #4a5568; }
        tr:hover { background: #f8fafc; }
        a { color: #3182ce; text-decoration: none; }
        a:hover { text-decoration: underline; color: #2c5282; }
        .status-ok { color: green; font-weight: bold; }
        .status-missing { color: #cbd5e0; font-style: italic; }
        .resource-link { display: inline-flex; align-items: center; padding: 4px 8px; background: #ebf8ff; border-radius: 4px; font-size: 13px; margin-right: 5px; border: 1px solid #bee3f8; transition: all 0.2s; }
        .resource-link:hover { background: #bee3f8; text-decoration: none; }
        .resource-link.pdf { background: #fff5f5; border-color: #fed7d7; color: #c53030; }
        .resource-link.pdf:hover { background: #fed7d7; }
        .full-resources { background: #f0fff4; padding: 15px; border-radius: 6px; border: 1px solid #c6f6d5; margin: 15px 0; display: flex; gap: 15px; align-items: center; }
        .full-resources strong { margin-right: 10px; color: #22543d; }
        .toc { margin-bottom: 30px; padding: 15px; background: #ebf4ff; border-radius: 6px; }
        .toc a { margin-right: 15px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 QA Human Dashboard</h1>
        
        <p>Use este dashboard para verificar manualmente enlaces y recursos en todo el ecosistema Eluno.org.</p>
        
        <div class="toc">
            ${PROJECTS.map(p => `<a href="#${p.id}">${p.name}</a>`).join('')}
        </div>

        ${PROJECTS.map(project => {
            return `
            <div id="${project.id}">
                <h2>${project.name}</h2>
                <p><strong>URL Principal:</strong> <a href="${project.domain}" target="_blank">${project.domain}</a></p>
                
                ${project.langs.map(lang => {
                    const media = getMediaConfig(project.id, lang.code);
                    if (!media) return `<p>⚠️ Configuración no encontrada para ${lang.label}</p>`;

                    // Full Book Resources
                    // FIX: Use project.static base URL instead of hardcoded root
                    const fullAudio = media.all?.audio ? `${project.static}${media.all.audio}` : null;
                    const fullPdf = media.all?.pdf ? `${project.static}${media.all.pdf}` : null;

                    return `
                    <h3>🏳️ ${lang.label} (${lang.code})</h3>
                    <p>
                        <strong>Landing:</strong> <a href="${project.domain}${lang.prefix}/" target="_blank">${project.domain}${lang.prefix}/</a>
                    </p>

                    ${(fullAudio || fullPdf) ? `
                    <div class="full-resources">
                        <strong>⬇️ Descargas Completas:</strong>
                        ${fullAudio ? `<a href="${fullAudio}" target="_blank" class="resource-link">🔊 Audiolibro Completo (MP3)</a>` : '<span class="status-missing">Sin Audio Completo</span>'}
                        ${fullPdf ? `<a href="${fullPdf}" target="_blank" class="resource-link pdf">📄 Libro Completo (PDF)</a>` : '<span class="status-missing">Sin PDF Completo</span>'}
                    </div>` : ''}

                    <table>
                        <thead>
                            <tr>
                                <th width="8%">Cap</th>
                                <th width="32%">Página Web</th>
                                <th width="30%">Audio (MP3)</th>
                                <th width="30%">PDF</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from({length: project.chapters}, (_, i) => i + 1).map(ch => {
                                const chKey = ch.toString();
                                const chData = media[chKey] || {};
                                const chUrl = `${project.domain}${lang.prefix}/ch${ch}/`;
                                
                                // FIX: Use project.static base URL instead of hardcoded root
                                const mp3Link = chData.audio ? `${project.static}${chData.audio}` : null;
                                const pdfLink = chData.pdf ? `${project.static}${chData.pdf}` : null;

                                return `
                                <tr>
                                    <td><strong>${ch}</strong></td>
                                    <td><a href="${chUrl}" target="_blank">Abrir Página</a></td>
                                    <td>
                                        ${mp3Link 
                                            ? `<a href="${mp3Link}" target="_blank" class="resource-link">🔊 Descargar MP3</a>` 
                                            : `<span class="status-missing">-</span>`}
                                    </td>
                                    <td>
                                        ${pdfLink 
                                            ? `<a href="${pdfLink}" target="_blank" class="resource-link pdf">📄 Descargar PDF</a>` 
                                            : `<span class="status-missing">-</span>`}
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    `;
                }).join('')}
            </div>
            `;
        }).join('')}

        <div style="margin-top: 50px; text-align: center; color: #718096; font-size: 12px;">
            Generado automáticamente • ${new Date().toISOString()}
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(OUTPUT_FILE, html);
    console.log(`✅ HTML Dashboard generated at: ${OUTPUT_FILE}`);
}

generateHTML();
