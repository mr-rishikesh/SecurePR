import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-6">
      <main className="max-w-2xl w-full text-center">
        <div className="mb-6 inline-flex items-center gap-2 bg-indigo-900/40 border border-indigo-700/50 rounded-full px-4 py-1.5 text-sm text-indigo-300">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          AI-Powered Security Auditing
        </div>

        <h1 className="text-6xl font-extrabold tracking-tight text-white mb-4">
          Dev<span className="text-indigo-400">Insight</span>
        </h1>

        <p className="text-xl text-gray-400 mb-10 leading-relaxed">
          Automatically audit every Pull Request for security vulnerabilities —
          SQL injection, hardcoded secrets, and insecure dependencies — powered
          by Gemini 1.5 Flash.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors px-8 py-3.5 text-base font-semibold text-white shadow-lg"
          >
            View Dashboard
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-gray-700 hover:border-gray-500 hover:bg-gray-800 transition-colors px-8 py-3.5 text-base font-semibold text-gray-300"
          >
            GitHub Docs
          </a>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold text-gray-100 mb-1">Instant Audits</h3>
            <p className="text-sm text-gray-500">Every PR triggers a security review within seconds via GitHub webhooks.</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl mb-2">🛡️</div>
            <h3 className="font-semibold text-gray-100 mb-1">Three Threat Classes</h3>
            <p className="text-sm text-gray-500">Detects SQL injection, hardcoded secrets, and vulnerable dependencies.</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold text-gray-100 mb-1">Analytics Dashboard</h3>
            <p className="text-sm text-gray-500">Track audit volume, bugs found, and response time trends over time.</p>
          </div>
        </div>
      </main>

      <footer className="mt-20 text-sm text-gray-600">
        DevInsight — AI-Powered PR Auditor
      </footer>
    </div>
  );
}
