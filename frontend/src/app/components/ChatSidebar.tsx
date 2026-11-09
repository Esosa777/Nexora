import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ChatSidebarProps {
  channels: any[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  currentUser: any;
  onLogout: () => void;
  onChannelCreated: (newChannel: any) => void;
}

export default function ChatSidebar({
  channels,
  selectedChannelId,
  onSelectChannel,
  currentUser,
  onLogout,
  onChannelCreated,
}: ChatSidebarProps) {
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelAvatar, setNewChannelAvatar] = useState('');

  // Clear unread badge when a channel is selected
  useEffect(() => {
    if (selectedChannelId) {
      setUnreadMap((prev) => ({ ...prev, [selectedChannelId]: 0 }));
    }
  }, [selectedChannelId]);

  // Global listener for incoming messages in any channel to update unread counts
  useEffect(() => {
    if (!currentUser || channels.length === 0) return;

    const channelIds = channels.map((c) => c.id);

    const unreadSub = supabase
      .channel('global_unread_channel_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new;
          if (
            channelIds.includes(msg.channel_id) &&
            msg.user_id !== currentUser.id &&
            msg.channel_id !== selectedChannelId
          ) {
            setUnreadMap((prev) => ({
              ...prev,
              [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(unreadSub);
    };
  }, [channels, currentUser, selectedChannelId]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !currentUser) return;

    const { data: newChan, error } = await supabase
      .from('channels')
      .insert([
        { 
          name: newChannelName.trim(), 
          created_by: currentUser.id,
          avatar_url: newChannelAvatar.trim() || null 
        }
      ])
      .select()
      .single();

    if (!error && newChan) {
      await supabase.from('channel_members').insert([
        { channel_id: newChan.id, user_id: currentUser.id, status: 'active', role: 'admin' },
      ]);
      onChannelCreated(newChan);
      setNewChannelName('');
      setNewChannelAvatar('');
      setIsCreateOpen(false);
    } else {
      alert('Error creating channel: ' + error?.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider uppercase text-gray-400">Channels</h2>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-6 h-6 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm transition cursor-pointer shadow"
          title="Create Channel"
        >
          +
        </button>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {channels.map((chan) => {
          const isActive = chan.id === selectedChannelId;
          const unreadCount = unreadMap[chan.id] || 0;

          return (
            <button
              key={chan.id}
              onClick={() => onSelectChannel(chan.id)}
              className={`w-full p-2.5 rounded-xl flex items-center justify-between transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 border border-blue-500/40 text-white font-semibold'
                  : 'hover:bg-gray-800 text-gray-300 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
                  {chan.avatar_url ? (
                    <img src={chan.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    chan.name?.[0]?.toUpperCase() || '#'
                  )}
                </div>
                <div className="truncate text-left">
                  <span className="text-xs font-semibold truncate">#{chan.name}</span>
                </div>
              </div>
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse shrink-0">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Create Channel Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsCreateOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">Create New Channel</h3>
            <form onSubmit={handleCreateChannel} className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. announcements"
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Avatar Image URL (Optional)</label>
                <input
                  type="url"
                  value={newChannelAvatar}
                  onChange={(e) => setNewChannelAvatar(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 bg-gray-800 rounded-xl text-xs text-gray-300">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 rounded-xl text-xs font-semibold text-white">Create Channel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}