import { useState } from 'react';
import { supabase, updateMemberDkp } from '@/lib/supabase';
import type { CurrentUser, Member, AttendanceEvent } from '@/types';
import { Plus, Trash2, AlertTriangle, Crown, UserCheck, Calendar } from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
  members: Member[];
  onMembersChange: () => void;
}

const defaultEvents: AttendanceEvent[] = [{ id: 1, name: 'Guild Raid', dkp: 50 }];

export function AttendancePage({ currentUser, members, onMembersChange }: Props) {
  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';

  const [events, setEvents] = useState<AttendanceEvent[]>(defaultEvents);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDkp, setNewEventDkp] = useState('');
  const [attendanceNames, setAttendanceNames] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [decayConfirm, setDecayConfirm] = useState(false);

  const addEvent = () => {
    const name = newEventName.trim();
    const dkp = parseInt(newEventDkp);
    if (!name || isNaN(dkp)) return;
    setEvents([...events, { id: Date.now(), name, dkp }]);
    setNewEventName('');
    setNewEventDkp('');
  };

  const removeEvent = (index: number) => {
    setEvents(events.filter((_, i) => i !== index));
  };

  const recordAttendance = async () => {
    const checkedDkp = events.reduce((sum, e, i) => {
      const cb = document.getElementById(`event-${i}`) as HTMLInputElement;
      return sum + (cb?.checked ? e.dkp : 0);
    }, 0);

    if (checkedDkp === 0) {
      alert('Select at least one event');
      return;
    }

    const names = attendanceNames
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) {
      alert('Enter at least one username');
      return;
    }

    for (const name of names) {
      const m = members.find((x) => x.username.toLowerCase() === name.toLowerCase());
      if (!m) continue;

      await supabase
        .from('members')
        .update({
          dkp: m.dkp + checkedDkp,
          attendance: (m.attendance || 0) + 1,
        })
        .eq('id', m.id);
    }

    await onMembersChange();
    setShowModal(false);
    setAttendanceNames('');
    alert(`Attendance Recorded! +${checkedDkp} DKP awarded`);
  };

  const applyDecay = async () => {
    if (!decayConfirm) {
      setDecayConfirm(true);
      return;
    }

    for (const m of members) {
      const reduction = Math.floor(m.dkp * 0.1);
      await updateMemberDkp(m.id, Math.max(0, m.dkp - reduction));
    }

    await onMembersChange();
    setDecayConfirm(false);
    alert('10% Decay Applied to all members');
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
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
            <button
              onClick={applyDecay}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                decayConfirm
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-[#222] text-gray-300 hover:bg-[#333]'
              }`}
            >
              <AlertTriangle size={16} />
              {decayConfirm ? 'Confirm 10% Decay?' : 'Apply 10% Decay'}
            </button>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Crown className="text-yellow-400" size={22} />
          <h2 className="text-xl font-bold">Leaderboard</h2>
          <span className="text-gray-500 text-sm ml-2">({members.length} members)</span>
        </div>
        <div className="space-y-3">
          {members.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#333] transition-colors"
            >
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
                <img src={m.avatar} alt="" className="w-11 h-11 rounded-full border border-[#333]" />
                <div>
                  <div className="font-medium">{m.username}</div>
                  <div className="text-gray-500 text-xs capitalize flex items-center gap-1">
                    {m.role === 'leader' && <Crown size={10} className="text-yellow-400" />}
                    {m.role}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <div className="text-gray-500 text-xs">Attendance</div>
                  <div className="text-gray-300">{m.attendance || 0}</div>
                </div>
                <div className="text-cyan-400 text-xl font-bold tabular-nums">{m.dkp} DKP</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-[#222]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <UserCheck className="text-cyan-400" size={24} />
                Record Attendance
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white p-2 hover:bg-[#222] rounded-xl transition-all"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>

            {/* Events */}
            <div className="grid md:grid-cols-2 gap-3 mb-5">
              {events.map((e, i) => (
                <div key={e.id} className="card p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-cyan-400 text-sm">+{e.dkp} DKP</div>
                    </div>
                    <input
                      id={`event-${i}`}
                      type="checkbox"
                      className="w-5 h-5 accent-cyan-400 rounded"
                    />
                  </div>
                  <button
                    onClick={() => removeEvent(i)}
                    className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-3 py-2 rounded-xl w-full text-sm transition-all flex items-center justify-center gap-1"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Add Event */}
            <div className="card p-4 mb-5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Add New Event</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="Event Name"
                  className="bg-black border border-[#333] rounded-xl p-3 text-sm"
                />
                <input
                  value={newEventDkp}
                  onChange={(e) => setNewEventDkp(e.target.value)}
                  type="number"
                  placeholder="DKP Amount"
                  className="bg-black border border-[#333] rounded-xl p-3 text-sm"
                />
              </div>
              <button onClick={addEvent} className="btn-primary mt-3 flex items-center gap-2">
                <Plus size={16} /> Add Event
              </button>
            </div>

            {/* Names Input */}
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-400 mb-2 block">
                Member Names (one per line)
              </label>
              <textarea
                value={attendanceNames}
                onChange={(e) => setAttendanceNames(e.target.value)}
                className="w-full h-40 bg-black border border-[#333] rounded-2xl p-4 text-sm resize-none"
                placeholder="Enter usernames, one per line..."
              />
            </div>

            <button onClick={recordAttendance} className="btn-primary w-full py-3">
              Record Attendance
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
