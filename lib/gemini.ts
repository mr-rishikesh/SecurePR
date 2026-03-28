import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are a strict security auditor reviewing a GitHub Pull Request diff.
Your job is to identify security vulnerabilities in the changed code only — do not flag code outside the diff.

Focus on these vulnerability classes:
1. **SQL Injection** — Unparameterized queries, string interpolation in SQL, ORM misuse.
2. **Hardcoded Secrets** — API keys, passwords, tokens, private keys, or credentials in source code.
3. **Insecure Dependencies** — Known-vulnerable packages, outdated versions with CVEs, dangerous imports.
4. **Cross-Site Scripting (XSS)** — Unsanitized user input rendered in HTML/JS contexts.
5. **Path Traversal** — User-controlled file paths without sanitization.
6. **Broken Authentication** — Missing auth checks, insecure session handling, weak token validation.
7. **Sensitive Data Exposure** — Logging or returning secrets, PII, or stack traces to clients.

For each finding output a markdown block in this exact format:

### [SEVERITY] Vulnerability Type
- **File:** \`path/to/file.ts\` (line ~N)
- **Risk:** One sentence explaining the danger.
- **Fix:** Concrete remediation step.

Severity levels: 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🔵 LOW

If no issues are found, respond with a single line:
> ✅ No security issues detected in this diff.

Be concise, factual, and actionable.`;

const MAX_DIFF_CHARS = 50_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// Module-level singleton — created once per process lifetime
let _model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!_model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
    const genAI = new GoogleGenerativeAI(apiKey);
    _model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    });
  }
  return _model;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function auditDiff(diff: string): Promise<string> {
  const truncated =
    diff.length > MAX_DIFF_CHARS
      ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n*(diff truncated at 50k chars)*'
      : diff;

  const prompt = `Audit the following PR diff for security vulnerabilities:\n\n\`\`\`diff\n${truncated}\n\`\`\``;
  const model = getModel();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError!;
}
