/**
 * SSRF Guard — Unit Tests
 *
 * Verifies that the SSRF guard correctly blocks all classes of internal/private
 * network access while allowing legitimate external URLs.
 */
import { describe, it, expect } from "vitest";
import { checkURL, safeFetch } from "./ssrf-guard";

describe("SSRF Guard — checkURL", () => {
  describe("Protocol filtering", () => {
    it("allows http://", () => {
      expect(checkURL("http://example.com").allowed).toBe(true);
    });

    it("allows https://", () => {
      expect(checkURL("https://example.com").allowed).toBe(true);
    });

    it("blocks file://", () => {
      const result = checkURL("file:///etc/passwd");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/protocol/i);
    });

    it("blocks ftp://", () => {
      expect(checkURL("ftp://example.com").allowed).toBe(false);
    });

    it("blocks gopher:// (used in some SSRF exploits)", () => {
      expect(checkURL("gopher://example.com:11211/_stats").allowed).toBe(false);
    });

    it("blocks data: URIs", () => {
      expect(checkURL("data:text/plain,Hello").allowed).toBe(false);
    });
  });

  describe("Hostname blocklist", () => {
    it("blocks localhost", () => {
      expect(checkURL("http://localhost/admin").allowed).toBe(false);
    });

    it("blocks 0.0.0.0", () => {
      expect(checkURL("http://0.0.0.0/").allowed).toBe(false);
    });

    it("blocks GCP metadata.google.internal", () => {
      expect(checkURL("http://metadata.google.internal/computeMetadata/v1/").allowed).toBe(false);
    });

    it("blocks bare 'metadata' hostname", () => {
      expect(checkURL("http://metadata/").allowed).toBe(false);
    });
  });

  describe("Private IPv4 ranges", () => {
    it("blocks 127.0.0.1 (loopback)", () => {
      const r = checkURL("http://127.0.0.1/");
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/loopback|private|127/i);
    });

    it("blocks 127.255.255.254 (entire 127/8)", () => {
      expect(checkURL("http://127.255.255.254/").allowed).toBe(false);
    });

    it("blocks 10.0.0.1 (private 10/8)", () => {
      const r = checkURL("http://10.0.0.1/");
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/private/i);
    });

    it("blocks 10.255.255.255 (entire 10/8 range)", () => {
      expect(checkURL("http://10.255.255.255/").allowed).toBe(false);
    });

    it("blocks 172.16.0.1 (start of 172.16/12)", () => {
      expect(checkURL("http://172.16.0.1/").allowed).toBe(false);
    });

    it("blocks 172.31.255.255 (end of 172.16/12)", () => {
      expect(checkURL("http://172.31.255.255/").allowed).toBe(false);
    });

    it("ALLOWS 172.32.0.1 (outside 172.16/12 range)", () => {
      expect(checkURL("http://172.32.0.1/").allowed).toBe(true);
    });

    it("ALLOWS 172.15.0.1 (just below 172.16/12)", () => {
      expect(checkURL("http://172.15.0.1/").allowed).toBe(true);
    });

    it("blocks 192.168.1.1 (private 192.168/16)", () => {
      expect(checkURL("http://192.168.1.1/").allowed).toBe(false);
    });

    it("blocks 169.254.169.254 (AWS EC2 metadata service)", () => {
      const r = checkURL("http://169.254.169.254/latest/meta-data/iam/");
      expect(r.allowed).toBe(false);
    });

    it("blocks 0.1.2.3 (entire 0/8)", () => {
      expect(checkURL("http://0.1.2.3/").allowed).toBe(false);
    });

    it("blocks 224.0.0.1 (multicast)", () => {
      expect(checkURL("http://224.0.0.1/").allowed).toBe(false);
    });

    it("blocks 240.0.0.1 (reserved)", () => {
      expect(checkURL("http://240.0.0.1/").allowed).toBe(false);
    });

    it("blocks 255.255.255.255 (broadcast)", () => {
      expect(checkURL("http://255.255.255.255/").allowed).toBe(false);
    });
  });

  describe("Private IPv6 ranges", () => {
    it("blocks ::1 (loopback)", () => {
      expect(checkURL("http://[::1]/").allowed).toBe(false);
    });

    it("blocks fe80:: (link-local)", () => {
      expect(checkURL("http://[fe80::1]/").allowed).toBe(false);
    });

    it("blocks fc00:: (unique-local)", () => {
      expect(checkURL("http://[fc00::1]/").allowed).toBe(false);
    });

    it("blocks fd00:: (unique-local)", () => {
      expect(checkURL("http://[fd00::1]/").allowed).toBe(false);
    });

    it("blocks IPv4-mapped loopback ::ffff:127.0.0.1", () => {
      expect(checkURL("http://[::ffff:127.0.0.1]/").allowed).toBe(false);
    });
  });

  describe("Dangerous ports", () => {
    it("blocks port 22 (SSH)", () => {
      expect(checkURL("http://example.com:22/").allowed).toBe(false);
    });

    it("blocks port 3306 (MySQL)", () => {
      expect(checkURL("http://example.com:3306/").allowed).toBe(false);
    });

    it("blocks port 6379 (Redis)", () => {
      expect(checkURL("http://example.com:6379/").allowed).toBe(false);
    });

    it("blocks port 27017 (MongoDB)", () => {
      expect(checkURL("http://example.com:27017/").allowed).toBe(false);
    });

    it("blocks port 5432 (Postgres)", () => {
      expect(checkURL("http://example.com:5432/").allowed).toBe(false);
    });

    it("blocks port 9000 (MinIO admin)", () => {
      expect(checkURL("http://example.com:9000/").allowed).toBe(false);
    });

    it("allows port 80 (HTTP)", () => {
      expect(checkURL("http://example.com:80/").allowed).toBe(true);
    });

    it("allows port 443 (HTTPS)", () => {
      expect(checkURL("https://example.com:443/").allowed).toBe(true);
    });

    it("allows port 8080 (common web)", () => {
      expect(checkURL("http://example.com:8080/").allowed).toBe(true);
    });
  });

  describe("Invalid input", () => {
    it("rejects empty string", () => {
      expect(checkURL("").allowed).toBe(false);
    });

    it("rejects malformed URL", () => {
      expect(checkURL("not-a-url").allowed).toBe(false);
    });

    it("rejects 'javascript:' URLs", () => {
      expect(checkURL("javascript:alert(1)").allowed).toBe(false);
    });
  });

  describe("Allowlist mode", () => {
    it("rejects URL not in allowlist", () => {
      const r = checkURL("https://evil.com", { allowedHostnames: ["api.github.com"] });
      expect(r.allowed).toBe(false);
      expect(r.reason).toMatch(/allowlist/i);
    });

    it("accepts URL exactly matching allowlist", () => {
      expect(checkURL("https://api.github.com/users", { allowedHostnames: ["api.github.com"] }).allowed).toBe(true);
    });

    it("accepts subdomain of allowlisted host", () => {
      expect(checkURL("https://uploads.api.github.com/x", { allowedHostnames: ["api.github.com"] }).allowed).toBe(true);
    });

    it("is case-insensitive for hostnames", () => {
      expect(checkURL("https://API.GitHub.com/", { allowedHostnames: ["api.github.com"] }).allowed).toBe(true);
    });
  });

  describe("Legitimate external URLs", () => {
    it("allows api.github.com", () => {
      expect(checkURL("https://api.github.com/repos/user/repo").allowed).toBe(true);
    });

    it("allows api.openai.com", () => {
      expect(checkURL("https://api.openai.com/v1/chat").allowed).toBe(true);
    });

    it("allows public Gemini endpoint", () => {
      expect(checkURL("https://generativelanguage.googleapis.com/v1beta/models").allowed).toBe(true);
    });
  });
});

describe("SSRF Guard — safeFetch", () => {
  it("rejects URLs that fail the SSRF check", async () => {
    await expect(safeFetch("http://127.0.0.1/admin")).rejects.toThrow(/SSRF guard/i);
  });

  it("rejects URLs with disallowed protocols", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(/SSRF guard/i);
  });

  it("respects custom timeout (aborts on slow response)", async () => {
    // Use a non-routable but DNS-resolvable address; should hit the abort timeout
    // Using a 1ms timeout to ensure it always aborts
    const promise = safeFetch("https://api.github.com/", { timeoutMs: 1 });
    await expect(promise).rejects.toThrow();
  });
});
