import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, PieChart, Activity, ShieldAlert, CheckCircle, Database } from 'lucide-react';
import { StatCard } from '../components/StatCard';

interface OverviewData {
  total_cases: number;
  active_cases: number;
  closed_cases: number;
  total_alerts: number;
  unread_alerts: number;
  total_evidence: number;
  total_transactions: number;
  monitored_wallets: number;
  avg_risk_score: number;
  total_funds_at_risk: number;
  cases_by_status: Record<string, number>;
  cases_by_blockchain: Record<string, number>;
  cases_by_priority: Record<string, number>;
}

export const AnalyticsDashboard: React.FC = () => {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [riskDist, setRiskDist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('sih_auth_token')}` };
        const base = window.location.protocol === 'https:' ? '/api' : 'http://localhost:8000/api';
        
        const [ovRes, trRes, hmRes, rdRes] = await Promise.all([
          fetch(`${base}/analytics/overview`, { headers }),
          fetch(`${base}/analytics/trends?days=30`, { headers }),
          fetch(`${base}/analytics/heatmap`, { headers }),
          fetch(`${base}/analytics/risk-distribution`, { headers })
        ]);
        
        if (ovRes.ok) setOverview(await ovRes.json());
        if (trRes.ok) setTrends(await trRes.json());
        if (hmRes.ok) setHeatmap(await hmRes.json());
        if (rdRes.ok) setRiskDist(await rdRes.json());
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const maxRiskDist = Math.max(...riskDist.map(r => r.count), 1);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-[#0F172A] border border-slate-800 flex items-center justify-between shadow-md text-white">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
              Intelligence Dashboard
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            System Analytics & Threat Trends
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Cases"
          value={overview.total_cases}
          subtitle={`${overview.active_cases} active, ${overview.closed_cases} closed`}
          icon={Database}
          color="indigo"
        />
        <StatCard
          title="Avg Risk Score"
          value={overview.avg_risk_score}
          subtitle="System-wide threat index"
          icon={BarChart3}
          color={overview.avg_risk_score > 70 ? 'red' : 'amber'}
        />
        <StatCard
          title="Funds at Risk"
          value={`$${overview.total_funds_at_risk.toLocaleString()}`}
          subtitle="Estimated total exposure"
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Active Alerts"
          value={overview.unread_alerts}
          subtitle={`Out of ${overview.total_alerts} total alerts`}
          icon={ShieldAlert}
          color="red"
          trend="Action Req."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <BarChart3 className="w-5 h-5 text-slate-500" />
            <h3 className="text-base font-bold text-[#1E293B]">Risk Score Distribution</h3>
          </div>
          <div className="h-64 flex items-end justify-between gap-1 pt-4">
            {riskDist.map((bucket, i) => {
              const heightPct = (bucket.count / maxRiskDist) * 100;
              return (
                <div key={i} className="flex flex-col items-center flex-1 group">
                  <div className="text-[10px] text-slate-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {bucket.count}
                  </div>
                  <div 
                    className="w-full bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  ></div>
                  <div className="text-[9px] text-slate-400 mt-2 -rotate-45 transform origin-top-left ml-2 whitespace-nowrap">
                    {bucket.range}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <Activity className="w-5 h-5 text-slate-500" />
            <h3 className="text-base font-bold text-[#1E293B]">Transaction Heatmap (Day x Hour)</h3>
          </div>
          <div className="h-64 flex flex-col justify-center">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {[...Array(7)].map((_, day) => (
                <React.Fragment key={day}>
                  {[...Array(24)].map((_, hour) => {
                    const data = heatmap.find(h => h.day_of_week === day && h.hour === hour);
                    const count = data ? data.count : 0;
                    const opacity = Math.min(count * 0.1 + 0.05, 1);
                    return (
                      <div 
                        key={`${day}-${hour}`} 
                        className="aspect-square bg-blue-600 rounded-sm"
                        style={{ opacity: count > 0 ? opacity : 0.05 }}
                        title={`Day ${day}, Hour ${hour}: ${count} txs`}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-xs text-slate-500 px-1">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
