/**
 * Convert v3.1 format (single file with all chapters) to individual chapter files
 */

const fs = require('fs');
const path = require('path');

function convertToChapterFormat(inputFile, outputDir, lang) {
  console.log(`Converting ${inputFile} to ${outputDir}...`);

  // Load the v3.1 file
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Convert each chapter
  data.chapters.forEach(chapter => {
    const chapterNumber = String(chapter.number).padStart(2, '0');
    const outputFile = path.join(outputDir, `${chapterNumber}.json`);

    // Convert content array to sections format
    const sections = [{
      id: `ch${chapter.number}-main`,
      title: chapter.title,
      content: chapter.content
    }];

    const chapterData = {
      id: chapter.id,
      number: chapter.number,
      numberText: chapter.numberText,
      title: chapter.title,
      sections: sections
    };

    fs.writeFileSync(outputFile, JSON.stringify(chapterData, null, 2), 'utf8');
    console.log(`  ✓ Created ${outputFile}`);
  });

  console.log(`✓ Converted ${data.chapters.length} chapters for ${lang}`);
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node convert-v3.1-to-chapters.js <input-file> <output-dir> <lang>');
  console.log('Example: node convert-v3.1-to-chapters.js temp_files/teachings_v3.1_es.json i18n/es/chapters es');
  process.exit(1);
}

const [inputFile, outputDir, lang] = args;
convertToChapterFormat(inputFile, outputDir, lang);
