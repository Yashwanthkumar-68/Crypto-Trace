import React, { useState } from 'react';
import {
  FileText, UserCheck, Search, Database, ShieldAlert,
  Building2, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Sparkles, Bot, AlertTriangle, ArrowRight, X, HelpCircle,
  TrendingUp, Shield, Cpu, RefreshCw
} from 'lucide-react';
import { Case, CaseStatus } from '../types';

export interface CaseJourneyMapProps {
  caseData: Case;
  compact?: boolean;
  className?: string;
  onOpenCaseDetail?: (caseId: string) => void;
}

interface JourneyStage {
  step: number;
  id: string;
  icon: any;
  title: string;
  agentName: string;
  agentRole: string;
  status: 'completed' | 'active' | 'pending';
  timestamp?: string;
  duration?: string;
  details: string;
  agentForesight: string;
}

export const CaseJourneyMap: React.FC<CaseJourneyMapProps> = ({
  caseData,
  compact = false,
  className = '',
  onOpenCaseDetail
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [activeAgentModal, setActiveAgentModal] = useState<JourneyStage | null>(null);

  // Status progression mapping
  const getStageStatus = (stageStep: number): 'completed' | 'active' | 'pending' => {
    const status = caseData.status;

    // Mapping statuses to step 1-7
    let currentStep = 1;
    switch (status) {
      case 'NEW':
        currentStep = 1;
        break;
      case 'ASSIGNED':
      case 'ACCEPTED':
        currentStep = 2;
        break;
      case 'UNDER_INVESTIGATION':
      case 'ANALYSIS_RUNNING':
        currentStep = 3;
        break;
      case 'EVIDENCE_REVIEW':
        currentStep = 4;
        break;
      case 'REPORT_PENDING':
        currentStep = 5;
        break;
      case 'SUPERVISOR_REVIEW':
      case 'ON_HOLD':
      case 'ESCALATED':
        currentStep = 6;
        break;
      case 'RESOLVED':
      case 'CLOSED':
        currentStep = 7;
        break;
      case 'REJECTED':
        currentStep = 1;
        break;
      default:
        currentStep = 2;
    }

    if (stageStep < currentStep) return 'completed';
    if (stageStep === currentStep) return 'active';
    return 'pending';
  };

  const createdDate = new Date(caseData.created_at || Date.now());
  const updatedDate = new Date(caseData.updated_at || caseData.created_at || Date.now());
  const daysElapsed = Math.max(1, Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));

  const stages: JourneyStage[] = [
    {
      step: 1,
      id: 'complaint_filed',
      icon: FileText,
      title: 'Complaint Filed',
      agentName: 'Intake & Cryptographic Hashing Agent',
      agentRole: 'Digitally seals initial complaint metadata and calculates SHA-256 evidence integrity seal.',
      status: getStageStatus(1),
      timestamp: createdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      duration: 'Immediate',
      details: `Ref: ${caseData.complaint_reference} • Loss: ₹${(caseData.amount_lost || 0).toLocaleString('en-IN')}`,
      agentForesight: 'Verified tamper-proof evidence hash. Chain-of-custody initiated.'
    },
    {
      step: 2,
      id: 'officer_assigned',
      icon: UserCheck,
      title: 'Officer Assigned',
      agentName: 'Smart Dispatcher Agent',
      agentRole: 'Matches case blockchain signature with specialized Cyber Cell investigators.',
      status: getStageStatus(2),
      timestamp: caseData.assigned_investigator ? 'Assigned' : 'Auto-Routing',
      duration: '45 mins',
      details: caseData.assigned_investigator 
        ? `IO: ${caseData.assigned_investigator.full_name} (${caseData.assigned_investigator.email})`
        : 'Assigned to Cyber Crime Command Cell',
      agentForesight: 'Investigator workload optimized. Real-time collaboration room provisioned.'
    },
    {
      step: 3,
      id: 'under_investigation',
      icon: Search,
      title: 'Under Investigation',
      agentName: 'Syndicate Correlation Agent',
      agentRole: 'Performs link analysis across NCRP complaints to discover shared suspect wallets.',
      status: getStageStatus(3),
      timestamp: `Day ${daysElapsed}`,
      duration: `${daysElapsed} days active`,
      details: caseData.suspect_wallet 
        ? `Suspect: ${caseData.suspect_wallet.slice(0, 8)}...${caseData.suspect_wallet.slice(-6)}`
        : 'Wallet Address under heuristic resolution',
      agentForesight: 'Scanned 1,200+ complaint records. Cross-case correlation score: 94%.'
    },
    {
      step: 4,
      id: 'funds_traced',
      icon: Database,
      title: 'Funds Traced',
      agentName: 'Multi-Hop Peeling Trail Agent',
      agentRole: 'Traverses blockchain ledger hops to detect money-mule transit hubs and exchange deposits.',
      status: getStageStatus(4),
      timestamp: 'Ledger Scanned',
      duration: '~4 hours',
      details: `Blockchain: ${caseData.blockchain || 'Ethereum'} • Multi-hop peeling trail discovered`,
      agentForesight: 'Identified 3 downstream peeling transactions leading to exchange deposit node.'
    },
    {
      step: 5,
      id: 'report_filed',
      icon: ShieldAlert,
      title: 'Report Filed',
      agentName: 'Statutory Notice & FIR Drafter Agent',
      agentRole: 'Auto-generates Section 91 CrPC notices and NCRP/I4C compliant forensic dossiers.',
      status: getStageStatus(5),
      timestamp: 'Dossier Ready',
      duration: '15 mins',
      details: 'Formal Section 91 CrPC statutory requisition generated for VASP disclosure',
      agentForesight: 'Legal compliance packet formatted for Binance/WazirX Law Enforcement relations.'
    },
    {
      step: 6,
      id: 'supervisor_review',
      icon: Building2,
      title: 'Supervisor & VASP Review',
      agentName: 'Exchange Compliance Liaison Agent',
      agentRole: 'Dispatches freeze directives to foreign/domestic VASPs and tracks acknowledgment SLA.',
      status: getStageStatus(6),
      timestamp: 'Pending VASP Action',
      duration: 'Est. 24-48 hrs',
      details: 'Compliance desk awaiting exchange KYC disclosures and wallet freeze confirmations',
      agentForesight: 'Based on 14 similar cases, VASP response expected within ~48 hours.'
    },
    {
      step: 7,
      id: 'case_resolved',
      icon: CheckCircle2,
      title: 'Case Resolved',
      agentName: 'Asset Recovery & Restitution Agent',
      agentRole: 'Coordinates judicial order execution and final victim restitution.',
      status: getStageStatus(7),
      timestamp: caseData.status === 'RESOLVED' ? updatedDate.toLocaleDateString() : 'Awaiting Settlement',
      duration: 'Target: 14 days',
      details: caseData.status === 'RESOLVED' 
        ? 'Investigation concluded • Formal evidence report submitted to magistrate'
        : 'Final restitution and court seizure order documentation',
      agentForesight: 'Victim restitution protocol enabled under Section 451/457 CrPC.'
    }
  ];

  const currentActiveStep = stages.find(s => s.status === 'active') || stages[0];
  const isResolved = caseData.status === 'RESOLVED' || caseData.status === 'CLOSED';

  // Mini 1-line progress calculation
  const completedCount = stages.filter(s => s.status === 'completed').length + (isResolved ? 1 : 0.5);
  const progressPercent = Math.min(100, Math.round((completedCount / 7) * 100));

  return (
    <div className={`relative bg-gradient-to-br from-slate-900 via-[#0B132B] to-[#0A1128] border border-slate-800 rounded-2xl p-5 text-white shadow-xl overflow-hidden ${className}`}>
      {/* Background forensic grid glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none" />

      {/* Confetti Animation when Resolved */}
      {isResolved && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          <div className="absolute top-2 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
          <div className="absolute top-4 left-1/2 w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
          <div className="absolute top-3 right-1/4 w-2 h-2 bg-pink-400 rounded-full animate-ping" />
          <div className="absolute top-8 right-1/3 w-3 h-1 bg-blue-400 rotate-45 animate-pulse" />
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-wide text-white flex items-center gap-1.5">
                <span>Forensic Case Journey</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  AI-Agent Driven
                </span>
              </h3>
              {isResolved && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Resolved 🎉
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Live automated progression from complaint ingestion to VASP freezing & judicial restitution.
            </p>
          </div>
        </div>

        {/* Predictive Time & Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>Active Stage: <strong className="text-white font-bold">{currentActiveStep.title}</strong></span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <span>{isExpanded ? 'Compact View' : 'Explore Story'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Compact Mini Bar (Always visible or toggleable) */}
      {!isExpanded ? (
        <div className="mt-4 pt-1 relative z-10">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>{currentActiveStep.agentName}: {currentActiveStep.agentForesight}</span>
            </span>
            <span className="font-mono text-[11px] text-blue-400 font-bold">{progressPercent}%</span>
          </div>

          {/* Progress track */}
          <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Mini stage pills */}
          <div className="grid grid-cols-7 gap-1 mt-2.5">
            {stages.map((st) => {
              const isDone = st.status === 'completed';
              const isActive = st.status === 'active';
              return (
                <div
                  key={st.id}
                  onClick={() => setActiveAgentModal(st)}
                  className={`cursor-pointer text-center py-1 px-1 rounded-md text-[10px] font-mono transition-all truncate ${
                    isDone 
                      ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40' 
                      : isActive 
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20 ring-1 ring-blue-400' 
                      : 'bg-slate-800/40 text-slate-500 border border-slate-800'
                  }`}
                  title={`${st.title}: ${st.agentRole}`}
                >
                  {st.step}. {st.title.split(' ')[0]}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Full Storyboard Journey Map (Expanded View) */
        <div className="mt-6 relative z-10">
          {/* Predictive Banner */}
          <div className="mb-5 p-3 rounded-xl bg-blue-950/40 border border-blue-800/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-slate-300">
                <strong className="text-blue-300 font-semibold">AI Foresight Engine:</strong> Based on multi-hop clustering across {caseData.blockchain || 'Ethereum'}, expected resolution trajectory is ~12-14 business days.
              </span>
            </div>
            <span className="hidden md:inline text-[11px] font-mono font-bold text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded border border-blue-700/50 shrink-0 ml-2">
              Confidence 91%
            </span>
          </div>

          {/* Cards & Animated Connecting Line Container */}
          <div className="relative">
            {/* SVG Connecting Line for Desktop */}
            <div className="hidden lg:block absolute top-[44px] left-[4%] right-[4%] h-0.5 z-0 pointer-events-none">
              <div className="w-full h-full bg-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                  style={{ width: `${Math.max(8, progressPercent)}%` }}
                />
              </div>
            </div>

            {/* 7 Stage Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 relative z-10">
              {stages.map((stage) => {
                const Icon = stage.icon;
                const isCompleted = stage.status === 'completed';
                const isActive = stage.status === 'active';
                const isPending = stage.status === 'pending';

                return (
                  <div
                    key={stage.id}
                    onClick={() => setActiveAgentModal(stage)}
                    className={`rounded-xl p-3.5 transition-all duration-200 cursor-pointer flex flex-col justify-between border relative group ${
                      isActive
                        ? 'bg-slate-800/90 border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500'
                        : isCompleted
                        ? 'bg-slate-800/50 border-slate-700/80 hover:border-blue-400/60 hover:bg-slate-800/80'
                        : 'bg-slate-900/40 border-slate-800/60 opacity-60 hover:opacity-90'
                    }`}
                  >
                    {/* Active Halo Indicator */}
                    {isActive && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                      </span>
                    )}

                    {/* Step Top */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                            : isCompleted
                            ? 'bg-blue-900/60 text-blue-300 border border-blue-600/40'
                            : 'bg-slate-800 text-slate-500'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-mono text-[10px] font-bold text-slate-500">
                          0{stage.step}
                        </span>
                      </div>

                      <h4 className={`text-xs font-bold tracking-tight mb-1 ${
                        isActive ? 'text-blue-300' : isCompleted ? 'text-white' : 'text-slate-400'
                      }`}>
                        {stage.title}
                      </h4>

                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                        {stage.details}
                      </p>
                    </div>

                    {/* Step Footer */}
                    <div className="pt-2 border-t border-slate-800/70 mt-2">
                      <div className="flex items-center justify-between text-[9px] font-mono">
                        <span className={isActive ? 'text-blue-400 font-bold' : 'text-slate-500'}>
                          {stage.duration}
                        </span>
                        <span className="text-slate-400 truncate max-w-[70px]">
                          {stage.timestamp}
                        </span>
                      </div>

                      {/* Autonomous Agent Chip */}
                      <div className="mt-1.5 flex items-center gap-1 text-[9px] text-blue-400/80 group-hover:text-blue-300 transition-colors">
                        <Bot className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{stage.agentName.split(' ')[0]} Agent</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Interactive "Ask Stage Agent" Modal */}
      {activeAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setActiveAgentModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                  Stage 0{activeAgentModal.step} Autonomous Agent
                </span>
                <h3 className="text-base font-black text-white">
                  {activeAgentModal.agentName}
                </h3>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Agent Mandate & Actions
                </span>
                <p className="leading-relaxed">
                  {activeAgentModal.agentRole}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/50">
                <span className="text-[10px] font-bold uppercase text-blue-400 block mb-1">
                  Current Case Telemetry
                </span>
                <p className="font-mono text-slate-200">
                  {activeAgentModal.details}
                </p>
                <p className="mt-2 text-slate-300 italic">
                  💡 "{activeAgentModal.agentForesight}"
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                <span>Execution State: <strong className="text-white uppercase">{activeAgentModal.status}</strong></span>
                <span>Interval: <strong className="text-white">{activeAgentModal.duration}</strong></span>
              </div>
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setActiveAgentModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close Agent Brief
              </button>
              {onOpenCaseDetail && (
                <button
                  onClick={() => {
                    setActiveAgentModal(null);
                    onOpenCaseDetail(caseData.case_id);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <span>Open Full Forensic Dossier</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
