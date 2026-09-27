import React, { useState } from 'react';
import { Shield, Radio, UserCheck, LogOut, Terminal, Bell, AlertTriangle, ShieldCheck, ChevronDown } from 'lucide-react';
import { User, UserRole } from '../types';

import { NotificationCenter } from './NotificationCenter';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';
import { RequireRole } from './auth/RequireRole';

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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
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
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-wider text-slate-900">
                  CryptoTrace
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {t('brand.badge', 'DEFENSE FORENSICS')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                {t('brand.subtitle', 'Real-Time VASP Identification & Money Trail Analytics')}
              </p>
            </div>
          </div>

          {/* Role-tailored Navigation Links */}
          <nav className="hidden md:flex items-center gap-4">
            
            {/* Victim Navigation */}
            <RequireRole allowedRoles={['VICTIM']} currentUser={currentUser}>
               <button
                  onClick={() => onSelectTab('victim_dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'victim_dashboard'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {t('nav.my_complaints', 'My Complaints')}
                </button>
                <button
                  onClick={() => onSelectTab('create_case')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'create_case'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {t('nav.file_complaint', 'File Complaint')}
                </button>
            </RequireRole>

            {/* Investigator & Supervisor Navigation (Dropdowns) */}
            <RequireRole allowedRoles={['INVESTIGATOR', 'SUPERVISOR', 'ADMINISTRATOR']} currentUser={currentUser}>
              
              <button
                  onClick={() => onSelectTab('investigator_dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'investigator_dashboard' || activeTab === 'dashboard'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Dashboard
              </button>

              {/* Cases Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all">
                  Cases <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
                  <button onClick={() => onSelectTab('cases')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Case Ledger</button>
                  <button onClick={() => onSelectTab('priority')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Priority Queue</button>
                </div>
              </div>

              {/* Forensics Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all">
                  Forensics <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
                  <button onClick={() => onSelectTab('verify_wallet')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-500" /> Verify Wallet</button>
                  <button onClick={() => onSelectTab('multichain')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Multi-Chain Trace</button>
                  <button onClick={() => onSelectTab('batch')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Batch Analysis</button>
                </div>
              </div>

              {/* Intelligence Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all">
                  Intelligence <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
                  <button onClick={() => onSelectTab('analytics')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Analytics</button>
                  <button onClick={() => onSelectTab('intelligence')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600">Risk & Intel</button>
                  <button onClick={() => onSelectTab('monitoring')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center justify-between">
                    Monitoring
                    {alertCount > 0 && <span className="bg-red-500 text-white rounded-full px-1.5 text-[10px]">{alertCount}</span>}
                  </button>
                </div>
              </div>

            </RequireRole>

            <RequireRole allowedRoles={['SUPERVISOR', 'ADMINISTRATOR']} currentUser={currentUser}>
               <button
                  onClick={() => onSelectTab('admin')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'admin'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Administration
              </button>
            </RequireRole>
          </nav>

          {/* Controls: Mode Toggle, Chain Selector, User Role, Profile */}
          <div className="flex items-center gap-2.5">
            {/* Unified Live Blockchain & Forensic Engine */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-emerald-600">Sepolia</span>
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
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <UserCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-semibold text-slate-900 leading-tight">
                      {currentUser.full_name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono font-medium">
                      {currentUser.role}
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
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
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
              className="md:hidden ml-1 p-2 rounded-lg bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {showRoleMenu && (
          <nav className="md:hidden py-3 border-t border-slate-200 flex flex-col gap-2 bg-white">
            <RequireRole allowedRoles={['INVESTIGATOR', 'SUPERVISOR', 'ADMINISTRATOR']} currentUser={currentUser}>
              <button onClick={() => onSelectTab('investigator_dashboard')} className="text-left px-4 py-2 text-sm text-slate-600">Dashboard</button>
              <button onClick={() => onSelectTab('cases')} className="text-left px-4 py-2 text-sm text-slate-600">Cases</button>
              <button onClick={() => onSelectTab('analytics')} className="text-left px-4 py-2 text-sm text-slate-600">Intelligence</button>
            </RequireRole>
            <RequireRole allowedRoles={['VICTIM']} currentUser={currentUser}>
              <button onClick={() => onSelectTab('victim_dashboard')} className="text-left px-4 py-2 text-sm text-slate-600">My Complaints</button>
              <button onClick={() => onSelectTab('create_case')} className="text-left px-4 py-2 text-sm text-slate-600">File Complaint</button>
            </RequireRole>
          </nav>
        )}
      </div>
    </header>
  );
};
