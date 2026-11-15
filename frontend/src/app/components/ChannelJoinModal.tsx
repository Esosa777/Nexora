import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ChannelJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  onJoined: () => void;
}

export default function ChannelJoinModal({ 
  isOpen, 
  onClose, 
  channelId, 
  channelName, 
  onJoined 
}: ChannelJoinModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleJoin = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Use upsert to safely handle duplicate entries if the user is already a member
    const { error } = await supabase
      .from('channel_members')
      .upsert(
        [
          { 
            channel_id: channelId, 
            user_id: user.id, 
            role: 'member' 
          }
        ],
        { onConflict: 'channel_id,user_id' }
      );

    setLoading(false);

    if (error) {
      console.error('Error joining channel:', error);
      alert('Failed to join channel: ' + error.message);
    } else {
      onJoined();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-white shadow-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-lg">
            #
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Join #{channelName}</h3>
            <p className="text-xs text-gray-400">Workspace Channel</p>
          </div>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          You are about to join this channel. Once joined, you'll be able to send messages, participate in threads, and view channel history.
        </p>

        <div className="flex gap-2 justify-end mt-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleJoin}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-lg shadow-blue-600/20"
          >
            {loading ? 'Joining...' : 'Join Channel'}
          </button>
        </div>
      </div>
    </div>
  );
}