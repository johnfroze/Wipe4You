import {
  useState,
  useEffect,
} from 'react';

import {
  supabase,
  updateMemberDkp,
} from '@/lib/supabase';

import type {
  CurrentUser,
  Member,
  AttendanceEvent,
} from '@/types';

import {
  Plus,
  Trash2,
  AlertTriangle,
  Crown,
  UserCheck,
  Calendar,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  members: Member[];
  onMembersChange: () => void;
}

export function AttendancePage({
  currentUser,
  members,
  onMembersChange,
}: Props) {

  // =========================
  // ADMIN CHECK
  // =========================

  const isAdmin =
    currentUser?.member.role === 'leader' ||
    currentUser?.member.role === 'elder';

  // =========================
  // STATE
  // =========================

  const [events, setEvents] =
    useState<AttendanceEvent[]>([]);

  const [newEventName, setNewEventName] =
    useState('');

  const [newEventDkp, setNewEventDkp] =
    useState('');

  const [attendanceNames, setAttendanceNames] =
    useState('');

  const [showModal, setShowModal] =
    useState(false);

  const [decayConfirm, setDecayConfirm] =
    useState(false);

  // =========================
  // LOAD EVENTS
  // =========================

  const loadEvents = async () => {
    try {

      const { data, error } =
        await supabase
          .from('attendance_events')
          .select('*')
          .order('id', {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      setEvents(data || []);

    } catch (err) {

      console.error(
        'Failed loading events:',
        err
      );
    }
  };

  // =========================
  // INITIAL LOAD + REALTIME
  // =========================

  useEffect(() => {

    loadEvents();

    const channel = supabase
      .channel('attendance-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_events',
        },
        async () => {
          await loadEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, []);

  // =========================
  // ADD EVENT
  // =========================

  const addEvent = async () => {

    const name =
      newEventName.trim();

    const dkp =
      parseInt(newEventDkp);

    if (!name || isNaN(dkp)) {
      alert('Fill all fields');
      return;
    }

    try {

      const { error } =
        await supabase
          .from('attendance_events')
          .insert({
            name,
            dkp,
          });

      if (error) {
        throw error;
      }

      setNewEventName('');
      setNewEventDkp('');

      await loadEvents();

    } catch (err) {

      console.error(err);

      alert('Failed to add event');
    }
  };

  // =========================
  // RECORD ATTENDANCE
  // =========================

  const recordAttendance =
    async () => {

      const checkedDkp =
        events.reduce(
          (sum, e, i) => {

            const cb =
              document.getElementById(
                `event-${i}`
              ) as HTMLInputElement;

            return (
              sum +
              (cb?.checked
                ? e.dkp
                : 0)
            );
          },
          0
        );

      if (checkedDkp === 0) {

        alert(
          'Select at least one event'
        );

        return;
      }

      const names =
        attendanceNames
          .split('\n')
          .map((n) =>
            n.trim()
          )
          .filter(Boolean);

      if (names.length === 0) {

        alert(
          'Enter at least one username'
        );

        return;
      }

      try {

        for (const name of names) {

          const member =
            members.find(
              (x) =>
                x.username.toLowerCase() ===
                name.toLowerCase()
            );

          if (!member)
            continue;

          await supabase
            .from('members')
            .update({

              dkp:
                member.dkp +
                checkedDkp,

              attendance:
                (member.attendance || 0) +
                1,

            })
            .eq(
              'id',
              member.id
            );
        }

        await onMembersChange();

        setShowModal(false);

        setAttendanceNames('');

        alert(
          `Attendance Recorded! +${checkedDkp} DKP awarded`
        );

      } catch (err) {

        console.error(err);

        alert(
          'Attendance failed'
        );
      }
    };

  // =========================
  // APPLY DECAY
  // =========================

  const applyDecay =
    async () => {

      if (!decayConfirm) {
        setDecayConfirm(true);
        return;
      }

      try {

        for (const m of members) {

          const reduction =
            Math.floor(
              m.dkp * 0.1
            );

          await updateMemberDkp(
            m.id,
            Math.max(
              0,
              m.dkp -
                reduction
            )
          );
        }

        await onMembersChange();

        setDecayConfirm(false);

        alert(
          '10% Decay Applied'
        );

      } catch (err) {

        console.error(err);

        alert(
          'Decay failed'
        );
      }
    };

  // =========================
  // RESET ATTENDANCE
  // =========================

  const resetAttendance =
    async () => {

      const confirmed =
        window.confirm(
          'Reset ALL attendance values to 0?'
        );

      if (!confirmed) return;

      try {

        for (const m of members) {

          await supabase
            .from('members')
            .update({
              attendance: 0,
            })
            .eq('id', m.id);
        }

        await onMembersChange();

        alert(
          'Attendance reset successfully'
        );

      } catch (err) {

        console.error(err);

        alert(
          'Failed to reset attendance'
        );
      }
    };

  // =========================
  // UI
  // =========================

  return (
    <div className="animate-fade-in space-y-6">

      {/* HEADER */}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

        <div>

          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar
              className="text-cyan-400"
              size={24}
            />

            Attendance
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Track guild events and award DKP
          </p>
        </div>

        {isAdmin && (

          <div className="flex gap-2 flex-wrap">

            {/* ADD ATTENDANCE */}

            <button
              onClick={() =>
                setShowModal(true)
              }
              className="btn-primary flex items-center gap-2"
            >
              <UserCheck size={16} />

              Add Attendance
            </button>

            {/* APPLY DECAY */}

            <button
              onClick={applyDecay}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                decayConfirm
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-[#222] text-gray-300 hover:bg-[#333]'
              }`}
            >
              <AlertTriangle size={16} />

              {decayConfirm
                ? 'Confirm 10% Decay?'
                : 'Apply 10% Decay'}
            </button>

            {/* RESET ATTENDANCE */}

            <button
              onClick={resetAttendance}
              className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 bg-red-900/40 text-red-400 hover:bg-red-800/50"
            >
              <Trash2 size={16} />

              Reset Attendance
            </button>
          </div>
        )}
      </div>

      {/* LEADERBOARD */}

      <div className="card p-5">

        <div className="flex items-center gap-2 mb-5">

          <Crown
            className="text-yellow-400"
            size={22}
          />

          <h2 className="text-xl font-bold">
            Leaderboard
          </h2>

          <span className="text-gray-500 text-sm ml-2">
            ({members.length} members)
          </span>
        </div>

        <div className="space-y-3">

          {members.map((m, i) => (

            <div
              key={m.id}
              className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#333] transition-colors"
            >

              {/* LEFT */}

              <div className="flex items-center gap-4">

                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
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
                  className="w-11 h-11 rounded-full border border-[#333]"
                />

                <div>

                  <div className="font-medium">
                    {m.username}
                  </div>

                  <div className="text-gray-500 text-xs capitalize flex items-center gap-1">

                    {m.role ===
                      'leader' && (
                      <Crown
                        size={10}
                        className="text-yellow-400"
                      />
                    )}

                    {m.role}
                  </div>
                </div>
              </div>

              {/* RIGHT */}

              <div className="flex items-center gap-6">

                <div className="text-right">

                  <div className="text-gray-500 text-xs">
                    Attendance
                  </div>

                  <div className="text-gray-300">
                    {m.attendance || 0}
                  </div>
                </div>

                <div className="text-cyan-400 text-xl font-bold tabular-nums">
                  {m.dkp} DKP
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}

      {showModal && (

        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">

          <div className="bg-[#111] rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-[#222]">

            {/* HEADER */}

            <div className="flex justify-between items-center mb-5">

              <h2 className="text-2xl font-bold">
                Record Attendance
              </h2>

              <button
                onClick={() =>
                  setShowModal(false)
                }
                className="text-gray-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* EVENTS */}

            <div className="space-y-3 mb-6">

              <h3 className="font-bold">
                Select Events
              </h3>

              {events.map((e, i) => (

                <div
                  key={e.id}
                  className="flex items-center justify-between bg-black border border-[#222] rounded-xl p-3"
                >

                  <label className="flex items-center gap-3 cursor-pointer flex-1">

                    <input
                      id={`event-${i}`}
                      type="checkbox"
                      className="w-5 h-5"
                    />

                    <div>

                      <div className="font-medium">
                        {e.name}
                      </div>

                      <div className="text-cyan-400 text-sm">
                        +{e.dkp} DKP
                      </div>
                    </div>
                  </label>

                  {/* DELETE EVENT */}

                  {isAdmin && (

                    <button
                      onClick={async () => {

                        const confirmed =
                          confirm(
                            'Delete this event?'
                          );

                        if (!confirmed)
                          return;

                        try {

                          const { error } =
                            await supabase
                              .from(
                                'attendance_events'
                              )
                              .delete()
                              .eq(
                                'id',
                                e.id
                              );

                          if (error) {
                            throw error;
                          }

                          await loadEvents();

                        } catch (err) {

                          console.error(err);

                          alert(
                            'Failed to remove event'
                          );
                        }
                      }}
                      className="text-red-400 hover:text-red-300 p-2 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* ADD EVENT */}

            <div className="space-y-3 mb-6">

              <h3 className="font-bold">
                Add New Event
              </h3>

              <div className="flex gap-3">

                <input
                  value={newEventName}
                  onChange={(e) =>
                    setNewEventName(
                      e.target.value
                    )
                  }
                  placeholder="Event name"
                  className="flex-1 bg-black border border-[#333] rounded-xl p-3"
                />

                <input
                  value={newEventDkp}
                  onChange={(e) =>
                    setNewEventDkp(
                      e.target.value
                    )
                  }
                  placeholder="DKP"
                  type="number"
                  className="w-32 bg-black border border-[#333] rounded-xl p-3"
                />

                <button
                  onClick={addEvent}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>

            {/* USERNAMES */}

            <div className="space-y-3 mb-6">

              <h3 className="font-bold">
                Usernames
              </h3>

              <textarea
                value={attendanceNames}
                onChange={(e) =>
                  setAttendanceNames(
                    e.target.value
                  )
                }
                placeholder="One username per line..."
                className="w-full h-40 bg-black border border-[#333] rounded-2xl p-4 resize-none"
              />
            </div>

            {/* FOOTER */}

            <div className="flex justify-end gap-3">

              <button
                onClick={() =>
                  setShowModal(false)
                }
                className="px-5 py-3 rounded-xl bg-[#222] hover:bg-[#333]"
              >
                Cancel
              </button>

              <button
                onClick={recordAttendance}
                className="btn-primary"
              >
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
