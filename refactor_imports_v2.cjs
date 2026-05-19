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
        const name = file.replace(/\.tsx?$/, '');
        hookToDir.set(name, dir);
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

            // Sort by length descending
            const sortedHooks = Array.from(hookToDir.keys()).sort((a, b) => b.length - a.length);

            // 1. Fix relative imports within src/hooks
            if (fullPath.includes('src/hooks')) {
                const relativeRegex = /from\s+['"]\.\/([^'"]+)['"]/g;
                content = content.replace(relativeRegex, (match, p1) => {
                    const parts = p1.split('/');
                    const lastPart = parts[parts.length - 1];
                    if (hookToDir.has(lastPart)) {
                        const targetDir = hookToDir.get(lastPart);
                        changed = true;
                        return `from "@/hooks/${targetDir}/${lastPart}"`;
                    }
                    return match;
                });
                
                const relativeParentRegex = /from\s+['"]\.\.\/([^'"]+)['"]/g;
                content = content.replace(relativeParentRegex, (match, p1) => {
                    const parts = p1.split('/');
                    const lastPart = parts[parts.length - 1];
                    if (hookToDir.has(lastPart)) {
                        const targetDir = hookToDir.get(lastPart);
                        changed = true;
                        return `from "@/hooks/${targetDir}/${lastPart}"`;
                    }
                    return match;
                });
            }

            // 2. Fix @/hooks imports
            for (const hookName of sortedHooks) {
                const targetDir = hookToDir.get(hookName);
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
