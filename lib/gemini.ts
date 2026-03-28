import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are a strict security auditor reviewing a GitHub Pull Request diff.
Your job is to identify security vulnerabilities in the changed code only.

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

Be concise, factual, and actionable. Do not flag issues outside the diff.`;

let genAIInstance: ReturnType<typeof GoogleGenerativeAI.prototype.getGenerativeModel> | null = null;

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
  if (!genAIInstance) {
    const genAI = new GoogleGenerativeAI(apiKey);
    genAIInstance = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    });
  }
  return genAIInstance;
}

const MAX_DIFF_CHARS = 50_000;

export async function auditDiff(diff: string): Promise<string> {
  const truncated = diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + '\n\n*(diff truncated at 50k chars)*'
    : diff;

  const model = getModel();
  const prompt = `Audit the following PR diff for security vulnerabilities:\n\n\`\`\`diff\n${truncated}\n\`\`\``;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
