import React, { useState, useEffect } from 'react';
import { FolderLock, Plus, Search, Filter, ArrowRight, ShieldAlert, Building2, Link2 } from 'lucide-react';
import { Case, User } from '../types';
import { api } from '../services/api';
import { TruthBadge } from '../components/TruthBadge';
import { ImportExternalCaseModal } from '../components/ImportExternalCaseModal';

interface CasesPageProps {
  currentUser: User | null;
  onOpenCase: (caseId: string) => void;
  onCreateNewCase: () => void;
}

export const CasesPage: React.FC<CasesPageProps> = ({
  currentUser,
  onOpenCase,
  onCreateNewCase
}) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [caseSyndicates, setCaseSyndicates] = useState<Record<string, string>>({});
  const [syndicateFilterOnly, setSyndicateFilterOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const loadCases = async () => {
    setLoading(true);
    try {
      const [list, syndicates] = await Promise.all([
        api.getCases(),
        api.getSyndicates().catch(() => [])
      ]);
      setCases(list);
      const tagMap: Record<string, string> = {};
      if (Array.isArray(syndicates)) {
        syndicates.forEach((syn) => {
          if (syn.case_ids) {
            syn.case_ids.forEach((cid) => {
              tagMap[cid] = syn.syndicate_tag;
            });
          }
        });
      }
      setCaseSyndicates(tagMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const filteredCases = cases.filter((c) => {
    if (syndicateFilterOnly && !caseSyndicates[c.case_id]) {
      return false;
    }
    const victim = c.unregistered_victim_name || c.victim_name || '';
    const ref = c.complaint_reference || '';
    const extRef = c.external_reference || '';
    const suspect = c.suspect_wallet || '';
    const title = c.title || '';
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      victim.toLowerCase().includes(term) ||
      ref.toLowerCase().includes(term) ||
      extRef.toLowerCase().includes(term) ||
      suspect.toLowerCase().includes(term) ||
      title.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#1E293B] tracking-wide">
            Cryptocurrency Crime Case Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Active and resolved digital asset fraud complaints undergoing forensic tracing
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {(currentUser?.role === 'INVESTIGATOR' || currentUser?.role === 'SUPERVISOR' || currentUser?.role === 'ADMINISTRATOR') && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>Import Physical FIR</span>
            </button>
          )}

          <button
            onClick={onCreateNewCase}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Fraud Complaint / Case</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Victim, Complaint Ref, or Suspect Wallet Address..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSyndicateFilterOnly(!syndicateFilterOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              syndicateFilterOnly
                ? 'bg-red-50 text-red-700 border-red-300 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 text-red-600" />
            <span>Crime Rings ({Object.keys(caseSyndicates).length})</span>
          </button>

          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">NEW</option>
            <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
            <option value="EVIDENCE_REVIEW">EVIDENCE REVIEW</option>
            <option value="SUPERVISOR_REVIEW">SUPERVISOR REVIEW</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
      </div>

      {/* Case List */}
      <div className="space-y-3">
        {filteredCases.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 shadow-sm rounded-2xl text-slate-500 text-xs">
            No matching investigation cases found.
          </div>
        ) : (
          filteredCases.map((c) => (
            <div
              key={c.case_id}
              onClick={() => onOpenCase(c.case_id)}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-blue-400 cursor-pointer transition-all hover:shadow-md flex flex-wrap items-center justify-between gap-4 group"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl border ${
                  c.priority === 'CRITICAL'
                    ? 'bg-red-50 border-red-200 text-[#DC2626]'
                    : 'bg-blue-50 border-blue-200 text-[#2563EB]'
                }`}>
                  <FolderLock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1E293B] group-hover:text-blue-600 transition-colors">
                      {c.title || c.complaint_reference}
                    </span>
                    {c.origin === 'EXTERNAL_IMPORT' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-purple-600" />
                        <span>FIR: {c.external_reference || 'External Import'}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        App Filing
                      </span>
                    )}
                    {caseSyndicates[c.case_id] && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1 font-mono">
                        <Link2 className="w-3 h-3 text-red-600" />
                        <span>{caseSyndicates[c.case_id]}</span>
                      </span>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                      {c.blockchain}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      c.priority === 'CRITICAL'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {c.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-mono">
                    Suspect: <span className="text-red-600 font-semibold">{c.suspect_wallet || 'Pending address'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Victim: {c.unregistered_victim_name || c.victim_name || 'Walk-in Complainant'}{c.unregistered_victim_contact ? ` (${c.unregistered_victim_contact})` : ''} • Reported Loss: {Number(c.amount_lost || 0).toLocaleString()} {c.currency || 'ETH'} • Incident: {c.incident_date ? new Date(c.incident_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border uppercase ${
                    c.status === 'CLOSED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : c.status === 'SUPERVISOR_REVIEW'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {(c.status || 'NEW').replace(/_/g, ' ')}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    Created: {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* External Case Import Modal */}
      <ImportExternalCaseModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(newCase) => {
          loadCases();
          onOpenCase(newCase.case_id);
        }}
      />
    </div>
  );
};
