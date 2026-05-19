const fs = require('fs');
const path = require('path');

const hooksRoot = path.join(process.cwd(), 'src/hooks');
const subdirs = fs.readdirSync(hooksRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== '__tests__')
    .map(dirent => dirent.name);

const fileToDir = new Map();

for (const dir of subdirs) {
    const dirPath = path.join(hooksRoot, dir);
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const name = file.replace(/\.tsx?$/, '');
            if (name === 'index') continue;
            fileToDir.set(name, dir);
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

            const sortedFiles = Array.from(fileToDir.keys()).sort((a, b) => b.length - a.length);

            for (const fileName of sortedFiles) {
                const targetDir = fileToDir.get(fileName);
                
                // Match @/hooks/filename
                const regex = new RegExp(`(['"])@/hooks/${fileName}(['"])`, 'g');
                if (content.match(regex)) {
                    content = content.replace(regex, `$1@/hooks/${targetDir}/${fileName}$2`);
                    changed = true;
                }

                // Also match relative imports within src/hooks if they point to these files
                if (fullPath.includes('src/hooks')) {
                    const relRegex = new RegExp(`from\\s+['"]\\./${fileName}['"]`, 'g');
                    if (content.match(relRegex)) {
                        content = content.replace(relRegex, `from "@/hooks/${targetDir}/${fileName}"`);
                        changed = true;
                    }
                    const relParentRegex = new RegExp(`from\\s+['"]\\.\\./${fileName}['"]`, 'g');
                    if (content.match(relParentRegex)) {
                        content = content.replace(relParentRegex, `from "@/hooks/${targetDir}/${fileName}"`);
                        changed = true;
                    }
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
