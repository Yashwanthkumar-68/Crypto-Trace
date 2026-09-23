import React, { useState, useEffect } from 'react';
import { Users, UserPlus, MessageSquare, Activity, Send, Trash2 } from 'lucide-react';
import { api } from '../services/api';

interface Collaborator {
  user_id: string;
  username: string;
  full_name: string;
  role: string;
  joined_at: string;
}

interface TeamNote {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  details?: string;
  timestamp: string;
}

export const CollaborationPanel: React.FC<{caseId: string}> = ({ caseId }) => {
  const [activeTab, setActiveTab] = useState<'members' | 'notes' | 'activity'>('members');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  
  const [newUsername, setNewUsername] = useState('');
  const [newNote, setNewNote] = useState('');

  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('sih_auth_token')}`,
    'Content-Type': 'application/json'
  });
  const base = window.location.protocol === 'https:' ? '/api' : 'http://localhost:8000/api';

  const fetchCollaborators = async () => {
    try {
      const res = await fetch(`${base}/collaboration/cases/${caseId}/collaborators`, { headers: getHeaders() });
      if (res.ok) setCollaborators(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${base}/collaboration/cases/${caseId}/team-notes`, { headers: getHeaders() });
      if (res.ok) setNotes(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${base}/collaboration/cases/${caseId}/activity-feed`, { headers: getHeaders() });
      if (res.ok) setActivities(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'members') fetchCollaborators();
    if (activeTab === 'notes') fetchNotes();
    if (activeTab === 'activity') fetchActivities();
  }, [activeTab, caseId]);

  const handleAddMember = async () => {
    if (!newUsername) return;
    try {
      const res = await fetch(`${base}/collaboration/cases/${caseId}/collaborators`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          user_id: newUsername,
          username: newUsername,
          full_name: newUsername,
        })
      });
      if (res.ok) {
        setNewUsername('');
        fetchCollaborators();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await fetch(`${base}/collaboration/cases/${caseId}/collaborators/${userId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) fetchCollaborators();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddNote = async () => {
    if (!newNote) return;
    try {
      const res = await fetch(`${base}/collaboration/cases/${caseId}/team-notes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content: newNote })
      });
      if (res.ok) {
        setNewNote('');
        fetchNotes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderNoteContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) => 
      part.startsWith('@') ? <span key={i} className="text-blue-500 font-medium">{part}</span> : part
    );
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col h-[600px]">
      <div className="flex space-x-4 mb-4 border-b border-slate-100 pb-2">
        <button 
          onClick={() => setActiveTab('members')}
          className={`flex items-center space-x-1 ${activeTab === 'members' ? 'text-blue-600 border-b-2 border-blue-600 pb-2 -mb-2' : 'text-slate-500'}`}
        >
          <Users size={18} />
          <span>Team Members</span>
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={`flex items-center space-x-1 ${activeTab === 'notes' ? 'text-blue-600 border-b-2 border-blue-600 pb-2 -mb-2' : 'text-slate-500'}`}
        >
          <MessageSquare size={18} />
          <span>Team Notes</span>
        </button>
        <button 
          onClick={() => setActiveTab('activity')}
          className={`flex items-center space-x-1 ${activeTab === 'activity' ? 'text-blue-600 border-b-2 border-blue-600 pb-2 -mb-2' : 'text-slate-500'}`}
        >
          <Activity size={18} />
          <span>Activity Feed</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex space-x-2 mb-4">
              <input 
                type="text" 
                placeholder="Username or Name"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
              />
              <button 
                onClick={handleAddMember}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-1 hover:bg-blue-700"
              >
                <UserPlus size={18} />
                <span>Invite</span>
              </button>
            </div>
            
            <div className="space-y-2">
              {collaborators.map(c => (
                <div key={c.user_id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                      {c.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">{c.full_name}</div>
                      <div className="text-xs text-slate-500">@{c.username}</div>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full ml-2">
                      {c.role}
                    </span>
                  </div>
                  <button onClick={() => handleRemoveMember(c.user_id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {notes.map(note => (
                <div key={note.id} className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm text-slate-700">{note.author}</span>
                    <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-800 text-sm whitespace-pre-wrap">
                    {renderNoteContent(note.content)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              <textarea 
                className="flex-1 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-12"
                placeholder="Add a note... use @ to mention"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              <button 
                onClick={handleAddNote}
                className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 flex items-center justify-center"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
            {activities.map(act => (
              <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  <Activity size={16} />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <div className="font-bold text-slate-800 text-sm">{act.actor}</div>
                    <time className="text-xs font-medium text-slate-500">{new Date(act.timestamp).toLocaleString()}</time>
                  </div>
                  <div className="text-sm text-slate-600">{act.action}</div>
                  {act.details && <div className="text-xs text-slate-400 mt-1">{act.details}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
