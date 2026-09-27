import React, { useState } from 'react';
import { Search, ShieldAlert, ArrowRight, RefreshCw, Building, Database } from 'lucide-react';
import { api } from '../services/api';
import { TruthBadge } from '../components/TruthBadge';
import { TransactionGraph } from '../components/TransactionGraph';
import { RiskBreakdown } from '../components/RiskBreakdown';
import { PriorityWalletTable } from '../components/PriorityWalletTable';
import { detectCurrencyType } from '../utils/currencyDetector';

interface WalletAnalysisPageProps {
  initialAddress?: string;
}

export const WalletAnalysisPage: React.FC<WalletAnalysisPageProps> = ({ initialAddress }) => {
  const [address, setAddress] = useState(initialAddress || '0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97');
  const [blockchain, setBlockchain] = useState('Ethereum');
  const [detectedCurrency, setDetectedCurrency] = useState(detectCurrencyType(initialAddress || '0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97'));
  const [hops, setHops] = useState(2);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddressChange = (val: string) => {
    setAddress(val);
    const detected = detectCurrencyType(val);
    setDetectedCurrency(detected);

    if (detected.currency === 'BTC') {
      setBlockchain('Bitcoin');
    } else if (detected.currency === 'SOL') {
      setBlockchain('Solana');
    } else if (detected.currency === 'TRX') {
      setBlockchain('Tron');
    } else if (detected.currency === 'EVM' && (blockchain === 'Bitcoin' || blockchain === 'Solana' || blockchain === 'Tron')) {
      setBlockchain('Ethereum');
    }
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.analyzeWallet(address.trim(), blockchain, hops);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Please check address format.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-[#1E293B] tracking-wide">
          Direct Blockchain Wallet Forensics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Multi-chain forensic intelligence supporting Ethereum, Bitcoin, Solana, Tron, Polygon, and BNB Smart Chain
        </p>
      </div>

      {/* Search Bar Form */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 text-[#1E293B]">
        <form onSubmit={handleAnalyze} className="flex flex-wrap items-end gap-3 text-xs">
          <div className="flex-1 min-w-[280px]">
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-semibold block">
                Target Suspect Wallet Address
              </label>
              {address.trim() && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${detectedCurrency.badgeStyle}`}>
                  {detectedCurrency.symbol} • {detectedCurrency.networkName}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Paste address (0x... EVM, bc1... Bitcoin, Solana Base58, Tron T...)"
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#1E293B] font-mono focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="w-52">
            <label className="text-slate-700 font-semibold block mb-1">Blockchain Network</label>
            <select
              value={blockchain}
              onChange={(e) => setBlockchain(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
            >
              <option value="Ethereum">Ethereum (Sepolia / Mainnet)</option>
              <option value="Bitcoin">Bitcoin Mainnet (BTC)</option>
              <option value="Solana">Solana Mainnet (SOL)</option>
              <option value="Tron">Tron Mainnet (TRX / TRC-20)</option>
              <option value="Polygon">Polygon PoS (POL)</option>
              <option value="BNB Smart Chain">BNB Smart Chain (BNB)</option>
            </select>
          </div>

          <div className="w-28">
            <label className="text-slate-700 font-semibold block mb-1">Hop Depth</label>
            <select
              value={hops}
              onChange={(e) => setHops(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
            >
              <option value={1}>1 Hop</option>
              <option value={2}>2 Hops</option>
              <option value={3}>3 Hops</option>
              <option value={5}>5 Hops</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? 'Tracing Nodes...' : 'Analyze Wallet'}</span>
          </button>
        </form>


        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Analysis Results View */}
      {result && (
        <div className="space-y-6">
          {/* Summary Stat Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-slate-500">Target Address</p>
              <p className="text-xs font-mono font-bold text-[#1E293B] mt-1 truncate">
                {result.address}
              </p>
              <span className="text-[10px] text-blue-700 font-semibold">{result.label}</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-slate-500">Total Volume Inflow</p>
              <p className="text-xl font-mono font-black text-emerald-600 mt-1">
                +{result.total_incoming} ETH
              </p>
              <p className="text-[10px] text-slate-400">From downstream counterparties</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-slate-500">Total Volume Outflow</p>
              <p className="text-xl font-mono font-black text-red-600 mt-1">
                -{result.total_outgoing} ETH
              </p>
              <p className="text-[10px] text-slate-400">Dispersed to peeling wallets</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-slate-500">Risk Assessment</p>
              <p className="text-xl font-mono font-black text-[#1E293B] mt-1">
                {result.risk_score} / 100
              </p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                result.risk_level === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {result.risk_level}
              </span>
            </div>
          </div>

          {/* Interactive Graph */}
          {result.subgraph && (
            <TransactionGraph
              data={result.subgraph}
              selectedHop={hops}
              onHopChange={(h) => {
                setHops(h);
                handleAnalyze();
              }}
              suspiciousOnly={false}
              onToggleSuspiciousOnly={() => {}}
              onInspectWallet={(addr) => {
                setAddress(addr);
                handleAnalyze();
              }}
            />
          )}

          {/* Risk Breakdown Component */}
          <RiskBreakdown
            assessment={{
              score: result.risk_score,
              level: result.risk_level,
              title: 'Investigation Risk Score',
              reasons: result.reasons,
              disclaimer: result.disclaimer
            }}
            mlAssessment={result.ml_assessment}
          />

          {/* Priority Wallets Table */}
          {result.priority_wallets && (
            <PriorityWalletTable
              wallets={result.priority_wallets}
              onInspectWallet={(addr) => {
                setAddress(addr);
                handleAnalyze();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
