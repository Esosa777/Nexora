import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onLogout: () => void;
}

export default function SettingsModal({ isOpen, onClose, currentUser, onLogout }: SettingsModalProps) {
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'blocks'>('profile');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    async function loadSettings() {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (prof) {
        setUsername(prof.username || '');
        setAvatarUrl(prof.avatar_url || '');
      }

      // Fetch Blocked Users
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('id, blocked_id, profiles:blocked_id(username, avatar_url)')
        .eq('blocker_id', currentUser.id);

      setBlockedUsers(blocks || []);
    }

    loadSettings();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username, avatar_url: avatarUrl })
      .eq('id', currentUser.id);

    setSaving(false);
    if (!error) {
      alert('Profile updated!');
    } else {
      alert('Update failed: ' + error.message);
    }
  };

  const handleUnblock = async (blockId: string) => {
    await supabase.from('user_blocks').delete().eq('id', blockId);
    setBlockedUsers((prev) => prev.filter((b) => b.id !== blockId));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl text-white relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
          <h3 className="text-base font-bold">Settings & Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-gray-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-1.5 rounded-lg font-semibold transition ${activeTab === 'profile' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            My Profile
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`flex-1 py-1.5 rounded-lg font-semibold transition ${activeTab === 'blocks' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            Blocked Users ({blockedUsers.length})
          </button>
        </div>

        {activeTab === 'profile' ? (
          <div className="space-y-4">
            <div className="flex justify-center mb-2">
              <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center font-bold text-xl">
                {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : username[0]?.toUpperCase()}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Avatar Image URL</label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button onClick={onLogout} className="text-xs text-red-400 hover:underline">Log Out</button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {blockedUsers.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No blocked users.</p>
            ) : (
              blockedUsers.map((b) => (
                <div key={b.id} className="flex justify-between items-center p-2 bg-gray-800 rounded-xl text-xs">
                  <span>@{b.profiles?.username || 'User'}</span>
                  <button onClick={() => handleUnblock(b.id)} className="text-blue-400 hover:underline">Unblock</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}