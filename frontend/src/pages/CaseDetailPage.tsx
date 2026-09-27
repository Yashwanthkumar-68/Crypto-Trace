import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Shield, Clock, Database, Cpu, Brain, CheckSquare,
  Network, GitCommit, AlertTriangle, Eye, FileText, History,
  Plus, ExternalLink, RefreshCw, Send, CheckCircle2, Building2,
  Link2, Users, AlertOctagon, TrendingUp, Layers, ChevronRight, Fingerprint,
  Scale, FileCheck2, ChevronDown, Activity, AlertCircle
} from 'lucide-react';
import {
  Case, Transaction, SubgraphData, MoneyTrailPath,
  RiskAssessment, RiskFinding, EvidenceItem, MonitoredWallet,
  ReportData, AuditLogItem, User, CaseSyndicateIntelResponse
} from '../types';
import { api } from '../services/api';
import { TruthBadge } from '../components/TruthBadge';
import { TransactionGraph } from '../components/TransactionGraph';
import { ThreatGraph } from '../components/ThreatGraph';
import { MoneyTrailTimeline } from '../components/MoneyTrailTimeline';
import { RiskBreakdown } from '../components/RiskBreakdown';
import { PriorityWalletTable } from '../components/PriorityWalletTable';
import { CopilotDrawer } from '../components/CopilotDrawer';
import { EvidenceLocker } from '../components/EvidenceLocker';
import { ReportViewer } from '../components/ReportViewer';
import { UnifiedTimeline } from '../components/UnifiedTimeline';
import { GeoMap } from '../components/GeoMap';
import { CollaborationPanel } from '../components/CollaborationPanel';
import { CaseJourneyMap } from '../components/CaseJourneyMap';
import { RequireRole } from '../components/auth/RequireRole';
import { AdvancedForensicsPanel } from '../components/forensics/AdvancedForensicsPanel';

interface CaseDetailPageProps {
  caseId: string;
  currentUser: User | null;
  onBack: () => void;
  onInspectWallet: (address: string) => void;
  onOpenCase?: (caseId: string) => void;
}

type TabType =
  | 'overview'
  | 'syndicate'
  | 'visual'
  | 'timeline'
  | 'graph'
  | 'trail'
  | 'risk'
  | 'patterns'
  | 'cross_chain'
  | 'evidence'
  | 'copilot'
  | 'monitoring'
  | 'reports'
  | 'audit'
  | 'geo'
  | 'collaboration';

export const CaseDetailPage: React.FC<CaseDetailPageProps> = ({
  caseId,
  currentUser,
  onBack,
  onInspectWallet,
  onOpenCase
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [graphData, setGraphData] = useState<SubgraphData | null>(null);
  const [trailData, setTrailData] = useState<any>(null);
  const [riskData, setRiskData] = useState<{ risk_assessment: RiskAssessment; findings: RiskFinding[] } | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [monitoredList, setMonitoredList] = useState<MonitoredWallet[]>([]);
  const [reportsList, setReportsList] = useState<ReportData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [selectedHops, setSelectedHops] = useState(3);
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [exportingNcrp, setExportingNcrp] = useState(false);
  const [showSection91Modal, setShowSection91Modal] = useState(false);
  const [allowedTransitions, setAllowedTransitions] = useState<string[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [transitioningStatus, setTransitioningStatus] = useState(false);
  const [auditVerification, setAuditVerification] = useState<any>(null);
  const [verifyingAudit, setVerifyingAudit] = useState(false);
  const [syndicateIntel, setSyndicateIntel] = useState<CaseSyndicateIntelResponse | null>(null);
  const [scanningLinks, setScanningLinks] = useState(false);
  const [graphViewMode, setGraphViewMode] = useState<'force' | 'hierarchical'>('force');
  const [showLegalActionsMenu, setShowLegalActionsMenu] = useState(false);

  const loadCaseFull = async () => {
    setLoading(true);
    try {
      const [
        c,
        txs,
        g,
        trail,
        pats,
        evs,
        mon,
        reps,
        audits,
        notesData,
        wsData,
        intel
      ] = await Promise.all([
        api.getCase(caseId).catch(() => null),
        api.getCaseTransactions(caseId).catch(() => []),
        api.getGraph(caseId, selectedHops, suspiciousOnly).catch(() => null),
        api.getMoneyTrail(caseId, 5).catch(() => null),
        api.getPatterns(caseId).catch(() => null),
        api.getEvidence(caseId).catch(() => []),
        api.getMonitoredWallets(caseId).catch(() => []),
        api.getReports(caseId).catch(() => []),
        api.getAuditLogs(caseId).catch(() => []),
        api.getCaseNotes(caseId).catch(() => []),
        api.getCaseWorkspace(caseId).catch(() => null),
        api.getCaseLinks(caseId).catch(() => null)
      ]);

      setCaseData(c);
      setTransactions(txs || []);
      setGraphData(g);
      setTrailData(trail);
      setRiskData(pats);
      setEvidenceList(evs || []);
      setMonitoredList(mon || []);
      setReportsList(reps || []);
      setAuditLogs(audits || []);
      setNotes(notesData || []);
      setSyndicateIntel(intel);
      if (wsData?.allowed_transitions && wsData.allowed_transitions.length > 0) {
        setAllowedTransitions(wsData.allowed_transitions);
        setSelectedTransition(wsData.allowed_transitions[0]);
      } else {
        const defaultTransitions = ['UNDER_INVESTIGATION', 'EVIDENCE_REVIEW', 'SUPERVISOR_REVIEW', 'ON_HOLD', 'RESOLVED', 'CLOSED'];
        setAllowedTransitions(defaultTransitions);
        setSelectedTransition(defaultTransitions[0]);
      }
    } catch (err) {
      console.error('Failed to load case full details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanLinks = async () => {
    setScanningLinks(true);
    try {
      const updatedIntel = await api.scanCaseLinks(caseId);
      setSyndicateIntel(updatedIntel);
      // Reload workspace and timeline for freshly created syndicate events
      loadCaseFull();
    } catch (err: any) {
      alert(err.message || 'Failed to scan cross-case links');
    } finally {
      setScanningLinks(false);
    }
  };

  const handleExportNcrp = async () => {
    setExportingNcrp(true);
    try {
      const data = await api.exportCaseNcrp(caseId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NCRP_${caseId}_Dossier.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export NCRP dossier: ' + err.message);
    } finally {
      setExportingNcrp(false);
    }
  };

  const [generatingSubpoena, setGeneratingSubpoena] = useState(false);

  const handleDownloadSubpoena = async (walletAddress?: string) => {
    const targetWallet = walletAddress || caseData?.suspect_wallet;
    if (!targetWallet) {
      alert('No target wallet address specified for Section 94 BNSS Subpoena.');
      return;
    }
    setGeneratingSubpoena(true);
    try {
      const blob = await api.downloadSubpoena(caseId, targetWallet);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanShort = targetWallet.length >= 10 ? targetWallet.slice(0, 10) : targetWallet;
      a.download = `Subpoena_Sec94_BNSS_${caseId}_${cleanShort}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to generate Section 94 BNSS Subpoena: ' + err.message);
    } finally {
      setGeneratingSubpoena(false);
    }
  };

  const handleDownloadSection91Notice = () => {
    if (!caseData) return;
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const noticeContent = `================================================================================
OFFICE OF THE SUPERINTENDENT OF POLICE / CYBER CRIME INVESTIGATION CELL
FORMAL NOTICE UNDER SECTION 91 OF THE CODE OF CRIMINAL PROCEDURE, 1973 (CrPC)
================================================================================

Date of Issue: ${dateStr}
Notice Reference: SEC91/CYBER/${caseData.case_id}/2026
Case Reference: ${caseData.case_id} • Complaint Ref: ${caseData.complaint_reference || 'N/A'}

TO:
The Compliance Officer / Head of Legal & Law Enforcement Relations
Binance / Identified Cryptocurrency Exchange (VASP)
Global Regulatory Compliance Desk

SUBJECT: URGENT STATUTORY NOTICE UNDER SECTION 91 CrPC FOR ACCOUNT FREEZING, 
         KYC DISCLOSURE, AND TRANSACTION RECORD PRESERVATION IN CONNECTION 
         WITH CYBER FINANCIAL FRAUD INVESTIGATION.

Sir / Madam,

WHEREAS an investigation into a criminal case under Sections 419, 420 of the 
Indian Penal Code (IPC) and Section 66D of the Information Technology Act, 2000, 
is presently underway regarding the fraudulent diversion of cryptocurrency funds 
belonging to complainant: ${caseData.victim_name || 'Victim Complainant'}.

AND WHEREAS automated multi-hop blockchain ledger analytics conducted by the 
Cyber Crime Forensics Division has established an unbroken, deterministic chain of 
custody linking the stolen funds directly to your exchange deposit infrastructure:

1. INCIDENT & VICTIM LOSS DETAILS:
   - Reported Fraud Loss: ₹${(caseData.amount_lost || 500000).toLocaleString('en-IN')} (${caseData.currency || 'INR'})
   - Blockchain Network: ${caseData.blockchain || 'Ethereum'}
   - Initial Victim Transaction Hash: ${caseData.transaction_hash || 'N/A'}
   - Suspect Origin Wallet: ${caseData.suspect_wallet || 'N/A'}

2. FORENSIC MONEY TRAIL & IDENTIFIED NEXUS EXCHANGE:
   - Destination VASP: Binance 14 Hot Wallet / Identified Exchange Deposit
   - Destination Deposit Address: 0x28c6c06298d514db089934071355e5743bf21d60
   - Multi-Hop Path: Victim -> Suspect Intake (A) -> Peeling Hub (B) -> Mule Transit (F) -> Consolidator (G) -> Exchange Deposit
   - Terminal Deposit Amount: 1.15 ETH
   - Forensic Integrity Seal: SHA256-AUTHENTICATED-EVIDENCE-PACKET

YOU ARE HEREBY REQUIRED AND DIRECTED UNDER SECTION 91 OF THE CrPC TO:
1. IMMEDIATELY FREEZE and place a restrictive hold upon the user account(s), 
   sub-accounts, UID, and internal ledgers associated with deposit address 
   0x28c6c06298d514db089934071355e5743bf21d60.
2. FURNISH COMPLETE KYC/AML IDENTIFIERS within 48 hours of receipt of this notice, 
   including:
   a. Full Name, Registered Email Address, Phone Number, and Government ID (Passport / Aadhaar / National ID).
   b. Complete IP Access Logs with timestamps and port numbers for all logins and withdrawals.
   c. Associated fiat bank accounts, card numbers, or P2P payment records linked to this account.
3. PRESERVE ALL DIGITAL AUDIT TRAILS, order book trades, and internal transfer history.

Failure to comply with this statutory demand constitutes an offense punishable under 
Section 175 and Section 204 of the Indian Penal Code (IPC).

Issued by:
CYBER CRIME INVESTIGATION DIVISION
Specialized Law Enforcement Forensic Unit
================================================================================`;

    const blob = new Blob([noticeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Section_91_CrPC_Notice_${caseData.case_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransition) return;
    setTransitioningStatus(true);
    try {
      await api.updateCaseStatus(caseId, selectedTransition, statusNote || undefined);
      setShowStatusModal(false);
      setStatusNote('');
      await loadCaseFull();
    } catch (err: any) {
      alert(err.message || 'Failed to update case status');
    } finally {
      setTransitioningStatus(false);
    }
  };

  const handleVerifyAudit = async () => {
    setVerifyingAudit(true);
    try {
      const res = await api.verifyAuditIntegrity();
      setAuditVerification(res);
    } catch (err: any) {
      alert(err.message || 'Failed to verify audit logs');
    } finally {
      setVerifyingAudit(false);
    }
  };

  useEffect(() => {
    loadCaseFull();
  }, [caseId, selectedHops, suspiciousOnly]);

  useEffect(() => {
    if (currentUser?.role === 'VICTIM' && !['overview', 'timeline', 'evidence'].includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [currentUser, activeTab]);

  const handleHopChange = (h: number) => {
    setSelectedHops(h);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      await api.addCaseNote(caseId, newNote);
      setNewNote('');
      const updatedNotes = await api.getCaseNotes(caseId);
      setNotes(updatedNotes);
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const newRep = await api.generateReport(caseId, `Forensic Crypto Investigation Report: ${caseData?.complaint_reference}`);
      setReportsList((prev) => [newRep, ...prev]);
      setActiveTab('reports');
    } catch (err: any) {
      alert(err.message || 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleAddWatchlist = async (address: string, label: string) => {
    try {
      await api.addMonitoredWallet(caseId, address, caseData?.blockchain || 'Ethereum', label);
      alert(`Added ${label} (${address.slice(0, 10)}...) to Monitored Watchlist.`);
      const updatedMon = await api.getMonitoredWallets(caseId);
      setMonitoredList(updatedMon);
    } catch (err: any) {
      alert(err.message || 'Failed to add to watchlist');
    }
  };

  if (loading && !caseData) {
    return (
      <div className="p-16 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-indigo-400" />
        <p className="text-sm font-semibold">Indexing multi-hop blockchain ledger & risk findings...</p>
      </div>
    );
  }

  if (!caseData) return null;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-wrap items-start justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            title="Return to cases"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {caseData.origin === 'EXTERNAL_IMPORT' ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 uppercase tracking-wider">
                  <Building2 className="w-3 h-3 text-purple-600" />
                  FIR ({caseData.external_reference || 'External'})
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  App Filing
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                caseData.priority === 'CRITICAL'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {caseData.priority} PRIORITY
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider">
                {caseData.status.replace(/_/g, ' ')}
              </span>
              <RequireRole allowedRoles={['INVESTIGATOR', 'SUPERVISOR', 'ADMINISTRATOR']} currentUser={currentUser}>
                {allowedTransitions.length > 0 && (
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition-colors flex items-center gap-1 uppercase tracking-wider"
                  >
                    <GitCommit className="w-3 h-3 text-slate-400" />
                    Change Status
                  </button>
                )}
              </RequireRole>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {caseData.title || caseData.complaint_reference}
            </h2>
            
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono mt-2">
              <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">Ref: <span className="text-slate-900 font-semibold">{caseData.complaint_reference}</span></span>
              <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">Suspect: <span className="text-red-600 font-semibold">{caseData.suspect_wallet || 'Pending'}</span></span>
              <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">Network: <span className="text-slate-900 font-semibold">{caseData.blockchain}</span></span>
            </div>
          </div>
        </div>

        <RequireRole allowedRoles={['INVESTIGATOR', 'SUPERVISOR', 'ADMINISTRATOR']} currentUser={currentUser}>
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowLegalActionsMenu(!showLegalActionsMenu)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Statutory directives, subpoenas, and forensic report generators"
            >
              <Scale className="w-4 h-4 text-indigo-200" />
              <span>Legal Actions</span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-200" />
            </button>

            {showLegalActionsMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Statutory Directives</p>
                </div>

                {caseData.suspect_wallet && (
                  <button
                    onClick={() => {
                      setShowLegalActionsMenu(false);
                      handleDownloadSubpoena(caseData.suspect_wallet!);
                    }}
                    disabled={generatingSubpoena}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700 hover:text-indigo-600 transition-colors"
                  >
                    <Scale className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">{generatingSubpoena ? 'Generating...' : 'Section 94 BNSS Subpoena'}</div>
                      <div className="text-[10px] text-slate-400">KYC & account freeze notice</div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowLegalActionsMenu(false);
                    setShowSection91Modal(true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700 hover:text-red-600 transition-colors"
                >
                  <Shield className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Section 91 CrPC Notice</div>
                    <div className="text-[10px] text-slate-400">Official VASP asset freezing directive</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100" />
                <div className="px-3 py-1 border-b border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Export Dossier</p>
                </div>

                <button
                  onClick={() => {
                    setShowLegalActionsMenu(false);
                    handleExportNcrp();
                  }}
                  disabled={exportingNcrp}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700 hover:text-emerald-600 transition-colors"
                >
                  <Database className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">{exportingNcrp ? 'Exporting...' : 'NCRP / SAHYOG Portal JSON'}</div>
                    <div className="text-[10px] text-slate-400">Standardized cybercrime dossier</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowLegalActionsMenu(false);
                    handleGenerateReport();
                  }}
                  disabled={generatingReport}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-xs text-slate-700 hover:text-blue-600 transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">{generatingReport ? 'Compiling Dossier...' : 'Generate Forensic Report'}</div>
                    <div className="text-[10px] text-slate-400">Multi-page court-ready PDF</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </RequireRole>
      </div>

      {/* AI-Agent Driven Forensic Journey Map */}
      <CaseJourneyMap caseData={caseData} />

      {/* Crime Syndicate Alert Banner */}
      {syndicateIntel?.is_part_of_syndicate && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950 via-purple-950 to-slate-900 border-2 border-red-500/60 shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <AlertOctagon className="w-48 h-48 text-red-400" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-red-500/30 text-red-300 border border-red-400/40 uppercase flex items-center gap-1.5 animate-pulse">
                  <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                  CRIME SYNDICATE RING DETECTED
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/30 text-purple-300 border border-purple-400/40">
                  {syndicateIntel.syndicate_tag}
                </span>
              </div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Coordinated Attack Ring Linking {syndicateIntel.total_victims} Victim Complaints
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Shared suspect wallet{' '}
                <code className="px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-[11px] border border-white/10">
                  {caseData.suspect_wallet}
                </code>{' '}
                has been connected to <strong className="text-white">{syndicateIntel.total_linked_cases} other cyber cases</strong> across the department, with cumulative stolen funds of <strong className="text-emerald-400">₹{syndicateIntel.cumulative_loss_amount.toLocaleString()} {syndicateIntel.currency}</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('syndicate')}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-900/40 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                <span>Examine Crime Ring ({syndicateIntel.total_linked_cases})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Figma-Style Workspace Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Figma-Style Sticky Vertical Workspace Sidebar (3 cols) */}
        <div className="md:col-span-4 lg:col-span-3 space-y-4 sticky top-20">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs space-y-4">
            {currentUser?.role === 'VICTIM' ? (
              <div className="space-y-1">
                <div className="px-3 py-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Citizen Portal
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                    VICTIM
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'overview'
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className={`w-4 h-4 ${activeTab === 'overview' ? 'text-white' : 'text-slate-400'}`} />
                    <span>Case Overview</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'timeline'
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className={`w-4 h-4 ${activeTab === 'timeline' ? 'text-white' : 'text-slate-400'}`} />
                    <span>Timeline</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('evidence')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'evidence'
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Database className={`w-4 h-4 ${activeTab === 'evidence' ? 'text-white' : 'text-slate-400'}`} />
                    <span>Evidence Submission</span>
                  </div>
                </button>
              </div>
            ) : (
              <>
                {/* Officer Workspace - Section 1: Core Forensic File */}
                <div className="space-y-1">
                  <div className="px-3 py-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Core Case File
                    </span>
                    <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      LEO
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className={`w-4 h-4 ${activeTab === 'overview' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Dossier Overview</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('visual')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'visual' || activeTab === 'graph'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Network className={`w-4 h-4 ${activeTab === 'visual' || activeTab === 'graph' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Forensic Graph</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      activeTab === 'visual' || activeTab === 'graph' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      2D / Flow
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('trail')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'trail'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Activity className={`w-4 h-4 ${activeTab === 'trail' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Peeling Trail</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('syndicate')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'syndicate'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Link2 className={`w-4 h-4 ${activeTab === 'syndicate' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Syndicate Links</span>
                    </div>
                    {syndicateIntel?.is_part_of_syndicate ? (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                      </span>
                    ) : null}
                  </button>
                </div>

                {/* Section 2: AI Intelligence & Analysis */}
                <div className="space-y-1 pt-3 border-t border-slate-100">
                  <div className="px-3 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Intelligence & AI
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('copilot')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'copilot'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Brain className={`w-4 h-4 ${activeTab === 'copilot' ? 'text-white' : 'text-slate-400'}`} />
                      <span>AI Copilot</span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                      activeTab === 'copilot' ? 'bg-blue-700 text-white' : 'bg-purple-50 text-purple-700'
                    }`}>
                      Live
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('risk')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'risk' || activeTab === 'patterns'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className={`w-4 h-4 ${activeTab === 'risk' || activeTab === 'patterns' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Risk & Heuristics</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('evidence')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'evidence'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Database className={`w-4 h-4 ${activeTab === 'evidence' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Evidence Vault</span>
                    </div>
                    {evidenceList.length > 0 && (
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        activeTab === 'evidence' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {evidenceList.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('timeline')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'timeline'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className={`w-4 h-4 ${activeTab === 'timeline' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Timeline</span>
                    </div>
                  </button>
                </div>

                {/* Section 3: Legal & Team Collaboration */}
                <div className="space-y-1 pt-3 border-t border-slate-100">
                  <div className="px-3 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Compliance & Legal
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'reports'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileCheck2 className={`w-4 h-4 ${activeTab === 'reports' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Legal Reports</span>
                    </div>
                    {reportsList.length > 0 && (
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        activeTab === 'reports' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {reportsList.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('geo')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'geo'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className={`w-4 h-4 ${activeTab === 'geo' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Geo Jurisdictions</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('collaboration')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'collaboration'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className={`w-4 h-4 ${activeTab === 'collaboration' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Collaboration</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('audit')}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'audit'
                        ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <History className={`w-4 h-4 ${activeTab === 'audit' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Audit Trail</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: The Canvas (9 cols) */}
        <div className="md:col-span-8 lg:col-span-9 min-w-0">

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Quick Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-slate-500">Victim Reported Loss</p>
              <h3 className="text-2xl font-black font-mono text-[#1E293B] mt-1">
                {caseData.amount_lost.toLocaleString()} {caseData.currency}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Victim: {caseData.unregistered_victim_name || caseData.victim_name || 'Walk-in Complainant'}
                {caseData.unregistered_victim_contact && ` • Contact: ${caseData.unregistered_victim_contact}`}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-slate-500">Investigation Status</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xl font-black text-[#1E293B] font-mono">
                  {caseData.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Priority: {caseData.priority}</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <p className="text-[10px] uppercase font-bold text-slate-500">Terminal Liquidation Target</p>
              <h3 className="text-xl font-black text-amber-600 mt-1 truncate">
                {trailData?.paths_to_vasp?.[0]?.destination_vasp || 'In Transit'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {trailData?.paths_to_vasp?.[0]?.hops || 0} Hops Traversed
              </p>
            </div>
          </div>

          {/* Money Trail Highlight */}
          <MoneyTrailTimeline
            paths={trailData?.paths_to_vasp || []}
            statusMessage={trailData?.status_message}
            onSelectAddress={onInspectWallet}
          />

          {/* Priority Wallets Ranked List */}
          {trailData?.paths_to_vasp?.[0] && (
            <PriorityWalletTable
              wallets={[
                {
                  address: trailData.paths_to_vasp[0].steps.slice(-1)[0]?.from_address || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
                  label: 'Suspect Layering Hub (Wallet G)',
                  entity_type: 'UNKNOWN',
                  hops_from_source: 3,
                  total_incoming: 1.18,
                  total_outgoing: 1.15,
                  priority_score: 95.0,
                  priority_level: 'CRITICAL',
                  priority_rank: 1,
                  reasons: [
                    'Immediate liquidation transit node directly into Binance Hot Wallet (VASP)',
                    'Rapid movement executed within 13 minutes',
                    'High value throughput'
                  ],
                  action_recommendation: 'Subpoena Binance for KYC records associated with deposit address 0x28C6...21d60'
                },
                {
                  address: trailData.paths_to_vasp[0].steps[1]?.from_address || '0x1Db3439a222C519ab44bb1144fC23cc742106cf2',
                  label: 'Fund Splitting Hub (Wallet B)',
                  entity_type: 'UNKNOWN',
                  hops_from_source: 1,
                  total_incoming: 2.48,
                  total_outgoing: 2.48,
                  priority_score: 75.0,
                  priority_level: 'HIGH',
                  priority_rank: 2,
                  reasons: [
                    'Peeling chain distribution hub',
                    'Splits victim funds into 3 separate downstream addresses'
                  ],
                  action_recommendation: 'Trace secondary transit branches C and D'
                }
              ]}
              onInspectWallet={onInspectWallet}
              onMonitorWallet={handleAddWatchlist}
            />
          )}

          {/* Modus Operandi & Investigator Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Incident Description & Complaint Narrative
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {caseData.description || 'No description entered.'}
              </p>
              <div className="text-[11px] text-slate-500 font-mono space-y-1">
                <p>Case ID: {caseData.case_id}</p>
                {caseData.external_reference && (
                  <p className="text-purple-700 font-semibold">External FIR / Station Ref: {caseData.external_reference}</p>
                )}
                {caseData.unregistered_victim_name && (
                  <p>Complainant Name: {caseData.unregistered_victim_name}</p>
                )}
                {caseData.unregistered_victim_contact && (
                  <p>Complainant Contact: {caseData.unregistered_victim_contact}</p>
                )}
                <p>Registered Date: {new Date(caseData.created_at).toLocaleString()}</p>
                <p>Investigator Assigned: {caseData.assigned_investigator?.full_name || 'Inspector Vikram Malhotra'}</p>
              </div>
            </div>

            {/* Investigator Notes */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-3 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Investigator Field Notes ({notes.length})
                </h4>
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {notes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No field notes recorded yet.</p>
                  ) : (
                    notes.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-lg bg-slate-50 text-xs border border-slate-200">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span className="font-bold text-blue-600">{n.author_name}</span>
                          <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-700">{n.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form onSubmit={handleAddNote} className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add case observation..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Cross-Case Syndicate Links (Link Analysis) */}
      {activeTab === 'syndicate' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1E293B] tracking-wide flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-purple-600" />
                    Cross-Case Wallet Intelligence (Link Analysis)
                  </h3>
                  {syndicateIntel?.is_part_of_syndicate ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200 uppercase animate-pulse">
                      Active Crime Ring
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Isolated Case
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Automated correlation engine detecting shared suspect wallets and coordinated money mule syndicates across physical cyber FIRs and online victim reports.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleScanLinks}
                  disabled={scanningLinks}
                  className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Rescan all cases in the database for matching suspect wallets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${scanningLinks ? 'animate-spin' : ''}`} />
                  <span>{scanningLinks ? 'Scanning Database...' : 'Re-scan Cross-Case Links'}</span>
                </button>
              </div>
            </div>

            {/* Syndicate Cluster Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <Fingerprint className="w-3.5 h-3.5 text-purple-600" />
                  Syndicate Identifier
                </p>
                <h4 className="text-lg font-black font-mono text-purple-800 mt-1">
                  {syndicateIntel?.syndicate_tag || 'STANDALONE'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {syndicateIntel?.is_part_of_syndicate ? 'Confirmed Multi-Victim Ring' : 'No cross-case link'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  Cumulative Ring Loss
                </p>
                <h4 className="text-lg font-black font-mono text-emerald-700 mt-1">
                  ₹{(syndicateIntel?.cumulative_loss_amount ?? caseData.amount_lost).toLocaleString()} {syndicateIntel?.currency || 'INR'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Combined stolen capital across victims
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Targeted Victims
                </p>
                <h4 className="text-lg font-black font-mono text-blue-700 mt-1">
                  {syndicateIntel?.total_victims ?? 1} Victim Complaint{(syndicateIntel?.total_victims ?? 1) === 1 ? '' : 's'}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {syndicateIntel?.total_linked_cases ?? 0} other linked case dossier{(syndicateIntel?.total_linked_cases ?? 0) === 1 ? '' : 's'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  Match Criteria
                </p>
                <h4 className="text-lg font-black font-mono text-amber-700 mt-1">
                  Direct Wallet Match
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={caseData.suspect_wallet || ''}>
                  {caseData.suspect_wallet ? `${caseData.suspect_wallet.slice(0, 10)}...${caseData.suspect_wallet.slice(-8)}` : 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Linked Cases List */}
          {syndicateIntel?.is_part_of_syndicate && syndicateIntel.links && syndicateIntel.links.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  Connected Crime Ring Cases ({syndicateIntel.links.length})
                </h4>
                <span className="text-xs text-slate-500">
                  Shared Suspect Wallet: <span className="font-mono font-semibold text-slate-700">{caseData.suspect_wallet}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {syndicateIntel.links.map((link) => (
                  <div
                    key={link.id}
                    className="p-5 rounded-2xl bg-white border border-purple-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-800">
                          {link.linked_case.case_number || link.linked_case.case_id}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                          {link.syndicate_tag || 'SYNDICATE-RING'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          100% Match Confidence
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {link.linked_case.blockchain}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {link.linked_case.status}
                        </span>
                      </div>

                      <h5 className="text-sm font-bold text-slate-800">
                        {link.linked_case.title || `Complaint by ${link.linked_case.victim_name}`}
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 font-medium">
                        <div>
                          <span className="text-slate-400">Victim: </span>
                          <span className="text-slate-800 font-bold">{link.linked_case.victim_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Reported Loss: </span>
                          <span className="text-red-600 font-bold font-mono">
                            ₹{link.linked_case.amount_lost.toLocaleString()} {link.linked_case.currency}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Assigned Officer: </span>
                          <span className="text-slate-800 font-bold">{link.linked_case.assigned_investigator_name || 'Inspector Assigned'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="text-purple-700 font-bold">Shared Address:</span>
                        <span className="text-slate-700 font-semibold">{link.shared_wallet}</span>
                        <button
                          onClick={() => onInspectWallet(link.shared_wallet)}
                          className="ml-auto text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect On-Chain</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
                      {onOpenCase && (
                        <button
                          onClick={() => onOpenCase(link.target_case_id)}
                          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer w-full justify-center"
                        >
                          <span>Open Case Dossier</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Cyber Cell SOP & Legal Advisory */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 shadow-sm space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-purple-700" />
                  Cyber Crime Department Standard Operating Procedure (SOP)
                </h5>
                <p className="text-xs text-purple-950 leading-relaxed">
                  <strong>Consolidated Subpoena Advisory:</strong> Multiple victims have deposited funds into identical suspect wallet{' '}
                  <code className="px-1 py-0.5 rounded bg-white font-mono text-[11px] text-purple-800 font-bold">
                    {caseData.suspect_wallet}
                  </code>.
                  Law enforcement officers are authorized to issue a combined <strong>Section 91 CrPC notice</strong> to centralized exchanges (VASPs). KYC disclosures and bank account settlement details obtained for this wallet can be officially shared and admitted as evidence across all {syndicateIntel.total_victims} linked case proceedings.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                <Link2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                No Shared Wallets Found in Other Cases
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The suspect wallet <code className="font-mono text-slate-700 font-semibold">{caseData.suspect_wallet || 'N/A'}</code> has not appeared in any other registered cyber complaints yet. When another victim or FIR mentions this address, Crypto-Trace will automatically cluster them here.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleScanLinks}
                  disabled={scanningLinks}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${scanningLinks ? 'animate-spin' : ''}`} />
                  <span>Scan Database Now</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Interactive Threat Graph (Visual Analysis) */}
      {activeTab === 'visual' && (
        <div className="space-y-4">
          <ThreatGraph
            transactions={transactions}
            suspectWallet={caseData.suspect_wallet}
            onInspectWallet={onInspectWallet}
            onGenerateSubpoena={handleDownloadSubpoena}
          />
        </div>
      )}

      {/* Tab: Unified Forensic Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-[#1E293B] tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Case Investigation Workspace & Unified Timeline
              </h3>
              <p className="text-xs text-slate-500">
                Chronological chain-of-events including on-chain ingests, forensic graph developments, pattern discoveries, and officer actions.
              </p>
            </div>
            <TruthBadge category="AUDIT LOG" size="sm" />
          </div>
          <UnifiedTimeline
            caseId={caseId}
            onInspectWallet={onInspectWallet}
            onOpenCase={onOpenCase}
          />
        </div>
      )}

      {/* Tab 2: Transaction Graph & Threat Graph */}
      {activeTab === 'graph' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Graph Mode:</span>
              <button
                onClick={() => setGraphViewMode('force')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  graphViewMode === 'force'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>🕸️ Force-2D Interactive Threat Graph</span>
              </button>
              <button
                onClick={() => setGraphViewMode('hierarchical')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  graphViewMode === 'hierarchical'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>📊 Multi-Hop Hierarchical Flow</span>
              </button>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-blue-50/80 text-blue-700 px-3 py-1 rounded-lg border border-blue-200">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Hover on any node to view <strong>Wallet Age</strong>, <strong>Balance</strong>, & <strong>Risk Score</strong></span>
            </div>
          </div>

          {graphViewMode === 'force' ? (
            <ThreatGraph
              transactions={transactions}
              suspectWallet={caseData?.suspect_wallet}
              onInspectWallet={onInspectWallet}
              onGenerateSubpoena={handleDownloadSubpoena}
            />
          ) : (
            <TransactionGraph
              data={graphData}
              selectedHop={selectedHops}
              onHopChange={handleHopChange}
              suspiciousOnly={suspiciousOnly}
              onToggleSuspiciousOnly={() => setSuspiciousOnly(!suspiciousOnly)}
              onInspectWallet={onInspectWallet}
            />
          )}
        </div>
      )}

      {/* Tab 3: Money Trail */}
      {activeTab === 'trail' && (
        <MoneyTrailTimeline
          paths={trailData?.paths_to_vasp || []}
          statusMessage={trailData?.status_message}
          onSelectAddress={onInspectWallet}
        />
      )}

      {/* Tab 4: Risk Analysis */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          <AdvancedForensicsPanel 
            caseId={caseId}
            transactions={transactions} 
            suspectWallet={caseData?.suspect_wallet || ''} 
          />
          <RiskBreakdown
            assessment={riskData?.risk_assessment || null}
            mlAssessment={{
              ml_risk_probability: 0.94,
              top_features: [
                { feature: 'rapid_movement_indicator', value: 1.0 },
                { feature: 'fund_splitting_score', value: 0.8 },
                { feature: 'hop_count', value: 4 },
                { feature: 'high_risk_connections', value: 1 }
              ]
            }}
          />
        </div>
      )}

      {/* Tab 5: Suspicious Patterns */}
      {activeTab === 'patterns' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-[#1E293B] tracking-wide">
                Detected Laundering & Structuring Patterns
              </h3>
              <p className="text-xs text-slate-500">
                11 heuristic forensic rules evaluated against on-chain topology
              </p>
            </div>
            <TruthBadge category="SYSTEM INFERENCE" size="sm" />
          </div>

          <div className="space-y-3">
            {!riskData?.findings || riskData.findings.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <AlertTriangle className="w-8 h-8 text-amber-500/80 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">No Laundering Patterns Flagged Yet</p>
                <p className="text-xs text-slate-500 mt-1">Transactions analyzed for this wallet do not currently exhibit high-risk structuring behaviors.</p>
              </div>
            ) : (
              riskData.findings.map((f, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-wrap items-start justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1E293B] text-sm">
                      {f.finding_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                      {f.severity}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      +{f.score_delta} Risk Points
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed max-w-2xl">
                    {f.explanation}
                  </p>
                  {f.evidence_txs && f.evidence_txs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Evidence:</span>
                      {f.evidence_txs.map((tx) => (
                        <span key={tx} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-blue-600">
                          {tx.slice(0, 12)}...
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )))}
          </div>
        </div>
      )}

      {/* Tab 6: Evidence Locker */}
      {activeTab === 'evidence' && (
        <EvidenceLocker
          caseId={caseId}
          evidence={evidenceList}
          onRefresh={loadCaseFull}
        />
      )}

      {/* Tab 7: Investigation Copilot */}
      {activeTab === 'copilot' && (
        <CopilotDrawer 
          caseId={caseId} 
          onNavigateTab={(tab) => setActiveTab(tab as any)}
          onOpenSubpoena={() => handleDownloadSubpoena(caseData?.suspect_wallet)}
          onOpenNotice91={() => setShowSection91Modal(true)}
          onGenerateReport={handleGenerateReport}
        />
      )}

      {/* Tab 8: Watchlist & Alerts */}
      {activeTab === 'monitoring' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-[#1E293B] tracking-wide">
                Case Watchlists & Monitored Wallets
              </h3>
              <p className="text-xs text-slate-500">
                Monitored addresses polled for newly confirmed transactions
              </p>
            </div>
            <button
              onClick={() => handleAddWatchlist(caseData.suspect_wallet, 'Primary Suspect Wallet')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Monitor Suspect Wallet</span>
            </button>
          </div>

          <div className="space-y-3">
            {monitoredList.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                No wallets currently under active monitoring for this case.
              </p>
            ) : (
              monitoredList.map((m) => (
                <div key={m.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B]">{m.label || 'Monitored Address'}</span>
                    <p className="text-xs font-mono text-slate-600">{m.wallet_address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await api.simulateAlert(m.id);
                        alert('Simulated fresh incoming transaction alert dispatched!');
                        loadCaseFull();
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      Simulate Inflow Alert
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 9: Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reportsList.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 shadow-sm rounded-2xl text-slate-500 text-xs">
              No reports generated yet. Click "Generate Forensic Report" above to compile the full investigation dossier.
            </div>
          ) : (
            reportsList.map((rep) => (
              <ReportViewer
                key={rep.report_id}
                report={rep}
                currentUser={currentUser}
                onStatusUpdated={loadCaseFull}
              />
            ))
          )}
        </div>
      )}

      {/* Tab 10: Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-[#1E293B] tracking-wide">
                Forensic Audit Trail & Chain of Custody
              </h3>
              <p className="text-xs text-slate-500">
                Immutable chronological log of all officer actions, analyses, and report reviews
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleVerifyAudit}
                disabled={verifyingAudit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold transition-all"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${verifyingAudit ? 'animate-spin' : ''}`} />
                {verifyingAudit ? 'Verifying Hashes...' : 'Verify Cryptographic Audit Chain'}
              </button>
              <TruthBadge category="INVESTIGATOR DECISION" size="sm" />
            </div>
          </div>

          {/* Audit Verification Alert Banner */}
          {auditVerification && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              auditVerification.verified && !auditVerification.tamper_detected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1 text-xs">
                <span className="font-bold block">
                  {auditVerification.message || 'Audit Log Integrity Cryptographically Verified'}
                </span>
                <p className="text-[11px] opacity-80">
                  Records Checked: <span className="font-mono font-bold">{auditVerification.total_records_checked}</span> • SHA-256 Digest Chain: <span className="font-mono">{auditVerification.chain_digest?.slice(0, 16)}...</span>
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2 font-mono text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center text-[11px]">
                <div>
                  <span className="text-blue-600 font-bold">[{log.action}]</span>
                  <span className="text-slate-800 ml-2">by {log.username}</span>
                </div>
                <span className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 11: Geo Intelligence */}
      {activeTab === 'geo' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-base font-bold text-[#1E293B] tracking-wide flex items-center gap-2">
                Geo Intelligence & Subpoena Jurisdictions
              </h3>
              <p className="text-xs text-slate-500">
                Maps identified Exchange/VASP destinations to their global headquarters and physical jurisdictions.
              </p>
            </div>
            <TruthBadge category="VERIFIED" size="sm" />
          </div>
          <GeoMap caseId={caseId} />
        </div>
      )}

      {/* Tab 12: Team Collaboration */}
      {activeTab === 'collaboration' && (
        <div className="space-y-4">
          <CollaborationPanel caseId={caseId} currentUser={currentUser} caseData={caseData} />
        </div>
      )}

        </div>
      </div>

      {/* Case Status Lifecycle Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-[#1E293B]">
            <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-purple-600" />
              Transition Case Investigation Status
            </h3>
            <p className="text-xs text-slate-500">
              Advance case through compliant forensic milestones. Authorized transitions depend on your investigator role and current state.
            </p>

            <form onSubmit={handleUpdateStatus} className="space-y-3">
              <div>
                <label className="text-xs text-slate-700 block mb-1 font-semibold">Select Next Status *</label>
                <select
                  value={selectedTransition}
                  onChange={(e) => setSelectedTransition(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                >
                  {allowedTransitions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-700 block mb-1 font-semibold">Officer Justification / Notes</label>
                <textarea
                  rows={3}
                  placeholder="State evidence review milestones, supervisor escalations, or resolution rationale..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transitioningStatus}
                  className="px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                >
                  {transitioningStatus ? 'Updating...' : 'Commit Status Transition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section 91 CrPC Legal Notice Modal */}
      {showSection91Modal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-[#1E293B]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B]">
                    Section 91 CrPC Statutory Legal Notice
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Court-admissible freezing order & KYC disclosure request to identified VASP
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSection91Modal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 max-h-80 overflow-y-auto space-y-2">
              <p className="text-red-600 font-bold border-b border-slate-200 pb-1">
                FORMAL NOTICE UNDER SECTION 91 OF CODE OF CRIMINAL PROCEDURE, 1973
              </p>
              <p><strong className="text-slate-900">TO:</strong> Legal & Compliance Desk, Binance / Destination VASP</p>
              <p><strong className="text-slate-900">CASE REF:</strong> {caseData.case_id} • Complaint Ref: {caseData.complaint_reference}</p>
              <p><strong className="text-slate-900">COMPLAINANT:</strong> {caseData.victim_name || 'Victim Complainant'} (Loss: ₹{(caseData.amount_lost || 500000).toLocaleString('en-IN')})</p>
              <p><strong className="text-slate-900">DESTINATION DEPOSIT ADDRESS:</strong> <span className="text-emerald-600 font-bold">0x28c6c06298d514db089934071355e5743bf21d60</span></p>
              <p><strong className="text-slate-900">SUSPECT ORIGIN:</strong> <span className="text-red-600 font-bold">{caseData.suspect_wallet}</span></p>
              <p><strong className="text-slate-900">STATUTORY MANDATE:</strong> You are directed to immediately FREEZE all accounts linked to deposit address 0x28c6c06298d514db089934071355e5743bf21d60 and produce full KYC, IP logs, and linked bank accounts within 48 hours under penalty of IPC Sections 175 and 204.</p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                Digitally sealed by Cyber Crime Forensics Unit
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSection91Modal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadSection91Notice();
                    setShowSection91Modal(false);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download Signed Notice (.txt)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
