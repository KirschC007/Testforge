import { describe, expect, it } from "vitest";
import { assessPublicHttpUrl } from "./url-safety";

describe("url safety", () => {
  it("allows public http and https URLs", () => {
    expect(assessPublicHttpUrl("https://example.com").safe).toBe(true);
    expect(assessPublicHttpUrl("http://api.example.com:8080").safe).toBe(true);
  });

  it("blocks local and private network targets", () => {
    for (const url of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://10.0.0.5",
      "http://172.16.1.1",
      "http://192.168.0.2",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]:3000",
      "http://service.local",
    ]) {
      expect(assessPublicHttpUrl(url).safe, url).toBe(false);
    }
  });

  it("blocks non-http protocols", () => {
    expect(assessPublicHttpUrl("file:///etc/passwd").safe).toBe(false);
    expect(assessPublicHttpUrl("ftp://example.com").safe).toBe(false);
  });
});
