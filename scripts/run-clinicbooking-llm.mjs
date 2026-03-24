#!/usr/bin/env node
// run-clinicbooking-llm.mjs
// ClinicBooking End-to-End LLM-Pipeline Test
// Spec: /tmp/clinicbooking-test/spec.md
// Code: /tmp/clinicbooking-test/routes/appointments.js
// 7 intentional bugs — LLM must parse the complex spec

import { readFileSync } from 'fs';
import { runAnalysisJob } from '../server/analyzer/job-runner.js';

const specText = readFileSync('/tmp/clinicbooking-test/spec.md', 'utf-8');
const codeText = readFileSync('/tmp/clinicbooking-test/routes/appointments.js', 'utf-8');

console.log('='.repeat(70));
console.log('CLINICBOOKING — LLM PIPELINE TEST');
console.log('='.repeat(70));
console.log(`Spec: ${specText.length} chars`);
console.log(`Code: ${codeText.length} chars`);
console.log('');
console.log('BUGS EINGEBAUT:');
console.log('  BUG #1: Validation-Return fehlt (INVALID_SCHEDULE_TIME nie geworfen)');
console.log('  BUG #2: Fehlende Clinic-Isolation für doctorId/patientId (DOCTOR_NOT_IN_CLINIC)');
console.log('  BUG #3: Role-based Filtering fehlt (Patient sieht alle Termine)');
console.log('  BUG #4: Keine Status-Transitions-Validierung (COMPLETED→REQUESTED erlaubt)');
console.log('  BUG #5: Kein Audit-Log bei Patient-Records (DSGVO Art. 9)');
console.log('  BUG #6: Fehlende Appointment-Status-Prüfung bei Prescription');
console.log('  BUG #7: Kein Duplicate-Invoice-Check (DUPLICATE_INVOICE)');
console.log('='.repeat(70));
console.log('');

const codeFiles = [
  {
    path: 'routes/appointments.js',
    content: codeText,
    language: 'javascript',
  }
];

let result;
try {
  result = await runAnalysisJob(
    specText,
    'ClinicBooking',
    undefined,
    undefined,
    { codeFiles }
  );
} catch (err) {
  console.error('Pipeline failed:', err);
  process.exit(1);
}

const ir = result.analysisResult?.ir;
const suite = result.validatedSuite;

console.log('');
console.log('='.repeat(70));
console.log('RAW PIPELINE RESULTS');
console.log('='.repeat(70));
console.log(`Behaviors parsed:    ${ir?.behaviors?.length ?? 0}`);
console.log(`Endpoints found:     ${ir?.apiEndpoints?.length ?? 0}`);
console.log(`StatusMachine:       ${ir?.statusMachine?.states?.join(' → ') ?? 'none'}`);
console.log(`StatusMachines:      ${ir?.statusMachines?.length ?? 0} machines`);
console.log(`TenantKey:           ${ir?.authModel?.tenantKey ?? 'null'}`);
console.log(`Roles:               ${ir?.authModel?.roles?.map(r => r.name).join(', ') ?? 'none'}`);
console.log(`IDOR vectors:        ${suite?.validatedProofs?.filter(p => p.type === 'idor').length ?? 0}`);
console.log(`Proof targets:       ${suite?.validatedProofs?.length ?? 0}`);
console.log(`Discarded proofs:    ${suite?.discardedProofs?.length ?? 0}`);
console.log('');

// testFiles is array of {filename, content}
const testFilesArr = Array.isArray(result.testFiles) ? result.testFiles : [];
console.log(`Test files:          ${testFilesArr.length}`);
for (const f of testFilesArr) {
  console.log(`  ${f?.filename}: ${(f?.content ?? '').length} chars`);
}

const allContent = JSON.stringify(result);
const allFiles = testFilesArr.map(f => (f?.content ?? '')).join('\n');

function check(label, condition) {
  const icon = condition ? '✅' : '❌';
  console.log(`${icon} ${label}`);
  return condition;
}

console.log('');
console.log('='.repeat(70));
console.log('BUG DETECTION');
console.log('='.repeat(70));

const bug1 = check(
  'BUG #1: INVALID_SCHEDULE_TIME — Validation-Return fehlt',
  allContent.includes('INVALID_SCHEDULE_TIME') ||
  allFiles.toLowerCase().includes('schedule') && allFiles.toLowerCase().includes('time') ||
  allFiles.toLowerCase().includes('1 hour') || allFiles.toLowerCase().includes('future')
);

const bug2 = check(
  'BUG #2: DOCTOR_NOT_IN_CLINIC — Cross-Clinic Isolation fehlt',
  allContent.includes('DOCTOR_NOT_IN_CLINIC') ||
  allContent.includes('PATIENT_NOT_IN_CLINIC') ||
  (allFiles.toLowerCase().includes('clinic') && allFiles.toLowerCase().includes('doctor'))
);

const bug3 = check(
  'BUG #3: Role-based Filtering fehlt (Patient sieht alle Termine)',
  allContent.toLowerCase().includes('patient') &&
  allFiles.toLowerCase().includes('role') &&
  (allFiles.toLowerCase().includes('filter') || allFiles.toLowerCase().includes('patientid') || allFiles.toLowerCase().includes('own'))
);

const bug4 = check(
  'BUG #4: INVALID_TRANSITION — COMPLETED→REQUESTED erlaubt',
  allContent.includes('INVALID_TRANSITION') ||
  (allFiles.toLowerCase().includes('completed') && allFiles.toLowerCase().includes('requested')) ||
  allFiles.toLowerCase().includes('transition')
);

const bug5 = check(
  'BUG #5: Kein Audit-Log bei Patient-Records (DSGVO Art. 9)',
  allContent.toLowerCase().includes('audit') &&
  (allFiles.toLowerCase().includes('records') || allFiles.toLowerCase().includes('patient')) &&
  allFiles.toLowerCase().includes('log')
);

const bug6 = check(
  'BUG #6: APPOINTMENT_NOT_COMPLETED — Prescription ohne Status-Check',
  allContent.includes('APPOINTMENT_NOT_COMPLETED') ||
  (allFiles.toLowerCase().includes('prescription') && allFiles.toLowerCase().includes('completed'))
);

const bug7 = check(
  'BUG #7: DUPLICATE_INVOICE — Kein Idempotency-Check',
  allContent.includes('DUPLICATE_INVOICE') ||
  (allFiles.toLowerCase().includes('invoice') && allFiles.toLowerCase().includes('duplicate')) ||
  (allFiles.toLowerCase().includes('invoice') && allFiles.toLowerCase().includes('idempotent'))
);

const found = [bug1, bug2, bug3, bug4, bug5, bug6, bug7].filter(Boolean).length;
console.log('');
console.log('='.repeat(70));
console.log(`SUMMARY: ${found}/7 bugs detected`);
if (found === 7) {
  console.log('🎉 ALLE 7 BUGS GEFUNDEN!');
} else {
  console.log(`⚠️  ${7 - found} Bugs NICHT gefunden`);
}
console.log('='.repeat(70));

// RAW OUTPUT: all generated test files
console.log('');
console.log('='.repeat(70));
console.log('GENERATED TEST FILES — RAW OUTPUT');
console.log('='.repeat(70));
for (const f of testFilesArr) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`FILE: ${f?.filename}`);
  console.log('─'.repeat(70));
  console.log(f?.content ?? '');
}
