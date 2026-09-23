import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export interface AlertToastItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  caseId?: string;
  timestamp: string;
}

interface AlertToastProps {
  alerts: AlertToastItem[];
  onDismiss: (id: string) => void;
  onNavigate?: (caseId: string) => void;
}

const getSeverityStyles = (severity: AlertSeverity) => {
  switch (severity) {
    case 'info':
      return {
        bg: 'bg-slate-800 border-blue-500',
        icon: <Info className="w-5 h-5 text-blue-400" />,
        text: 'text-blue-400',
      };
    case 'warning':
      return {
        bg: 'bg-slate-800 border-amber-500',
        icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
        text: 'text-amber-400',
      };
    case 'critical':
      return {
        bg: 'bg-slate-800 border-red-500',
        icon: <XCircle className="w-5 h-5 text-red-500" />,
        text: 'text-red-500',
      };
    case 'emergency':
      return {
        bg: 'bg-slate-800 border-red-600 animate-pulse',
        icon: <Bell className="w-5 h-5 text-red-600 animate-bounce" />,
        text: 'text-red-600 font-bold',
      };
    default:
      return {
        bg: 'bg-slate-800 border-slate-500',
        icon: <Info className="w-5 h-5 text-slate-400" />,
        text: 'text-slate-400',
      };
  }
};

const SingleToast: React.FC<{
  alert: AlertToastItem;
  onDismiss: (id: string) => void;
  onNavigate?: (caseId: string) => void;
}> = ({ alert, onDismiss, onNavigate }) => {
  const [isVisible, setIsVisible] = useState(false);
  const styles = getSeverityStyles(alert.severity);

  useEffect(() => {
    // Trigger entrance animation
    const enterTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-dismiss logic based on severity
    let dismissTimer: any = null;
    
    if (alert.severity === 'info') {
      dismissTimer = setTimeout(() => handleDismiss(), 5000);
    } else if (alert.severity === 'warning') {
      dismissTimer = setTimeout(() => handleDismiss(), 10000);
    }
    // critical and emergency require manual dismissal

    return () => {
      clearTimeout(enterTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [alert.severity]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(alert.id), 300); // Wait for exit animation
  };

  const handleClick = () => {
    if (alert.caseId && onNavigate) {
      onNavigate(alert.caseId);
      handleDismiss();
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        w-80 sm:w-96 p-4 mb-3 rounded-lg border-l-4 shadow-lg
        ${styles.bg} text-slate-200 cursor-pointer hover:bg-slate-700
      `}
      onClick={handleClick}
      role="alert"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-0.5">{styles.icon}</div>
          <div className="flex-1">
            <h4 className={`text-sm font-semibold mb-1 ${styles.text}`}>
              {alert.title}
            </h4>
            <p className="text-xs text-slate-300 line-clamp-2">
              {alert.message}
            </p>
            <span className="text-[10px] text-slate-400 block mt-2">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="ml-2 text-slate-400 hover:text-slate-200 focus:outline-none"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const AlertToast: React.FC<AlertToastProps> = ({ alerts, onDismiss, onNavigate }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {alerts.map((alert) => (
        <SingleToast
          key={alert.id}
          alert={alert}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
};
