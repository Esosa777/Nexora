import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ChannelDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinedChannel: (channelId: string) => void;
}

export default function ChannelDiscoveryModal({ isOpen, onClose, onJoinedChannel }: ChannelDiscoveryModalProps) {
  const [channels, setChannels] = useState<any[]>([]);
  const [myMemberships, setMyMemberships] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadPublicChannels() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch all channels
      const { data: allChannels } = await supabase.from('channels').select('*');

      // 2. Fetch current user's memberships
      const { data: memberships } = await supabase
        .from('channel_members')
        .select('channel_id, status')
        .eq('user_id', user.id);

      const membershipMap: Record<string, string> = {};
      if (memberships) {
        memberships.forEach((m) => {
          membershipMap[m.channel_id] = m.status; // 'active' or 'pending'
        });
      }

      setMyMemberships(membershipMap);
      setChannels(allChannels || []);
      setLoading(false);
    }

    loadPublicChannels();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJoinChannel = async (channelId: string, requireApproval = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const status = requireApproval ? 'pending' : 'active';

    const { error } = await supabase.from('channel_members').insert([
      {
        channel_id: channelId,
        user_id: user.id,
        role: 'member',
        status: status,
      },
    ]);

    if (error) {
      alert('Failed to join channel: ' + error.message);
    } else {
      setMyMemberships((prev) => ({ ...prev, [channelId]: status }));
      if (!requireApproval) {
        onJoinedChannel(channelId);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-white flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
          <div>
            <h2 className="text-lg font-bold">Discover Channels</h2>
            <p className="text-xs text-gray-400">Join communities and start chatting</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold p-1">✕</button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Loading channels...</div>
        ) : channels.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">No channels available yet. Create one!</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {channels.map((channel) => {
              const membershipStatus = myMemberships[channel.id];

              return (
                <div key={channel.id} className="flex items-center justify-between bg-gray-800/60 border border-gray-800 rounded-xl p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 overflow-hidden flex items-center justify-center font-bold text-blue-400 shrink-0">
                      {channel.avatar_url ? (
                        <img src={channel.avatar_url} alt={channel.name} className="w-full h-full object-cover" />
                      ) : (
                        channel.name[0]?.toUpperCase() || '#'
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{channel.name}</h3>
                      <p className="text-xs text-gray-400 line-clamp-1">{channel.description || 'No description provided'}</p>
                    </div>
                  </div>

                  <div>
                    {membershipStatus === 'active' ? (
                      <button
                        onClick={() => {
                          onJoinedChannel(channel.id);
                          onClose();
                        }}
                        className="px-4 py-1.5 bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-600 transition"
                      >
                        Open Chat
                      </button>
                    ) : membershipStatus === 'pending' ? (
                      <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold">
                        Request Pending
                      </span>
                    ) : (
                      <button
                        onClick={() => handleJoinChannel(channel.id, false)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-md"
                      >
                        Join Channel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}