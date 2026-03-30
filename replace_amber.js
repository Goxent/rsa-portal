const fs = require('fs');
const path = require('path');

const DIRECTORIESToScan = [
    path.join(__dirname, 'components'),
    path.join(__dirname, 'pages'),
    path.join(__dirname, 'context'),
    path.join(__dirname, 'hooks'),
];

// Files to skip entirely because they contain complex data colors
const skipFiles = [
    'StaffCapacityHeatmap.tsx',
    'FocusWidget.tsx', // contains warnings
    'PendingActionsWidget.tsx', // Keep amber for pending actions 
    'GreetingsWidget.tsx', // specific time-of-day ambers
    'WorkloadHeatmap.tsx'
];

function processDirectory(directory) {
    if (!fs.existsSync(directory)) return;

    fs.readdirSync(directory).forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            if (skipFiles.includes(path.basename(fullPath))) {
                console.log(`Skipping predefined file: ${fullPath}`);
                return;
            }

            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // Perform cautious replacements
            // We want to replace amber-100 through amber-950 with brand-100 through brand-950
            // but ONLY when it's part of text-, bg-, border-, ring-, shadow-, hover:, focus:
            
            const regex = /(text|bg|border|ring|shadow|fill|stroke|from|via|to)-amber-(\d{2,3})/g;
            content = content.replace(regex, '$1-brand-$2');

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Replaced amber with brand in: ${fullPath}`);
            }
        }
    });
}

DIRECTORIESToScan.forEach(dir => processDirectory(dir));
console.log('Done running bulk update script.');
