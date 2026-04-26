const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pages', 'TasksPage.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Find the first instance of const TasksPage: React.FC = () => {
const firstIndex = code.indexOf('const TasksPage: React.FC = () => {');
// Find the second instance
const secondIndex = code.indexOf('const TasksPage: React.FC = () => {', firstIndex + 1);

if (secondIndex !== -1) {
    // Delete everything between firstIndex and secondIndex
    code = code.slice(0, firstIndex) + code.slice(secondIndex);
}

// Remove duplicate imports if any
code = code.replace(/import \{ debounce \} from 'lodash';\n/g, '');
code = code.replace("import { useMedia, useIntersection } from 'react-use';", "import { useMedia, useIntersection } from 'react-use';\nimport { debounce } from 'lodash';");

fs.writeFileSync(filePath, code);
console.log("TasksPage.tsx cleaned up.");
