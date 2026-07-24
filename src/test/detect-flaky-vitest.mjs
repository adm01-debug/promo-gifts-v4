import fs from 'fs';
import path from 'path';

const reportPath = path.resolve('vitest-report.json');

if (!fs.existsSync(reportPath)) {
  console.log('No Vitest report found.');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
const brokenTests = [];

report.testResults.forEach(suite => {
  suite.assertionResults.forEach(test => {
    if (test.status === 'failed') {
      brokenTests.push({
        title: test.title,
        fullName: test.fullName,
        file: suite.name
      });
    }
  });
});

let summary = '';

if (brokenTests.length > 0) {
  summary += '\n### ❌ Vitest Broken Tests (Failed all retries)\n';
  summary += '| Test | File |\n';
  summary += '| --- | --- |\n';
  brokenTests.forEach(t => {
    summary += `| ${t.fullName} | ${t.file} |\n`;
  });
  
  // For Vitest, we could output a file that Vitest can use to skip tests
  // but Vitest doesn't have a built-in grepInvert as easily configurable via file as Playwright
  // unless we use a custom test sequencer or similar.
  // For now, we just report them.
}

if (summary) {
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}
