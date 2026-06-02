import { useState, useEffect, useCallback } from 'react';
import {
  supabase, getAnnouncements, createAnnouncement,
  updateAnnouncement, deleteAnnouncement,
} from '@/lib/supabase';
import type { Announcement, CurrentUser } from '@/types';
import {
  Megaphone, Pin, Plus, Trash2, Edit3,
  X, CheckCircle2, AlertTriangle, Loader2, Check,
} from 'lucide-react';

interface Props {
  currentUser: CurrentUser | null;
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-slide-in-right border
      ${type === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
      {type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {message}
      <button onClick={onClose} className="ml-1 hover:text-white"><X size={13} /></button>
    </div>
  );
}

export function AnnouncementsPage({ currentUser }: Props) {
  const isAdmin = currentUser?.member.role === 'leader' || currentUser?.member.role === 'elder';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch { showToast('Failed to load announcements', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const resetForm = () => {
    setTitle(''); setBody(''); setPinned(false);
    setShowForm(false); setEditingId(null);
  };

  const startEdit = (a: Announcement) => {
    setTitle(a.title); setBody(a.body); setPinned(a.pinned);
    setEditingId(a.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) { showToast('Title and body required', 'error'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateAnnouncement(editingId, { title, body, pinned });
        showToast('Announcement updated', 'success');
      } else {
        await createAnnouncement({
          title, body, pinned,
          author_name: currentUser?.member.username || 'Admin',
        });
        showToast('Announcement posted', 'success');
      }
      resetForm();
      await load();
    } catch { showToast('Failed to save announcement', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteAnnouncement(id);
      await load();
      showToast('Announcement deleted', 'success');
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeletingId(null); }
  };

  const togglePin = async (a: Announcement) => {
    try {
      await updateAnnouncement(a.id, { pinned: !a.pinned });
      await load();
      showToast(a.pinned ? 'Unpinned' : 'Pinned to top', 'success');
    } catch { showToast('Failed to update', 'error'); }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="animate-fade-in space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <Megaphone size={16} className="text-cyan-400" />
            </div>
            Announcements
          </h1>
          <p className="text-gray-500 text-sm mt-1">Guild notices from leadership</p>
        </div>
        {isAdmin && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Post Announcement
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && isAdmin && (
        <div className="card p-5 animate-fade-in space-y-4">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">
            {editingId ? 'Edit Announcement' : 'New Announcement'}
          </h3>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title..."
            className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none font-bold"
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement here..."
            rows={4}
            className="w-full bg-black/60 border border-[#1e2d3d] rounded-xl p-3 text-sm focus:border-cyan-500/50 focus:outline-none resize-none"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="accent-cyan-400 w-4 h-4"
              />
              <Pin size={13} className={pinned ? 'text-cyan-400' : 'text-gray-600'} />
              Pin to top
            </label>

            <div className="flex gap-2">
              <button onClick={resetForm} disabled={saving}
                className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="btn-primary flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editingId ? 'Save Changes' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcements list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : announcements.length === 0 ? (
        <div className="card p-16 text-center">
          <Megaphone size={40} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">No announcements yet</p>
          {isAdmin && <p className="text-gray-600 text-xs mt-1">Post the first announcement above</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`card p-5 transition-all ${
                a.pinned
                  ? 'border-cyan-500/25 shadow-[0_0_20px_#00d4ff08]'
                  : ''
              }`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  {a.pinned && (
                    <Pin size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-black text-base leading-snug truncate">{a.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                      <span className="text-gray-500 font-medium">{a.author_name}</span>
                      <span>·</span>
                      <span>{formatDate(a.created_at)}</span>
                      {a.pinned && (
                        <>
                          <span>·</span>
                          <span className="text-cyan-600 font-bold uppercase tracking-wider text-[10px]">Pinned</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin actions */}
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => togglePin(a)}
                      className={`p-2 rounded-lg transition-all ${
                        a.pinned
                          ? 'text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20'
                          : 'text-gray-600 hover:text-cyan-400 hover:bg-cyan-400/10'
                      }`}
                      title={a.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin size={14} />
                    </button>
                    <button onClick={() => startEdit(a)}
                      className="p-2 rounded-lg text-gray-600 hover:text-white hover:bg-white/10 transition-all">
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
                    >
                      {deletingId === a.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Body */}
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
