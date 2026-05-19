const fs = require('fs');
const path = require('path');

const pagesRoot = path.join(process.cwd(), 'src/pages');

function getPageMap(dir, baseDir = '') {
    const map = new Map();
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            const subMap = getPageMap(path.join(dir, file.name), path.join(baseDir, file.name));
            for (const [k, v] of subMap) map.set(k, v);
        } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts')) {
            const pageName = file.name.replace(/\.tsx?$/, '');
            if (baseDir) {
                map.set(pageName, baseDir.replace(/\\/g, '/'));
            }
        }
    }
    return map;
}

const pageToDir = getPageMap(pagesRoot);
const sortedPages = Array.from(pageToDir.keys()).sort((a, b) => b.length - a.length);

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

            // 1. Convert relative imports to @/pages imports if they point to a known page
            // This is tricky but we can try to match import { ... } from './Page'
            const relativeRegex = /from\s+['"]\.\/([^'"]+)['"]/g;
            content = content.replace(relativeRegex, (match, p1) => {
                const parts = p1.split('/');
                const lastPart = parts[parts.length - 1];
                if (pageToDir.has(lastPart)) {
                    const subDir = pageToDir.get(lastPart);
                    changed = true;
                    return `from "@/pages/${subDir}/${lastPart}"`;
                }
                return match;
            });

            // 2. Fix @/pages imports that are missing the subfolder
            for (const pageName of sortedPages) {
                const subDir = pageToDir.get(pageName);
                if (!subDir) continue;

                const regex = new RegExp(`(['"])@/pages/${pageName}(['"])`, 'g');
                if (content.match(regex)) {
                    content = content.replace(regex, `$1@/pages/${subDir}/${pageName}$2`);
                    changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated page imports in ${fullPath}`);
            }
        }
    }
}

processDirectory(path.join(process.cwd(), 'src'));
