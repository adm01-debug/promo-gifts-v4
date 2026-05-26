import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const ALLOWED_IMPORT_SKELETON_UI = [
  "src/components/loading/ModernSkeletons.tsx",
  "src/components/layout/SkeletonLoaders.tsx",
  "src/components/ui/skeleton.tsx",
  "src/components/cart/CartItemSkeleton.tsx",
  "src/components/products/ProductDetailSkeleton.tsx",
  "src/components/bi/BISkeletons.tsx"
];

const IGNORED_DIRS = ["node_modules", ".git", "dist", ".next", ".agents"];

function getFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  for (const file of files) {
    const name = join(dir, file);
    if (statSync(name).isDirectory()) {
      if (IGNORED_DIRS.some(d => name.includes(d))) continue;
      getFiles(name, fileList);
    } else {
      if ([".tsx", ".ts", ".js", ".jsx"].includes(extname(name))) {
        fileList.push(name);
      }
    }
  }
  return fileList;
}

console.log("🔍 Running Skeleton Audit...");

const allFiles = getFiles("src");
let errors = 0;
let warnings = 0;

for (const file of allFiles) {
  const content = readFileSync(file, "utf8");
  
  // Rule 1: Avoid direct imports of @/components/ui/skeleton in pages/features
  if (content.includes("@/components/ui/skeleton") && !ALLOWED_IMPORT_SKELETON_UI.includes(file)) {
    // We treat this as a warning because sometimes fine-grained skeletons are needed
    // but we want to encourage using ModernSkeletons.
    // console.warn(`⚠️ [WARNING] ${file} imports Skeleton directly.`);
    warnings++;
  }

  // Rule 2: Check for potential double skeleton (multiple Suspense)
  const suspenseCount = (content.match(/<Suspense/g) || []).length;
  if (suspenseCount > 1) {
    console.info(`ℹ️ [INFO] ${file} has multiple Suspense blocks (${suspenseCount}).`);
  }

  // Rule 3: Check for Skeleton without ID (multiline check)
  // Find all <Skeleton occurrences and check if 'id=' exists until the next '>'
  const skeletonTags = content.match(/<Skeleton[^>]*>/g) || [];
  for (const tag of skeletonTags) {
    if (!tag.includes("id=") && !tag.includes("...props") && !tag.includes("data-testid=")) {
      console.error(`❌ [ERROR] Found Skeleton without ID in ${file}: ${tag.replace(/\s+/g, ' ')}`);
      errors++;
    }
  }
}

console.log(`\n✅ Audit complete: ${errors} errors, ${warnings} warnings.`);
if (errors > 0) {
  console.log("Please add 'id' props to all <Skeleton /> usages for better traceability.");
  // process.exit(1); // Don't fail the build yet, just warn
}
