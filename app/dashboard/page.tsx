'use client';

import Link from 'next/link';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ─── Mock data ────────────────────────────────────────────────────────────────
const prData = [
  { day: 'Mon', prs: 3 },
  { day: 'Tue', prs: 7 },
  { day: 'Wed', prs: 5 },
  { day: 'Thu', prs: 12 },
  { day: 'Fri', prs: 9 },
  { day: 'Sat', prs: 4 },
  { day: 'Sun', prs: 6 },
];

const bugData = [
  { type: 'SQL Injection', count: 8, color: '#ef4444' },
  { type: 'Hardcoded Secrets', count: 14, color: '#f97316' },
  { type: 'Insecure Deps', count: 11, color: '#eab308' },
  { type: 'XSS', count: 5, color: '#a78bfa' },
  { type: 'Path Traversal', count: 3, color: '#60a5fa' },
  { type: 'Broken Auth', count: 6, color: '#f472b6' },
];

const responseData = [
  { day: 'Mon', secs: 12.4 },
  { day: 'Tue', secs: 10.8 },
  { day: 'Wed', secs: 9.5 },
  { day: 'Thu', secs: 11.2 },
  { day: 'Fri', secs: 8.3 },
  { day: 'Sat', secs: 7.9 },
  { day: 'Sun', secs: 7.2 },
];

const recentAudits = [
  { repo: 'acme/api', pr: 142, status: 'critical', bugs: 3, time: '2m ago', sha: 'a3f9b12' },
  { repo: 'acme/frontend', pr: 89, status: 'clean', bugs: 0, time: '14m ago', sha: 'c72de45' },
  { repo: 'acme/infra', pr: 31, status: 'warning', bugs: 1, time: '1h ago', sha: 'f01bc98' },
  { repo: 'acme/mobile', pr: 204, status: 'critical', bugs: 4, time: '2h ago', sha: '88a2c31' },
  { repo: 'acme/api', pr: 139, status: 'clean', bugs: 0, time: '3h ago', sha: '2d9f074' },
];

const totalPRs = prData.reduce((s, d) => s + d.prs, 0);
const totalBugs = bugData.reduce((s, d) => s + d.count, 0);
const avgResponse = (responseData.reduce((s, d) => s + d.secs, 0) / responseData.length).toFixed(1);
const criticalCount = recentAudits.filter((a) => a.status === 'critical').length;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'critical')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <span className="w-1 h-1 rounded-full bg-red-400" /> Critical
      </span>
    );
  if (status === 'warning')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        <span className="w-1 h-1 rounded-full bg-yellow-400" /> Warning
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
      <span className="w-1 h-1 rounded-full bg-green-400" /> Clean
    </span>
  );
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#111',
    border: '1px solid #222',
    borderRadius: '10px',
    fontSize: '12px',
    color: '#ededed',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  },
  labelStyle: { color: '#888', marginBottom: '4px' },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 h-14 border-b border-white/6 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">DevInsight</span>
          </Link>
          <span className="text-white/15">/</span>
          <span className="text-sm text-[#888]">Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-[#555] px-3 py-1 rounded-full border border-white/6 bg-white/3">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
            Worker online
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg border border-white/6 bg-white/3 text-[#888] hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Overview</h1>
          <p className="text-sm text-[#555] mt-0.5">Last 7 days · mock data</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'PRs Audited',
              value: totalPRs,
              sub: 'this week',
              color: 'indigo',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              ),
            },
            {
              label: 'Bugs Found',
              value: totalBugs,
              sub: 'across all PRs',
              color: 'red',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              ),
            },
            {
              label: 'Avg Response',
              value: `${avgResponse}s`,
              sub: 'end-to-end',
              color: 'green',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              label: 'Critical PRs',
              value: criticalCount,
              sub: 'need attention',
              color: 'orange',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                </svg>
              ),
            },
          ].map(({ label, value, sub, color, icon }) => {
            const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
              indigo: { bg: 'bg-indigo-600/10', text: 'text-indigo-400', border: 'border-indigo-500/20', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.08)]' },
              red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.08)]' },
              green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.08)]' },
              orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.08)]' },
            };
            const c = colorMap[color];
            return (
              <div key={label} className={`p-5 rounded-2xl border ${c.border} bg-[#0a0a0a] ${c.glow}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[#555] uppercase tracking-wider font-medium">{label}</span>
                  <span className={`p-1.5 rounded-lg ${c.bg} ${c.text}`}>{icon}</span>
                </div>
                <p className={`text-3xl font-bold ${c.text} tracking-tight`}>{value}</p>
                <p className="text-xs text-[#444] mt-1">{sub}</p>
              </div>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* PRs per day */}
          <div className="p-6 rounded-2xl border border-white/6 bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-white">PRs Audited</h2>
                <p className="text-xs text-[#555] mt-0.5">Daily volume</p>
              </div>
              <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">7d</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={prData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="prGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="prs"
                  name="PRs"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#prGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Response time */}
          <div className="p-6 rounded-2xl border border-white/6 bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-white">Avg Response Time</h2>
                <p className="text-xs text-[#555] mt-0.5">End-to-end seconds</p>
              </div>
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">↓ improving</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={responseData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 20]} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v}s`, 'Avg response']} />
                <Area
                  type="monotone"
                  dataKey="secs"
                  name="Seconds"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#respGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bug types bar + Recent audits */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
          {/* Bug types */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-white/6 bg-[#0a0a0a]">
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-white">Bugs by Type</h2>
              <p className="text-xs text-[#555] mt-0.5">All-time distribution</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bugData} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#444', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="type" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={12}>
                  {bugData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent audits */}
          <div className="lg:col-span-3 p-6 rounded-2xl border border-white/6 bg-[#0a0a0a]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-white">Recent Audits</h2>
                <p className="text-xs text-[#555] mt-0.5">Latest PR activity</p>
              </div>
              <button className="text-xs text-[#555] hover:text-[#888] transition-colors">View all →</button>
            </div>
            <div className="space-y-2">
              {recentAudits.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors group">
                  {/* Repo icon */}
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/6 flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{a.repo}</span>
                      <span className="text-xs text-[#444] font-mono">#{a.pr}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#444] font-mono">{a.sha}</span>
                      <span className="text-[#333]">·</span>
                      <span className="text-xs text-[#444]">{a.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.bugs > 0 && (
                      <span className="text-xs text-[#555]">{a.bugs} {a.bugs === 1 ? 'bug' : 'bugs'}</span>
                    )}
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Severity legend */}
        <div className="p-5 rounded-2xl border border-white/5 bg-[#0a0a0a]">
          <p className="text-xs text-[#444] uppercase tracking-widest font-medium mb-4">Severity reference</p>
          <div className="flex flex-wrap gap-4">
            {[
              { emoji: '🔴', label: 'Critical', desc: 'Immediate exploitation risk — block merge', color: 'text-red-400' },
              { emoji: '🟠', label: 'High', desc: 'Serious vulnerability — fix before deploy', color: 'text-orange-400' },
              { emoji: '🟡', label: 'Medium', desc: 'Security weakness — schedule fix', color: 'text-yellow-400' },
              { emoji: '🔵', label: 'Low', desc: 'Minor issue or best practice', color: 'text-blue-400' },
            ].map(({ emoji, label, desc, color }) => (
              <div key={label} className="flex items-start gap-2 min-w-45">
                <span className="text-sm mt-0.5">{emoji}</span>
                <div>
                  <span className={`text-xs font-semibold ${color}`}>{label}</span>
                  <p className="text-xs text-[#444] mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 px-6 py-5 flex items-center justify-between text-xs text-[#333]">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-indigo-600/70 flex items-center justify-center">
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          DevInsight
        </div>
        <span>Mock data · connect Redis &amp; GitHub token to go live</span>
      </footer>
    </div>
  );
}
