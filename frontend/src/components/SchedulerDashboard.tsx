import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, Trash2, History, RefreshCw, Timer } from 'lucide-react';
import { api } from '../services/api';

interface Job {
  id: string;
  wallet_address: string;
  case_id: string;
  blockchain: string;
  interval_hours: number;
  last_run: string | null;
  next_run: string;
  status: 'active' | 'paused';
}

interface JobHistory {
  run_at: string;
  new_transactions: number;
  balance_change: number;
  risk_score_change: number;
  alert_generated: boolean;
  summary: string;
}

export const SchedulerDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobHistory, setSelectedJobHistory] = useState<JobHistory[] | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Form State
  const [walletAddress, setWalletAddress] = useState('');
  const [caseId, setCaseId] = useState('');
  const [blockchain, setBlockchain] = useState('Bitcoin');
  const [interval, setInterval] = useState<number>(24);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('sih_auth_token')}`,
    'Content-Type': 'application/json'
  });
  const base = window.location.protocol === 'https:' ? '/api' : 'http://localhost:8000/api';

  const fetchJobs = async () => {
    try {
      const response = await fetch(`${base}/scheduler/jobs`, { headers: getHeaders() });
      if (response.ok) setJobs(await response.json());
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${base}/scheduler/jobs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          wallet_address: walletAddress,
          case_id: caseId,
          blockchain,
          interval_hours: interval,
        })
      });
      if (response.ok) {
        setWalletAddress('');
        setCaseId('');
        setBlockchain('Bitcoin');
        setInterval(24);
        fetchJobs();
      }
    } catch (error) {
      console.error('Error creating job:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async (job: Job) => {
    try {
      const endpoint = job.status === 'active' ? 'pause' : 'resume';
      const response = await fetch(`${base}/scheduler/jobs/${job.id}/${endpoint}`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (response.ok) fetchJobs();
    } catch (error) {
      console.error('Error toggling job status:', error);
    }
  };

  const handleExecuteNow = async (id: string) => {
    try {
      const response = await fetch(`${base}/scheduler/jobs/${id}/execute`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (response.ok) {
        fetchJobs();
        if (selectedJobId === id) {
          fetchHistory(id);
        }
      }
    } catch (error) {
      console.error('Error executing job:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${base}/scheduler/jobs/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (response.ok) {
        if (selectedJobId === id) {
          setSelectedJobHistory(null);
          setSelectedJobId(null);
        }
        fetchJobs();
      }
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

  const fetchHistory = async (id: string) => {
    try {
      const response = await fetch(`${base}/scheduler/jobs/${id}/history`, { headers: getHeaders() });
      if (response.ok) {
        setSelectedJobHistory(await response.json());
        setSelectedJobId(id);
      }
    } catch (error) {
      console.error('Error fetching job history:', error);
    }
  };

  return (
    <div className="p-6 space-y-6 text-slate-200">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Clock className="w-6 h-6 text-blue-400" /> Automated Scheduled Monitoring
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Job Form */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 h-fit">
          <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-blue-400" /> Create New Schedule
          </h2>
          <form onSubmit={handleCreateJob} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Wallet Address</label>
              <input
                type="text"
                required
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter wallet address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Case ID</label>
              <input
                type="text"
                required
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter associated case ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Blockchain</label>
              <select
                value={blockchain}
                onChange={(e) => setBlockchain(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Bitcoin">Bitcoin</option>
                <option value="Ethereum">Ethereum</option>
                <option value="Binance Smart Chain">Binance Smart Chain</option>
                <option value="Tron">Tron</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Interval</label>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value={1}>Every 1 hour</option>
                <option value={6}>Every 6 hours</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Every 24 hours</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Create Job'}
            </button>
          </form>
        </div>

        {/* Active Jobs List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Active Jobs</h2>
            <button onClick={fetchJobs} className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl p-8 text-center border border-slate-700 text-slate-400">
              No active scheduled monitoring jobs found.
            </div>
          ) : (
            <div className="grid gap-4">
              {jobs.map((job) => (
                <div key={job.id} className="bg-slate-800 rounded-2xl p-5 border border-slate-700 hover:border-slate-600 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white break-all">{job.wallet_address}</h3>
                      <p className="text-sm text-slate-400">Case ID: {job.case_id} • {job.blockchain}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${job.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm bg-slate-900/50 p-3 rounded-lg">
                    <div>
                      <span className="text-slate-500 block mb-1">Interval</span>
                      <span className="text-slate-300 font-medium">Every {job.interval_hours}h</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Next Run</span>
                      <span className="text-slate-300 font-medium">
                        {new Date(job.next_run).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleTogglePause(job)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${job.status === 'active' ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'}`}
                    >
                      {job.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {job.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleExecuteNow(job.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                    >
                      <Play className="w-4 h-4" /> Execute Now
                    </button>
                    <button
                      onClick={() => fetchHistory(job.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                    >
                      <History className="w-4 h-4" /> History
                    </button>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors ml-auto"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Execution History Panel */}
      {selectedJobId && selectedJobHistory && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" /> Execution History
            </h2>
            <button onClick={() => setSelectedJobId(null)} className="text-sm text-slate-400 hover:text-white">
              Close
            </button>
          </div>

          {selectedJobHistory.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No execution history available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Run At</th>
                    <th className="px-4 py-3">New TXs</th>
                    <th className="px-4 py-3">Balance Change</th>
                    <th className="px-4 py-3">Risk Change</th>
                    <th className="px-4 py-3">Alert</th>
                    <th className="px-4 py-3 rounded-tr-lg">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {selectedJobHistory.map((history, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(history.run_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{history.new_transactions}</td>
                      <td className="px-4 py-3">{history.balance_change}</td>
                      <td className="px-4 py-3">
                        <span className={history.risk_score_change > 0 ? 'text-red-400' : 'text-green-400'}>
                          {history.risk_score_change > 0 ? '+' : ''}{history.risk_score_change}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {history.alert_generated ? (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Yes</span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-full">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={history.summary}>
                        {history.summary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
