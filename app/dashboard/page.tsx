'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const prReviewData = [
  { week: 'Week 1', prs: 4 },
  { week: 'Week 2', prs: 7 },
  { week: 'Week 3', prs: 5 },
  { week: 'Week 4', prs: 12 },
  { week: 'Week 5', prs: 9 },
  { week: 'Week 6', prs: 15 },
  { week: 'Week 7', prs: 18 },
  { week: 'Week 8', prs: 22 },
];

const bugsFoundData = [
  { week: 'Week 1', sqlInjection: 1, hardcodedSecrets: 2, insecureDeps: 0 },
  { week: 'Week 2', sqlInjection: 0, hardcodedSecrets: 3, insecureDeps: 1 },
  { week: 'Week 3', sqlInjection: 2, hardcodedSecrets: 1, insecureDeps: 2 },
  { week: 'Week 4', sqlInjection: 1, hardcodedSecrets: 4, insecureDeps: 3 },
  { week: 'Week 5', sqlInjection: 3, hardcodedSecrets: 2, insecureDeps: 1 },
  { week: 'Week 6', sqlInjection: 0, hardcodedSecrets: 5, insecureDeps: 2 },
  { week: 'Week 7', sqlInjection: 2, hardcodedSecrets: 1, insecureDeps: 4 },
  { week: 'Week 8', sqlInjection: 1, hardcodedSecrets: 3, insecureDeps: 2 },
];

const responseTimeData = [
  { week: 'Week 1', avgSeconds: 12.4 },
  { week: 'Week 2', avgSeconds: 10.8 },
  { week: 'Week 3', avgSeconds: 11.2 },
  { week: 'Week 4', avgSeconds: 9.5 },
  { week: 'Week 5', avgSeconds: 8.9 },
  { week: 'Week 6', avgSeconds: 8.1 },
  { week: 'Week 7', avgSeconds: 7.6 },
  { week: 'Week 8', avgSeconds: 7.2 },
];

const totalPRs = prReviewData.reduce((sum, d) => sum + d.prs, 0);
const totalBugs = bugsFoundData.reduce(
  (sum, d) => sum + d.sqlInjection + d.hardcodedSecrets + d.insecureDeps,
  0
);
const latestAvgResponse = responseTimeData[responseTimeData.length - 1].avgSeconds;

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-indigo-400">DevInsight Dashboard</h1>
          <p className="text-gray-400 mt-2">AI-Powered PR Audit Analytics</p>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-sm text-gray-400 uppercase tracking-wider">Total PRs Reviewed</p>
            <p className="text-5xl font-bold text-indigo-400 mt-2">{totalPRs}</p>
            <p className="text-xs text-gray-500 mt-1">Last 8 weeks</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-sm text-gray-400 uppercase tracking-wider">Security Bugs Found</p>
            <p className="text-5xl font-bold text-red-400 mt-2">{totalBugs}</p>
            <p className="text-xs text-gray-500 mt-1">SQL injection, secrets, deps</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-sm text-gray-400 uppercase tracking-wider">Avg Response Time</p>
            <p className="text-5xl font-bold text-green-400 mt-2">{latestAvgResponse}s</p>
            <p className="text-xs text-gray-500 mt-1">Current week average</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Total PRs Reviewed - Line Chart */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Total PRs Reviewed</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={prReviewData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="prs"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={{ fill: '#818cf8', r: 4 }}
                  name="PRs Reviewed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Average Response Time - Line Chart */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Average Response Time (seconds)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 20]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#e5e7eb' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgSeconds"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ fill: '#34d399', r: 4 }}
                  name="Avg Response (s)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Security Bugs Found - Bar Chart (full width) */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Security Bugs Found by Type</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bugsFoundData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Legend />
              <Bar dataKey="sqlInjection" name="SQL Injection" fill="#f87171" radius={[4, 4, 0, 0]} />
              <Bar dataKey="hardcodedSecrets" name="Hardcoded Secrets" fill="#fb923c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="insecureDeps" name="Insecure Dependencies" fill="#facc15" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <footer className="mt-10 text-center text-gray-600 text-sm">
          DevInsight AI-Powered PR Auditor — mock data for demonstration
        </footer>
      </div>
    </div>
  );
}
