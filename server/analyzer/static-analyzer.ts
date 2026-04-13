/**
 * TestForge v9.0 — Static Analysis Layer
 * Deterministic pattern-based security scanning.
 * Runs BEFORE LLM analysis — no API calls needed.
 */

export interface StaticFinding {
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  description: string;
  fix: string;
}

interface CodeFile {
  path: string;
  content: string;
}

const RULES: Array<{
  id: string;
  severity: StaticFinding["severity"];
  description: string;
  fix: string;
  pattern: RegExp;
  fileFilter?: RegExp;
  // If antiPattern is present, finding is only reported if pattern matches AND antiPattern does NOT
  antiPattern?: RegExp;
}> = [
  {
    id: "RULE-001",
    severity: "critical",
    description: "No rate limiter on authentication endpoint",
    fix: "Add express-rate-limit or similar middleware to login/auth/reset-password routes",
    pattern: /\.post\s*\(\s*["'][^"']*(?:login|auth|reset.?password|sign.?in)[^"']*["']/i,
    antiPattern: /rateLimit|rateLimiter|rate_limit|slowDown|express-rate-limit/i,
  },
  {
    id: "RULE-002",
    severity: "high",
    description: "Origin/redirect parameter used without whitelist validation",
    fix: "Validate origin/redirect against an ALLOWED_ORIGINS whitelist",
    pattern: /(?:req\.(?:body|query|params)\.(?:origin|redirect|returnUrl|callback)|input\.(?:origin|redirect))/i,
    antiPattern: /ALLOWED_ORIGINS|allowedOrigins|whitelist|validOrigins|VALID_REDIRECT/i,
  },
  {
    id: "RULE-003",
    severity: "medium",
    description: "Backup or environment file found in source",
    fix: "Remove .bak, .env, .env.local files from version control",
    pattern: /\.(bak|env\.local|env\.production|env\.staging)\b/,
    fileFilter: /\.(ts|js|json)$/,
  },
  {
    id: "RULE-004",
    severity: "medium",
    description: "bcrypt rounds below 10 (weak hashing)",
    fix: "Increase bcrypt salt rounds to at least 10 (recommended: 12)",
    pattern: /bcrypt\.\w+\s*\([^)]*,\s*([1-9])\s*[,)]/,
  },
  {
    id: "RULE-005",
    severity: "high",
    description: "Sensitive data logged to console",
    fix: "Remove console.log of passwords, secrets, tokens, and keys",
    pattern: /console\.(?:log|info|debug)\s*\([^)]*(?:password|secret|token|apiKey|api_key|private_key)/i,
  },
  {
    id: "RULE-006",
    severity: "critical",
    description: "Math.random() used for security-sensitive value (predictable)",
    fix: "Use crypto.randomBytes() or crypto.randomUUID() instead of Math.random()",
    pattern: /Math\.random\s*\(\)/,
    fileFilter: /(?:token|secret|key|auth|session|csrf)/i,
  },
  {
    id: "RULE-007",
    severity: "critical",
    description: "eval(), Function(), or child_process.exec() with user input",
    fix: "Never use eval/Function/exec with user-controlled input — use parameterized queries or safe alternatives",
    pattern: /(?:eval|new\s+Function|child_process\.exec)\s*\(/,
  },
  {
    id: "RULE-008",
    severity: "medium",
    description: "Failed login attempts not logged to audit trail",
    fix: "Add audit logging for failed authentication attempts",
    pattern: /(?:invalid.*password|wrong.*password|login.*fail|auth.*fail)/i,
    antiPattern: /audit|log.*fail|logFailedLogin|track.*attempt/i,
  },
  {
    id: "RULE-009",
    severity: "critical",
    description: "SQL query built with string concatenation (injection risk)",
    fix: "Use parameterized queries (drizzle ORM, knex, or pg with $1 placeholders)",
    pattern: /(?:query|execute|raw)\s*\(\s*[`"'].*\$\{|(?:query|execute|raw)\s*\(\s*[^,]+\s*\+\s*(?:req\.|input\.|body\.)/,
  },
  {
    id: "RULE-010",
    severity: "high",
    description: "JWT signed without expiry (token never expires)",
    fix: "Add expiresIn to jwt.sign() options (e.g., '15m' for access tokens, '7d' for refresh)",
    pattern: /jwt\.sign\s*\(/,
    antiPattern: /expiresIn|exp:/,
  },
  {
    id: "RULE-011",
    severity: "medium",
    description: "Hardcoded HTTP URL (should be HTTPS)",
    fix: "Use HTTPS for all external API calls and redirects",
    pattern: /["']http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/,
  },
  {
    id: "RULE-012",
    severity: "high",
    description: "Password reset without token expiry check",
    fix: "Add token expiry validation to password reset flow",
    pattern: /(?:reset.*password|password.*reset)/i,
    antiPattern: /expir|isValid|tokenAge|createdAt.*<|Date\.now/i,
  },
  {
    id: "RULE-013",
    severity: "high",
    description: "File upload without content-type or size validation",
    fix: "Validate file type (whitelist mime types) and enforce max file size",
    pattern: /upload|multer|formidable|busboy/i,
    antiPattern: /fileFilter|limits|maxFileSize|allowedTypes|mimetype/i,
  },
  {
    id: "RULE-014",
    severity: "high",
    description: "CORS with wildcard (*) in production",
    fix: "Replace CORS origin '*' with specific allowed domains",
    pattern: /cors\s*\(\s*\{[^}]*origin\s*:\s*["']\*["']/,
  },
  {
    id: "RULE-015",
    severity: "medium",
    description: "Missing Content-Security-Policy header",
    fix: "Add Content-Security-Policy header via helmet or manual middleware",
    pattern: /app\.use|express\(\)/,
    antiPattern: /helmet|contentSecurityPolicy|Content-Security-Policy/i,
    fileFilter: /(?:index|app|server|main)\.(ts|js)$/,
  },
];

export function runStaticAnalysis(codeFiles: CodeFile[]): StaticFinding[] {
  const findings: StaticFinding[] = [];

  for (const file of codeFiles) {
    const lines = file.content.split("\n");

    for (const rule of RULES) {
      // File filter
      if (rule.fileFilter && !rule.fileFilter.test(file.path)) continue;

      // Check if the entire file has the anti-pattern (= already mitigated)
      if (rule.antiPattern && rule.antiPattern.test(file.content)) continue;

      // Scan line by line
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i])) {
          findings.push({
            rule: rule.id,
            severity: rule.severity,
            file: file.path,
            line: i + 1,
            description: rule.description,
            fix: rule.fix,
          });
          break; // One finding per rule per file
        }
      }
    }
  }

  return findings;
}
