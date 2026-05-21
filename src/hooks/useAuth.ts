import { useState, useEffect, useRef } from 'react';
import { supabase, getMemberByDiscordId, upsertMember } from '@/lib/supabase';
import type { CurrentUser, Member } from '@/types';
import { checkGuildMember } from '@/lib/discord';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const initStarted = useRef(false);

  // Handle user login/registration — async operations outside onAuthStateChange
  const handleUser = async (user: CurrentUser['user']) => {
    try {
      const avatarUrl =
        user.user_metadata?.avatar_url ||
        `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 6)}.png`;
      const fullName =
        user.user_metadata?.custom_claims?.global_name ||
        user.user_metadata?.full_name ||
        'Unknown';

      // Upsert member record
      await upsertMember({
        discord_id: user.id,
        username: fullName,
        avatar: avatarUrl,
      });

      // Fetch full member record
      const member = await getMemberByDiscordId(user.id);
      if (member) {
        setCurrentUser({
          user: {
            ...user,
            user_metadata: {
              ...user.user_metadata,
              avatar_url: avatarUrl,
              full_name: fullName,
            },
          },
          member,
        });
      }
    } catch (err) {
      console.error('handleUser error:', err);
    }
  };

  // Initialize auth + listen for changes
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    let mounted = true;

    // Initial session check
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          await handleUser(session.user as CurrentUser['user']);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    // CRITICAL: onAuthStateChange callback MUST be synchronous.
    // Async callbacks block the auth channel and cause deadlocks.
    // We use a Promise chain (.then) to defer async work.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep loading state during auth transitions
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        if (mounted) setLoading(true);
      }

      if (event === 'SIGNED_IN' && session?.user && mounted) {
        // Defer async work to avoid blocking the auth channel
        Promise.resolve()
          .then(() => handleUser(session.user as CurrentUser['user']))
          .finally(() => {
            if (mounted) setLoading(false);
          });
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setCurrentUser(null);
          setLoading(false);
        }
      } else {
        // For other events (TOKEN_REFRESHED, etc.), just stop loading
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty deps — run once only

  const isLeader = currentUser?.member.role === 'leader';
  const isElder = currentUser?.member.role === 'elder';
  const isAdmin = isLeader || isElder;

  return {
    currentUser,
    loading,
    isLeader,
    isElder,
    isAdmin,
  };
}

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('dkp', { ascending: false });
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadMembers();
  }, []);

  return { members, loading, loadMembers };
}
