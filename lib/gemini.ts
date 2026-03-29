import Groq from 'groq-sdk';

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

// Model: llama-3.3-70b-versatile is Groq's fastest high-quality model.
// Alternatives: mixtral-8x7b-32768, llama3-70b-8192, gemma2-9b-it
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const MAX_DIFF_CHARS = 50_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// Module-level singleton — created once per process lifetime
let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY environment variable is not set');
    _client = new Groq({ apiKey });
  }
  return _client;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function auditDiff(diff: string): Promise<string> {
  const truncated =
    diff.length > MAX_DIFF_CHARS
      ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n*(diff truncated at 50k chars)*'
      : diff;

  const client = getClient();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 2048,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Audit the following PR diff for security vulnerabilities:\n\n\`\`\`diff\n${truncated}\n\`\`\``,
          },
        ],
      });
      return completion.choices[0]?.message?.content ?? '> ✅ No response from model.';
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError!;
}
