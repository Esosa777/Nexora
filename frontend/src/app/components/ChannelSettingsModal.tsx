import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ChannelSettingsModalProps {
  channel: any;
  currentUser: any;
  onClose: () => void;
  onChannelUpdated: (updatedChannel: any) => void;
}

export default function ChannelSettingsModal({ channel, currentUser, onClose, onChannelUpdated }: ChannelSettingsModalProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(channel.approval_required || false);
  const [userRole, setUserRole] = useState<string>('member');

  useEffect(() => {
    async function fetchChannelData() {
      setLoading(true);
      
      // 1. Fetch channel members with profiles
      const { data, error } = await supabase
        .from('channel_members')
        .select(`
          role,
          user_id,
          profiles:user_id(id, username, display_name, avatar_url)
        `)
        .eq('channel_id', channel.id);

      if (!error && data) {
        setMembers(data);
        // Find current user's role in this channel
        const currentMember = data.find((m) => m.user_id === currentUser.id);
        if (currentMember) {
          setUserRole(currentMember.role);
        }
      }
      setLoading(false);
    }

    fetchChannelData();
  }, [channel.id, currentUser.id]);

  const handleToggleApproval = async (newVal: boolean) => {
    setApprovalRequired(newVal);
    const { error } = await supabase
      .from('channels')
      .update({ approval_required: newVal })
      .eq('id', channel.id);

    if (error) {
      alert('Failed to update settings: ' + error.message);
      setApprovalRequired(!newVal); // revert on failure
    } else {
      onChannelUpdated({ ...channel, approval_required: newVal });
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: string) => {
    const { error } = await supabase
      .from('channel_members')
      .update({ role: newRole })
      .eq('channel_id', channel.id)
      .eq('user_id', targetUserId);

    if (error) {
      alert('Failed to update member role: ' + error.message);
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === targetUserId ? { ...m, role: newRole } : m))
      );
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channel.id)
      .eq('user_id', targetUserId);

    if (error) {
      alert('Failed to remove member: ' + error.message);
    } else {
      setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId));
    }
  };

  const isCreatorOrAdmin = userRole === 'creator' || userRole === 'admin';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] text-white overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
          <div>
            <h2 className="text-lg font-bold"># {channel.name} Settings</h2>
            <p className="text-xs text-gray-400">Manage channel permissions and members</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white cursor-pointer w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Creator/Admin Settings Section */}
          {isCreatorOrAdmin && (
            <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Channel Controls</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">Require Admin Approval to Join</div>
                  <div className="text-xs text-gray-400">New members must be approved before entering.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approvalRequired}
                    onChange={(e) => handleToggleApproval(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* Members List Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Members ({members.length})
              </h3>
            </div>

            {loading ? (
              <div className="text-center text-xs text-gray-500 py-6">Loading members...</div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const profile = member.profiles;
                  const isMe = member.user_id === currentUser.id;
                  const isTargetCreator = member.role === 'creator';

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-800 rounded-xl hover:bg-gray-800 transition"
                    >
                      {/* User Info */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center font-bold text-sm shrink-0">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            profile?.username?.[0]?.toUpperCase() || 'U'
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            {profile?.display_name || `@${profile?.username || 'User'}`}
                            {isMe && <span className="text-[10px] bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded">You</span>}
                          </div>
                          <div className="text-xs text-gray-400 capitalize">
                            Role: <span className="text-blue-400 font-medium">{member.role}</span>
                          </div>
                        </div>
                      </div>

                      {/* Admin Actions (Promote / Demote / Remove) */}
                      {userRole === 'creator' && !isMe && !isTargetCreator && (
                        <div className="flex items-center gap-2">
                          {member.role === 'member' ? (
                            <button
                              onClick={() => handleUpdateRole(member.user_id, 'admin')}
                              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              Make Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateRole(member.user_id, 'member')}
                              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              Dismiss Admin
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}