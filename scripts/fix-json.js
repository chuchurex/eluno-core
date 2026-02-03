const fs = require('fs');
const path = require('path');

const dir = 'i18n/en/chapters';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let modified = false;

  const newLines = lines.map(line => {
    // Target lines like: "text": "..."
    // We capture the prefix ("text": "), the content, and the suffix (", or ")
    // We look for the last quote in the line to define the end of content.
    const lastQuoteIndex = line.lastIndexOf('"');
    const firstQuoteIndex = line.indexOf('"text": "');

    if (firstQuoteIndex !== -1 && lastQuoteIndex > firstQuoteIndex + 9) {
      // 9 is length of "text": "
      const prefixEnd = firstQuoteIndex + 9;
      const prefix = line.substring(0, prefixEnd);
      const suffix = line.substring(lastQuoteIndex);
      const inner = line.substring(prefixEnd, lastQuoteIndex);

      // Escape unescaped quotes in 'inner'
      // We look for " that is NOT preceded by \
      if (/(?<!\\)"/.test(inner)) {
        const fixedInner = inner.replace(/(?<!\\)"/g, '\\"');
        modified = true;
        return prefix + fixedInner + suffix;
      }
    }
    return line;
  });

  if (modified) {
    console.log(`Fixing ${file}...`);
    fs.writeFileSync(filePath, newLines.join('\n'));
  }
});
