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

function collectQueryBlock(lines: string[], startIdx: number): string {
  const block: string[] = [];
  for (let i = startIdx; i < Math.min(lines.length, startIdx + 14); i++) {
    block.push(lines[i]);
    if (/\}\)\s*;|\}\s*\)\s*$|\}\s*,\s*$|\)\s*;/.test(lines[i])) break;
  }
  return block.join("\n");
}

function hasTenantScopedQuery(block: string): boolean {
  const tenantField = "(?:tenantId|organizationId|shopId|workspaceId|companyId)";
  const directWhereObject = new RegExp(`where\\s*:\\s*\\{[^}]*${tenantField}`, "i");
  const predicateWithEq = new RegExp(`(?:where|and|or|eq)\\s*\\([^\\n]*${tenantField}`, "i");
  const nestedPredicate = new RegExp(`${tenantField}[^\\n]{0,80}(?:input\\.|ctx\\.|params\\.|query\\.|body\\.)`, "i");
  const drizzleObjectForm = new RegExp(`${tenantField}\\s*:\\s*(?:input\\.|ctx\\.|params\\.|query\\.|body\\.)`, "i");
  const userScopedPredicate = /(?:where|and|or|eq)\s*\([^\n]*(?:userId|ownerId|createdBy)[^\n]*(?:ctx\.user\.id|input\.userId|req\.user\.id)/i;
  return (
    directWhereObject.test(block) ||
    predicateWithEq.test(block) ||
    nestedPredicate.test(block) ||
    drizzleObjectForm.test(block) ||
    userScopedPredicate.test(block)
  );
}

function stripLineComment(line: string): string {
  return line.replace(/\/\/.*$/, "");
}

function shouldSkipStaticFile(pathname: string): boolean {
  return (
    /node_modules|\.test\.|\.spec\.|dist\/|build\/|coverage\/|\.next\/|\.d\.ts$/.test(pathname) ||
    /(?:^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|bun\.lock|composer\.lock|Cargo\.lock)$/.test(pathname) ||
    /(?:^|\/)(vitest|vite|eslint|prettier|tailwind|postcss|playwright)\.config\.[cm]?[tj]s$/.test(pathname) ||
    /(?:^|\/)(\.manus|\.turbo|\.cache|\.github)\//.test(pathname) ||
    /(?:^|\/)(client|public|docs|examples?)\//.test(pathname) ||
    /(?:^|\/)(migrations?|drizzle)\//.test(pathname) ||
    /(?:^|\/)scripts\//.test(pathname) ||
    /\.(min\.js|map)$/.test(pathname)
  );
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
      /(?:apiKey|api_key|secret|password|token|jwt_secret|private_key)\s*[:=]\s*["'][^"']{8,}["']|jwt\.sign\s*\([^,]+,\s*["'][^"']{8,}["']/i,
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
      const hasLoginEndpoint = lines.some(l => /credentials|login\s*(?:\(|:)|signin\s*(?:\(|:)|authenticate|["']\/login["']/i.test(l));
      const isOAuthOnly = lines.some(l => /oauth|google|microsoft|github/i.test(l)) && !lines.some(l => /password|credentials/i.test(l));
      if (isOAuthOnly) return [];
      const hasRequestHandling = lines.some(l => /req\.|request\.|body|\binput\b|credentials|password\s*[=:]/i.test(l));
      if (!hasRequestHandling) return [];
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
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        const cleanLine = stripLineComment(line);
        const block = lines.slice(idx, idx + 5).map(stripLineComment).join("\n");
        const hasQueryCall = /(?:query|execute|raw|sql)\s*\(/i.test(cleanLine);
        if (!hasQueryCall) return;
        if (/(?:query|execute|raw)\s*\([\s\S]*\?[\s\S]*,\s*\[[\s\S]*\]/i.test(block)) return;
        const hasTemplateInterpolation = /(?:query|execute|raw|sql)\s*\(\s*[`"'][\s\S]*\$\{/i.test(block);
        const hasUserControlledConcat = /(?:query|execute|raw|sql)\s*\([\s\S]*?(?:\+[\s\S]*?){2,}/i.test(block)
          && /req\.|request\.|body\.|params\.|query\.|input\.|args\./i.test(block);
        if (!hasTemplateInterpolation && !hasUserControlledConcat) return;
        findings.push({
          rule: "STATIC-003-SQL-INJECTION",
          severity: "HIGH",
          file: file.path,
          line: idx + 1,
          message: "Potential SQL injection — use parameterized queries",
          snippet: block.trim().slice(0, 120),
        });
      });
      return findings;
    },
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
        const context = lines.slice(Math.max(0, idx - 3), idx + 4).join("\n");
        const isSensitive = /delete|remove|admin|billing|payment|secret|private/i.test(context);
        const isPublic = /publicProcedure/.test(context);
        const isEndpoint = /\.mutation|\.query/.test(context);
        if (isSensitive && isPublic && isEndpoint) {
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

  // RULE 7: Floating promise / missing await on side-effectful async call
  {
    id: "STATIC-007-UNHANDLED-PROMISE",
    severity: "MEDIUM",
    description: "Floating promise without await, return, void, or catch",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        const cleanLine = stripLineComment(line).trim();
        if (!cleanLine || /^[.*}):,\]]/.test(cleanLine)) return;
        if (/^(await|return|void|throw|if|for|while|switch|const|let|var|import|export|function|async)\b/.test(cleanLine)) return;
        if (/=>|process\.stdout\.write|console\.|\.catch\s*\(|\.then\s*\([^)]*,|Promise\.all(?:Settled)?\s*\(/.test(cleanLine)) return;
        const unhandledThen = /\.then\s*\(/.test(cleanLine) && !/\.catch\s*\(/.test(cleanLine);
        const explicitAsyncCall = /\b[A-Za-z_$][\w$]*(?:Async|Promise)\s*\([^)]*\)\s*;?$/.test(cleanLine);
        if (!unhandledThen && !explicitAsyncCall) return;
        findings.push({
          rule: "STATIC-007-UNHANDLED-PROMISE",
          severity: "MEDIUM",
          file: file.path,
          line: idx + 1,
          message: "Potential floating promise — await, return, void, or attach .catch()",
          snippet: cleanLine.slice(0, 120),
        });
      });
      return findings;
    },
  },

  // RULE 8: Missing tenant isolation check
  {
    id: "STATIC-008-MISSING-TENANT-CHECK",
    severity: "HIGH",
    description: "DB query without tenant filter",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        const isDbQuery = /\.findMany\(|\.findFirst\(|\.findUnique\(|\.select\(\)\.from\(|db\.query\./.test(line);
        if (!isDbQuery) return;
        const queryBlock = collectQueryBlock(lines, idx);
        if (/\b(?:platformSettings|systemSettings|featureFlags|plans|integrationTypes|emailTemplates)\b/.test(queryBlock)) return;
        const hasTenantSignalsNearby = /tenantId|organizationId|shopId|workspaceId|companyId/.test(queryBlock);
        const hasTenantScopedFilter = hasTenantScopedQuery(queryBlock);
        if (hasTenantSignalsNearby && hasTenantScopedFilter) return;
        if (!hasTenantScopedFilter) {
          findings.push({
            rule: "STATIC-008-MISSING-TENANT-CHECK",
            severity: "HIGH",
            file: file.path,
            line: idx + 1,
            message: "DB query without tenant filter — potential IDOR/data leak",
            snippet: queryBlock.trim().slice(0, 120),
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
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        const context = lines.slice(Math.max(0, idx - 2), idx + 3).join("\n");
        const exposesError = /(?:message|error|details)\s*:\s*(?:err|error|e)\.(?:stack|message|toString)|(?:res|reply)\.(?:json|send|status)[\s\S]*(?:err|error|e)\.(?:stack|message|toString)|Response\.json\s*\([\s\S]*(?:err|error|e)\.(?:stack|message|toString)/i.test(line);
        const isOnlyLogging = /logger\.|console\.|captureException\(/i.test(line) && !/(?:res|reply)\.|Response\.json|return\s+\{/.test(context);
        if (!exposesError || isOnlyLogging) return;
        findings.push({
          rule: "STATIC-009-STACK-TRACE-LEAK",
          severity: "MEDIUM",
          file: file.path,
          line: idx + 1,
          message: "Stack trace or error message exposed in response — sanitize error output",
          snippet: line.trim().slice(0, 120),
        });
      });
      return findings;
    },
  },

  // RULE 10: Missing webhook signature validation
  {
    id: "STATIC-010-MISSING-WEBHOOK-SIGNATURE",
    severity: "HIGH",
    description: "Webhook handler without signature validation",
    check: (file, lines) => {
      if (!file.path.includes("webhook") && !file.path.includes("hook")) return [];
      const executableLines = lines.map(stripLineComment);
      const hasSignatureCheck = executableLines.some(l => /signature|hmac|sha256|verify|stripe-signature|x-hub-signature/i.test(l));
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
      if (file.path.endsWith("package.json")) return [];
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        if (/buildUploadUrl|downloadUrl|Storage upload failed|uploadUrl/i.test(line)) return;
        if (/\bmulter\s*\(|request\.formData\s*\(|req\.file|req\.files|multipart/i.test(line)) {
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
        const isSensitive = /(?:delete.*User|deleteAccount|banUser|promoteToAdmin|changeRole|resetPassword)\s*(?:\(|:)/i.test(line);
        if (!isSensitive) return;
        if (/^\s*import\b|^\s*export\s+\{/.test(line)) return;
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

  // RULE 16: Mass assignment via raw request/input object updates
  {
    id: "STATIC-016-MASS-ASSIGNMENT",
    severity: "HIGH",
    description: "Broad object update with unfiltered user input",
    check: (file, lines) => {
      const findings: StaticFinding[] = [];
      lines.forEach((line, idx) => {
        const dangerousWrite = /data\s*:\s*input\b|data\s*:\s*req\.body\b|\.\.\.\s*input\b|\.\.\.\s*req\.body\b/.test(line);
        if (!dangerousWrite) return;
        const context = lines.slice(Math.max(0, idx - 8), idx + 8).join("\n");
        const hasProtectedFields = /role|isAdmin|tenantId|status/.test(context);
        if (!hasProtectedFields) return;
        findings.push({
          rule: "STATIC-016-MASS-ASSIGNMENT",
          severity: "HIGH",
          file: file.path,
          line: idx + 1,
          message: "Unfiltered user input is written into a mutable model with protected fields nearby",
          snippet: line.trim().slice(0, 120),
        });
      });
      return findings;
    },
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

export function runStaticAnalysis(files: CodeFile[]): StaticFinding[] {
  const allFindings: StaticFinding[] = [];

  for (const file of files) {
    // Skip generated, dependency, migration, config, and tool-artifact files.
    if (shouldSkipStaticFile(file.path)) continue;

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
