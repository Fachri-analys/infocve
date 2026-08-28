/**
 * CWE ID → standard English name.
 *
 * The NVD CVE API only ever returns a bare CWE ID (e.g. "CWE-79") inside
 * `weaknesses[].description[].value` — never a human-readable name. This is
 * a small, static lookup for the ~70 CWEs that show up most often in real
 * CVE data, so `<CWECard>` still has a name to display instead of just the
 * code. CWE definitions are maintained by MITRE and change rarely, so a
 * static table is a reasonable, dependency-free choice here rather than
 * calling a second external API just for this.
 *
 * Unknown IDs fall back to a generic label in `getCweName()` below — they
 * still render correctly, just without a specific name.
 */
export const CWE_CATALOG: Record<string, string> = {
  "CWE-20": "Improper Input Validation",
  "CWE-22": "Path Traversal",
  "CWE-78": "OS Command Injection",
  "CWE-79": "Cross-Site Scripting",
  "CWE-89": "SQL Injection",
  "CWE-90": "LDAP Injection",
  "CWE-94": "Code Injection",
  "CWE-98": "PHP Remote File Inclusion",
  "CWE-116": "Improper Encoding or Escaping of Output",
  "CWE-119": "Improper Restriction of Operations within Memory Buffer Bounds",
  "CWE-125": "Out-of-Bounds Read",
  "CWE-190": "Integer Overflow or Wraparound",
  "CWE-200": "Exposure of Sensitive Information to an Unauthorized Actor",
  "CWE-203": "Observable Discrepancy",
  "CWE-208": "Observable Timing Discrepancy",
  "CWE-259": "Use of Hard-coded Password",
  "CWE-269": "Improper Privilege Management",
  "CWE-284": "Improper Access Control",
  "CWE-285": "Improper Authorization",
  "CWE-287": "Improper Authentication",
  "CWE-294": "Authentication Bypass by Capture-Replay",
  "CWE-295": "Improper Certificate Validation",
  "CWE-306": "Missing Authentication for Critical Function",
  "CWE-307": "Improper Restriction of Excessive Authentication Attempts",
  "CWE-311": "Missing Encryption of Sensitive Data",
  "CWE-319": "Cleartext Transmission of Sensitive Information",
  "CWE-326": "Inadequate Encryption Strength",
  "CWE-327": "Use of a Broken or Risky Cryptographic Algorithm",
  "CWE-330": "Use of Insufficiently Random Values",
  "CWE-352": "Cross-Site Request Forgery (CSRF)",
  "CWE-362": "Race Condition (Improper Synchronization)",
  "CWE-367": "Time-of-Check Time-of-Use (TOCTOU) Race Condition",
  "CWE-384": "Session Fixation",
  "CWE-400": "Uncontrolled Resource Consumption",
  "CWE-416": "Use After Free",
  "CWE-425": "Direct Request (Forced Browsing)",
  "CWE-434": "Unrestricted Upload of File with Dangerous Type",
  "CWE-441": "Unintended Proxy or Intermediary (Confused Deputy)",
  "CWE-444": "HTTP Request/Response Smuggling",
  "CWE-459": "Incomplete Cleanup",
  "CWE-476": "NULL Pointer Dereference",
  "CWE-502": "Deserialization of Untrusted Data",
  "CWE-521": "Weak Password Requirements",
  "CWE-522": "Insufficiently Protected Credentials",
  "CWE-532": "Insertion of Sensitive Information into Log File",
  "CWE-601": "URL Redirection to Untrusted Site (Open Redirect)",
  "CWE-611": "Improper Restriction of XML External Entity Reference (XXE)",
  "CWE-639": "Authorization Bypass Through User-Controlled Key (IDOR)",
  "CWE-668": "Exposure of Resource to Wrong Sphere",
  "CWE-674": "Uncontrolled Recursion",
  "CWE-732": "Incorrect Permission Assignment for Critical Resource",
  "CWE-770": "Allocation of Resources Without Limits or Throttling",
  "CWE-772": "Missing Release of Resource After Effective Lifetime",
  "CWE-787": "Out-of-Bounds Write",
  "CWE-798": "Use of Hard-coded Credentials",
  "CWE-829": "Inclusion of Functionality from Untrusted Control Sphere",
  "CWE-834": "Excessive Iteration",
  "CWE-841": "Improper Enforcement of Behavioral Workflow",
  "CWE-862": "Missing Authorization",
  "CWE-863": "Incorrect Authorization",
  "CWE-918": "Server-Side Request Forgery (SSRF)",
  "CWE-1021": "Improper Restriction of Rendered UI Layers (Clickjacking)",
  "CWE-1284": "Improper Validation of Specified Quantity in Input",
  "NVD-CWE-Other": "Other (not yet mapped to a specific CWE)",
  "NVD-CWE-noinfo": "Insufficient Information to Classify",
};

export function getCweName(id: string): string {
  return CWE_CATALOG[id] ?? "Common Weakness Enumeration";
}
