import React, { useState } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  AlertCircle, 
  Database, 
  Cpu, 
  Brain, 
  Check, 
  Copy, 
  ArrowRight, 
  Zap, 
  FileText, 
  Scale, 
  ExternalLink 
} from 'lucide-react';
import { api } from '../services/api';
import { CopilotResponse } from '../types';
import { TruthBadge } from './TruthBadge';

export interface CopilotAction {
  id: string;
  label: string;
  type: 'NAVIGATE' | 'SUBPOENA' | 'NOTICE_91' | 'GENERATE_REPORT';
  tabTarget?: string;
  description?: string;
}

interface CopilotDrawerProps {
  caseId: string;
  onNavigateTab?: (tab: string) => void;
  onOpenSubpoena?: () => void;
  onOpenNotice91?: () => void;
  onGenerateReport?: () => void;
}

interface ChatMessage {
  sender: 'user' | 'copilot';
  text: string;
  category?: string;
  evidence?: any[];
  timestamp: string;
  actions?: CopilotAction[];
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({ 
  caseId,
  onNavigateTab,
  onOpenSubpoena,
  onOpenNotice91,
  onGenerateReport
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'copilot',
      text: "Hello, Inspector. I am your Autonomous Investigation Copilot. I analyze on-chain topologies, FIFO taint mixtures, and temporal anomalies to extract actionable intelligence.\n\nYou can ask questions or execute direct forensic workflows using the quick actions below.",
      category: 'SYSTEM INFERENCE',
      timestamp: new Date().toLocaleTimeString(),
      actions: [
        {
          id: 'init-graph',
          label: 'Open Forensic Threat Graph',
          type: 'NAVIGATE',
          tabTarget: 'graph',
          description: 'Visualize multi-hop fund flow with FIFO taint and botnet clusters'
        },
        {
          id: 'init-subpoena',
          label: 'Draft Section 94 BNSS Subpoena',
          type: 'SUBPOENA',
          description: 'Auto-generate statutory notice for exchange freeze'
        },
        {
          id: 'init-trail',
          label: 'Inspect Fund Flow Trail',
          type: 'NAVIGATE',
          tabTarget: 'trail',
          description: 'Inspect step-by-step transaction ledger'
        }
      ]
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestedQuestions = [
    "Where did the victim's money go?",
    "Which wallet should I investigate first?",
    "What suspicious patterns were detected?",
    "Did the funds reach a known VASP?",
    "Show the largest transaction."
  ];

  // Natural Language Intent Parser to extract actionable chips
  const extractActionChips = (text: string, query: string): CopilotAction[] => {
    const actions: CopilotAction[] = [];
    const lower = (text + ' ' + query).toLowerCase();

    if (
      lower.includes('subpoena') || 
      lower.includes('section 94') || 
      lower.includes('bnss') || 
      lower.includes('freeze') || 
      lower.includes('vasp') ||
      lower.includes('exchange')
    ) {
      actions.push({
        id: 'act-subpoena',
        label: 'Draft Section 94 BNSS Subpoena',
        type: 'SUBPOENA',
        description: 'Generates formal VASP KYC production and account freeze order'
      });
    }

    if (
      lower.includes('section 91') || 
      lower.includes('crpc') || 
      lower.includes('directive') || 
      lower.includes('notice')
    ) {
      actions.push({
        id: 'act-notice91',
        label: 'Issue Section 91 CrPC Notice',
        type: 'NOTICE_91',
        description: 'Open statutory electronic evidence preservation directive'
      });
    }

    if (
      lower.includes('graph') || 
      lower.includes('network') || 
      lower.includes('topology') || 
      lower.includes('taint') || 
      lower.includes('botnet') || 
      lower.includes('cluster')
    ) {
      actions.push({
        id: 'act-graph',
        label: 'Inspect in Threat Graph',
        type: 'NAVIGATE',
        tabTarget: 'graph',
        description: 'Explore visual graph with FIFO taint propagation'
      });
    }

    if (
      lower.includes('trail') || 
      lower.includes('money') || 
      lower.includes('hop') || 
      lower.includes('peeling') || 
      lower.includes('layering') || 
      lower.includes('destination')
    ) {
      actions.push({
        id: 'act-trail',
        label: 'View Money Trail Ledger',
        type: 'NAVIGATE',
        tabTarget: 'trail',
        description: 'Inspect step-by-step transaction ledger'
      });
    }

    if (
      lower.includes('evidence') || 
      lower.includes('locker') || 
      lower.includes('court') || 
      lower.includes('sha-256') || 
      lower.includes('dossier')
    ) {
      actions.push({
        id: 'act-evidence',
        label: 'Open Evidence Locker',
        type: 'NAVIGATE',
        tabTarget: 'evidence',
        description: 'Review cryptographically sealed exhibits and court filings'
      });
    }

    if (
      lower.includes('report') || 
      lower.includes('summary') || 
      lower.includes('pdf')
    ) {
      actions.push({
        id: 'act-report',
        label: 'Generate Case Brief Report',
        type: 'GENERATE_REPORT',
        description: 'Produce complete multi-page investigative brief'
      });
    }

    // Return deduplicated top 3 actions
    return Array.from(new Map(actions.map(a => [a.id, a])).values()).slice(0, 3);
  };

  const executeAction = (action: CopilotAction) => {
    let statusText = `Executed action: "${action.label}".`;

    if (action.type === 'NAVIGATE' && action.tabTarget && onNavigateTab) {
      onNavigateTab(action.tabTarget);
      statusText = `Switched workspace tab to "${action.tabTarget.toUpperCase()}".`;
    } else if (action.type === 'SUBPOENA' && onOpenSubpoena) {
      onOpenSubpoena();
      statusText = `Initiated Section 94 BNSS Subpoena generation workflow.`;
    } else if (action.type === 'NOTICE_91' && onOpenNotice91) {
      onOpenNotice91();
      statusText = `Opened Section 91 CrPC Statutory Legal Notice modal.`;
    } else if (action.type === 'GENERATE_REPORT' && onGenerateReport) {
      onGenerateReport();
      statusText = `Initiated Case Intelligence Brief Report generation.`;
    }

    setMessages((prev) => [
      ...prev,
      {
        sender: 'copilot',
        text: `⚡ Autonomous Execution: ${statusText}`,
        category: 'ACTION DISPATCH',
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const handleSend = async (qText?: string) => {
    const query = qText || inputQuery;
    if (!query.trim() || loading) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!qText) setInputQuery('');
    setLoading(true);

    try {
      const lower = query.toLowerCase();
      const isActionDirective = 
        lower.startsWith('trace') || 
        lower.startsWith('flag') || 
        lower.startsWith('monitor') || 
        lower.startsWith('subpoena') || 
        lower.startsWith('verify') || 
        lower.includes('and flag') || 
        lower.includes('and generate') || 
        lower.includes('and subpoena') ||
        lower.includes('0x') ||
        lower.includes('notice 94') ||
        lower.includes('section 94');

      if (isActionDirective) {
        const actionResp = await api.executeAutonomousAgentAction({
          instruction: query,
          case_id: caseId
        });
        const actionChips = extractActionChips(actionResp.narrative_response, query);

        const copilotMsg: ChatMessage = {
          sender: 'copilot',
          text: actionResp.narrative_response,
          category: `AUTONOMOUS AI (${(actionResp.tools_executed || [actionResp.tool_executed]).join(', ')})`,
          evidence: [actionResp.execution_receipt],
          timestamp: new Date().toLocaleTimeString(),
          actions: actionChips
        };
        setMessages((prev) => [...prev, copilotMsg]);
      } else {
        const resp: CopilotResponse = await api.queryCopilot(caseId, query);
        const actionChips = extractActionChips(resp.answer, query);

        const copilotMsg: ChatMessage = {
          sender: 'copilot',
          text: resp.answer,
          category: resp.category,
          evidence: resp.grounded_evidence,
          timestamp: new Date().toLocaleTimeString(),
          actions: actionChips
        };
        setMessages((prev) => [...prev, copilotMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'copilot',
          text: "I was unable to analyze the case ledger at this moment. Please verify the case ID and backend connection.",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl flex flex-col h-[580px] overflow-hidden shadow-sm">
      {/* Copilot Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#1E293B] flex items-center gap-1.5">
              Agentic Forensic Copilot
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h4>
            <p className="text-[11px] text-slate-500">
              Grounded Reasoning & Action Dispatch Engine
            </p>
          </div>
        </div>
        <TruthBadge category="AI ASSESSMENT" size="sm" />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap gap-1.5 overflow-x-auto">
        {suggestedQuestions.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-300 transition-all text-left truncate max-w-xs shadow-xs cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs ${
                m.sender === 'user'
                  ? 'bg-[#2563EB] text-white rounded-br-none'
                  : 'bg-slate-50 border border-slate-200 text-[#1E293B] rounded-bl-none'
              }`}
            >
              {m.category && (
                <div className="mb-2">
                  <TruthBadge category={m.category} size="sm" />
                </div>
              )}
              <div className="whitespace-pre-line">{m.text}</div>

              {/* Phase 3: Actionable Execution Chips */}
              {m.actions && m.actions.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3 text-indigo-500" />
                    Recommended Autonomous Actions:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {m.actions.map(act => (
                      <button
                        key={act.id}
                        onClick={() => executeAction(act)}
                        className="group px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 shadow-xs hover:shadow text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title={act.description}
                      >
                        <ArrowRight className="w-3 h-3 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 px-1">
              {m.timestamp}
            </span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#2563EB] bg-blue-50 p-3 rounded-xl max-w-xs border border-blue-200">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
            <span>Analyzing indexed transactions & topology...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Copilot about fund flow, priority wallets, or VASP..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="p-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

