import { describe, expect, it } from "vitest";
import { getSafeDomain, isSafeUrl } from "@/lib/security";
import { safeJsonLdStringify } from "@/utils/format";

describe("Security Hardening Tests", () => {
  describe("isSafeUrl (XSS & Protocol Validation)", () => {
    it("allows valid http and https URLs", () => {
      expect(isSafeUrl("https://nvd.nist.gov/vuln/detail/CVE-2024-1234")).toBe(true);
      expect(isSafeUrl("http://example.com/advisory")).toBe(true);
    });

    it("rejects dangerous or malformed URL schemes", () => {
      expect(isSafeUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeUrl("javascript:confirm(document.cookie)")).toBe(false);
      expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
      expect(isSafeUrl("file:///etc/passwd")).toBe(false);
      expect(isSafeUrl("vbscript:msgbox")).toBe(false);
      expect(isSafeUrl("invalid-url-string")).toBe(false);
      expect(isSafeUrl("")).toBe(false);
      expect(isSafeUrl(undefined)).toBe(false);
    });
  });

  describe("getSafeDomain", () => {
    it("extracts hostname safely and handles malformed strings", () => {
      expect(getSafeDomain("https://www.github.com/advisories")).toBe("github.com");
      expect(getSafeDomain("javascript:alert(1)", "Fallback")).toBe("Fallback");
      expect(getSafeDomain("", "Fallback")).toBe("Fallback");
    });
  });

  describe("safeJsonLdStringify (JSON-LD Sanitization)", () => {
    it("escapes script closing tags to prevent XSS", () => {
      const data = { title: "</script><script>alert('xss')</script>" };
      const jsonLd = safeJsonLdStringify(data);
      expect(jsonLd).not.toContain("</script>");
      expect(jsonLd).toContain("\\u003c/script");
    });
  });
});
