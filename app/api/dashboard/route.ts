import { NextResponse } from 'next/server';
import { getAudits, pushMultipleAudits } from '@/lib/db';

// Prevent Next.js from caching this API route statically
export const dynamic = 'force-dynamic';

interface AuditLog {
  id: string;
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  timestamp: number;
  responseTimeSecs: number;
  status: 'clean' | 'warning' | 'critical';
  bugsCount: number;
  bugTypes: string[];
  region: string;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function seedAuditsIfEmpty() {
  const currentAudits = await getAudits();
  if (currentAudits.length === 0) {
    const mockAudits: AuditLog[] = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const repos = ['acme/api', 'acme/frontend', 'acme/infra', 'acme/mobile', 'company/service'];
    const shas = ['a3f9b12', 'c72de45', 'f01bc98', '88a2c31', '2d9f074', 'e3b8a1c', '7d2d9f0'];
    const regions = ['us', 'uk', 'in', 'ca', 'au'];
    const bugTypesPool = ['SQL Injection', 'Hardcoded Secrets', 'Insecure Deps', 'XSS', 'Path Traversal', 'Broken Auth'];

    // Generate 40 historical audits spread over the last 7 days
    for (let i = 0; i < 40; i++) {
      const dayOffset = Math.floor(Math.random() * 7); // 0 to 6 days ago
      const timestamp = now - dayOffset * oneDay - Math.floor(Math.random() * oneDay * 0.8);
      const repo = repos[Math.floor(Math.random() * repos.length)];
      const prNumber = 100 + i;
      const headSha = shas[Math.floor(Math.random() * shas.length)];
      const responseTimeSecs = parseFloat((5 + Math.random() * 12).toFixed(1));
      const region = regions[Math.floor(Math.random() * regions.length)];

      const statusSeed = Math.random();
      let status: 'clean' | 'warning' | 'critical' = 'clean';
      let bugsCount = 0;
      let bugTypes: string[] = [];

      if (statusSeed < 0.2) {
        status = 'critical';
        bugsCount = 1 + Math.floor(Math.random() * 3);
        bugTypes.push('SQL Injection');
        if (bugsCount > 1) bugTypes.push('Hardcoded Secrets');
      } else if (statusSeed < 0.5) {
        status = 'warning';
        bugsCount = 1 + Math.floor(Math.random() * 2);
        bugTypes.push(bugTypesPool[Math.floor(Math.random() * bugTypesPool.length)]);
      }

      mockAudits.push({
        id: `seed-delivery-${i}`,
        owner: repo.split('/')[0],
        repo: repo.split('/')[1],
        prNumber,
        headSha,
        timestamp,
        responseTimeSecs,
        status,
        bugsCount,
        bugTypes,
        region,
      });
    }

    // Sort by timestamp descending
    mockAudits.sort((a, b) => b.timestamp - a.timestamp);
    await pushMultipleAudits(mockAudits);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const regionParam = searchParams.get('region');

    // Automatically seed audits if empty to guarantee dashboard data
    await seedAuditsIfEmpty();

    const allAudits: AuditLog[] = await getAudits();

    // Filter by region if requested
    const filteredAudits = regionParam
      ? allAudits.filter((a) => a.region.toLowerCase() === regionParam.toLowerCase())
      : allAudits;

    // Calculate aggregate KPIs
    const totalPRs = filteredAudits.length;
    const totalBugs = filteredAudits.reduce((acc, a) => acc + (a.bugsCount || 0), 0);
    const sumResponse = filteredAudits.reduce((acc, a) => acc + (a.responseTimeSecs || 0), 0);
    const avgResponse = totalPRs > 0 ? (sumResponse / totalPRs).toFixed(1) : '0.0';
    const criticalCount = filteredAudits.filter((a) => a.status === 'critical').length;

    // Prepare 7-day daily volume & response time charts
    const last7Days = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const localYear = d.getFullYear();
      const localMonth = String(d.getMonth() + 1).padStart(2, '0');
      const localDate = String(d.getDate()).padStart(2, '0');
      const dateStr = `${localYear}-${localMonth}-${localDate}`;
      last7Days.push({
        dateStr,
        dayName: daysOfWeek[d.getDay()],
        prs: 0,
        totalSecs: 0,
        auditCountForSecs: 0,
      });
    }

    for (const audit of filteredAudits) {
      const d = new Date(audit.timestamp);
      const localYear = d.getFullYear();
      const localMonth = String(d.getMonth() + 1).padStart(2, '0');
      const localDate = String(d.getDate()).padStart(2, '0');
      const auditDateStr = `${localYear}-${localMonth}-${localDate}`;

      const dayObj = last7Days.find((day) => day.dateStr === auditDateStr);
      if (dayObj) {
        dayObj.prs++;
        dayObj.totalSecs += audit.responseTimeSecs;
        dayObj.auditCountForSecs++;
      }
    }

    const prData = last7Days.map((day) => ({
      day: day.dayName,
      prs: day.prs,
    }));

    const responseData = last7Days.map((day) => ({
      day: day.dayName,
      secs: day.auditCountForSecs > 0 ? parseFloat((day.totalSecs / day.auditCountForSecs).toFixed(1)) : 0,
    }));

    // Prepare Bugs by Type chart
    const bugCounts: Record<string, number> = {
      'SQL Injection': 0,
      'Hardcoded Secrets': 0,
      'Insecure Deps': 0,
      'XSS': 0,
      'Path Traversal': 0,
      'Broken Auth': 0,
      'Sensitive Data': 0,
    };

    for (const audit of filteredAudits) {
      if (audit.bugTypes && Array.isArray(audit.bugTypes)) {
        for (const type of audit.bugTypes) {
          if (bugCounts[type] !== undefined) {
            bugCounts[type]++;
          }
        }
      }
    }

    const colors: Record<string, string> = {
      'SQL Injection': '#ef4444',
      'Hardcoded Secrets': '#f97316',
      'Insecure Deps': '#eab308',
      'XSS': '#a78bfa',
      'Path Traversal': '#60a5fa',
      'Broken Auth': '#f472b6',
      'Sensitive Data': '#f43f5e',
    };

    const bugData = Object.entries(bugCounts).map(([type, count]) => ({
      type,
      count,
      color: colors[type] || '#a8a29e',
    }));

    // Prepare recent audits list
    const recentAudits = filteredAudits.slice(0, 5).map((a) => ({
      repo: `${a.owner}/${a.repo}`,
      pr: a.prNumber,
      status: a.status,
      bugs: a.bugsCount,
      time: formatTimeAgo(a.timestamp),
      sha: a.headSha.slice(0, 7),
    }));

    return NextResponse.json({
      totalPRs,
      totalBugs,
      avgResponse,
      criticalCount,
      prData,
      bugData,
      responseData,
      recentAudits,
    });
  } catch (error) {
    console.error('Dashboard data API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
