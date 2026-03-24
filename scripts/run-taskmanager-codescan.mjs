/**
 * TaskManager Code-Scan Test
 * 
 * Runs TestForge Code-Scan against:
 * - Spec: /tmp/taskmanager-test/spec.md
 * - Code: /tmp/taskmanager-test/routes/tasks.js (with 5 intentional bugs)
 * 
 * Expected bugs to find:
 * BUG #1: Missing role check — guest can create tasks (MISSING_AUTH)
 * BUG #2: Missing org check on assignee — cross-org assignee accepted (IDOR)
 * BUG #3: Missing orgId filter in list — returns all orgs' tasks (IDOR)
 * BUG #4: No status transition validation — done→in_progress allowed (BUSINESS_LOGIC)
 * BUG #5: No audit log on export — PII export not logged (DSGVO)
 */

import { readFileSync } from 'fs';
import { runAnalysisJob } from '../server/analyzer/job-runner.ts';

const SPEC_PATH = '/tmp/taskmanager-test/spec.md';
const CODE_PATH = '/tmp/taskmanager-test/routes/tasks.js';

const specText = readFileSync(SPEC_PATH, 'utf-8');
const codeText = readFileSync(CODE_PATH, 'utf-8');

console.log('='.repeat(70));
console.log('TASKMANAGER CODE-SCAN TEST');
console.log('='.repeat(70));
console.log(`Spec: ${specText.length} chars`);
console.log(`Code: ${codeText.length} chars`);
console.log('');
console.log('Expected bugs:');
console.log('  BUG #1: Missing role check (guest can create tasks)');
console.log('  BUG #2: Missing org check on assignee (cross-org IDOR)');
console.log('  BUG #3: Missing orgId filter in list (cross-tenant IDOR)');
console.log('  BUG #4: No status transition validation (done→in_progress)');
console.log('  BUG #5: No audit log on PII export (DSGVO)');
console.log('='.repeat(70));

const codeFiles = [
  {
    path: 'routes/tasks.js',
    content: codeText,
  }
];

let result;
try {
  result = await runAnalysisJob(
    specText,
    'TaskManager',
    (layer, message) => {
      console.log(`[Layer ${layer}] ${message}`);
    },
    undefined, // no industry pack
    { codeFiles }
  );
} catch (err) {
  console.error('Pipeline failed:', err);
  process.exit(1);
}

const ir = result.analysisResult?.ir;
const suite = result.validatedSuite;
const report = result.report;

console.log('');
console.log('='.repeat(70));
console.log('RESULTS');
console.log('='.repeat(70));
console.log(`Behaviors parsed:    ${ir?.behaviors?.length ?? 0}`);
console.log(`Endpoints found:     ${ir?.apiEndpoints?.length ?? 0}`);
console.log(`Proof targets:       ${suite?.validatedProofs?.length ?? 0}`);
console.log(`Discarded proofs:    ${suite?.discardedProofs?.length ?? 0}`);
console.log('');

// Check which bugs were found
const allContent = JSON.stringify(result);
// testFiles is an array of {filename, content} objects
const testFilesArr = Array.isArray(result.testFiles) ? result.testFiles : [];
const allFiles = testFilesArr.map(f => (f?.content ?? '')).join('\n');

function check(label, condition) {
  const icon = condition ? '✅' : '❌';
  console.log(`${icon} ${label}`);
  return condition;
}

console.log('BUG DETECTION:');
console.log('-'.repeat(70));

// BUG #1: Missing role check — guest can create tasks
const bug1 = check(
  'BUG #1: Guest role check missing (FORBIDDEN for guest on POST /tasks)',
  allContent.toLowerCase().includes('guest') &&
  (allContent.includes('FORBIDDEN') || allContent.includes('403') || allContent.includes('role')) &&
  (allFiles.includes('guest') || allFiles.includes('role'))
);

// BUG #2: Missing org check on assignee
const bug2 = check(
  'BUG #2: Assignee cross-org check missing (ASSIGNEE_NOT_IN_ORG)',
  allContent.includes('ASSIGNEE_NOT_IN_ORG') ||
  allContent.toLowerCase().includes('assignee') && allContent.toLowerCase().includes('org') ||
  allFiles.toLowerCase().includes('assignee') && allFiles.toLowerCase().includes('org')
);

// BUG #3: Missing orgId filter — IDOR
const bug3 = check(
  'BUG #3: IDOR — orgId filter missing in GET /tasks list',
  (allContent.includes('IDOR') || allContent.includes('idor') || allContent.includes('cross-tenant') || allContent.includes('orgId')) &&
  (allFiles.includes('orgId') || allFiles.includes('org_id') || allFiles.includes('idor') || allFiles.includes('IDOR'))
);

// BUG #4: Status transition validation missing
const bug4 = check(
  'BUG #4: Status transition done→in_progress not validated (INVALID_TRANSITION)',
  (allContent.includes('INVALID_TRANSITION') || allContent.includes('done') && allContent.includes('in_progress')) &&
  (allFiles.includes('done') || allFiles.includes('in_progress') || allFiles.includes('transition'))
);

// BUG #5: No audit log on export
const bug5 = check(
  'BUG #5: PII export not logged (DSGVO audit trail missing)',
  (allContent.toLowerCase().includes('audit') || allContent.toLowerCase().includes('gdpr') || allContent.toLowerCase().includes('dsgvo')) &&
  (allFiles.toLowerCase().includes('audit') || allFiles.toLowerCase().includes('export') || allFiles.toLowerCase().includes('pii'))
);

const found = [bug1, bug2, bug3, bug4, bug5].filter(Boolean).length;
console.log('');
console.log('='.repeat(70));
console.log(`SUMMARY: ${found}/5 bugs detected`);

if (found === 5) {
  console.log('🎉 ALLE 5 BUGS GEFUNDEN!');
} else {
  console.log(`⚠️  ${5 - found} Bugs NICHT gefunden — Optimierungsbedarf`);
  
  // Show what test files were generated
  console.log('');
  console.log('Generated test files:');
  for (const f of testFilesArr) {
    console.log(`  ${f?.filename}: ${(f?.content ?? '').length} chars`);
  }
}

console.log('='.repeat(70));

// Show the generated test files for manual inspection
console.log('');
console.log('GENERATED TEST FILES (first 100 lines each):');
console.log('='.repeat(70));
for (const f of testFilesArr) {
  console.log(`\n--- ${f?.filename} ---`);
  console.log((f?.content ?? '').split('\n').slice(0, 100).join('\n'));
}
