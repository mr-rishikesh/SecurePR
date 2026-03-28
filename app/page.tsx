import Link from 'next/link';

const features = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    label: 'Instant',
    title: 'Zero-wait audits',
    desc: 'Webhook hits your API, job is queued and 200 OK returned in under 50ms. GitHub never times out.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    label: '7 threat classes',
    title: 'Deep security coverage',
    desc: 'SQL injection, hardcoded secrets, insecure deps, XSS, path traversal, broken auth, data exposure.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    label: 'Analytics',
    title: 'Live dashboard',
    desc: 'Track PR volume, bugs caught per category, and response time trends across your whole team.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
    label: 'Production-ready',
    title: 'Docker + CI/CD',
    desc: 'Multi-container Docker Compose with Redis, GitHub Actions pipeline, and standalone Next.js.',
  },
];

const steps = [
  { n: '01', title: 'Open a PR', desc: 'Push a branch and open a pull request on any GitHub repo where DevInsight is installed.' },
  { n: '02', title: 'Webhook fires', desc: 'GitHub sends a webhook. DevInsight verifies the HMAC signature and queues the job in under 50ms.' },
  { n: '03', title: 'Gemini audits the diff', desc: 'The background worker fetches only the changed lines and sends them to Gemini 1.5 Flash for analysis.' },
  { n: '04', title: 'Comment posted', desc: 'Findings land directly on the PR thread — severity-rated, file-specific, with actionable remediation steps.' },
];

const stats = [
  { value: '< 50ms', label: 'Webhook response' },
  { value: '7', label: 'Threat classes' },
  { value: '3×', label: 'Worker concurrency' },
  { value: '3', label: 'Auto retries' },
];

export default function Home() {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Background glow blobs */}
      <div className="pointer-events-none select-none absolute inset-0 overflow-hidden">
        <div className="blob absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="blob blob-delay absolute top-[40%] -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-900/10 blur-[100px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">DevInsight</span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-[#888]">
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
        </nav>
        <Link
          href="/dashboard"
          className="text-sm font-medium px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-white hover:bg-white/[0.1] transition-colors"
        >
          Open dashboard →
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32">
        {/* Badge */}
        <div className="fade-up flex justify-center mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
            </span>
            Powered by Gemini 1.5 Flash
          </span>
        </div>

        {/* Headline */}
        <div className="fade-up fade-up-1 text-center mb-6">
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter text-white leading-[1.05]">
            Security audits
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300 bg-clip-text text-transparent">
              on every PR.
            </span>
          </h1>
        </div>

        {/* Sub */}
        <div className="fade-up fade-up-2 text-center mb-10">
          <p className="text-lg text-[#888] max-w-xl mx-auto leading-relaxed">
            DevInsight hooks into GitHub, audits each pull request diff with AI, and posts
            severity-rated findings directly on the PR thread — automatically.
          </p>
        </div>

        {/* CTAs */}
        <div className="fade-up fade-up-3 flex flex-col sm:flex-row items-center justify-center gap-3 mb-20">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-[0_0_24px_rgba(99,102,241,0.35)] hover:shadow-[0_0_32px_rgba(99,102,241,0.5)]"
          >
            View dashboard
            <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/[0.1] text-[#aaa] hover:text-white hover:border-white/[0.2] text-sm font-medium transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </div>

        {/* Stats bar */}
        <div className="fade-up fade-up-4 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/6 mb-24">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#0a0a0a] px-6 py-5 text-center">
              <p className="text-2xl font-bold text-white tracking-tight">{s.value}</p>
              <p className="text-xs text-[#555] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Features grid */}
        <div className="mb-24">
          <p className="text-xs font-semibold text-[#555] uppercase tracking-widest text-center mb-8">What you get</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative p-6 rounded-2xl border border-white/6 bg-[#0a0a0a] hover:border-indigo-500/30 hover:bg-[#0f0f14] transition-all"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-600/0 to-indigo-600/0 group-hover:from-indigo-600/5 group-hover:to-transparent transition-all" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="p-1.5 rounded-lg bg-indigo-600/15 text-indigo-400">{f.icon}</span>
                    <span className="text-xs font-medium text-indigo-400/80 uppercase tracking-wider">{f.label}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-[#666] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mb-20">
          <p className="text-xs font-semibold text-[#555] uppercase tracking-widest text-center mb-8">How it works</p>
          <div className="relative">
            {/* Connecting line */}
            <div className="hidden sm:block absolute left-[2.35rem] top-8 bottom-8 w-px bg-gradient-to-b from-indigo-600/40 via-indigo-600/20 to-transparent" />
            <div className="space-y-4">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-5 p-5 rounded-2xl border border-white/5 bg-[#0a0a0a] hover:border-white/[0.08] transition-colors">
                  <div className="shrink-0 w-10 h-10 rounded-full border border-indigo-500/30 bg-indigo-600/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-400 font-mono">{s.n}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">{s.title}</h4>
                    <p className="text-sm text-[#666] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA banner */}
        <div className="relative rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/60 to-black overflow-hidden p-10 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12)_0%,transparent_70%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white mb-3">Ready to ship safer code?</h2>
            <p className="text-[#777] mb-6 text-sm max-w-sm mx-auto">
              Point a webhook at <code className="font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded text-xs">/api/webhook</code> and you're live.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-[0_0_24px_rgba(99,102,241,0.4)]"
            >
              Open dashboard →
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-[#444]">
        <div className="flex items-center justify-center gap-1">
          <div className="w-4 h-4 rounded bg-indigo-600/80 flex items-center justify-center mr-1">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          DevInsight — AI-Powered PR Security Auditor
        </div>
      </footer>
    </div>
  );
}
