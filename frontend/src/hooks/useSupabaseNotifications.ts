import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export interface SupabaseNotification {
  id: string;
  user_id: number;
  case_id: string;
  title?: string;
  message: string;
  notification_type: 'CASE_ASSIGNED' | 'SUPERVISOR_REVIEW' | 'CASE_RESOLVED' | string;
  event_type?: 'CASE_ASSIGNED' | 'SUPERVISOR_REVIEW' | 'CASE_RESOLVED' | string;
  is_read: boolean;
  created_at: string;
}

export function useSupabaseNotifications(userId: number | null) {
  const [notifications, setNotifications] = useState<SupabaseNotification[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to Supabase Realtime on the notifications table
    channelRef.current = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const raw = payload.new as any;
          const newNotif: SupabaseNotification = {
            ...raw,
            notification_type: raw.notification_type || raw.event_type || 'INFO',
            event_type: raw.notification_type || raw.event_type || 'INFO'
          };
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return { notifications, markAllRead };
}
