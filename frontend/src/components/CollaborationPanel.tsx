import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, MessageSquare, Activity, Send, Trash2,
  CheckCircle2, Clock, Shield, Search, X, AlertCircle, Sparkles,
  UserCheck, ShieldAlert, BadgeCheck, FileText, Check, Ban
} from 'lucide-react';
import { api } from '../services/api';
import {
  CollaborationOfficer,
  CaseCollaboratorItem,
  TeamNoteItem,
  ActivityFeedItem,
  User,
  Case
} from '../types';
import { TruthBadge } from './TruthBadge';

interface CollaborationPanelProps {
  caseId: string;
  currentUser?: User | null;
  caseData?: Case | null;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  caseId,
  currentUser,
  caseData
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'notes' | 'activity'>('members');
  const [collaborators, setCollaborators] = useState<CaseCollaboratorItem[]>([]);
  const [availableOfficers, setAvailableOfficers] = useState<CollaborationOfficer[]>([]);
  const [notes, setNotes] = useState<TeamNoteItem[]>([]);
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingNote, setSubmittingNote] = useState(false);

  // Invite modal state
  const [selectedOfficer, setSelectedOfficer] = useState<CollaborationOfficer | null>(null);
  const [inviteMessage, setInviteMessage] = useState(
    'Requesting your expertise in tracing peel chains and multi-hop mixer flows for this suspect wallet.'
  );
  const [sendingInvite, setSendingInvite] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Quick message presets
  const messagePresets = [
    'Requesting your expertise in tracing peel chains and multi-hop mixer flows for this suspect wallet.',
    'Need assistance preparing Law Enforcement Section 91 VASP freeze notice and evidence affidavit.',
    'Suspicious darknet syndicate cluster identified; requesting cross-case intelligence analysis.',
    'High-velocity asset outflow detected; urgent co-investigation required.'
  ];

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [collabs, officers, teamNotes, feeds] = await Promise.all([
        api.getCaseCollaborators(caseId).catch(() => []),
        api.getAvailableCollaborators(caseId).catch(() => []),
        api.getCaseTeamNotes(caseId).catch(() => []),
        api.getCaseActivityFeed(caseId).catch(() => [])
      ]);
      setCollaborators(collabs);
      setAvailableOfficers(officers);
      setNotes(teamNotes);
      setActivities(feeds);
    } catch (err) {
      console.error('Failed to load collaboration data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [caseId]);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setActionErrorMessage(msg);
      setTimeout(() => setActionErrorMessage(null), 5000);
    } else {
      setActionSuccessMessage(msg);
      setTimeout(() => setActionSuccessMessage(null), 5000);
    }
  };

  const handleOpenInviteModal = (officer: CollaborationOfficer) => {
    setSelectedOfficer(officer);
    setInviteMessage(
      `Requesting collaboration on Case #${caseData?.case_number || caseId}: assistance needed on blockchain transaction tracing.`
    );
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficer) return;
    setSendingInvite(true);
    try {
      await api.sendCollaborationInvite(caseId, {
        investigator_id: selectedOfficer.id,
        message: inviteMessage.trim()
      });
      showNotification(`Collaboration invitation and message dispatched to ${selectedOfficer.full_name}!`);
      setSelectedOfficer(null);
      await loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to send collaboration invite', true);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRespondInvite = async (assignmentId: number, action: 'ACCEPT' | 'DECLINE') => {
    try {
      await api.respondCollaborationInvite(caseId, assignmentId, action);
      if (action === 'ACCEPT') {
        showNotification('Collaboration accepted! You are now an active co-investigator on this case.');
      } else {
        showNotification('Collaboration invitation declined.');
      }
      await loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to respond to invitation', true);
    }
  };

  const handleRemoveMember = async (collaboratorId: string | number, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from this case?`)) return;
    try {
      await api.removeCaseCollaborator(caseId, collaboratorId);
      showNotification(`Collaborator ${name} removed from case.`);
      await loadAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to remove collaborator', true);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const mentions = newNote.match(/@\w+/g) || [];
      await api.addCaseTeamNote(caseId, newNote.trim(), mentions);
      setNewNote('');
      const updatedNotes = await api.getCaseTeamNotes(caseId);
      setNotes(updatedNotes);
      const updatedFeeds = await api.getCaseActivityFeed(caseId);
      setActivities(updatedFeeds);
    } catch (err: any) {
      showNotification(err.message || 'Failed to post note', true);
    } finally {
      setSubmittingNote(false);
    }
  };

  const renderNoteContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="text-blue-600 font-bold bg-blue-50 px-1 py-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // Filter available officers by search query
  const filteredOfficers = availableOfficers.filter((o) => {
    const q = searchQuery.toLowerCase();
    return (
      o.full_name.toLowerCase().includes(q) ||
      o.username.toLowerCase().includes(q) ||
      o.department.toLowerCase().includes(q) ||
      o.specialization.toLowerCase().includes(q) ||
      o.badge_id.toLowerCase().includes(q)
    );
  });

  const activeCollaborators = collaborators.filter((c) => c.status === 'ACCEPTED' || c.is_lead);
  const pendingInvitations = collaborators.filter((c) => c.status === 'PENDING');

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col min-h-[680px] text-[#1E293B]">
      {/* Success / Error Banners */}
      {actionSuccessMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccessMessage}</span>
          </div>
          <button onClick={() => setActionSuccessMessage(null)}>
            <X className="w-3.5 h-3.5 text-emerald-600" />
          </button>
        </div>
      )}

      {actionErrorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{actionErrorMessage}</span>
          </div>
          <button onClick={() => setActionErrorMessage(null)}>
            <X className="w-3.5 h-3.5 text-red-600" />
          </button>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1E293B] tracking-wide flex items-center gap-2">
                Multi-Investigator Case Collaboration
                <TruthBadge category="VERIFIED" size="sm" />
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Co-investigate blockchain forensic trails, invite accredited officers, and coordinate via case notes.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-slate-600">Active Officers:</span>
            <span className="font-bold text-slate-900">{activeCollaborators.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-amber-700">Pending:</span>
            <span className="font-bold text-amber-800">{pendingInvitations.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-purple-700">Notes:</span>
            <span className="font-bold text-purple-800">{notes.length}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 my-4 border-b border-slate-100 pb-2">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'members'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Members & Available Directory</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-mono">
            {activeCollaborators.length + availableOfficers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'notes'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Team Notes & Discussion</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
            {notes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'activity'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Activity Timeline</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
            {activities.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Team Members & Available Directory */}
      {activeTab === 'members' && (
        <div className="space-y-6 flex-1 overflow-y-auto pr-1">
          {/* Section A: Active Case Investigators */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                Active Case Co-Investigators ({activeCollaborators.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Both investigators share full access to analyze, add evidence, and report.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeCollaborators.map((c) => (
                <div
                  key={c.user_id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    c.is_lead
                      ? 'bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border-blue-200 shadow-sm'
                      : 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          c.is_lead
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {c.full_name ? c.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1">
                          {c.full_name}
                          {c.is_lead && (
                            <span title="Lead Investigator">
                              <BadgeCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          @{c.username}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        c.is_lead
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {c.role}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">{c.department || 'Cyber Crime Division'}</span>
                    {!c.is_lead && (
                      <button
                        onClick={() => handleRemoveMember(c.assignment_id || c.user_id, c.full_name)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Remove Collaborator"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section B: Pending Collaboration Requests */}
          {pendingInvitations.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                  <h4 className="text-xs font-bold text-amber-900">
                    Pending Collaboration Requests ({pendingInvitations.length})
                  </h4>
                </div>
                <span className="text-[10px] text-amber-700 font-medium">
                  Waiting for officer acceptance before granting case investigation access
                </span>
              </div>

              <div className="space-y-2">
                {pendingInvitations.map((inv) => (
                  <div
                    key={inv.assignment_id}
                    className="p-3 bg-white rounded-xl border border-amber-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                        {inv.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{inv.full_name}</span>
                          <span className="text-slate-500 font-mono text-[10px]">@{inv.username}</span>
                          <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            AWAITING ACCEPTANCE
                          </span>
                        </div>
                        {inv.message && (
                          <div className="mt-1 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic text-[11px]">
                            "{inv.message}"
                          </div>
                        )}
                        <div className="mt-1 text-[10px] text-slate-400">
                          Invited by {inv.invited_by || 'Case Officer'} • {new Date(inv.joined_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {inv.can_respond ? (
                        <>
                          <button
                            onClick={() => handleRespondInvite(inv.assignment_id, 'ACCEPT')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accept & Join Case
                          </button>
                          <button
                            onClick={() => handleRespondInvite(inv.assignment_id, 'DECLINE')}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 font-semibold text-xs transition-all border border-slate-200"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Decline
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleRemoveMember(inv.assignment_id, inv.full_name)}
                          className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-[11px] font-semibold border border-transparent hover:border-red-200 transition-all"
                        >
                          Cancel Invite
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section C: Available Accredited Investigators Directory */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                  Available Investigators Directory ({filteredOfficers.length})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Send a collaboration request with an investigation briefing to partner on this case.
                </p>
              </div>

              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search officer, badge, or specialty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Officer Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredOfficers.map((officer) => {
                const isCollaborating = officer.collaboration_status === 'ACCEPTED' || officer.collaboration_status === 'LEAD';
                const isPending = officer.collaboration_status === 'PENDING';
                const isAvailable = officer.availability_status === 'AVAILABLE';

                return (
                  <div
                    key={officer.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Officer Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                            {officer.full_name ? officer.full_name.charAt(0).toUpperCase() : 'O'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 truncate">
                              {officer.full_name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              @{officer.username} • {officer.badge_id}
                            </div>
                          </div>
                        </div>

                        {/* Availability Pill */}
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          />
                          {officer.availability_status}
                        </span>
                      </div>

                      {/* Department & Specialty */}
                      <div className="space-y-1 my-2.5 text-[11px] text-slate-600">
                        <div className="flex items-center gap-1 truncate text-slate-500">
                          <span className="font-semibold text-slate-700">Unit:</span> {officer.department}
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <span className="font-semibold text-slate-700">Specialty:</span>{' '}
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 text-[10px] font-medium">
                            {officer.specialization}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>Experience: {officer.experience_years} yrs</span>
                          <span>Active Cases: {officer.active_cases_count}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invite Button / Status */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      {officer.is_current_user ? (
                        <span className="text-[11px] font-semibold text-slate-400 italic">
                          (Your Account)
                        </span>
                      ) : isCollaborating ? (
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Joined Case
                        </span>
                      ) : isPending ? (
                        <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Invite Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenInviteModal(officer)}
                          className="w-full py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Invite to Collaborate</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Team Notes & Discussion */}
      {activeTab === 'notes' && (
        <div className="flex-1 flex flex-col min-h-[480px]">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {notes.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600">No team notes yet</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Start a case discussion thread or mention colleagues with @username
                </p>
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                        {note.author.charAt(0).toUpperCase()}
                      </div>
                      {note.author}
                      {note.author_username && (
                        <span className="text-[10px] text-slate-400 font-mono">@{note.author_username}</span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <div className="text-slate-800 whitespace-pre-wrap leading-relaxed pl-6">
                    {renderNoteContent(note.content)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New Note Form */}
          <form onSubmit={handleAddNote} className="flex gap-2 pt-2 border-t border-slate-100">
            <textarea
              className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none h-14"
              placeholder="Write a team note or mention a co-investigator with @... (e.g. @investigator2 please check hop 4)"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={submittingNote || !newNote.trim()}
              className="px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all shadow-xs"
              title="Send Note (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Activity Timeline */}
      {activeTab === 'activity' && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {activities.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">No activity logged yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Collaborative actions, invitations, and findings will be recorded here
              </p>
            </div>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="p-3 rounded-xl border border-slate-100 bg-white shadow-xs flex items-start gap-3 text-xs">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 mt-0.5">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-900">{act.actor}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium mt-0.5">{act.action}</p>
                  {act.details && (
                    <p className="text-[11px] text-slate-500 mt-0.5 italic break-words">
                      "{act.details}"
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Collaboration Invite Modal */}
      {selectedOfficer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 text-[#1E293B]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Invite Investigator to Co-Investigate
                </h3>
              </div>
              <button
                onClick={() => setSelectedOfficer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Officer Preview Card */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {selectedOfficer.full_name ? selectedOfficer.full_name.charAt(0).toUpperCase() : 'O'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  {selectedOfficer.full_name}
                  <span className="text-[10px] text-slate-500 font-mono">@{selectedOfficer.username}</span>
                </div>
                <div className="text-[11px] text-slate-600 truncate">
                  {selectedOfficer.department} • {selectedOfficer.specialization}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Badge ID: {selectedOfficer.badge_id}
                </div>
              </div>
            </div>

            {/* Case Info Pill */}
            <div className="text-xs text-slate-600 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>
                Case: <strong className="text-slate-800">#{caseData?.case_number || caseId}</strong> ({caseData?.title || 'Active Investigation'})
              </span>
            </div>

            {/* Message input */}
            <form onSubmit={handleSendInvite} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Investigation Briefing / Invitation Message
                </label>
                <textarea
                  required
                  rows={3}
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 resize-none"
                  placeholder="Explain why you are inviting this officer and what forensic tasks to coordinate..."
                />
              </div>

              {/* Message Quick Presets */}
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                  Quick Presets
                </span>
                <div className="space-y-1">
                  {messagePresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInviteMessage(preset)}
                      className="w-full text-left p-1.5 rounded-lg text-[10px] text-slate-600 hover:text-blue-700 hover:bg-blue-50/70 border border-slate-100 transition-colors truncate block"
                    >
                      • {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOfficer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite || !inviteMessage.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingInvite ? 'Dispatching Invite...' : 'Send Invitation & Message'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
