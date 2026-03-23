/**
 * TestForge Repo-Scanner (S5-1)
 *
 * Scans a GitHub repository for API spec files:
 * - openapi.yaml / openapi.json
 * - swagger.yaml / swagger.json
 * - api.yaml / api.json
 * - docs/api/*.yaml
 * - Any file matching spec patterns
 *
 * Returns a list of discovered spec files with metadata.
 * Used by the "Scan Repo" feature in the UI.
 */

export interface DiscoveredSpec {
  path: string;
  name: string;
  type: "openapi3" | "swagger2" | "text" | "unknown";
  sizeBytes: number;
  downloadUrl: string;
  sha: string;
}

export interface RepoScanResult {
  owner: string;
  repo: string;
  branch: string;
  specs: DiscoveredSpec[];
  totalFiles: number;
  scannedAt: string;
}

const SPEC_PATTERNS = [
  /openapi\.(yaml|yml|json)$/i,
  /swagger\.(yaml|yml|json)$/i,
  /api\.(yaml|yml|json)$/i,
  /api-spec\.(yaml|yml|json)$/i,
  /api-docs\.(yaml|yml|json)$/i,
  /spec\.(yaml|yml|json)$/i,
  /docs\/api\/.*\.(yaml|yml|json)$/i,
  /\.well-known\/openapi\.(yaml|yml|json)$/i,
];

function isSpecFile(path: string): boolean {
  return SPEC_PATTERNS.some(p => p.test(path));
}

function detectSpecType(content: string): DiscoveredSpec["type"] {
  const trimmed = content.trim();
  if (trimmed.includes("openapi: 3") || trimmed.includes('"openapi": "3')) return "openapi3";
  if (trimmed.includes("swagger: '2") || trimmed.includes('"swagger": "2')) return "swagger2";
  if (trimmed.includes("openapi: 2") || trimmed.includes("swagger:")) return "swagger2";
  if (trimmed.includes("paths:") || trimmed.includes('"paths"')) return "openapi3";
  if (trimmed.length > 100) return "text";
  return "unknown";
}

interface GitHubTreeItem {
  path: string;
  type: string;
  size: number;
  sha: string;
  url: string;
  download_url?: string;
}

/**
 * Scan a GitHub repository for API spec files.
 * Uses the GitHub Trees API (recursive) for efficiency.
 */
export async function scanGitHubRepo(
  owner: string,
  repo: string,
  branch: string = "main",
  githubToken?: string
): Promise<RepoScanResult> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubToken) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  // Get the tree recursively
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    const err = await treeRes.text();
    throw new Error(`GitHub API error ${treeRes.status}: ${err}`);
  }
  const treeData = await treeRes.json() as { tree: GitHubTreeItem[]; truncated: boolean };

  const specs: DiscoveredSpec[] = [];
  const candidates = treeData.tree.filter(
    item => item.type === "blob" && isSpecFile(item.path)
  );

  // For each candidate, peek at the first 500 bytes to detect type
  for (const item of candidates.slice(0, 20)) { // Max 20 specs per repo
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`;
    let specType: DiscoveredSpec["type"] = "unknown";
    try {
      const peekRes = await fetch(rawUrl, {
        headers: { ...headers, "Range": "bytes=0-499" },
      });
      if (peekRes.ok) {
        const peek = await peekRes.text();
        specType = detectSpecType(peek);
      }
    } catch {
      // Ignore peek errors — still include the file
    }
    specs.push({
      path: item.path,
      name: item.path.split("/").pop() || item.path,
      type: specType,
      sizeBytes: item.size || 0,
      downloadUrl: rawUrl,
      sha: item.sha,
    });
  }

  return {
    owner,
    repo,
    branch,
    specs,
    totalFiles: treeData.tree.filter(i => i.type === "blob").length,
    scannedAt: new Date().toISOString(),
  };
}

// ─── Code File Fetcher ───────────────────────────────────────────────────────

const CODE_FILE_PATTERNS = [
  /\.ts$/,
  /\.tsx$/,
  /\.js$/,
  /\.mjs$/,
  /\.prisma$/,
  /package\.json$/,
  /\.env\.example$/,
];

const IGNORE_PATHS = [
  /node_modules\//,
  /\.next\//,
  /dist\//,
  /build\//,
  /\.git\//,
  /coverage\//,
  /\.turbo\//,
  /out\//,
  /\.cache\//,
  /\.test\./,
  /\.spec\./,
  /test\//,
  /__tests__\//,
  /\.stories\./,
];

function isCodeFile(path: string): boolean {
  if (IGNORE_PATHS.some(p => p.test(path))) return false;
  return CODE_FILE_PATTERNS.some(p => p.test(path));
}

/**
 * Fetch code files from a GitHub repository for static analysis.
 * Downloads all relevant .ts/.tsx/.js/.prisma/package.json/.env.example files.
 * Ignores node_modules, dist, build, test files.
 * Max 100 files, max 5MB total.
 */
export async function fetchRepoCodeFiles(
  owner: string,
  repo: string,
  branch: string = "main",
  githubToken?: string
): Promise<Array<{ path: string; content: string }>> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubToken) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  // Get the full file tree
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    const err = await treeRes.text();
    throw new Error(`GitHub API error ${treeRes.status}: ${err}`);
  }
  const treeData = await treeRes.json() as { tree: GitHubTreeItem[]; truncated: boolean };

  // Filter to relevant code files
  const candidates = treeData.tree
    .filter(item => item.type === "blob" && isCodeFile(item.path))
    .sort((a, b) => (a.size || 0) - (b.size || 0)) // Smallest first
    .slice(0, 100); // Max 100 files

  const result: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;
  const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB
  const MAX_FILE_BYTES = 200 * 1024; // 200KB per file

  for (const item of candidates) {
    if (totalBytes >= MAX_TOTAL_BYTES) break;
    if ((item.size || 0) > MAX_FILE_BYTES) continue;

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`;
    try {
      const res = await fetch(rawUrl, { headers });
      if (!res.ok) continue;
      const content = await res.text();
      totalBytes += content.length;
      result.push({ path: item.path, content });
    } catch {
      // Skip files that fail to download
    }
  }

  return result;
}

/**
 * Parse a GitHub URL into owner/repo/branch components.
 * Supports:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/branch
 *   https://github.com/owner/repo/blob/branch/path
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+))?(?:\/.*)?$/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    branch: match[3] || "main",
  };
}
