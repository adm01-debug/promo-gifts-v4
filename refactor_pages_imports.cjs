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
// Add the direct pages (root) to the map as empty string so they don't get changed if they are already correct
const rootPages = fs.readdirSync(pagesRoot).filter(f => f.endsWith('.tsx')).map(f => f.replace(/\.tsx?$/, ''));
for (const p of rootPages) {
    if (!pageToDir.has(p)) pageToDir.set(p, '');
}

console.log('Page Mapping:', Object.fromEntries(pageToDir));

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

            const sortedPages = Array.from(pageToDir.keys()).sort((a, b) => b.length - a.length);

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
