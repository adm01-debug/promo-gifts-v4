const fs = require('fs');
const path = require('path');

const replacements = {
    '@/hooks/productsAnalytics': '@/hooks/products',
    '@/hooks/productsIntelligenceBadges': '@/hooks/products',
    '@/hooks/uiLockFix': '@/hooks/ui',
    '@/hooks/useExpertConversations': '@/hooks/intelligence',
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

            for (const [oldPath, newPath] of Object.entries(replacements)) {
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
