import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface MemberItem {
  id: string; // channel_members.id
  user_id: string;
  role: 'creator' | 'admin' | 'member';
  profiles: {
    username: string;
    avatar_url?: string;
  } | null;
}

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
}

export default function MemberManagementModal({ isOpen, onClose, channelId }: MemberManagementModalProps) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'creator' | 'admin' | 'member' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !channelId) return;

    async function loadMembersAndRole() {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // 1. Fetch channel members raw
      const { data: rawMembers, error: membersError } = await supabase
        .from('channel_members')
        .select('id, user_id, role')
        .eq('channel_id', channelId);

      if (membersError) {
        console.error('Error fetching members:', membersError);
        setLoading(false);
        return;
      }

      // Identify current user's role
      const myMembership = rawMembers?.find((m) => m.user_id === user.id);
      setCurrentUserRole(myMembership ? (myMembership.role as any) : null);

      if (!rawMembers || rawMembers.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // 2. Fetch profiles independently to prevent foreign key embedding issues
      const userIds = Array.from(new Set(rawMembers.map((m) => m.user_id)));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const profilesMap: Record<string, any> = {};
      if (profilesData) {
        profilesData.forEach((p) => {
          profilesMap[p.id] = p;
        });
      }

      const formattedMembers: MemberItem[] = rawMembers.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        profiles: profilesMap[m.user_id] || null,
      }));

      // Sort: Creator first, then Admins, then Members
      const roleOrder = { creator: 0, admin: 1, member: 2 };
      formattedMembers.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

      setMembers(formattedMembers);
      setLoading(false);
    }

    loadMembersAndRole();
  }, [isOpen, channelId]);

  if (!isOpen) return null;

  // Role Promotion / Demotion (Creator only)
  const handleRoleChange = async (memberUserId: string, newRole: 'admin' | 'member') => {
    if (currentUserRole !== 'creator') return;

    const { error } = await supabase
      .from('channel_members')
      .update({ role: newRole })
      .eq('channel_id', channelId)
      .eq('user_id', memberUserId);

    if (error) {
      alert('Failed to update role: ' + error.message);
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === memberUserId ? { ...m, role: newRole } : m))
      );
    }
  };

  // Kick member from channel (Creator kicks anyone; Admin kicks Members only)
  const handleKickMember = async (memberUserId: string, memberRole: string) => {
    const isCreator = currentUserRole === 'creator';
    const isAdmin = currentUserRole === 'admin';

    if (!isCreator && !(isAdmin && memberRole === 'member')) {
      alert('You do not have permission to kick this user.');
      return;
    }

    const confirmKick = window.confirm('Are you sure you want to remove this user from the channel?');
    if (!confirmKick) return;

    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', memberUserId);

    if (error) {
      alert('Failed to kick member: ' + error.message);
    } else {
      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-white flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">Channel Members</h2>
            <p className="text-xs text-gray-400">{members.length} participants</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold p-1 transition">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Loading members...</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {members.map((member) => {
              const isMe = member.user_id === currentUserId;
              const displayName = isMe ? 'You' : member.profiles?.username || 'User';
              const avatarUrl = member.profiles?.avatar_url;

              const canControlRole = currentUserRole === 'creator' && member.role !== 'creator';
              const canKick =
                (currentUserRole === 'creator' && member.role !== 'creator') ||
                (currentUserRole === 'admin' && member.role === 'member');

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between bg-gray-800/60 border border-gray-800 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-700 overflow-hidden border border-gray-600 flex items-center justify-center shrink-0 font-bold text-xs">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        displayName[0].toUpperCase()
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{displayName}</span>
                        {member.role === 'creator' && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            👑 Creator
                          </span>
                        )}
                        {member.role === 'admin' && (
                          <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            🛡️ Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    </div>
                  </div>

                  {!isMe && (canControlRole || canKick) && (
                    <div className="flex items-center gap-2">
                      {canControlRole && (
                        <>
                          {member.role === 'member' ? (
                            <button
                              onClick={() => handleRoleChange(member.user_id, 'admin')}
                              className="px-2.5 py-1 bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40 rounded-lg text-xs transition"
                            >
                              Make Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRoleChange(member.user_id, 'member')}
                              className="px-2.5 py-1 bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/40 rounded-lg text-xs transition"
                            >
                              Dismiss Admin
                            </button>
                          )}
                        </>
                      )}

                      {canKick && (
                        <button
                          onClick={() => handleKickMember(member.user_id, member.role)}
                          className="px-2.5 py-1 bg-red-600/20 text-red-300 border border-red-500/40 hover:bg-red-600/40 rounded-lg text-xs transition"
                        >
                          Kick
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}