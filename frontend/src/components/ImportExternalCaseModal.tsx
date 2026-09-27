import React, { useState } from 'react';
import { X, Building2, User, Phone, Mail, FileText, DollarSign, Wallet, Calendar, AlertTriangle, ShieldCheck, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { Case } from '../types';
import { detectCurrencyType } from '../utils/currencyDetector';

interface ImportExternalCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedCase: Case) => void;
}

export const ImportExternalCaseModal: React.FC<ImportExternalCaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    victim_name: '',
    victim_contact: '',
    external_reference: '',
    title: '',
    amount_lost: '',
    currency: 'INR',
    incident_date: new Date().toISOString().split('T')[0],
    suspect_wallet: '',
    blockchain: 'Ethereum',
    transaction_hash: '',
    description: '',
    priority: 'HIGH'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.victim_name.trim()) {
      setError('Victim Full Name is required for physical walk-in reporting.');
      return;
    }
    if (!formData.external_reference.trim()) {
      setError('External Reference / FIR Number is required to cross-reference offline records.');
      return;
    }
    if (!formData.amount_lost || parseFloat(formData.amount_lost) <= 0) {
      setError('Please provide a valid reported financial loss amount.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        victim_name: formData.victim_name.trim(),
        victim_contact: formData.victim_contact.trim() || undefined,
        external_reference: formData.external_reference.trim(),
        title: formData.title.trim() || `Physical FIR: ${formData.victim_name.trim()}`,
        amount_lost: parseFloat(formData.amount_lost),
        currency: formData.currency,
        incident_date: formData.incident_date ? new Date(formData.incident_date).toISOString() : undefined,
        suspect_wallet: formData.suspect_wallet.trim() || undefined,
        blockchain: formData.blockchain,
        transaction_hash: formData.transaction_hash.trim() || undefined,
        description: formData.description.trim() || undefined,
        priority: formData.priority
      };

      const res = await api.importExternalCase(payload);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import external case. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>External Case Import</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Walk-In Cyber Desk
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Register physical crime reports from victims without an app account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Victim Details Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Complainant / Walk-In Victim</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Victim Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra Verma"
                  value={formData.victim_name}
                  onChange={(e) => setFormData({ ...formData, victim_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Victim Contact (Phone or Email)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210 or victim@email.com"
                  value={formData.victim_contact}
                  onChange={(e) => setFormData({ ...formData, victim_contact: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Reference & Loss Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Physical Cyber Cell Records</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  External FIR / GD Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FIR-2026-CYBER-8849"
                  value={formData.external_reference}
                  onChange={(e) => setFormData({ ...formData, external_reference: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Case Priority Level
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH (Standard Fraud)</option>
                  <option value="CRITICAL">CRITICAL (&gt; ₹10L or Active Flight)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount Lost <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 500000"
                    value={formData.amount_lost}
                    onChange={(e) => setFormData({ ...formData, amount_lost: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-[10px] font-bold text-slate-400">
                    {formData.currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USDT">USDT (Tether)</option>
                  <option value="ETH">ETH (Ethereum)</option>
                  <option value="BTC">BTC (Bitcoin)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Blockchain Suspect Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Wallet className="w-3.5 h-3.5 text-purple-600" />
              <span>Blockchain Evidence & Suspect Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Suspect Wallet Address
                  </label>
                  {(() => {
                    const det = detectCurrencyType(formData.suspect_wallet);
                    return det && det.isValid ? (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${det.badgeColor}`}>
                        <span>{det.symbol}</span>
                        <span className="opacity-75">• Auto</span>
                      </span>
                    ) : null;
                  })()}
                </div>
                <input
                  type="text"
                  placeholder="0x..., bc1..., 1..., 3..., T..., or Solana address"
                  value={formData.suspect_wallet}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    const det = detectCurrencyType(val);
                    let newChain = formData.blockchain;
                    if (det && det.isValid) {
                      if (det.symbol === 'BTC') newChain = 'Bitcoin';
                      else if (det.symbol === 'SOL') newChain = 'Solana';
                      else if (det.symbol === 'TRX') newChain = 'Tron';
                      else if (det.symbol === 'ETH' && !['Ethereum', 'Ethereum Sepolia', 'Polygon PoS', 'BNB Smart Chain'].includes(formData.blockchain)) {
                        newChain = 'Ethereum';
                      }
                    }
                    setFormData({ ...formData, suspect_wallet: val, blockchain: newChain });
                  }}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Blockchain Network
                </label>
                <select
                  value={formData.blockchain}
                  onChange={(e) => setFormData({ ...formData, blockchain: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold"
                >
                  <option value="Ethereum">Ethereum (Mainnet)</option>
                  <option value="Ethereum Sepolia">Ethereum Sepolia (Testnet)</option>
                  <option value="Bitcoin">Bitcoin (BTC)</option>
                  <option value="Solana">Solana (SOL)</option>
                  <option value="Tron">Tron (TRX / USDT TRC-20)</option>
                  <option value="Polygon PoS">Polygon PoS</option>
                  <option value="BNB Smart Chain">BNB Smart Chain</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction Hash (TxID)
                </label>
                <input
                  type="text"
                  placeholder="0x... fraudulent transfer transaction hash"
                  value={formData.transaction_hash}
                  onChange={(e) => setFormData({ ...formData, transaction_hash: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incident Date & Time
                </label>
                <input
                  type="date"
                  value={formData.incident_date}
                  onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Statement / Incident Narrative
              </label>
              <textarea
                rows={3}
                placeholder="Details of complaint recorded during walk-in interview..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition flex items-center gap-2"
            >
              {loading ? (
                <span>Registering Case...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Import & Register Case</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
