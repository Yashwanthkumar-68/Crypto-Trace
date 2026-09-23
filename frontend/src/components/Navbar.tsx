import React, { useState } from 'react';
import { Shield, Radio, UserCheck, LogOut, Terminal, Bell, AlertTriangle, ShieldCheck } from 'lucide-react';
import { User, UserRole } from '../types';

import { NotificationCenter } from './NotificationCenter';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
  alertCount?: number;
  onOpenCase?: (caseId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  activeTab,
  onSelectTab,
  alertCount = 0,
  onOpenCase
}) => {
  const { t } = useLanguage();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  return (
    <header className="bg-[#0F172A] border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              if (currentUser?.role === 'VICTIM') onSelectTab('victim_dashboard');
              else if (currentUser?.role === 'INVESTIGATOR') onSelectTab('investigator_dashboard');
              else onSelectTab('dashboard');
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-400 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-[#0F172A] rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-wider text-white">
                  CryptoTrace
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-700/50">
                  {t('brand.badge', 'DEFENSE FORENSICS')}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 hidden sm:block font-medium">
                {t('brand.subtitle', 'Real-Time VASP Identification & Money Trail Analytics')}
              </p>
            </div>
          </div>

          {/* Role-tailored Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {currentUser?.role === 'VICTIM' ? (
              <>
                <button
                  onClick={() => onSelectTab('victim_dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'victim_dashboard'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {t('nav.my_complaints', 'My Complaints')}
                </button>
                <button
                  onClick={() => onSelectTab('verify_wallet')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'verify_wallet'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-amber-300 hover:text-white hover:bg-slate-800/70 border border-amber-500/30'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('nav.verify_wallet', 'Verify Wallet')}</span>
                </button>
                <button
                  onClick={() => onSelectTab('create_case')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'create_case'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {t('nav.file_complaint', 'File Complaint')}
                </button>
              </>
            ) : currentUser?.role === 'INVESTIGATOR' ? (
              <>
                <button
                  onClick={() => onSelectTab('investigator_dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'investigator_dashboard'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Officer Caseload
                </button>
                <button
                  onClick={() => onSelectTab('cases')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'cases' || activeTab === 'case_detail'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Case Ledger
                </button>
                <button
                  onClick={() => onSelectTab('verify_wallet')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'verify_wallet'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-amber-300 hover:text-white hover:bg-slate-800/70 border border-amber-500/30'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Verify Wallet</span>
                </button>
                <button
                  onClick={() => onSelectTab('priority')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'priority'
                      ? 'bg-[#DC2626] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Priority Queue
                </button>
                <button
                  onClick={() => onSelectTab('intelligence')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'intelligence'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Risk & Intel
                </button>
                <button
                  onClick={() => onSelectTab('multichain')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'multichain'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Multi-Chain
                </button>
                <button
                  onClick={() => onSelectTab('analytics')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => onSelectTab('batch')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'batch'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Batch Trace
                </button>
                <button
                  onClick={() => onSelectTab('monitoring')}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'monitoring'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Monitoring
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-[#DC2626] text-white rounded-full text-[9px] font-bold animate-pulse">
                      {alertCount}
                    </span>
                  )}
                </button>
              </>
            ) : currentUser?.role === 'SUPERVISOR' ? (
              <>
                <button
                  onClick={() => onSelectTab('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Command Dashboard
                </button>
                <button
                  onClick={() => onSelectTab('cases')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'cases' || activeTab === 'case_detail'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Case Ledger & Reviews
                </button>
                <button
                  onClick={() => onSelectTab('priority')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'priority'
                      ? 'bg-[#DC2626] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Priority Triage
                </button>
                <button
                  onClick={() => onSelectTab('admin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'admin'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Officer Roster & VASP
                </button>
                <button
                  onClick={() => onSelectTab('analytics')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => onSelectTab('batch')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'batch'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Batch Trace
                </button>
                <button
                  onClick={() => onSelectTab('monitoring')}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'monitoring'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Watchlist & Alerts
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-[#DC2626] text-white rounded-full text-[9px] font-bold animate-pulse">
                      {alertCount}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onSelectTab('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => onSelectTab('cases')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'cases' || activeTab === 'case_detail'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Case Ledger
                </button>
                <button
                  onClick={() => onSelectTab('priority')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'priority'
                      ? 'bg-[#DC2626] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Priority Queue
                </button>
                <button
                  onClick={() => onSelectTab('admin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'admin'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Administration
                </button>
                <button
                  onClick={() => onSelectTab('monitoring')}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'monitoring'
                      ? 'bg-[#2563EB] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  Monitoring
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-[#DC2626] text-white rounded-full text-[9px] font-bold animate-pulse">
                      {alertCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </nav>

          {/* Controls: Mode Toggle, Chain Selector, User Role, Profile */}
          <div className="flex items-center gap-2.5">
            {/* Unified Live Blockchain & Forensic Engine */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700/80 text-xs font-mono text-slate-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-400">Sepolia (11155111)</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Unified Live Sync</span>
            </div>

            {/* Smart Multilingual Language Switcher */}
            <LanguageSwitcher />

            {/* In-App Notification Center */}
            <NotificationCenter onOpenCase={onOpenCase} />

            {/* User Profile dropdown */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-semibold text-white leading-tight">
                      {currentUser.full_name}
                    </p>
                    <p className="text-[10px] text-blue-300 font-mono font-medium">
                      [{currentUser.role}]
                    </p>
                  </div>
                </button>

                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-[#1E293B]">
                    <div className="px-3.5 py-2.5 border-b border-slate-100 mb-1">
                      <p className="text-xs font-bold text-slate-800">
                        {currentUser.full_name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        @{currentUser.username} • {currentUser.email}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {currentUser.role}
                        </span>
                        {currentUser.badge_number && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            Badge: {currentUser.badge_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out / Log Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden ml-2 p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {showRoleMenu && (
          <nav className="md:hidden py-3 border-t border-slate-800 flex flex-col gap-2">
             {currentUser?.role === 'INVESTIGATOR' && (
              <>
                <button onClick={() => onSelectTab('investigator_dashboard')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'investigator_dashboard' ? 'text-white' : 'text-slate-400'}`}>Officer Caseload</button>
                <button onClick={() => onSelectTab('cases')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'cases' ? 'text-white' : 'text-slate-400'}`}>Case Ledger</button>
                <button onClick={() => onSelectTab('priority')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'priority' ? 'text-white' : 'text-slate-400'}`}>Priority Queue</button>
                <button onClick={() => onSelectTab('intelligence')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'intelligence' ? 'text-white' : 'text-slate-400'}`}>Risk & Intel</button>
                <button onClick={() => onSelectTab('multichain')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'multichain' ? 'text-white' : 'text-slate-400'}`}>Multi-Chain</button>
                <button onClick={() => onSelectTab('analytics')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'analytics' ? 'text-white' : 'text-slate-400'}`}>Analytics</button>
                <button onClick={() => onSelectTab('batch')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'batch' ? 'text-white' : 'text-slate-400'}`}>Batch Trace</button>
                <button onClick={() => onSelectTab('monitoring')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'monitoring' ? 'text-white' : 'text-slate-400'}`}>Monitoring</button>
              </>
            )}
            {currentUser?.role === 'SUPERVISOR' && (
              <>
                <button onClick={() => onSelectTab('dashboard')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400'}`}>Command Dashboard</button>
                <button onClick={() => onSelectTab('cases')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'cases' ? 'text-white' : 'text-slate-400'}`}>Case Ledger & Reviews</button>
                <button onClick={() => onSelectTab('priority')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'priority' ? 'text-white' : 'text-slate-400'}`}>Priority Triage</button>
                <button onClick={() => onSelectTab('admin')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'admin' ? 'text-white' : 'text-slate-400'}`}>Officer Roster & VASP</button>
                <button onClick={() => onSelectTab('analytics')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'analytics' ? 'text-white' : 'text-slate-400'}`}>Analytics</button>
                <button onClick={() => onSelectTab('batch')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'batch' ? 'text-white' : 'text-slate-400'}`}>Batch Trace</button>
                <button onClick={() => onSelectTab('monitoring')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'monitoring' ? 'text-white' : 'text-slate-400'}`}>Watchlist & Alerts</button>
              </>
            )}
             {currentUser?.role === 'VICTIM' && (
              <>
                <button onClick={() => onSelectTab('victim_dashboard')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'victim_dashboard' ? 'text-white' : 'text-slate-400'}`}>My Complaints</button>
                <button onClick={() => onSelectTab('create_case')} className={`text-left px-3 py-2 text-xs font-semibold ${activeTab === 'create_case' ? 'text-white' : 'text-slate-400'}`}>File Complaint</button>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};
