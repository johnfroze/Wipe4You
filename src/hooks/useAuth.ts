import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import {
  supabase,
  getMemberByDiscordId,
  upsertMember,
} from '@/lib/supabase';

import type {
  CurrentUser,
  Member,
} from '@/types';

// IMPORTANT
import { checkGuildMember } from '@/lib/discord';

export function useAuth() {
  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [authError, setAuthError] =
    useState<string | null>(null);

  const initStarted =
    useRef(false);

  // HANDLE USER LOGIN
  const handleUser = async (
    user: CurrentUser['user']
  ) => {
    try {
      // DISCORD SERVER CHECK
    const allowed =
  await checkGuildMember();;

      if (!allowed) {
        await supabase.auth.signOut();
        setAuthError(
          'You must join the guild Discord server to access this dashboard.'
        );
        return;
      }

      const avatarUrl =
        user.user_metadata
          ?.avatar_url ||
        `https://cdn.discordapp.com/embed/avatars/${
          Math.floor(
            Math.random() * 6
          )
        }.png`;

      const fullName =
        user.user_metadata
          ?.custom_claims
          ?.global_name ||
        user.user_metadata
          ?.full_name ||
        'Unknown';

      // CHECK EXISTING MEMBER
      let member =
        await getMemberByDiscordId(
          user.id
        );

      // ONLY CREATE FIRST TIME
      if (!member) {
        await upsertMember({
          discord_id: user.id,
          username: fullName,
          avatar: avatarUrl,
        });

        // REFETCH
        member =
          await getMemberByDiscordId(
            user.id
          );
      }

      // FAILSAFE
      if (!member) {
        console.error(
          'Failed to create member'
        );

        return;
      }

      // IMPORTANT:
      // DO NOT overwrite renamed usernames
      setCurrentUser({
        user: {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            avatar_url:
              avatarUrl,

            // USE DATABASE NAME
            full_name:
              member.username,
          },
        },

        member,
      });
    } catch (err) {
      console.error(
        'handleUser error:',
        err
      );
    }
  };

  // INIT AUTH
  useEffect(() => {
    if (
      initStarted.current
    )
      return;

    initStarted.current = true;

    let mounted = true;

    // INITIAL SESSION
    const init = async () => {
      try {
        const {
          data: {
            session,
          },
        } =
          await supabase.auth.getSession();

        if (
          session?.user &&
          mounted
        ) {
          await handleUser(
            session.user as CurrentUser['user']
          );
        }
      } catch (err) {
        console.error(
          'Auth init error:',
          err
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    init();

    // AUTH LISTENER
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          event,
          session
        ) => {
          // LOADING
          if (
            event ===
              'SIGNED_IN' ||
            event ===
              'SIGNED_OUT'
          ) {
            if (mounted) {
              setLoading(
                true
              );
            }
          }

          // SIGNED IN
          if (
            event ===
              'SIGNED_IN' &&
            session?.user &&
            mounted
          ) {
            Promise.resolve()
              .then(() =>
                handleUser(
                  session.user as CurrentUser['user']
                )
              )
              .finally(() => {
                if (
                  mounted
                ) {
                  setLoading(
                    false
                  );
                }
              });
          }

          // SIGNED OUT
          else if (
            event ===
            'SIGNED_OUT'
          ) {
            if (mounted) {
              setCurrentUser(
                null
              );

              setLoading(
                false
              );
            }
          }

          // OTHER EVENTS
          else {
            if (mounted) {
              setLoading(
                false
              );
            }
          }
        }
      );

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  // ROLES
  const isLeader =
    currentUser?.member
      .role ===
    'leader';

  const isElder =
    currentUser?.member
      .role ===
    'elder';

  const isAdmin =
    isLeader || isElder;

  return {
    currentUser,
    loading,
    authError,
    isLeader,
    isElder,
    isAdmin,
  };
}

// MEMBERS
export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTime = useRef<number>(0);
  const CACHE_MS = 3000; // skip refetch if data is <3s old

  const loadMembers = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime.current < CACHE_MS) return;
    lastFetchTime.current = now;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, discord_id, username, avatar, role, dkp, attendance, created_at')
        .order('dkp', { ascending: false });
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced + forces cache bypass so realtime events always refresh
  const loadMembersDebounced = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      lastFetchTime.current = 0; // bypass cache for explicit reloads
      loadMembers();
    }, 200);
  }, [loadMembers]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadMembers();
  }, [loadMembers]);

  return {
    members,
    loading,
    loadMembers: loadMembersDebounced,
  };
}
