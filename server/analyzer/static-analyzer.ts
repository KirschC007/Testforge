// static-analyzer.ts — v10 Block 8: 15 Pattern-Rules Static Analysis
// Runs over raw code files before LLM pass — deterministic, fast, no hallucinations

import type { CodeFile } from "./code-parser";

export interface StaticFinding {
  rule: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  file: string;
  line: number;
  message: string;
  snippet: string;
}

interface Rule {
  id: string;
  severity: StaticFinding["severity"];
  description: string;
  check: (file: CodeFile, lines: string[]) => StaticFinding[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function findLines(lines: string[], regex: RegExp, ruleId: string, severity: StaticFinding["severity"], message: string, filePath: string): StaticFinding[] {
  const findings: StaticFinding[] = [];
  lines.forEach((line, idx) => {
    if (regex.test(line)) {
      findings.push({
        rule: ruleId,
        severity,
        file: filePath,
        line: idx + 1,
        message,
        snippet: line.trim().slice(0, 120),
      });
    }
  });
  return findings;
}

// ─── 15 Rules ─────────────────────────────────────────────────────────────────

const RULES: Rule[] = [

  // RULE 1: Hardcoded secrets / API keys
  {
    id: "STATIC-001-HARDCODED-SECRET",
    severity: "HIGH",
    description: "Hardcoded secret or API key",
    check: (file, lines) => findLines(
      lines,
      /(?:apiKey|api_key|secret|password|token|jwt_secret|private_key)\s*[:=]\s*["'][^"']{8,}["']/i,
      "STATIC-001-HARDCODED-SECRET",
      "HIGH",
      "Hardcoded secret or API key detected — use environment variables",
      file.path
    ),
  },

  // RULE 2: Missing rate limiter on auth endpoints
  {
    id: "STATIC-002-NO-RATE-LIMIT",
    severity: "HIGH",
    description: "Auth endpoint without rate limiting",
    check: (file, lines) => {
      if (!file.path.includes("auth") && !file.path.includes("login")) return [];
      const hasRateLimit = lines.some(l => /rateLimit|rateLimiter|throttle|slowDown/i.test(l));
      if (hasRateLimit) return [];
      const hasLoginEndpoint = lines.some(l => /login|signin|authenticate/i.test(l));
      if (!hasLoginEndpoint) return [];
      return [{
        rule: "STATIC-002-NO-RATE-LIMIT",
        severity: "HIGH",
        file: file.path,
        line: 1,
        message: "Auth file has no rate limiter — brute-force attacks possible",
        snippet: file.path,
      }];
    },
  },

  // RULE 3: SQL injection risk — raw string interpolation in queries
  {
    id: "STATIC-003-SQL-INJECTION",
    severity: "HIGH",
    description: "Potential SQL injection via string interpolation",
    check: (file, lines) => findLines(
      lines,
      /(?:query|execute|raw|sql)\s*\(\s*[`"'].*\$\{/i,
      "STATIC-003-SQL-INJECTION",
      "HIGH",
      "Potential SQL injection — use parameterized queries",
      file.path
    ),
  },

  // RULE 4: Missing input validation on mutation
  {
    id: "STATIC-004-NO-INPUT-VALIDATION",
    severity: "MEDIUM",
    description: "Mutation without Zod input validation",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        if (/\.mutation\s*\(/.test(line) && !lines.slice(Math.max(0, idx - 3), idx + 5).some(l => /z\.object|z\.string|z\.number|input\s*\(/.test(l))) {
          findings.push({
            rule: "STATIC-004-NO-INPUT-VALIDATION",
            severity: "MEDIUM",
            file: file.path,
            line: idx + 1,
            message: "Mutation without input validation — add z.object() schema",
            snippet: line.trim().slice(0, 120),
          });
        }
      });
      return findings;
    },
  },

  // RULE 5: Missing authentication check on sensitive endpoint
  {
    id: "STATIC-005-MISSING-AUTH",
    severity: "HIGH",
    description: "Sensitive endpoint without auth middleware",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        const isSensitive = /delete|remove|admin|billing|payment|secret|private/i.test(line);
        const isPublic = /publicProcedure/.test(line);
        if (isSensitive && isPublic && /\.mutation|\.query/.test(line)) {
          findings.push({
            rule: "STATIC-005-MISSING-AUTH",
            severity: "HIGH",
            file: file.path,
            line: idx + 1,
            message: "Sensitive operation uses publicProcedure — should be protectedProcedure",
            snippet: line.trim().slice(0, 120),
          });
        }
      });
      return findings;
    },
  },

  // RULE 6: Missing CORS configuration
  {
    id: "STATIC-006-MISSING-CORS",
    severity: "MEDIUM",
    description: "Express app without CORS configuration",
    check: (file, lines) => {
      if (!file.path.includes("server") && !file.path.includes("app") && !file.path.includes("index")) return [];
      const hasExpress = lines.some(l => /express\(\)|createServer/.test(l));
      if (!hasExpress) return [];
      const hasCors = lines.some(l => /cors\(|helmet\(/.test(l));
      if (hasCors) return [];
      return [{
        rule: "STATIC-006-MISSING-CORS",
        severity: "MEDIUM",
        file: file.path,
        line: 1,
        message: "Express app without CORS/Helmet — add cors() and helmet() middleware",
        snippet: file.path,
      }];
    },
  },

  // RULE 7: Unhandled promise rejection
  {
    id: "STATIC-007-UNHANDLED-PROMISE",
    severity: "MEDIUM",
    description: "Async function without error handling",
    check: (file, lines) => findLines(
      lines,
      /await\s+\w+\([^)]*\)(?!\s*\.catch|\s*;?\s*\/\/)/,
      "STATIC-007-UNHANDLED-PROMISE",
      "MEDIUM",
      "Await without try/catch or .catch() — unhandled rejection possible",
      file.path
    ),
  },

  // RULE 8: Missing tenant isolation check
  {
    id: "STATIC-008-MISSING-TENANT-CHECK",
    severity: "HIGH",
    description: "DB query without tenant filter",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        const isDbQuery = /\.findMany\(|\.findFirst\(|\.findUnique\(/.test(line);
        if (!isDbQuery) return;
        const context = lines.slice(Math.max(0, idx - 2), idx + 8).join("\n");
        const hasTenantFilter = /tenantId|organizationId|shopId|workspaceId|companyId/.test(context);
        if (!hasTenantFilter) {
          findings.push({
            rule: "STATIC-008-MISSING-TENANT-CHECK",
            severity: "HIGH",
            file: file.path,
            line: idx + 1,
            message: "DB query without tenant filter — potential IDOR/data leak",
            snippet: line.trim().slice(0, 120),
          });
        }
      });
      return findings;
    },
  },

  // RULE 9: Exposed stack traces in error responses
  {
    id: "STATIC-009-STACK-TRACE-LEAK",
    severity: "MEDIUM",
    description: "Stack trace exposed in error response",
    check: (file, lines) => findLines(
      lines,
      /(?:message|error|details)\s*:\s*(?:err|error|e)\.(?:stack|message|toString)/i,
      "STATIC-009-STACK-TRACE-LEAK",
      "MEDIUM",
      "Stack trace or error message exposed in response — sanitize error output",
      file.path
    ),
  },

  // RULE 10: Missing webhook signature validation
  {
    id: "STATIC-010-MISSING-WEBHOOK-SIGNATURE",
    severity: "HIGH",
    description: "Webhook handler without signature validation",
    check: (file, lines) => {
      if (!file.path.includes("webhook") && !file.path.includes("hook")) return [];
      const hasSignatureCheck = lines.some(l => /signature|hmac|sha256|verify|stripe-signature|x-hub-signature/i.test(l));
      if (hasSignatureCheck) return [];
      return [{
        rule: "STATIC-010-MISSING-WEBHOOK-SIGNATURE",
        severity: "HIGH",
        file: file.path,
        line: 1,
        message: "Webhook handler without signature validation — replay attacks possible",
        snippet: file.path,
      }];
    },
  },

  // RULE 11: Insecure JWT configuration
  {
    id: "STATIC-011-INSECURE-JWT",
    severity: "HIGH",
    description: "JWT without expiry or weak algorithm",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        if (/jwt\.sign|sign\(.*secret/i.test(line)) {
          const context = lines.slice(idx, idx + 5).join(" ");
          if (!/expiresIn|exp\s*:/.test(context)) {
            findings.push({
              rule: "STATIC-011-INSECURE-JWT",
              severity: "HIGH",
              file: file.path,
              line: idx + 1,
              message: "JWT signed without expiresIn — tokens never expire",
              snippet: line.trim().slice(0, 120),
            });
          }
        }
      });
      return findings;
    },
  },

  // RULE 12: Missing file upload validation
  {
    id: "STATIC-012-FILE-UPLOAD-NO-VALIDATION",
    severity: "HIGH",
    description: "File upload without content-type or size validation",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        if (/multer|formData|upload|file.*upload|multipart/i.test(line)) {
          const context = lines.slice(Math.max(0, idx - 2), idx + 10).join("\n");
          if (!/mimetype|contentType|fileSize|maxSize|limits/i.test(context)) {
            findings.push({
              rule: "STATIC-012-FILE-UPLOAD-NO-VALIDATION",
              severity: "HIGH",
              file: file.path,
              line: idx + 1,
              message: "File upload without MIME type or size validation",
              snippet: line.trim().slice(0, 120),
            });
          }
        }
      });
      return findings;
    },
  },

  // RULE 13: Open redirect vulnerability
  {
    id: "STATIC-013-OPEN-REDIRECT",
    severity: "HIGH",
    description: "Redirect using unvalidated user input",
    check: (file, lines) => findLines(
      lines,
      /res\.redirect\s*\(\s*(?:req\.|request\.|params\.|query\.|body\.)/i,
      "STATIC-013-OPEN-REDIRECT",
      "HIGH",
      "Open redirect — validate redirect URL against allowlist",
      file.path
    ),
  },

  // RULE 14: Missing password hashing
  {
    id: "STATIC-014-PLAINTEXT-PASSWORD",
    severity: "HIGH",
    description: "Password stored or compared without hashing",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        if (/password\s*===\s*|password\s*==\s*|password\s*!==\s*/.test(line) && !/hash|bcrypt|argon|scrypt/i.test(line)) {
          findings.push({
            rule: "STATIC-014-PLAINTEXT-PASSWORD",
            severity: "HIGH",
            file: file.path,
            line: idx + 1,
            message: "Password compared without hashing — use bcrypt/argon2",
            snippet: line.trim().slice(0, 120),
          });
        }
      });
      return findings;
    },
  },

  // RULE 15: Missing audit logging on sensitive operations
  {
    id: "STATIC-015-MISSING-AUDIT-LOG",
    severity: "LOW",
    description: "Sensitive operation without audit logging",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        const isSensitive = /delete.*User|deleteAccount|banUser|promoteToAdmin|changeRole|resetPassword/i.test(line);
        if (!isSensitive) return;
        const context = lines.slice(Math.max(0, idx - 5), idx + 10).join("\n");
        const hasAuditLog = /auditLog|audit_log|logAction|createLog|activityLog/i.test(context);
        if (!hasAuditLog) {
          findings.push({
            rule: "STATIC-015-MISSING-AUDIT-LOG",
            severity: "LOW",
            file: file.path,
            line: idx + 1,
            message: "Sensitive operation without audit logging",
            snippet: line.trim().slice(0, 120),
          });
        }
      });
      return findings;
    },
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

export function runStaticAnalysis(files: CodeFile[]): StaticFinding[] {
  const allFindings: StaticFinding[] = [];

  for (const file of files) {
    // Skip test files, node_modules, generated files
    if (/node_modules|\.test\.|\.spec\.|dist\/|\.d\.ts$/.test(file.path)) continue;

    const lines = file.content.split("\n");

    for (const rule of RULES) {
      try {
        const findings = rule.check(file, lines);
        allFindings.push(...findings);
      } catch {
        // Rule errors are non-fatal
      }
    }
  }

  // Deduplicate: same rule + same file + same line
  const seen = new Set<string>();
  return allFindings.filter(f => {
    const key = `${f.rule}::${f.file}::${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
