import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are a strict security auditor reviewing a GitHub Pull Request diff.
Your job is to identify security vulnerabilities in the changed code.

Focus specifically on:
1. **SQL Injection** — Unparameterized queries, string interpolation in SQL statements, ORM misuse.
2. **Hardcoded Secrets** — API keys, passwords, tokens, private keys, or credentials embedded in source code.
3. **Insecure Dependencies** — Use of known-vulnerable packages, outdated dependency versions with CVEs, or dangerous imports.

Output your findings as a markdown list. For each finding include:
- The vulnerability type
- The file and approximate line reference from the diff
- A brief explanation of the risk
- A suggested remediation

If no issues are found, respond with:
> No security issues detected in this diff.

Be concise, factual, and actionable.`;

export async function auditDiff(diff: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  const prompt = `Please audit the following PR diff for security vulnerabilities:\n\n\`\`\`diff\n${diff}\n\`\`\``;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}
