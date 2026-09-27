import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, Play, AlertCircle, Clock, FileText, ChevronRight, UserCheck, Activity, Eye, Download, Sparkles, RefreshCw, Building2 } from 'lucide-react';
import { api } from '../services/api';
import { Case, User, InvestigatorProfile, InvestigationRecommendation } from '../types';
import { ImportExternalCaseModal } from '../components/ImportExternalCaseModal';

interface InvestigatorDashboardPageProps {
  currentUser: User;
  onOpenCase: (caseId: string) => void;
}

export const InvestigatorDashboardPage: React.FC<InvestigatorDashboardPageProps> = ({
  currentUser,
  onOpenCase
}) => {
  const [profile, setProfile] = useState<InvestigatorProfile | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Recommendations modal
  const [selectedRecommendations, setSelectedRecommendations] = useState<{ caseId: string; recs: InvestigationRecommendation[] } | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profData, casesData] = await Promise.all([
        api.getMyInvestigatorProfile().catch(() => null),
        api.getCases()
      ]);
      setProfile(profData);
      // Filter cases assigned to current user or all cases if supervisor
      const assignedCases = casesData.filter(c => c.assigned_investigator_id === currentUser.id || !c.assigned_investigator_id);
      setCases(assignedCases.length > 0 ? assignedCases : casesData);
    } catch (err) {
      console.error('Failed to load investigator dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAvailabilityChange = async (newStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE') => {
    setUpdatingAvailability(true);
    try {
      const updated = await api.updateInvestigatorAvailability(newStatus);
      setProfile(updated);
    } catch (err: any) {
      alert('Failed to update availability: ' + err.message);
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const handleAcceptCase = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.acceptCase(caseId);
      await loadData();
    } catch (err: any) {
      alert('Failed to accept case: ' + err.message);
    }
  };

  const handleStartInvestigation = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.startInvestigation(caseId);
      await loadData();
      onOpenCase(caseId);
    } catch (err: any) {
      alert('Failed to start investigation: ' + err.message);
    }
  };

  const handleViewRecommendations = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingRecs(true);
    try {
      const res = await api.getCaseRecommendations(caseId);
      setSelectedRecommendations({ caseId, recs: res.recommendations });
    } catch (err: any) {
      alert('Failed to load recommendations: ' + err.message);
    } finally {
      setLoadingRecs(false);
    }
  };

  const pendingAcceptanceCases = cases.filter(c => c.status === 'ASSIGNED');
  const activeInvestigations = cases.filter(c => ['ACCEPTED', 'UNDER_INVESTIGATION', 'ANALYSIS_RUNNING', 'EVIDENCE_REVIEW'].includes(c.status));

  return (
    <div className="space-y-6">
      {/* Command Header & Readiness Bar */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] shadow-2xs">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Officer {currentUser.full_name || currentUser.username}
              </h2>
              {currentUser.badge_number && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {currentUser.badge_number}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {profile?.organization || 'State Police Cyber Cell'} • {profile?.department || 'Cryptocurrency Forensics Unit'}
            </p>
          </div>
        </div>

        {/* Quick Command Actions & Readiness Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 px-2 uppercase tracking-wider">Status:</span>
            {(['AVAILABLE', 'BUSY', 'OFFLINE'] as const).map((status) => {
              const currentStatus = profile?.availability_status || 'AVAILABLE';
              const isSelected = currentStatus === status;
              return (
                <button
                  key={status}
                  disabled={updatingAvailability}
                  onClick={() => handleAvailabilityChange(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? status === 'AVAILABLE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : status === 'BUSY'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Building2 className="w-4 h-4" />
            <span>Import FIR</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh Caseload"
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Pending Incoming Cases Notification Banner */}
      {pendingAcceptanceCases.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-[0_2px_10px_rgba(0,0,0,0.04)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h3 className="text-sm font-extrabold text-amber-900 tracking-tight">
                Incoming Assigned Complaints ({pendingAcceptanceCases.length})
              </h3>
            </div>
            <span className="text-[10px] text-amber-700 font-mono font-bold uppercase tracking-wider">Immediate Acceptance Required</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingAcceptanceCases.map((c) => (
              <div
                key={c.case_id}
                onClick={() => onOpenCase(c.case_id)}
                className="p-4 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-amber-800">{c.case_number || c.case_id}</span>
                      {c.origin === 'EXTERNAL_IMPORT' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          FIR: {c.external_reference || 'External'}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-extrabold text-slate-900">₹{c.amount_lost.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">{c.title || `Victim: ${c.unregistered_victim_name || c.victim_name || 'Complainant'}`}</p>
                  <p className="text-[11px] text-slate-500 mt-1 truncate font-mono">
                    Suspect: {c.suspect_wallet || 'Pending Tx resolution'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => handleAcceptCase(c.case_id, e)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all shadow-sm border border-emerald-200"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Accept Case
                  </button>
                  <button
                    onClick={(e) => handleStartInvestigation(c.case_id, e)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start Investigation
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THE BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Box 1: Large Metrics (2 cols wide) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200 shadow-[0_2px_15px_rgba(0,0,0,0.03)] flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-full blur-3xl -z-10 group-hover:scale-110 transition-transform duration-700 ease-out" />
          
          <div>
            <h3 className="text-sm font-semibold text-slate-500 tracking-tight">Total Value Traced</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                ₹{activeInvestigations.reduce((acc, c) => acc + c.amount_lost, 0).toLocaleString('en-IN')}
              </span>
              <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+14% this week</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Active Cases</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{activeInvestigations.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Success Rate</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">92.4%</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Avg. Resolution</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">4.2 <span className="text-sm text-slate-500 font-medium">days</span></p>
            </div>
          </div>
        </div>

        {/* Box 2: Quick Tools (1 col wide) */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-[0_2px_15px_rgba(0,0,0,0.03)] flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-50 to-blue-50/60 rounded-full blur-2xl -z-10 group-hover:scale-110 transition-transform duration-700 ease-out" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" /> AI Forensics Suite
              </h3>
              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 uppercase">
                Active Tools
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Automated intelligence triggers for immediate evidence freezing & visual clustering.
            </p>
          </div>

          <div className="space-y-2.5 mt-5">
            <button
              onClick={() => {
                if (activeInvestigations.length > 0) {
                  onOpenCase(activeInvestigations[0].case_id);
                } else if (cases.length > 0) {
                  onOpenCase(cases[0].case_id);
                } else {
                  setIsImportModalOpen(true);
                }
              }}
              className="w-full bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-2xl p-3 flex items-center justify-between text-left transition-all group/item shadow-2xs cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-slate-800 group-hover/item:text-blue-700 transition-colors">Generate Legal Notice</p>
                <p className="text-[10px] text-slate-500 font-medium">Section 94 BNSS & 91 CrPC</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover/item:text-blue-600 group-hover/item:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => {
                if (activeInvestigations.length > 0) {
                  onOpenCase(activeInvestigations[0].case_id);
                } else if (cases.length > 0) {
                  onOpenCase(cases[0].case_id);
                } else {
                  setIsImportModalOpen(true);
                }
              }}
              className="w-full bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 hover:border-blue-200 rounded-2xl p-3 flex items-center justify-between text-left transition-all group/item shadow-2xs cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-slate-800 group-hover/item:text-blue-700 transition-colors">Forensic Threat Graph</p>
                <p className="text-[10px] text-slate-500 font-medium">Multi-Hop Clustering & AI Intel</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover/item:text-blue-600 group-hover/item:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_2px_15px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Active Investigation Feed</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time status of your assigned caseload</p>
          </div>
        </div>

        {activeInvestigations.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No active cases</p>
            <p className="text-xs text-slate-400 mt-1">Accept a pending case above to begin</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeInvestigations.map((c) => (
              <div
                key={c.case_id}
                onClick={() => onOpenCase(c.case_id)}
                className="group p-4 sm:px-6 hover:bg-blue-50/50 transition-colors duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 group-hover:bg-blue-100 group-hover:border-blue-200 transition-colors">
                    <Shield className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] font-bold text-slate-500">{c.case_number || c.case_id}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
                        {c.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors tracking-tight">
                      {c.title || `Victim: ${c.unregistered_victim_name || c.victim_name || 'Complainant'}`}
                    </h4>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                      Target: {c.suspect_wallet ? `${c.suspect_wallet.substring(0, 16)}...` : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 pl-14 sm:pl-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-extrabold text-slate-900">₹{c.amount_lost.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">{c.blockchain}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleViewRecommendations(c.case_id, e)}
                      className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
                      title="AI Leads"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 shadow-sm transition-all flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations Modal */}
      {selectedRecommendations && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                   <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">AI Action Leads</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedRecommendations.caseId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecommendations(null)}
                className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {selectedRecommendations.recs.map((rec) => (
                <div key={rec.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-widest ${
                      rec.priority === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-700'
                        : rec.priority === 'HIGH'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {rec.priority} Priority
                    </span>
                    <span className="text-[10px] font-mono font-medium text-slate-400">{rec.id}</span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{rec.title}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rec.description}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 shadow-sm">
                    <span className="font-bold text-indigo-600 mr-2">Action Required:</span> 
                    {rec.suggested_action}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => {
                  const cId = selectedRecommendations.caseId;
                  setSelectedRecommendations(null);
                  onOpenCase(cId);
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-[0_2px_10px_rgba(37,99,235,0.2)]"
              >
                Open Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Case Import Modal */}
      <ImportExternalCaseModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(newCase) => {
          loadData();
          onOpenCase(newCase.case_id);
        }}
      />
    </div>
  );
};
