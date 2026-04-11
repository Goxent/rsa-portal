const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('index.css')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('.');

let changedFiles = 0;

files.forEach(f => {
  let original = fs.readFileSync(f, 'utf8');
  let content = original;
  
  if (f.endsWith('index.css')) {
    content = content.replace(/rgba\(46,\s*138,\s*97/g, 'rgba(101,154,43');
    content = content.replace(/rgba\(26,\s*110,\s*77/g, 'rgba(82,122,34');
    content = content.replace(/#2e8a61/gi, '#659a2b');
    content = content.replace(/#1a6e4d/gi, '#527a22');
    content = content.replace(/#155c3f/gi, '#3f5e1a');
    content = content.replace(/#1e6448/gi, '#3f6018');
  } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
    content = content.replace(/['"]#2e8a61['"]/gi, '"var(--accent)"');
    content = content.replace(/['"]#1a6e4d['"]/gi, '"var(--accent)"');
    content = content.replace(/['"]#155c3f['"]/gi, '"var(--accent-secondary)"');
    
    // Also replace raw occurences if they were used directly inside template literals without quotes
    content = content.replace(/#2e8a61/gi, 'var(--accent)');
    // But wait, the standard string replace:
    // Some inline styles might look like: `color: '#2e8a61'`
    // If I replace `#2e8a61` to `var(--accent)`, it becomes `color: 'var(--accent)'` which is correct CSS.
    // If it was `color="#2e8a61"` it becomes `color="var(--accent)"`.
    // So just straight replacing `#2e8a61` to `var(--accent)` is perfect.
    
    content = content.replace(/#1a6e4d/gi, 'var(--accent)');
    content = content.replace(/#155c3f/gi, 'var(--accent-secondary)');
    
    content = content.replace(/rgba\(46,\s*138,\s*97/g, 'rgba(101,154,43');
    content = content.replace(/rgba\(26,\s*110,\s*77/g, 'rgba(82,122,34');
    
    content = content.replace(/from-emerald-/g, 'from-brand-');
    content = content.replace(/bg-emerald-/g, 'bg-brand-');
    content = content.replace(/text-emerald-/g, 'text-brand-');
    content = content.replace(/border-emerald-/g, 'border-brand-');
  }

  if (content !== original) {
    fs.writeFileSync(f, content, 'utf8');
    changedFiles++;
    console.log(`Updated: ${f}`);
  }
});

console.log(`Changed ${changedFiles} files.`);
