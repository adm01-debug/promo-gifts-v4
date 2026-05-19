const fs = require('fs');
const path = require('path');

const domainMapping = {
    'products': 'products',
    'quotes': 'quotes',
    'intelligence': 'intelligence',
    'auth': 'auth',
    'bi': 'bi',
    'crm': 'crm',
    'kit': 'kit-builder',
    'mockup': 'mockup',
    'favorites': 'favorites',
    'comparison': 'comparison',
};

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

            // Match @/hooks/domainSomething where domain is in domainMapping
            for (const [domainPrefix, targetDir] of Object.entries(domainMapping)) {
                const regex = new RegExp(`(['"])@/hooks/${domainPrefix}([A-Z][a-zA-Z]*)(['"])`, 'g');
                if (content.match(regex)) {
                    content = content.replace(regex, `$1@/hooks/${targetDir}$3`);
                    changed = true;
                }
            }
            
            // Manual fixes for specific ones that don't follow the pattern
            const manualFixes = {
                '@/hooks/uiLockFix': '@/hooks/ui',
                '@/hooks/commonHistory': '@/hooks/common',
            };
            
            for (const [oldPath, newPath] of Object.entries(manualFixes)) {
                const regex = new RegExp(`(['"])${oldPath}(['"])`, 'g');
                if (content.match(regex)) {
                    content = content.replace(regex, `$1${newPath}$2`);
                    changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated legacy imports in ${fullPath}`);
            }
        }
    }
}

processDirectory(path.join(process.cwd(), 'src'));

