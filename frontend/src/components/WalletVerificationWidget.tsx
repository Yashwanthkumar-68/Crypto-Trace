import React, { useState } from 'react';
import {
  ShieldAlert, ShieldCheck, AlertOctagon, AlertTriangle, Search,
  CheckCircle2, HelpCircle, ArrowRight, ExternalLink, RefreshCw,
  Copy, Check, FileWarning, Info, PhoneCall
} from 'lucide-react';
import { api } from '../services/api';
import { WalletVerificationResponse } from '../types';
import { detectCurrencyType } from '../utils/currencyDetector';

interface WalletVerificationWidgetProps {
  onFileComplaint?: (walletAddress: string) => void;
  className?: string;
}

export const WalletVerificationWidget: React.FC<WalletVerificationWidgetProps> = ({
  onFileComplaint,
  className = ''
}) => {
  const [address, setAddress] = useState('');
  const [blockchain, setBlockchain] = useState('Ethereum');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WalletVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleVerify = async (targetAddress?: string) => {
    const addr = (targetAddress || address).trim();
    if (!addr) {
      setError('Please paste or enter a valid recipient wallet address');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyWallet({
        wallet_address: addr,
        blockchain
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Verification check failed. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTest = (testAddr: string) => {
    setAddress(testAddr);
    handleVerify(testAddr);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                Citizen Scam Pre-Check
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Verify Before You Send • Preventative Defense
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Pre-Transfer Suspect Wallet Verifier
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Asked to transfer money or crypto by an investment advisor, online acquaintance, or task group? Verify whether the recipient wallet is already under investigation or reported in cyber complaints before losing your money.
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 p-3 rounded-xl text-right">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">National Cyber Helpline</p>
              <p className="text-sm font-black text-amber-400 font-mono flex items-center justify-end gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                Dial 1930
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Input Bar & Controls */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <select
              value={blockchain}
              onChange={(e) => setBlockchain(e.target.value)}
              className="px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 shrink-0 text-slate-800"
            >
              <option value="Ethereum">Ethereum (ETH / ERC-20)</option>
              <option value="Bitcoin">Bitcoin (BTC)</option>
              <option value="Polygon">Polygon (MATIC)</option>
              <option value="BSC">BNB Chain (BSC / BEP-20)</option>
              <option value="Tron">Tron (TRX / TRC-20)</option>
              <option value="Solana">Solana (SOL)</option>
            </select>

            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setAddress(val);
                  setError(null);
                  const det = detectCurrencyType(val);
                  if (det && det.isValid) {
                    if (det.symbol === 'BTC') setBlockchain('Bitcoin');
                    else if (det.symbol === 'SOL') setBlockchain('Solana');
                    else if (det.symbol === 'TRX') setBlockchain('Tron');
                    else if (det.symbol === 'ETH' && !['Ethereum', 'Polygon', 'BSC'].includes(blockchain)) {
                      setBlockchain('Ethereum');
                    }
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="Paste recipient wallet address (e.g. 0x..., bc1..., T..., or Solana address)"
                className="w-full pl-10 pr-24 py-2.5 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-slate-900"
              />
              {(() => {
                const det = detectCurrencyType(address);
                return det && det.isValid ? (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${det.badgeColor}`}>
                      <span>{det.symbol}</span>
                      <span className="opacity-70 text-[9px] uppercase tracking-wider">Auto</span>
                    </span>
                  </div>
                ) : null;
              })()}
            </div>

            <button
              onClick={() => handleVerify()}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Verifying...' : 'Check Address'}</span>
            </button>
          </div>

          {/* Quick Demo Test Buttons for Hackathon Presentation */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
            <span className="font-semibold">Quick SIH Demo Tests:</span>
            <button
              onClick={() => handleQuickTest('0x742d35Cc6634C0532925a3b844Bc454e4438f44e')}
              className="px-2.5 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-mono font-medium transition-colors cursor-pointer"
            >
              🚨 Test Known Scam Syndicate Wallet
            </button>
            <button
              onClick={() => handleQuickTest('0x000000000000000000000000000000000000dead')}
              className="px-2.5 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-mono font-medium transition-colors cursor-pointer"
            >
              ℹ️ Test Unreported Fresh Address
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium pt-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              {error}
            </p>
          )}
        </div>

        {/* Verification Result Display */}
        {result && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {result.risk_tier === 'CRITICAL' ? (
              /* CRITICAL ALERT CARD */
              <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-2 border-red-500 shadow-xl text-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg animate-pulse shrink-0">
                      <AlertOctagon className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-red-500/30 text-red-300 border border-red-400/40 uppercase">
                        CRITICAL FRAUD ALERT — DO NOT TRANSFER
                      </span>
                      <h3 className="text-lg font-black text-white mt-0.5 tracking-tight">
                        {result.warning_title}
                      </h3>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-black text-red-400 font-mono">
                      {result.risk_score.toFixed(1)} / 100
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium uppercase">Danger Threat Rating</p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-red-200 leading-relaxed font-medium">
                  {result.warning_message}
                </p>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Police Complaints</p>
                    <p className="text-base font-black text-red-400 font-mono mt-0.5">
                      {result.complaint_count} Active Complaints
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Crime Syndicate Link</p>
                    <p className="text-base font-black text-purple-400 font-mono mt-0.5 truncate">
                      {result.syndicate_tag || 'Multi-Victim Ring'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Law Enforcement Action</p>
                    <p className="text-base font-black text-amber-400 font-mono mt-0.5">
                      Freeze Target
                    </p>
                  </div>
                </div>

                {/* Direct Action */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                    <span>Address: {result.wallet_address.slice(0, 16)}...{result.wallet_address.slice(-8)}</span>
                    <button
                      onClick={() => handleCopy(result.wallet_address)}
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                      title="Copy Address"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {onFileComplaint && (
                    <button
                      onClick={() => onFileComplaint(result.wallet_address)}
                      className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-900/40 transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                    >
                      <FileWarning className="w-4 h-4" />
                      <span>Report Coercion / File Cyber Complaint</span>
                    </button>
                  )}
                </div>
              </div>
            ) : result.risk_tier === 'HIGH' ? (
              /* HIGH RISK WARNING */
              <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-400 shadow-sm space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                      HIGH RISK PATTERN DETECTED
                    </span>
                    <h3 className="text-base font-black text-amber-950 mt-0.5">
                      {result.warning_title}
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {result.warning_message}
                </p>
              </div>
            ) : (
              /* UNREPORTED ADDRESS NOTICE (NO GREEN 'SAFE' TRAP) */
              <div className="p-6 rounded-2xl bg-slate-50 border-2 border-amber-300/80 shadow-sm space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-700 shrink-0">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                      UNREPORTED ADDRESS — EXERCISE EXTREME CAUTION
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      {result.warning_title}
                    </h3>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-amber-200 text-xs text-slate-700 leading-relaxed space-y-2">
                  <p className="font-semibold text-amber-900">
                    {result.warning_message}
                  </p>
                  <p className="text-slate-600">
                    Scammers frequently generate a fresh cryptocurrency wallet for every individual victim to avoid triggering automated blacklists. Before sending any money, verify the 5 critical red flags below.
                  </p>
                </div>
              </div>
            )}

            {/* Anti-Fraud Citizen Checklist */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                Cyber Crime Prevention Checklist — Look for These 5 Red Flags:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                {result.safety_checklist.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-slate-200/80">
                    <span className="w-5 h-5 rounded-full bg-red-50 text-red-600 border border-red-200 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      !
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
