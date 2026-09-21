import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());

const { auditDiff } = await import('../lib/gemini.ts');

const sampleDiff = `diff --git a/test.js b/test.js
index 0000000..1111111 100644
--- a/test.js
+++ b/test.js
@@ -0,0 +1,2 @@
+// Hardcoded credential test
+const API_KEY = "dummy_secret_token_12345";
`;

console.log('Sending sample diff to Groq model...');
const result = await auditDiff(sampleDiff);
console.log('\n--- GROQ AUDIT REPORT ---');
console.log(result);
