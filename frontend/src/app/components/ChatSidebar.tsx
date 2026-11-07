import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import CreateChannelModal from './CreateChannelModal';
import ChannelDiscoveryModal from './ChannelDiscoveryModal';

export default function Sidebar({ onSelectChannel, activeChannelId }: { onSelectChannel: (id: string, name: string) => void; activeChannelId: string }) {
  const [channels, setChannels] = useState<any[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if (user) loadUserChannels(user.id);
    });
  }, []);

  const loadUserChannels = async (userId: string) => {
    // Fetch channels where user is an active member
    const { data: memberships, error } = await supabase
      .from('channel_members')
      .select('channel_id, channels(*)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('Error loading user channels:', error);
      return;
    }

    if (memberships) {
      const userChannels = memberships.map((m: any) => m.channels).filter(Boolean);
      setChannels(userChannels);
      
      // Auto-select the first channel if none is currently active
      if (userChannels.length > 0 && !activeChannelId) {
        onSelectChannel(userChannels[0].id, userChannels[0].name);
      }
    }
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full text-white">
      {/* Sidebar Header with Browse and Create Actions */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="font-bold text-sm tracking-wide text-gray-200">Channels</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsDiscoverOpen(true)}
            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
            title="Browse Channels"
          >
            🔍 Browse
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-xs font-bold transition cursor-pointer shadow-sm"
            title="Create Channel"
          >
            + New
          </button>
        </div>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {channels.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-gray-500 space-y-2">
            <p>No channels joined yet.</p>
            <p>Click <span className="text-blue-400 font-semibold">Browse</span> to discover rooms or <span className="text-blue-400 font-semibold">+ New</span> to create your own!</p>
          </div>
        ) : (
          channels.map((channel) => {
            const isActive = channel.id === activeChannelId;
            return (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id, channel.name)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                  isActive ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-800/80 text-gray-300'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center font-bold text-xs shrink-0">
                  {channel.avatar_url ? (
                    <img src={channel.avatar_url} alt={channel.name} className="w-full h-full object-cover" />
                  ) : (
                    channel.name[0]?.toUpperCase() || '#'
                  )}
                </div>
                <div className="truncate flex-1">
                  <div className="text-sm font-semibold truncate">{channel.name}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                    {channel.description || 'Channel chat'}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* User Session Footer */}
      {currentUser && (
        <div className="p-3 border-t border-gray-800 bg-gray-950/50 flex items-center justify-between text-xs">
          <div className="truncate text-gray-400">
            User: <span className="text-white font-medium">{currentUser.email?.split('@')[0]}</span>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
            className="text-red-400 hover:text-red-300 transition cursor-pointer"
            title="Sign out"
          >
            Logout
          </button>
        </div>
      )}

      {/* Channel Creation Modal */}
      <CreateChannelModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onChannelCreated={(newChannelId) => {
          setIsCreateOpen(false);
          if (currentUser) loadUserChannels(currentUser.id);
          onSelectChannel(newChannelId, 'New Channel');
        }}
      />

      {/* Channel Discovery & Join Modal */}
      <ChannelDiscoveryModal
        isOpen={isDiscoverOpen}
        onClose={() => setIsDiscoverOpen(false)}
        onJoinedChannel={(joinedChannelId) => {
          setIsDiscoverOpen(false);
          if (currentUser) loadUserChannels(currentUser.id);
          onSelectChannel(joinedChannelId, 'Channel');
        }}
      />
    </div>
  );
}