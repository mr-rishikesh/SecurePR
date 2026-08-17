import crypto from 'crypto';
import http from 'http';

// Load secret from environment or default to local setup secret
const secret = process.env.WEBHOOK_SECRET || 'your_webhook_secret_here';

const payload = JSON.stringify({
  action: 'opened',
  pull_request: {
    number: 42,
    head: {
      sha: 'abc1234567890def'
    },
    title: 'Test security PR'
  },
  repository: {
    owner: {
      login: 'testuser'
    },
    name: 'testrepo'
  }
});

const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

const region = 'in'; // test India region filtering
const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/webhook?region=${region}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': signature,
    'X-GitHub-Event': 'pull_request',
    'X-GitHub-Delivery': 'test-delivery-' + Date.now(),
  }
};

console.log(`Sending test webhook signed payload targeting region: "${region}"...`);

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Response Status: ${res.statusCode}`);
    console.log(`Response Body: ${body}`);
  });
});

req.on('error', (err) => {
  console.error('Failed to connect to local Next.js API server. Make sure it is running on port 3000!');
  console.error(err.message);
});

req.write(payload);
req.end();
