import fs from 'fs';
import path from 'path';

const reportPath = path.resolve('playwright-report/results.json');
const quarantinePath = path.resolve('quarantine-list.json');

if (!fs.existsSync(reportPath)) {
  console.log('No Playwright report found.');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
const flakyTests = [];
const brokenTests = [];

function processSuite(suite) {
  if (suite.specs) {
    suite.specs.forEach(spec => {
      spec.tests.forEach(test => {
        const results = test.results || [];
        const hasPassed = results.some(r => r.status === 'expected' || r.status === 'passed');
        const hasFailed = results.some(r => r.status === 'failed' || r.status === 'timedOut');
        
        if (hasPassed && hasFailed) {
          flakyTests.push({
            title: spec.title,
            file: spec.file,
            retries: results.length - 1
          });
        } else if (!hasPassed && hasFailed) {
          brokenTests.push({
            title: spec.title,
            file: spec.file
          });
        }
      });
    });
  }
  if (suite.suites) {
    suite.suites.forEach(processSuite);
  }
}

processSuite(report);

let summary = '';

if (flakyTests.length > 0) {
  summary += '\n### ⚠️ Flaky Tests Detected (Playwright)\n';
  summary += '| Test | File | Retries |\n';
  summary += '| --- | --- | --- |\n';
  flakyTests.forEach(t => {
    summary += `| ${t.title} | ${t.file} | ${t.retries} |\n`;
  });
}

if (brokenTests.length > 0) {
  summary += '\n### ❌ Broken Tests (Failed all retries - Quarantined candidate)\n';
  summary += '| Test | File |\n';
  summary += '| --- | --- |\n';
  brokenTests.forEach(t => {
    summary += `| ${t.title} | ${t.file} |\n`;
  });
  
  // Automatically quarantine broken tests for the next run
  const existingQuarantine = fs.existsSync(quarantinePath) 
    ? JSON.parse(fs.readFileSync(quarantinePath, 'utf-8'))
    : [];
    
  const newQuarantine = [...existingQuarantine, ...brokenTests.map(t => ({ title: t.title }))];
  // Remove duplicates
  const uniqueQuarantine = Array.from(new Set(newQuarantine.map(t => t.title)))
    .map(title => ({ title }));
    
  fs.writeFileSync(quarantinePath, JSON.stringify(uniqueQuarantine, null, 2));
  summary += '\n> Note: These tests have been added to `quarantine-list.json` and will be skipped in future CI runs until fixed.\n';
}

if (summary) {
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
} else {
  console.log('No flaky or broken tests detected.');
}
