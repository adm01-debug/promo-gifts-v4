const fs = require('fs');
const path = require('path');

const hooksRoot = path.join(process.cwd(), 'src/hooks');
const subdirs = fs.readdirSync(hooksRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== '__tests__')
    .map(dirent => dirent.name);

const hookToDir = new Map();

for (const dir of subdirs) {
    const dirPath = path.join(hooksRoot, dir);
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        if (file.startsWith('use') && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
            const hookName = file.replace(/\.tsx?$/, '');
            hookToDir.set(hookName, dir);
        }
    }
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            if (file.name !== 'node_modules' && file.name !== '.git') {
                processDirectory(fullPath);
            }
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;

            // Sort hook names by length descending to avoid partial matches (e.g., useAuth vs useAuthEvents)
            const sortedHooks = Array.from(hookToDir.keys()).sort((a, b) => b.length - a.length);

            for (const hookName of sortedHooks) {
                const targetDir = hookToDir.get(hookName);
                const oldImport = `@/hooks/${hookName}`;
                const newImport = `@/hooks/${targetDir}`;
                
                // Match both single and double quotes
                const regex = new RegExp(`(['"])@/hooks/${hookName}(['"])`, 'g');
                if (content.match(regex)) {
                    content = content.replace(regex, `$1@/hooks/${targetDir}$2`);
                    changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated imports in ${fullPath}`);
            }
        }
    }
}

processDirectory(path.join(process.cwd(), 'src'));
