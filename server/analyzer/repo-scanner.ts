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
  subpath?: string;
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

type FetchLike = typeof fetch;

function buildGitHubHeaders(githubToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubToken) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }
  return headers;
}

async function fetchDefaultBranch(
  owner: string,
  repo: string,
  headers: Record<string, string>,
  fetchImpl: FetchLike = fetch
): Promise<string | null> {
  const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const response = await fetchImpl(repoUrl, { headers });
  if (!response.ok) return null;
  const data = await response.json() as { default_branch?: string };
  return data.default_branch || null;
}

async function fetchRepoTreeWithFallback(
  owner: string,
  repo: string,
  branch: string,
  headers: Record<string, string>,
  fetchImpl: FetchLike = fetch
): Promise<{ tree: GitHubTreeItem[]; truncated: boolean; resolvedBranch: string }> {
  const candidates = Array.from(new Set([branch, "main", "master", "canary"]));
  let lastErrorText = "unknown error";
  let lastStatus = 500;

  for (const candidate of candidates) {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${candidate}?recursive=1`;
    const response = await fetchImpl(treeUrl, { headers });
    if (response.ok) {
      const data = await response.json() as { tree: GitHubTreeItem[]; truncated: boolean };
      return { ...data, resolvedBranch: candidate };
    }
    lastStatus = response.status;
    lastErrorText = await response.text();
    if (response.status !== 404) {
      throw new Error(`GitHub API error ${response.status}: ${lastErrorText}`);
    }
  }

  const defaultBranch = await fetchDefaultBranch(owner, repo, headers, fetchImpl);
  if (defaultBranch && !candidates.includes(defaultBranch)) {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
    const response = await fetchImpl(treeUrl, { headers });
    if (response.ok) {
      const data = await response.json() as { tree: GitHubTreeItem[]; truncated: boolean };
      return { ...data, resolvedBranch: defaultBranch };
    }
    lastStatus = response.status;
    lastErrorText = await response.text();
  }

  throw new Error(`GitHub API error ${lastStatus}: ${lastErrorText}`);
}

/**
 * Scan a GitHub repository for API spec files.
 * Uses the GitHub Trees API (recursive) for efficiency.
 */
export async function scanGitHubRepo(
  owner: string,
  repo: string,
  branch: string = "main",
  githubToken?: string,
  subpath?: string
): Promise<RepoScanResult> {
  const headers = buildGitHubHeaders(githubToken);
  const treeData = await fetchRepoTreeWithFallback(owner, repo, branch, headers);
  const normalizedSubpath = normalizeSubpath(subpath);

  const specs: DiscoveredSpec[] = [];
  const candidates = treeData.tree.filter(
    item => item.type === "blob" && isWithinSubpath(item.path, normalizedSubpath) && isSpecFile(item.path)
  );

  // For each candidate, peek at the first 500 bytes to detect type
  for (const item of candidates.slice(0, 20)) { // Max 20 specs per repo
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${treeData.resolvedBranch}/${item.path}`;
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
    branch: treeData.resolvedBranch,
    subpath: normalizedSubpath,
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

function normalizeSubpath(subpath?: string): string | undefined {
  if (!subpath) return undefined;
  const normalized = subpath.replace(/^\/+|\/+$/g, "");
  return normalized.length > 0 ? normalized : undefined;
}

function isWithinSubpath(filePath: string, subpath?: string): boolean {
  const normalized = normalizeSubpath(subpath);
  if (!normalized) return true;
  return filePath === normalized || filePath.startsWith(`${normalized}/`);
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
  githubToken?: string,
  subpath?: string
): Promise<Array<{ path: string; content: string }>> {
  const headers = buildGitHubHeaders(githubToken);
  const treeData = await fetchRepoTreeWithFallback(owner, repo, branch, headers);
  const normalizedSubpath = normalizeSubpath(subpath);

  // Filter to relevant code files
  const candidates = treeData.tree
    .filter(item => item.type === "blob" && isWithinSubpath(item.path, normalizedSubpath) && isCodeFile(item.path))
    .sort((a, b) => (a.size || 0) - (b.size || 0)) // Smallest first
    .slice(0, 100); // Max 100 files

  const result: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;
  const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB
  const MAX_FILE_BYTES = 200 * 1024; // 200KB per file

  for (const item of candidates) {
    if (totalBytes >= MAX_TOTAL_BYTES) break;
    if ((item.size || 0) > MAX_FILE_BYTES) continue;

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${treeData.resolvedBranch}/${item.path}`;
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
export function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string; subpath?: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(tree|blob)\/([^/]+)(?:\/(.*))?)?\/?$/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    branch: match[4] || "main",
    subpath: normalizeSubpath(match[5]),
  };
}
