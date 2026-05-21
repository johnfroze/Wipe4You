import { useState } from 'react';

import {
  updateMemberDkp,
  updateMemberRole,
  updateMemberUsername,
  deleteMember,
} from '@/lib/supabase';

import type { Member } from '@/types';

import {
  Shield,
  Crown,
  Star,
  User,
  Plus,
  Minus,
  Edit3,
  Trash2,
  Search,
} from 'lucide-react';

interface Props {
  members: Member[];
  onMembersChange: () => void;
}

export function AdminPage({
  members,
  onMembersChange,
}: Props) {
  const [search, setSearch] =
    useState('');

  const [editingDkp, setEditingDkp] =
    useState<
      Record<string, boolean>
    >({});

  const [dkpInputs, setDkpInputs] =
    useState<
      Record<string, string>
    >({});

  // FILTER
  const filtered = members.filter(
    (m) =>
      m.username
        .toLowerCase()
        .includes(
          search.toLowerCase()
        ) ||
      m.role
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
  );

  // ADD DKP
  const handleAddDkp =
    async (
      id: string,
      current: number
    ) => {
      const amount = parseInt(
        dkpInputs[id] || ''
      );

      if (
        isNaN(amount) ||
        amount <= 0
      )
        return;

      try {
        await updateMemberDkp(
          id,
          current + amount
        );

        setEditingDkp(
          (prev) => ({
            ...prev,
            [id]: false,
          })
        );

        setDkpInputs(
          (prev) => ({
            ...prev,
            [id]: '',
          })
        );

        await onMembersChange();
      } catch (err) {
        console.error(err);
      }
    };

  // REMOVE DKP
  const handleRemoveDkp =
    async (
      id: string,
      current: number
    ) => {
      const amount = parseInt(
        dkpInputs[id] || ''
      );

      if (
        isNaN(amount) ||
        amount <= 0
      )
        return;

      try {
        await updateMemberDkp(
          id,
          Math.max(
            0,
            current - amount
          )
        );

        setEditingDkp(
          (prev) => ({
            ...prev,
            [id]: false,
          })
        );

        setDkpInputs(
          (prev) => ({
            ...prev,
            [id]: '',
          })
        );

        await onMembersChange();
      } catch (err) {
        console.error(err);
      }
    };

  // CHANGE ROLE
  const handleChangeRole =
    async (
      id: string,
      current: Member['role']
    ) => {
      try {
        const roles: Member['role'][] =
          [
            'member',
            'elder',
            'leader',
          ];

        const idx =
          roles.indexOf(current);

        const next =
          roles[
            (idx + 1) %
              roles.length
          ];

        await updateMemberRole(
          id,
          next
        );

        await onMembersChange();
      } catch (err) {
        console.error(err);
      }
    };

  // RENAME USER
  const handleRename =
    async (
      id: string,
      current: string
    ) => {
      const name = prompt(
        'New username:',
        current
      );

      if (
        !name ||
        name.trim() === '' ||
        name === current
      )
        return;

      try {
        // IMPORTANT FIX
        await updateMemberUsername(
          id,
          name.trim()
        );

        await onMembersChange();
      } catch (err) {
        console.error(err);
      }
    };

  // DELETE MEMBER
  const handleDelete =
    async (
      id: string,
      username: string
    ) => {
      const confirmed =
        confirm(
          `Delete member "${username}"?\n\nThis cannot be undone.`
        );

      if (!confirmed) return;

      try {
        await deleteMember(id);

        await onMembersChange();
      } catch (err) {
        console.error(err);
      }
    };

  // ROLE ICON
  const roleIcon = (
    role: Member['role']
  ) => {
    switch (role) {
      case 'leader':
        return (
          <Crown
            size={14}
            className="text-yellow-400"
          />
        );

      case 'elder':
        return (
          <Star
            size={14}
            className="text-purple-400"
          />
        );

      default:
        return (
          <User
            size={14}
            className="text-gray-500"
          />
        );
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield
              className="text-cyan-400"
              size={24}
            />

            Admin Panel
          </h1>

          <p className="text-gray-500 text-sm mt-1">
            Manage guild members
            and DKP
          </p>
        </div>

        {/* SEARCH */}
        <div className="relative w-full sm:w-64">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            size={16}
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search members..."
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-[#333] rounded-xl text-sm"
          />
        </div>
      </div>

      {/* MEMBERS */}
      <div className="card p-5">
        <div className="text-sm text-gray-500 mb-4">
          {filtered.length} of{' '}
          {members.length} members
        </div>

        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex flex-col lg:flex-row lg:items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#333] transition-colors gap-4"
            >
              {/* LEFT */}
              <div className="flex items-center gap-4">
                <img
                  src={m.avatar}
                  alt=""
                  className="w-12 h-12 rounded-full border border-[#333]"
                />

                <div>
                  {/* USERNAME */}
                  <div className="font-medium flex items-center gap-2">
                    {m.username}

                    <button
                      onClick={() =>
                        handleRename(
                          m.id,
                          m.username
                        )
                      }
                      className="text-gray-600 hover:text-cyan-400 transition-colors"
                      title="Rename"
                    >
                      <Edit3
                        size={12}
                      />
                    </button>
                  </div>

                  {/* ROLE */}
                  <button
                    onClick={() =>
                      handleChangeRole(
                        m.id,
                        m.role
                      )
                    }
                    className="text-xs capitalize flex items-center gap-1 mt-0.5 hover:text-cyan-400 transition-colors"
                  >
                    {roleIcon(m.role)}

                    <span
                      className={
                        m.role ===
                        'leader'
                          ? 'text-yellow-400'
                          : m.role ===
                              'elder'
                            ? 'text-purple-400'
                            : 'text-gray-500'
                      }
                    >
                      {m.role}
                    </span>

                    <span className="text-gray-600 ml-1">
                      (click to
                      cycle)
                    </span>
                  </button>
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex items-center gap-3 flex-wrap">
                {editingDkp[
                  m.id
                ] ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={
                        dkpInputs[
                          m.id
                        ] || ''
                      }
                      onChange={(
                        e
                      ) =>
                        setDkpInputs(
                          (
                            prev
                          ) => ({
                            ...prev,
                            [m.id]:
                              e
                                .target
                                .value,
                          })
                        )
                      }
                      type="number"
                      placeholder="Amount"
                      className="w-24 bg-black border border-[#333] rounded-lg p-2 text-sm"
                      autoFocus
                    />

                    {/* ADD */}
                    <button
                      onClick={() =>
                        handleAddDkp(
                          m.id,
                          m.dkp
                        )
                      }
                      className="bg-green-600/20 text-green-400 hover:bg-green-600/30 p-2 rounded-lg transition-all"
                      title="Add DKP"
                    >
                      <Plus
                        size={16}
                      />
                    </button>

                    {/* REMOVE */}
                    <button
                      onClick={() =>
                        handleRemoveDkp(
                          m.id,
                          m.dkp
                        )
                      }
                      className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 p-2 rounded-lg transition-all"
                      title="Remove DKP"
                    >
                      <Minus
                        size={16}
                      />
                    </button>

                    {/* CANCEL */}
                    <button
                      onClick={() =>
                        setEditingDkp(
                          (
                            prev
                          ) => ({
                            ...prev,
                            [m.id]:
                              false,
                          })
                        )
                      }
                      className="text-gray-500 hover:text-white p-2 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    {/* DKP */}
                    <div className="text-cyan-400 font-bold tabular-nums mr-2">
                      {m.dkp} DKP
                    </div>

                    {/* EDIT DKP */}
                    <button
                      onClick={() =>
                        setEditingDkp(
                          (
                            prev
                          ) => ({
                            ...prev,
                            [m.id]:
                              true,
                          })
                        )
                      }
                      className="bg-[#222] hover:bg-[#333] text-gray-300 px-3 py-2 rounded-xl text-sm transition-all flex items-center gap-1"
                    >
                      <Edit3
                        size={14}
                      />
                      DKP
                    </button>
                  </>
                )}

                {/* DELETE */}
                <button
                  onClick={() =>
                    handleDelete(
                      m.id,
                      m.username
                    )
                  }
                  className="bg-red-600/20 text-red-400 hover:bg-red-600/30 px-3 py-2 rounded-xl text-sm transition-all flex items-center gap-1"
                >
                  <Trash2
                    size={14}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
