import React, { useState, useEffect } from 'react';
import {
  Clock, Shield, ArrowRight, GitCommit, FileText, CheckCircle2,
  AlertTriangle, RefreshCw, Filter, UserCheck, Search, Tag, Database,
  Calendar, Link2, Users, AlertOctagon, Send, Plus, X, MessageSquare,
  Smartphone, ArrowDown, ExternalLink, Eye, Copy, Landmark, Flame
} from 'lucide-react';
import { api } from '../services/api';
import { ScamCampaignEvent, ScamCampaignTimelineResponse, RealWorldEventCreate, TimelineEvent } from '../types';

interface UnifiedTimelineProps {
  caseId: string;
  initialEvents?: TimelineEvent[];
  onEvidenceClick?: (evidenceId: string) => void;
  onInspectWallet?: (address: string) => void;
  onOpenCase?: (caseId: string) => void;
}

export const UnifiedTimeline: React.FC<UnifiedTimelineProps> = ({
  caseId,
  initialEvents,
  onEvidenceClick,
  onInspectWallet,
  onOpenCase
}) => {
  const [campaignData, setCampaignData] = useState<ScamCampaignTimelineResponse | null>(null);
  const [events, setEvents] = useState<ScamCampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state for adding real-world human milestones
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventChannel, setNewEventChannel] = useState('Telegram');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventAmount, setNewEventAmount] = useState('');
  const [newEventSource, setNewEventSource] = useState('');
  const [newEventTarget, setNewEventTarget] = useState('');

  const loadCampaignTimeline = async () => {
    setLoading(true);
    try {
      const data = await api.getCaseCampaignTimeline(caseId);
      setCampaignData(data);
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load scam campaign timeline, falling back to basic timeline', err);
      // Fallback to basic timeline if needed
      try {
        const basicData = await api.getCaseTimeline(caseId);
        const mapped: ScamCampaignEvent[] = basicData.map((b: any) => ({
          id: `basic-${b.id}`,
          category: 'INVESTIGATION',
          event_type: b.event_type,
          title: b.title,
          description: b.description,
          timestamp: b.timestamp,
          actor: b.actor_username || b.actor,
          metadata: b.metadata
        }));
        setEvents(mapped);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaignTimeline();
  }, [caseId]);

  const handleAddRealWorldEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    setSubmittingEvent(true);
    try {
      const payload: RealWorldEventCreate = {
        title: newEventTitle.trim(),
        description: newEventDesc.trim() || 'Complainant reported milestone.',
        channel: newEventChannel,
        timestamp: newEventDate ? new Date(newEventDate).toISOString() : undefined,
        amount: newEventAmount ? parseFloat(newEventAmount) : undefined,
        source_entity: newEventSource.trim() || undefined,
        target_entity: newEventTarget.trim() || undefined
      };
      await api.addCaseRealWorldEvent(caseId, payload);
      setIsAddModalOpen(false);
      // Reset form
      setNewEventTitle('');
      setNewEventDesc('');
      setNewEventAmount('');
      setNewEventSource('');
      setNewEventTarget('');
      // Reload timeline
      await loadCampaignTimeline();
    } catch (err: any) {
      alert(err.message || 'Failed to add real-world event');
    } finally {
      setSubmittingEvent(false);
    }
  };

  const getCategoryIcon = (category: string, channel?: string) => {
    switch (category) {
      case 'REAL_WORLD':
        if (channel === 'Telegram' || channel === 'WhatsApp') {
          return <MessageSquare className="w-4 h-4 text-amber-600" />;
        }
        if (channel === 'Phone Call') {
          return <Smartphone className="w-4 h-4 text-amber-600" />;
        }
        if (channel?.includes('Bank') || channel?.includes('UPI')) {
          return <Landmark className="w-4 h-4 text-amber-600" />;
        }
        return <Calendar className="w-4 h-4 text-amber-600" />;
      case 'BLOCKCHAIN':
        return <Link2 className="w-4 h-4 text-blue-600" />;
      case 'SYNDICATE':
        return <Users className="w-4 h-4 text-purple-600" />;
      case 'INVESTIGATION':
      default:
        return <Shield className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'REAL_WORLD':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'BLOCKCHAIN':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'SYNDICATE':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'INVESTIGATION':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  const getCardBorderClass = (category: string) => {
    switch (category) {
      case 'REAL_WORLD':
        return 'border-amber-200 bg-amber-50/40 hover:border-amber-300';
      case 'BLOCKCHAIN':
        return 'border-blue-200 bg-blue-50/40 hover:border-blue-300';
      case 'SYNDICATE':
        return 'border-purple-200 bg-purple-50/40 hover:border-purple-300';
      case 'INVESTIGATION':
      default:
        return 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300';
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (selectedCategory !== 'ALL' && ev.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q) ||
        (ev.channel && ev.channel.toLowerCase().includes(q)) ||
        (ev.source_entity && ev.source_entity.toLowerCase().includes(q)) ||
        (ev.target_entity && ev.target_entity.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Presentation Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-700 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-blue-500/30 text-blue-300 border border-blue-400/30 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" />
                Scam Campaign Timeline Reconstruction
              </span>
              {campaignData?.syndicate_tag && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/30 text-purple-300 border border-purple-400/30">
                  {campaignData.syndicate_tag}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Connecting Real-World Human Events with On-Chain Ledger Movements
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              CryptoTrace reconstructs the entire sequence of fraud—from initial Telegram inducement and victim bank transfers, to blockchain transit hops and correlated victim reports across the department.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              title="Add a real-world victim milestone (Telegram contact, UPI transfer, call)"
            >
              <Plus className="w-4 h-4" />
              <span>Add Real-World Event</span>
            </button>
            <button
              onClick={loadCampaignTimeline}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors cursor-pointer"
              title="Reload Chronology"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Stat Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black font-mono text-white leading-tight">
                {campaignData?.real_world_events_count ?? 0}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Human Events</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black font-mono text-white leading-tight">
                {campaignData?.blockchain_events_count ?? 0}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Blockchain Hops</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black font-mono text-white leading-tight">
                {campaignData?.syndicate_events_count ?? 0}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Correlated Victims</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black font-mono text-white leading-tight">
                {events.filter(e => e.category === 'INVESTIGATION').length}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Police Actions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: `All Chronology (${events.length})` },
            { id: 'REAL_WORLD', label: `📅 Real-World Events (${campaignData?.real_world_events_count ?? 0})` },
            { id: 'BLOCKCHAIN', label: `🔗 Blockchain Transfers (${campaignData?.blockchain_events_count ?? 0})` },
            { id: 'SYNDICATE', label: `🚨 Correlated Victims (${campaignData?.syndicate_events_count ?? 0})` },
            { id: 'INVESTIGATION', label: `⚖️ Police Actions` }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search campaign timeline..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto text-center" />
          <p className="text-xs text-slate-500 font-semibold">Reconstructing multi-phase campaign chronology...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-500 text-xs">
          No events match the selected category filter.
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((ev, idx) => {
            const isLast = idx === filteredEvents.length - 1;
            return (
              <div key={ev.id} className="relative group">
                {/* Event Dot Icon */}
                <div className="absolute -left-6 sm:-left-8 top-3 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  {getCategoryIcon(ev.category, ev.channel)}
                </div>

                {/* Event Card */}
                <div className={`p-4 rounded-2xl border transition-all ${getCardBorderClass(ev.category)} shadow-sm`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${getCategoryBadgeClass(ev.category)}`}>
                        {ev.category === 'REAL_WORLD' && '📅 Real-World Event'}
                        {ev.category === 'BLOCKCHAIN' && '🔗 Blockchain Movement'}
                        {ev.category === 'SYNDICATE' && '🚨 Correlated Campaign Incident'}
                        {ev.category === 'INVESTIGATION' && '⚖️ Official Action'}
                      </span>

                      {ev.channel && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                          {ev.channel}
                        </span>
                      )}

                      {ev.amount_display && (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {ev.amount_display}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 font-mono font-medium">
                      {new Date(ev.timestamp).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}{' • '}
                      {new Date(ev.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 tracking-wide mt-1">
                    {ev.title}
                  </h4>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {ev.description}
                  </p>

                  {/* Flow Connection Entities (Source -> Target) */}
                  {(ev.source_entity || ev.target_entity) && (
                    <div className="flex flex-wrap items-center gap-2 mt-2.5 p-2 rounded-xl bg-white/70 border border-slate-200/80 text-[11px] font-mono">
                      <span className="text-slate-400 font-sans font-semibold">Flow:</span>
                      {ev.source_entity && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                          {ev.source_entity}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      {ev.target_entity && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                          {ev.target_entity}
                        </span>
                      )}
                    </div>
                  )}

                  {/* On-Chain actions & Cross-case links */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2 border-t border-slate-200/60">
                    {ev.tx_hash && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                        <span>Tx: {ev.tx_hash}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(ev.tx_hash!)}
                          className="hover:text-blue-900 cursor-pointer"
                          title="Copy Transaction Hash"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {ev.metadata?.shared_wallet && onInspectWallet && (
                      <button
                        onClick={() => onInspectWallet(ev.metadata!.shared_wallet)}
                        className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer bg-purple-50 px-2 py-0.5 rounded border border-purple-200"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Wallet On-Chain</span>
                      </button>
                    )}

                    {ev.metadata?.linked_case_id && onOpenCase && (
                      <button
                        onClick={() => onOpenCase(ev.metadata!.linked_case_id)}
                        className="text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-0.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                      >
                        <span>Open Linked Victim Case</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}

                    {ev.actor && (
                      <span className="text-[10px] text-slate-400 font-mono ml-auto">
                        Source: {ev.actor}
                      </span>
                    )}
                  </div>
                </div>

                {/* Downward indicator arrow to next chronological phase */}
                {!isLast && (
                  <div className="flex items-center justify-center my-1 text-slate-400">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Real-World Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Log Real-World Scam Milestone
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Record off-chain victim events (e.g., initial Telegram approach, phishing link clicked, bank transfer sent) to reconstruct the complete timeline before blockchain movement began.
            </p>

            <form onSubmit={handleAddRealWorldEvent} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Victim contacted on Telegram"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Channel / Platform
                  </label>
                  <select
                    value={newEventChannel}
                    onChange={(e) => setNewEventChannel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  >
                    <option value="Telegram">Telegram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Phone Call">Phone Call / SMS</option>
                    <option value="Bank / UPI Gateway">Bank / UPI Transfer</option>
                    <option value="Phishing Website">Fake Trading / Phishing Portal</option>
                    <option value="In-Person">In-Person Inducement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Event Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount Involved (INR, optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={newEventAmount}
                    onChange={(e) => setNewEventAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Source Entity (Who initiated?)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fraudster (@cryptoadvisor)"
                    value={newEventSource}
                    onChange={(e) => setNewEventSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Narrative Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe what occurred during this milestone..."
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent || !newEventTitle.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingEvent ? 'Saving...' : 'Record Milestone'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
