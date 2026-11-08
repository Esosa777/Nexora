import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string | null;
  currentUserId: string;
  onStartDm: (conversationId: string) => void;
}

export default function UserProfileModal({ isOpen, onClose, targetUserId, currentUserId, onStartDm }: UserProfileModalProps) {
  const [profile, setProfile] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !targetUserId) return;

    async function loadUserProfile() {
      setLoading(true);
      
      // Fetch Profile Data
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      setProfile(prof);

      // Check Block Status
      const { data: block } = await supabase
        .from('user_blocks')
        .select('*')
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', targetUserId)
        .maybeSingle();

      setIsBlocked(!!block);
      setLoading(false);
    }

    loadUserProfile();
  }, [isOpen, targetUserId, currentUserId]);

  if (!isOpen || !targetUserId) return null;

  const isSelf = targetUserId === currentUserId;

  const handleOpenDm = async () => {
    if (isSelf) return;

    // Search or create direct conversation
    const { data: existingConv } = await supabase
      .from('direct_conversations')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`)
      .maybeSingle();

    if (existingConv) {
      onStartDm(existingConv.id);
      onClose();
      return;
    }

    const { data: newConv, error } = await supabase
      .from('direct_conversations')
      .insert([{ sender_id: currentUserId, receiver_id: targetUserId, status: 'pending' }])
      .select()
      .single();

    if (!error && newConv) {
      onStartDm(newConv.id);
      onClose();
    } else {
      alert('Could not start direct message.');
    }
  };

  const handleToggleBlock = async () => {
    if (isBlocked) {
      await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', targetUserId);
      setIsBlocked(false);
    } else {
      await supabase
        .from('user_blocks')
        .insert([{ blocker_id: currentUserId, blocked_id: targetUserId }]);
      setIsBlocked(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-white relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold">✕</button>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading profile...</div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-blue-600/20 border-2 border-blue-500 overflow-hidden flex items-center justify-center font-bold text-2xl mb-3 shadow-lg">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" />
              ) : (
                profile?.username?.[0]?.toUpperCase() || 'U'
              )}
            </div>

            <h3 className="text-lg font-bold">@{profile?.username || 'User'}</h3>
            <span className="text-xs text-gray-400 mb-6">{profile?.role ? profile.role.toUpperCase() : 'Member'}</span>

            {!isSelf && (
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={handleOpenDm}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-xs transition cursor-pointer shadow-md"
                >
                  Send Direct Message
                </button>
                <button
                  onClick={handleToggleBlock}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer border ${
                    isBlocked 
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700' 
                      : 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/40'
                  }`}
                >
                  {isBlocked ? 'Unblock User' : 'Block User'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}