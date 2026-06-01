import { useState, useEffect, useCallback } from 'react';
import { supabase, updateMemberDkp } from '@/lib/supabase';
import type { CurrentUser, Member, AttendanceEvent } from '@/types';
import {
  Plus, Trash2, AlertTriangle, Crown, UserCheck,
  Calendar, ChevronDown, ChevronUp, Clock,
  CheckCircle2, TrendingUp, X,
} from 'lucide-react';

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

// ─── Reusable Confirm Modal (no native confirm/alert) ───
function ConfirmModal({
  title, message, confirmLabel, confirmClass = 'bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600/30',
  onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string;
  confirmClass?: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm bg-[#222] hover:bg-[#333] text-gray-300 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ───
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium
      ${type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {message}
      <button onClick={onClose} className="ml-2 hover:text-white"><X size={14} /></button>
    </div>
  );
}

export function AttendancePage({ currentUser, members, onMembersChange }: Props) {

  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';

  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDkp, setNewEventDkp] = useState('');
  const [attendanceNames, setAttendanceNames] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<'decay' | 'reset' | 'deleteEvent' | null>(null);
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<number | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load Events ───
  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('attendance_events')
      .select('*')
      .order('id', { ascending: false });
    if (!error) setEvents(data || []);
  }, []);

  // ─── Load Attendance Logs ───
  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('attendance_log')
      .select('*')
      .order('recorded_at', { ascending: false });
    if (!error) setAttendanceLogs(data || []);
  }, []);

  useEffect(() => {
    loadEvents();
    loadLogs();

    const eventsChannel = supabase
      .channel('attendance-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_events' }, loadEvents)
      .subscribe();

    const logsChannel = supabase
      .channel('attendance-log')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_log' }, loadLogs)
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [loadEvents, loadLogs]);

  // ─── Selected events DKP total ───
  const [checkedEventIds, setCheckedEventIds] = useState<Set<number>>(new Set());

  const toggleEvent = (id: number) => {
    setCheckedEventIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedDkp = events
    .filter((e) => checkedEventIds.has(e.id))
    .reduce((sum, e) => sum + e.dkp, 0);

  const selectedEvents = events.filter((e) => checkedEventIds.has(e.id));

  // ─── Add Event ───
  const addEvent = async () => {
    const name = newEventName.trim();
    const dkp = parseInt(newEventDkp);
    if (!name || isNaN(dkp)) { showToast('Fill in both event name and DKP', 'error'); return; }
    const { error } = await supabase.from('attendance_events').insert({ name, dkp });
    if (error) { showToast('Failed to add event', 'error'); return; }
    setNewEventName('');
    setNewEventDkp('');
    showToast(`Event "${name}" added`, 'success');
    await loadEvents();
  };

  // ─── Record Attendance ───
  const recordAttendance = async () => {
    if (selectedDkp === 0) { showToast('Select at least one event', 'error'); return; }
    const names = attendanceNames.split('\n').map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) { showToast('Enter at least one username', 'error'); return; }

    let matched = 0;
    try {
      for (const name of names) {
        const member = members.find((x) => x.username.toLowerCase() === name.toLowerCase());
        if (!member) continue;
        matched++;

        // Update member DKP + attendance count
        await supabase
          .from('members')
          .update({ dkp: member.dkp + selectedDkp, attendance: (member.attendance || 0) + 1 })
          .eq('id', member.id);

        // Insert one log row per event
        for (const event of selectedEvents) {
          await supabase.from('attendance_log').insert({
            member_id: member.id,
            event_id: event.id,
            event_name: event.name,
            dkp_awarded: event.dkp,
          });
        }
      }

      await onMembersChange();
      await loadLogs();
      setShowModal(false);
      setAttendanceNames('');
      setCheckedEventIds(new Set());
      showToast(`+${selectedDkp} DKP awarded to ${matched} member${matched !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to record attendance', 'error');
    }
  };

  // ─── Apply Decay ───
  const applyDecay = async () => {
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
      setConfirmModal(null);
    }
  };

  // ─── Reset Attendance ───
  const resetAttendance = async () => {
    try {
      for (const m of members) {
        await supabase.from('members').update({ attendance: 0 }).eq('id', m.id);
      }
      // Also wipe logs so history clears
      await supabase.from('attendance_log').delete().neq('id', 0);
      await onMembersChange();
      await loadLogs();
      showToast('Attendance and history reset', 'success');
    } catch {
      showToast('Failed to reset attendance', 'error');
    } finally {
      setConfirmModal(null);
    }
  };

  // ─── Delete Event ───
  const deleteEvent = async () => {
    if (!pendingDeleteEventId) return;
    const { error } = await supabase
      .from('attendance_events')
      .delete()
      .eq('id', pendingDeleteEventId);
    if (error) { showToast('Failed to delete event', 'error'); }
    else { showToast('Event deleted', 'success'); await loadEvents(); }
    setPendingDeleteEventId(null);
    setConfirmModal(null);
  };

  // ─── Per-member log lookup ───
  const getLogsForMember = (memberId: string) =>
    attendanceLogs.filter((l) => l.member_id === memberId);

  const maxAttendance = Math.max(...members.map((m) => m.attendance || 0), 1);

  return (
    <div className="animate-fade-in space-y-6">

      {/* Confirm Modals */}
      {confirmModal === 'decay' && (
        <ConfirmModal title="Apply 10% DKP Decay"
          message="This will reduce every member's DKP by 10%. This cannot be undone."
          confirmLabel="Apply Decay"
          onConfirm={applyDecay}
          onCancel={() => setConfirmModal(null)} />
      )}
      {confirmModal === 'reset' && (
        <ConfirmModal title="Reset Attendance"
          message="This will set all attendance counts to 0 and wipe all attendance history. This cannot be undone."
          confirmLabel="Reset Attendance"
          onConfirm={resetAttendance}
          onCancel={() => setConfirmModal(null)} />
      )}
      {confirmModal === 'deleteEvent' && (
        <ConfirmModal title="Delete Event"
          message="Remove this event from the list? Past attendance logs are unaffected."
          confirmLabel="Delete Event"
          onConfirm={deleteEvent}
          onCancel={() => { setConfirmModal(null); setPendingDeleteEventId(null); }} />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="text-cyan-400" size={24} />
            Attendance
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track guild events and award DKP</p>
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
              <UserCheck size={16} />
              Add Attendance
            </button>
            <button onClick={() => setConfirmModal('decay')}
              className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 bg-[#222] text-gray-300 hover:bg-[#333]">
              <AlertTriangle size={16} />
              Apply 10% Decay
            </button>
            <button onClick={() => setConfirmModal('reset')}
              className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 bg-red-900/40 text-red-400 hover:bg-red-800/50">
              <Trash2 size={16} />
              Reset Attendance
            </button>
          </div>
        )}
      </div>

      {/* ─── Leaderboard ─── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Crown className="text-yellow-400" size={22} />
          <h2 className="text-xl font-bold">Leaderboard</h2>
          <span className="text-gray-500 text-sm ml-2">({members.length} members)</span>
        </div>

        <div className="space-y-2">
          {members.map((m, i) => {
            const logs = getLogsForMember(m.id);
            const isExpanded = expandedMember === m.id;
            const attendanceCount = m.attendance || 0;
            const attendancePct = Math.round((attendanceCount / maxAttendance) * 100);

            // Group logs by date for the history view
            const logsByDate = logs.reduce<Record<string, AttendanceLog[]>>((acc, log) => {
              const date = new Date(log.recorded_at).toLocaleDateString();
              if (!acc[date]) acc[date] = [];
              acc[date].push(log);
              return acc;
            }, {});

            return (
              <div key={m.id}
                className="rounded-xl border border-[#1a1a1a] hover:border-[#333] transition-colors overflow-hidden">

                {/* ── Member Row ── */}
                <div
                  className="flex items-center justify-between p-4 bg-[#0a0a0a] cursor-pointer"
                  onClick={() => setExpandedMember(isExpanded ? null : m.id)}
                >
                  {/* Left */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      i === 0 ? 'bg-yellow-400/20 text-yellow-400'
                      : i === 1 ? 'bg-gray-300/20 text-gray-300'
                      : i === 2 ? 'bg-orange-400/20 text-orange-400'
                      : 'bg-[#1a1a1a] text-gray-500'
                    }`}>
                      #{i + 1}
                    </div>

                    <img src={m.avatar} alt="" className="w-10 h-10 rounded-full border border-[#333] shrink-0" />

                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.username}</div>
                      <div className="text-gray-500 text-xs capitalize flex items-center gap-1">
                        {m.role === 'leader' && <Crown size={10} className="text-yellow-400" />}
                        {m.role}
                      </div>
                    </div>
                  </div>

                  {/* Center: attendance bar */}
                  <div className="hidden sm:flex flex-col items-center gap-1 flex-1 max-w-xs px-6">
                    <div className="flex items-center justify-between w-full text-xs text-gray-500 mb-1">
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
                        className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all"
                        style={{ width: `${attendancePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-cyan-400 text-xl font-bold tabular-nums">{m.dkp} DKP</div>
                    <div className="text-gray-600">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* ── Expanded: Attendance History ── */}
                {isExpanded && (
                  <div className="border-t border-[#1a1a1a] bg-[#060606] px-4 py-4 animate-fade-in">
                    {logs.length === 0 ? (
                      <p className="text-gray-600 text-sm text-center py-4">No attendance history recorded yet.</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                          <CheckCircle2 size={13} className="text-cyan-500" />
                          <span>{logs.length} event{logs.length !== 1 ? 's' : ''} attended · {Object.keys(logsByDate).length} session{Object.keys(logsByDate).length !== 1 ? 's' : ''}</span>
                        </div>

                        {Object.entries(logsByDate).map(([date, dateLogs]) => (
                          <div key={date}>
                            {/* Date header */}
                            <div className="flex items-center gap-2 mb-2">
                              <Clock size={12} className="text-gray-600" />
                              <span className="text-xs text-gray-500">{date}</span>
                              <div className="flex-1 h-px bg-[#1a1a1a]" />
                              <span className="text-xs text-cyan-600">
                                +{dateLogs.reduce((s, l) => s + l.dkp_awarded, 0)} DKP
                              </span>
                            </div>

                            {/* Events for that session */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-4">
                              {dateLogs.map((log) => (
                                <div key={log.id}
                                  className="flex items-center justify-between bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                                    <span className="text-xs text-gray-300">{log.event_name}</span>
                                  </div>
                                  <span className="text-xs text-cyan-400 font-medium tabular-nums">
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
        </div>
      </div>

      {/* ─── Record Attendance Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-[#222]">

            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold">Record Attendance</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Selected DKP preview */}
            {selectedDkp > 0 && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-between">
                <span className="text-sm text-gray-400">Total DKP to award</span>
                <span className="text-cyan-400 font-bold text-lg tabular-nums">+{selectedDkp} DKP</span>
              </div>
            )}

            {/* Events */}
            <div className="space-y-3 mb-6">
              <h3 className="font-bold">Select Events</h3>

              {events.map((e) => (
                <div key={e.id}
                  className="flex items-center justify-between bg-black border border-[#222] rounded-xl p-3">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-cyan-400"
                      checked={checkedEventIds.has(e.id)}
                      onChange={() => toggleEvent(e.id)}
                    />
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-cyan-400 text-sm">+{e.dkp} DKP</div>
                    </div>
                  </label>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setPendingDeleteEventId(e.id);
                        setConfirmModal('deleteEvent');
                      }}
                      className="text-red-400 hover:text-red-300 p-2 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}

              {events.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-4">
                  No events yet. Add one below.
                </p>
              )}
            </div>

            {/* Add Event */}
            <div className="space-y-3 mb-6">
              <h3 className="font-bold">Add New Event</h3>
              <div className="flex gap-3">
                <input value={newEventName} onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="Event name"
                  className="flex-1 bg-black border border-[#333] rounded-xl p-3" />
                <input value={newEventDkp} onChange={(e) => setNewEventDkp(e.target.value)}
                  placeholder="DKP" type="number"
                  className="w-32 bg-black border border-[#333] rounded-xl p-3" />
                <button onClick={addEvent} className="btn-primary flex items-center gap-2">
                  <Plus size={16} />Add
                </button>
              </div>
            </div>

            {/* Usernames */}
            <div className="space-y-3 mb-6">
              <h3 className="font-bold">Usernames</h3>
              <textarea value={attendanceNames} onChange={(e) => setAttendanceNames(e.target.value)}
                placeholder="One username per line..."
                className="w-full h-40 bg-black border border-[#333] rounded-2xl p-4 resize-none" />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowModal(false)}
                className="px-5 py-3 rounded-xl bg-[#222] hover:bg-[#333]">
                Cancel
              </button>
              <button onClick={recordAttendance} className="btn-primary">
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
