import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Member {
  id: string;
  user_id: string;
  role: 'creator' | 'admin' | 'member';
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface ModalProps {
  channelId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: 'creator' | 'admin' | 'member';
}

export default function MemberManagementModal({ channelId, isOpen, onClose, currentUserRole }: ModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && channelId) {
      fetchMembers();
    }
  }, [isOpen, channelId]);

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('channel_members')
      .select(`
        id,
        user_id,
        role,
        profiles:user_id ( username, avatar_url )
      `)
      .eq('channel_id', channelId);

    if (error) {
      console.error('Error fetching members:', error);
    } else {
      setMembers((data as any) || []);
    }
    setLoading(false);
  };

  const handleUpdateRole = async (memberId: string, newRole: 'creator' | 'admin' | 'member') => {
    const { error } = await supabase
      .from('channel_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      alert('Failed to update role: ' + error.message);
    } else {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    }
  };

  const handleKickMember = async (memberId: string, username: string) => {
    const confirmKick = window.confirm(`Are you sure you want to remove @${username} from the channel?`);
    if (!confirmKick) return;

    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      alert('Failed to remove member: ' + error.message);
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/50">
          <div>
            <h3 className="text-base font-bold text-white">Channel Members</h3>
            <p className="text-xs text-gray-400">Manage member privileges & roles</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Member List */}
        <div className="p-4 max-h-96 overflow-y-auto space-y-3">
          {loading ? (
            <div className="text-center py-6 text-sm text-gray-500">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500">No members found.</div>
          ) : (
            members.map((member) => {
              const username = member.profiles?.username || 'Unknown';
              const isTargetCreator = member.role === 'creator';
              const isTargetAdmin = member.role === 'admin';

              return (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-800/60 border border-gray-700/50 hover:border-gray-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {member.profiles?.avatar_url ? (
                        <img src={member.profiles.avatar_url} alt={username} className="w-full h-full object-cover" />
                      ) : (
                        username[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">@{username}</span>
                        {isTargetCreator && <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">👑 Creator</span>}
                        {isTargetAdmin && <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full font-bold">🛡️ Admin</span>}
                      </div>
                    </div>
                  </div>

                  {/* Permission Actions */}
                  <div className="flex items-center gap-2">
                    {/* Only Creators can appoint or demote Admins and add more Creators */}
                    {currentUserRole === 'creator' && !isTargetCreator && (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value as any)}
                        className="bg-gray-900 text-xs text-gray-200 border border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Make Admin</option>
                        <option value="creator">Make Creator</option>
                      </select>
                    )}

                    {/* Both Creators & Admins can remove lower tier members */}
                    {(currentUserRole === 'creator' || (currentUserRole === 'admin' && member.role === 'member')) && !isTargetCreator && (
                      <button
                        onClick={() => handleKickMember(member.id, username)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded-lg transition"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}