import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, updateMemberDkp } from '@/lib/supabase';
import type { CurrentUser, Member, AttendanceEvent } from '@/types';
import {
  Plus,
  Trash2,
  AlertTriangle,
  Crown,
  UserCheck,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  TrendingUp,
  X,
  Loader2,
  Search,
  Users,
  History,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────
interface AttendanceLog {
  id: number;
  member_id: string;
  event_id: number | null;
  event_name: string;
  dkp_awarded: number;
  recorded_at: string;
}

interface Props {
  currentUser: CurrentUser | null;
  members: Member[];
  onMembersChange: () => void;
}

// ─── Confirm Modal ────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmClass = 'bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600/30',
  onConfirm,
  onCancel,
  loading = false,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm bg-[#222] hover:bg-[#333] text-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 disabled:opacity-50 ${confirmClass}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium ${
        type === 'success'
          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
          : 'bg-red-500/10 text-red-400 border border-red-500/20'
      }`}
    >
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {message}
      <button onClick={onClose} className="ml-2 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export function AttendancePage({ currentUser, members, onMembersChange }: Props) {
  const isAdmin =
    currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';

  // ── State ──
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [newEventName, setNewEventName] = useState('');
  const [newEventDkp, setNewEventDkp] = useState('');
  const [attendanceNames, setAttendanceNames] = useState('');
  const [checkedEventIds, setCheckedEventIds] = useState<Set<number>>(new Set());

  const [showModal, setShowModal] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [showEventHistory, setShowEventHistory] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [eventHistorySearch, setEventHistorySearch] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<'decay' | 'reset' | 'deleteEvent' | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<number | null>(null);

  // ── Toast helper ──
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Load Events ──
  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('attendance_events')
      .select('*')
      .order('id', { ascending: false });
    if (error) {
      console.error('loadEvents error:', error);
      return;
    }
    setEvents(data || []);
  }, []);

  // ── Load Logs — fetch ALL logs, no member filter ──
  // RLS must have a policy: authenticated users can select all rows.
  // If you see 0 rows here, run this in Supabase SQL editor:
  //   create policy "attendance_log_select" on attendance_log
  //     for select to authenticated using (true);
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_log')
        .select('id, member_id, event_id, event_name, dkp_awarded, recorded_at')
        .order('recorded_at', { ascending: false });

      if (error) {
        console.error('loadLogs error:', error.message, error.code, error.details);
        showToast('Could not load attendance history', 'error');
        setAttendanceLogs([]);
        return;
      }

      console.debug(`[attendance_log] fetched ${data?.length ?? 0} rows`);
      // Normalize member_id to string so UUID vs text comparison always works
      setAttendanceLogs(
        (data || []).map((row) => ({
          ...row,
          member_id: String(row.member_id),
        }))
      );
    } finally {
      setLogsLoading(false);
    }
  }, [showToast]);

  // ── Initial load + realtime subscriptions ──
  useEffect(() => {
    loadEvents();
    loadLogs();

    const eventsChannel = supabase
      .channel('attendance-events-ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_events' },
        () => loadEvents()
      )
      .subscribe();

    const logsChannel = supabase
      .channel('attendance-log-ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance_log' },
        () => loadLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [loadEvents, loadLogs]);

  // ── Derived: selected events & DKP ──
  const selectedEvents = useMemo(
    () => events.filter((e) => checkedEventIds.has(e.id)),
    [events, checkedEventIds]
  );

  const selectedDkp = useMemo(
    () => selectedEvents.reduce((sum, e) => sum + e.dkp, 0),
    [selectedEvents]
  );

  const toggleEvent = useCallback((id: number) => {
    setCheckedEventIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Per-member log lookup (string-normalized) ──
  const getLogsForMember = useCallback(
    (memberId: string) =>
      attendanceLogs.filter((l) => l.member_id === String(memberId)),
    [attendanceLogs]
  );

  const maxAttendance = useMemo(
    () => Math.max(...members.map((m) => m.attendance || 0), 1),
    [members]
  );

  // ── Event History groups ──
  // Groups all attendance_log rows by event_name, collects unique attendees
  // per session (by date), so admin can see exactly who attended each event.
  const eventGroups = useMemo(() => {
    const map = new Map<string, {
      eventName: string;
      dkpAwarded: number;
      totalAttendees: number;
      sessions: {
        date: string;
        attendees: { memberId: string; memberName: string }[];
      }[];
    }>();

    attendanceLogs.forEach((log) => {
      const existing = map.get(log.event_name);
      const date = new Date(log.recorded_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      });
      const memberName =
        members.find((m) => String(m.id) === String(log.member_id))?.username ||
        `Unknown (${log.member_id.slice(0, 6)})`;

      if (existing) {
        const session = existing.sessions.find((s) => s.date === date);
        if (session) {
          if (!session.attendees.find((a) => a.memberId === log.member_id)) {
            session.attendees.push({ memberId: log.member_id, memberName });
            existing.totalAttendees++;
          }
        } else {
          existing.sessions.push({ date, attendees: [{ memberId: log.member_id, memberName }] });
          existing.totalAttendees++;
        }
      } else {
        map.set(log.event_name, {
          eventName: log.event_name,
          dkpAwarded: log.dkp_awarded,
          totalAttendees: 1,
          sessions: [{ date, attendees: [{ memberId: log.member_id, memberName }] }],
        });
      }
    });

    // Sort sessions newest first within each event
    return Array.from(map.values())
      .sort((a, b) => b.totalAttendees - a.totalAttendees)
      .map((g) => ({
        ...g,
        sessions: g.sessions.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      }));
  }, [attendanceLogs, members]);

  const filteredEventGroups = useMemo(() => {
    if (!eventHistorySearch) return eventGroups;
    const q = eventHistorySearch.toLowerCase();
    return eventGroups.filter(
      (g) =>
        g.eventName.toLowerCase().includes(q) ||
        g.sessions.some((s) => s.attendees.some((a) => a.memberName.toLowerCase().includes(q)))
    );
  }, [eventGroups, eventHistorySearch]);
  const addEvent = async () => {
    const name = newEventName.trim();
    const dkp = parseInt(newEventDkp);
    if (!name || isNaN(dkp) || dkp <= 0) {
      showToast('Enter a valid event name and DKP value', 'error');
      return;
    }
    const { error } = await supabase.from('attendance_events').insert({ name, dkp });
    if (error) {
      showToast('Failed to add event', 'error');
      return;
    }
    setNewEventName('');
    setNewEventDkp('');
    showToast(`"${name}" added`, 'success');
    await loadEvents();
  };

  // ── Record Attendance ──
  const recordAttendance = async () => {
    if (selectedDkp === 0) {
      showToast('Select at least one event', 'error');
      return;
    }
    const names = attendanceNames
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) {
      showToast('Enter at least one username', 'error');
      return;
    }

    setSavingAttendance(true);
    let matched = 0;

    try {
      for (const name of names) {
        const member = members.find(
          (x) => x.username.toLowerCase() === name.toLowerCase()
        );
        if (!member) continue;
        matched++;

        // Update DKP + attendance count
        const { error: memberErr } = await supabase
          .from('members')
          .update({
            dkp: member.dkp + selectedDkp,
            attendance: (member.attendance || 0) + 1,
          })
          .eq('id', member.id);

        if (memberErr) {
          console.error('member update error:', memberErr);
          continue;
        }

        // Insert one log row per event
        for (const event of selectedEvents) {
          const { error: logErr } = await supabase.from('attendance_log').insert({
            member_id: member.id,
            event_id: event.id,
            event_name: event.name,
            dkp_awarded: event.dkp,
          });
          if (logErr) console.error('log insert error:', logErr);
        }
      }

      await onMembersChange();
      await loadLogs();

      setShowModal(false);
      setAttendanceNames('');
      setCheckedEventIds(new Set());

      if (matched === 0) {
        showToast('No matching usernames found', 'error');
      } else {
        showToast(
          `+${selectedDkp} DKP awarded to ${matched} member${matched !== 1 ? 's' : ''}`,
          'success'
        );
      }
    } catch (err) {
      console.error('recordAttendance error:', err);
      showToast('Failed to record attendance', 'error');
    } finally {
      setSavingAttendance(false);
    }
  };

  // ── Apply Decay ──
  const applyDecay = async () => {
    setConfirmLoading(true);
    try {
      for (const m of members) {
        const reduction = Math.floor(m.dkp * 0.1);
        await updateMemberDkp(m.id, Math.max(0, m.dkp - reduction));
      }
      await onMembersChange();
      showToast('10% decay applied to all members', 'success');
    } catch {
      showToast('Decay failed', 'error');
    } finally {
      setConfirmLoading(false);
      setConfirmModal(null);
    }
  };

  // ── Reset Attendance ──
  const resetAttendance = async () => {
    setConfirmLoading(true);
    try {
      for (const m of members) {
        await supabase.from('members').update({ attendance: 0 }).eq('id', m.id);
      }
      await supabase.from('attendance_log').delete().neq('id', 0);
      await onMembersChange();
      await loadLogs();
      showToast('Attendance and history reset', 'success');
    } catch {
      showToast('Failed to reset attendance', 'error');
    } finally {
      setConfirmLoading(false);
      setConfirmModal(null);
    }
  };

  // ── Delete Event ──
  const deleteEvent = async () => {
    if (!pendingDeleteEventId) return;
    setConfirmLoading(true);
    const { error } = await supabase
      .from('attendance_events')
      .delete()
      .eq('id', pendingDeleteEventId);
    if (error) {
      showToast('Failed to delete event', 'error');
    } else {
      showToast('Event deleted', 'success');
      await loadEvents();
    }
    setPendingDeleteEventId(null);
    setConfirmLoading(false);
    setConfirmModal(null);
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Confirm Modals ── */}
      {confirmModal === 'decay' && (
        <ConfirmModal
          title="Apply 10% DKP Decay"
          message="This will reduce every member's DKP by 10%. This cannot be undone."
          confirmLabel="Apply Decay"
          confirmClass="bg-orange-600/20 text-orange-400 border border-orange-500/20 hover:bg-orange-600/30"
          onConfirm={applyDecay}
          onCancel={() => setConfirmModal(null)}
          loading={confirmLoading}
        />
      )}
      {confirmModal === 'reset' && (
        <ConfirmModal
          title="Reset All Attendance"
          message="This sets every member's attendance count to 0 and wipes all history. This cannot be undone."
          confirmLabel="Reset Attendance"
          onConfirm={resetAttendance}
          onCancel={() => setConfirmModal(null)}
          loading={confirmLoading}
        />
      )}
      {confirmModal === 'deleteEvent' && (
        <ConfirmModal
          title="Delete Event"
          message="Remove this event from the list? Past attendance logs that used this event are unaffected."
          confirmLabel="Delete Event"
          onConfirm={deleteEvent}
          onCancel={() => {
            setConfirmModal(null);
            setPendingDeleteEventId(null);
          }}
          loading={confirmLoading}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="text-[#D4AF37]" size={24} />
            Attendance
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track guild events and award DKP</p>
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <UserCheck size={16} />
              Add Attendance
            </button>
            <button
              onClick={() => setConfirmModal('decay')}
              className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 bg-[#222] text-gray-300 hover:bg-[#333]"
            >
              <AlertTriangle size={16} />
              Apply 10% Decay
            </button>
            <button
              onClick={() => setConfirmModal('reset')}
              className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 bg-red-900/40 text-red-400 hover:bg-red-800/50"
            >
              <Trash2 size={16} />
              Reset Attendance
            </button>
          </div>
        )}
      </div>

      {/* ── Event History (admin only) ── */}
      {isAdmin && (
        <div className="card overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
            onClick={() => setShowEventHistory((v) => !v)}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center">
                <History size={14} className="text-[#D4AF37]" />
              </div>
              <div>
                <h2 className="font-black text-base">Event Attendance History</h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  {eventGroups.length} event{eventGroups.length !== 1 ? 's' : ''} recorded
                  {logsLoading && ' · loading...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {showEventHistory && (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    value={eventHistorySearch}
                    onChange={(e) => setEventHistorySearch(e.target.value)}
                    placeholder="Search event or player..."
                    className="pl-8 pr-3 py-1.5 bg-black/60 border border-[#1e2d3d] rounded-xl text-xs focus:border-[rgba(212,175,55,0.5)] focus:outline-none w-48"
                  />
                  {eventHistorySearch && (
                    <button onClick={() => setEventHistorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                      <X size={11} />
                    </button>
                  )}
                </div>
              )}
              <div className="text-gray-600">
                {showEventHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>
          </div>

          {/* Content */}
          {showEventHistory && (
            <div className="border-t border-[#1e2d3d] animate-fade-in">
              {logsLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading history...</span>
                </div>
              ) : filteredEventGroups.length === 0 ? (
                <div className="py-10 text-center">
                  <History size={36} className="mx-auto text-gray-700 mb-2" />
                  <p className="text-gray-500 text-sm">
                    {eventHistorySearch ? `No results for "${eventHistorySearch}"` : 'No attendance history recorded yet'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#0f1923]">
                  {filteredEventGroups.map((group) => {
                    const isOpen = expandedEvent === group.eventName;
                    const totalUniquePlayers = new Set(
                      group.sessions.flatMap((s) => s.attendees.map((a) => a.memberId))
                    ).size;

                    return (
                      <div key={group.eventName}>
                        {/* Event row */}
                        <div
                          className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                          onClick={() => setExpandedEvent(isOpen ? null : group.eventName)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[rgba(212,175,55,0.06)] border border-cyan-500/15 flex items-center justify-center shrink-0">
                              <Calendar size={14} className="text-[#D4AF37]" />
                            </div>
                            <div>
                              <div className="font-bold text-sm">{group.eventName}</div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                  <Users size={10} />
                                  {totalUniquePlayers} unique player{totalUniquePlayers !== 1 ? 's' : ''}
                                </span>
                                <span className="text-[11px] text-gray-600">·</span>
                                <span className="text-[11px] text-gray-500">
                                  {group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}
                                </span>
                                <span className="text-[11px] text-gray-600">·</span>
                                <span className="text-[11px] text-[rgba(212,175,55,0.6)] font-bold">
                                  +{group.dkpAwarded} DKP each
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right hidden sm:block">
                              <div className="text-xs text-gray-600">Last run</div>
                              <div className="text-xs text-gray-400 font-medium">
                                {group.sessions[0]?.date || '—'}
                              </div>
                            </div>
                            <div className="text-gray-600">
                              {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </div>
                          </div>
                        </div>

                        {/* Sessions list */}
                        {isOpen && (
                          <div className="bg-[#060a10] px-4 pb-4 pt-2 animate-fade-in space-y-3">
                            {group.sessions.map((session, si) => (
                              <div key={si} className="rounded-xl border border-[#1a2234] overflow-hidden">
                                {/* Session header */}
                                <div className="flex items-center justify-between px-3 py-2.5 bg-black/40">
                                  <div className="flex items-center gap-2">
                                    <Clock size={12} className="text-gray-600" />
                                    <span className="text-xs font-bold text-gray-300">{session.date}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                                      <Users size={10} />
                                      {session.attendees.length} player{session.attendees.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-[11px] text-[rgba(212,175,55,0.6)] font-bold">
                                      +{group.dkpAwarded} DKP
                                    </span>
                                  </div>
                                </div>

                                {/* Attendees grid */}
                                <div className="p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                  {session.attendees
                                    .filter((a) =>
                                      !eventHistorySearch ||
                                      a.memberName.toLowerCase().includes(eventHistorySearch.toLowerCase())
                                    )
                                    .sort((a, b) => a.memberName.localeCompare(b.memberName))
                                    .map((attendee) => {
                                      const memberData = members.find(
                                        (m) => String(m.id) === String(attendee.memberId)
                                      );
                                      return (
                                        <div
                                          key={attendee.memberId}
                                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/30 border border-[#1e2d3d]"
                                        >
                                          {memberData?.avatar ? (
                                            <img
                                              src={memberData.avatar}
                                              alt=""
                                              className="w-5 h-5 rounded-full border border-[#1e2d3d] shrink-0"
                                            />
                                          ) : (
                                            <div className="w-5 h-5 rounded-full bg-[#1e2d3d] shrink-0" />
                                          )}
                                          <span className="text-xs text-gray-300 truncate font-medium">
                                            {attendee.memberName}
                                          </span>
                                          {memberData?.role === 'leader' && (
                                            <Crown size={9} className="text-yellow-400 shrink-0" />
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>

                                {/* "X more" if search filters some out */}
                                {eventHistorySearch &&
                                  session.attendees.filter((a) =>
                                    a.memberName.toLowerCase().includes(eventHistorySearch.toLowerCase())
                                  ).length < session.attendees.length && (
                                  <div className="px-3 pb-2 text-[11px] text-gray-600">
                                    +{session.attendees.length -
                                      session.attendees.filter((a) =>
                                        a.memberName.toLowerCase().includes(eventHistorySearch.toLowerCase())
                                      ).length} more not shown
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Leaderboard ── */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Crown className="text-yellow-400" size={22} />
            <h2 className="text-xl font-bold">Leaderboard</h2>
            <span className="text-gray-500 text-sm ml-1">
              ({memberSearch
                ? `${members.filter(m => m.username.toLowerCase().includes(memberSearch.toLowerCase())).length} of ${members.length}`
                : members.length} members)
            </span>
          </div>
          <div className="flex items-center gap-3">
            {logsLoading && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin" />
                Loading history...
              </div>
            )}
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members..."
                className="pl-8 pr-3 py-2 bg-black/60 border border-[#1e2d3d] rounded-xl text-xs focus:border-[rgba(212,175,55,0.5)] focus:outline-none w-44"
              />
              {memberSearch && (
                <button onClick={() => setMemberSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {members
            .filter(m => !memberSearch || m.username.toLowerCase().includes(memberSearch.toLowerCase()))
            .map((m, i) => {
            const logs = getLogsForMember(m.id);
            const isExpanded = expandedMember === m.id;
            const attendanceCount = m.attendance || 0;
            const attendancePct =
              maxAttendance > 0
                ? Math.round((attendanceCount / maxAttendance) * 100)
                : 0;

            // Group logs by calendar date
            const logsByDate = logs.reduce<Record<string, AttendanceLog[]>>(
              (acc, log) => {
                const date = new Date(log.recorded_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });
                if (!acc[date]) acc[date] = [];
                acc[date].push(log);
                return acc;
              },
              {}
            );

            return (
              <div
                key={m.id}
                className="rounded-xl border border-[#1a1a1a] hover:border-[#2a2a2a] transition-colors overflow-hidden"
              >
                {/* ── Row ── */}
                <div
                  className="flex items-center justify-between p-4 bg-[#0a0a0a] cursor-pointer select-none"
                  onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                >
                  {/* Left: rank + avatar + name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        i === 0
                          ? 'bg-yellow-400/20 text-yellow-400'
                          : i === 1
                          ? 'bg-gray-300/20 text-gray-300'
                          : i === 2
                          ? 'bg-orange-400/20 text-orange-400'
                          : 'bg-[#1a1a1a] text-gray-500'
                      }`}
                    >
                      #{i + 1}
                    </div>

                    <img
                      src={m.avatar}
                      alt=""
                      className="w-10 h-10 rounded-full border border-[#333] shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.username}</div>
                      <div className="text-gray-500 text-xs capitalize flex items-center gap-1">
                        {m.role === 'leader' && (
                          <Crown size={10} className="text-yellow-400" />
                        )}
                        {m.role}
                      </div>
                    </div>
                  </div>

                  {/* Center: attendance bar (hidden on mobile) */}
                  <div className="hidden sm:flex flex-col gap-1 flex-1 max-w-xs px-6">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-0.5">
                      <span className="flex items-center gap-1">
                        <TrendingUp size={11} />
                        {attendanceCount} attended
                      </span>
                      {logs.length > 0 && (
                        <span className="flex items-center gap-1 text-gray-600">
                          <Clock size={11} />
                          {new Date(logs[0].recorded_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#A87820] to-[#D4AF37] rounded-full transition-all duration-500"
                        style={{ width: `${attendancePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Right: DKP + chevron */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-[#D4AF37] text-xl font-bold tabular-nums">
                      {m.dkp} DKP
                    </div>
                    <div className="text-gray-600">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* ── Expanded history ── */}
                {isExpanded && (
                  <div className="border-t border-[#1a1a1a] bg-[#060606] px-4 py-4">
                    {logsLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-gray-500 text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        Loading history...
                      </div>
                    ) : logs.length === 0 ? (
                      <div className="py-6 text-center space-y-1">
                        <p className="text-gray-500 text-sm">No attendance history yet.</p>
                        <p className="text-gray-700 text-xs">
                          History appears here after attendance is recorded with the new system.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary line */}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <CheckCircle2 size={13} className="text-[#D4AF37]" />
                          <span>
                            {logs.length} event{logs.length !== 1 ? 's' : ''} attended
                            {' · '}
                            {Object.keys(logsByDate).length} session
                            {Object.keys(logsByDate).length !== 1 ? 's' : ''}
                            {' · '}
                            <span className="text-[rgba(212,175,55,0.6)] font-medium">
                              +{logs.reduce((s, l) => s + l.dkp_awarded, 0)} DKP total
                            </span>
                          </span>
                        </div>

                        {/* Sessions grouped by date */}
                        {Object.entries(logsByDate).map(([date, dateLogs]) => (
                          <div key={date}>
                            {/* Date header */}
                            <div className="flex items-center gap-2 mb-2">
                              <Clock size={12} className="text-gray-600 shrink-0" />
                              <span className="text-xs text-gray-500 shrink-0">{date}</span>
                              <div className="flex-1 h-px bg-[#1a1a1a]" />
                              <span className="text-xs text-[rgba(212,175,55,0.4)] shrink-0">
                                +{dateLogs.reduce((s, l) => s + l.dkp_awarded, 0)} DKP
                              </span>
                            </div>

                            {/* Event chips */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-4">
                              {dateLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="flex items-center justify-between bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg px-3 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2
                                      size={12}
                                      className="text-green-500 shrink-0"
                                    />
                                    <span className="text-xs text-gray-300">
                                      {log.event_name}
                                    </span>
                                  </div>
                                  <span className="text-xs text-[#D4AF37] font-medium tabular-nums ml-3 shrink-0">
                                    +{log.dkp_awarded} DKP
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Empty search state */}
          {memberSearch && members.filter(m =>
            m.username.toLowerCase().includes(memberSearch.toLowerCase())
          ).length === 0 && (
            <div className="py-10 text-center">
              <Search size={32} className="mx-auto text-gray-700 mb-2" />
              <p className="text-gray-500 text-sm">No members match "{memberSearch}"</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Record Attendance Modal ── */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-[#222]">

            {/* Modal header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold">Record Attendance</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* DKP preview banner */}
            {selectedDkp > 0 && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-[rgba(212,175,55,0.04)] border border-[rgba(212,175,55,0.2)] flex items-center justify-between">
                <span className="text-sm text-gray-400">Total DKP to award per member</span>
                <span className="text-[#D4AF37] font-bold text-lg tabular-nums">
                  +{selectedDkp} DKP
                </span>
              </div>
            )}

            {/* Select events */}
            <div className="space-y-3 mb-6">
              <h3 className="font-bold">Select Events</h3>

              {events.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4 bg-black border border-[#222] rounded-xl">
                  No events yet. Add one below.
                </p>
              ) : (
                events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between bg-black border border-[#222] rounded-xl p-3"
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-[#D4AF37]"
                        checked={checkedEventIds.has(e.id)}
                        onChange={() => toggleEvent(e.id)}
                      />
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-[#D4AF37] text-sm">+{e.dkp} DKP</div>
                      </div>
                    </label>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setPendingDeleteEventId(e.id);
                          setConfirmModal('deleteEvent');
                        }}
                        className="text-red-400 hover:text-red-300 p-2 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add new event */}
            <div className="space-y-3 mb-6">
              <h3 className="font-bold">Add New Event</h3>
              <div className="flex gap-3">
                <input
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEvent()}
                  placeholder="Event name"
                  className="flex-1 bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
                />
                <input
                  value={newEventDkp}
                  onChange={(e) => setNewEventDkp(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEvent()}
                  placeholder="DKP"
                  type="number"
                  min="1"
                  className="w-28 bg-black border border-[#333] rounded-xl p-3 text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
                />
                <button
                  onClick={addEvent}
                  className="btn-primary flex items-center gap-2 shrink-0"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>

            {/* Usernames textarea */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Usernames</h3>
                <span className="text-xs text-gray-500">One per line</span>
              </div>
              <textarea
                value={attendanceNames}
                onChange={(e) => setAttendanceNames(e.target.value)}
                placeholder={`PlayerOne\nPlayerTwo\nPlayerThree`}
                className="w-full h-40 bg-black border border-[#333] rounded-2xl p-4 resize-none text-sm focus:border-[rgba(212,175,55,0.5)] focus:outline-none"
              />
              {/* Preview matched count */}
              {attendanceNames.trim() && (
                <p className="text-xs text-gray-500">
                  {
                    attendanceNames
                      .split('\n')
                      .map((n) => n.trim())
                      .filter((n) =>
                        n && members.some(
                          (m) => m.username.toLowerCase() === n.toLowerCase()
                        )
                      ).length
                  }{' '}
                  of{' '}
                  {attendanceNames.split('\n').filter((n) => n.trim()).length} names
                  matched
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={savingAttendance}
                className="px-5 py-3 rounded-xl bg-[#222] hover:bg-[#333] text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={recordAttendance}
                disabled={savingAttendance || selectedDkp === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingAttendance && <Loader2 size={16} className="animate-spin" />}
                {savingAttendance ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
