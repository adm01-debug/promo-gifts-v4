import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const LEGACY_SKELETON_FILES = [
  "src/components/layout/SkeletonLoaders.tsx",
];

const ALLOWED_IMPORT_SKELETON_UI = [
  "src/components/loading/ModernSkeletons.tsx",
  "src/components/layout/SkeletonLoaders.tsx", // Temporary until fully migrated
  "src/components/ui/skeleton.tsx" // The component itself
];

function getFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const name = join(dir, file);
    if (statSync(name).isDirectory()) {
      if (name.includes("node_modules") || name.includes(".git")) continue;
      getFiles(name, fileList);
    } else {
      if ([".tsx", ".ts", ".js", ".jsx"].includes(extname(name))) {
        fileList.push(name);
      }
    }
  }
  return fileList;
}

console.log("🔍 Checking for legacy skeleton usage...");

const allFiles = getFiles("src");
let errors = 0;

for (const file of allFiles) {
  const content = readFileSync(file, "utf8");
  
  // Check for direct imports of ui/skeleton outside of ModernSkeletons
  if (content.includes("@/components/ui/skeleton") && !ALLOWED_IMPORT_SKELETON_UI.includes(file)) {
    console.warn(`⚠️ [RECOMENDAÇÃO] O arquivo ${file} está importando diretamente o Skeleton base. Prefira usar componentes de ModernSkeletons para consistência.`);
  }

  // Check for usage of legacy SkeletonLoaders
  if (content.includes("@/components/layout/SkeletonLoaders") && file !== "src/components/layout/SkeletonLoaders.tsx") {
    // console.log(`ℹ️ ${file} usa SkeletonLoaders.tsx`);
  }
}

// Check if any Suspense boundaries might be nesting skeletons (double skeleton)
// This is harder to check statically, but we can look for suspicious patterns
for (const file of allFiles) {
  const content = readFileSync(file, "utf8");
  const suspenseCount = (content.match(/<Suspense/g) || []).length;
  if (suspenseCount > 1) {
    console.log(`📌 [INFO] ${file} tem múltiplos Suspense. Verifique se não há skeletons aninhados causando 'duplo skeleton'.`);
  }
}

console.log("\n✅ Verificação concluída.");
