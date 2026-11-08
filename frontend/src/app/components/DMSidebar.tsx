import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface DMSidebarProps {
  currentUserId: string;
  activeDmId: string | null;
  onSelectDm: (dmId: string) => void;
  onOpenStartModal: () => void;
}

export default function DMSidebar({ currentUserId, activeDmId, onSelectDm, onOpenStartModal }: DMSidebarProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;

    async function loadConversations() {
      setLoading(true);
      const { data, error } = await supabase
        .from('direct_conversations')
        .select(`
          *,
          sender:profiles!sender_id(id, username, avatar_url),
          receiver:profiles!receiver_id(id, username, avatar_url)
        `)
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (!error && data) {
        setConversations(data);
      }
      setLoading(false);
    }

    loadConversations();

    // Global Presence Channel to track online users across the app
    const globalPresence = supabase.channel('global_presence', {
      config: { presence: { key: currentUserId } }
    });

    globalPresence
      .on('presence', { event: 'sync' }, () => {
        const state = globalPresence.presenceState();
        setOnlineUserIds(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalPresence.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(globalPresence);
    };
  }, [currentUserId]);

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 text-white">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Direct Messages</h3>
        <button
          onClick={onOpenStartModal}
          className="w-6 h-6 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm transition cursor-pointer shadow"
          title="New Direct Message"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-center text-xs text-gray-500 py-4">Loading DMs...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-xs text-gray-500 py-8 px-2">
            No direct messages yet. Click "+" to start chatting by username!
          </div>
        ) : (
          conversations.map((conv) => {
            const isSender = conv.sender_id === currentUserId;
            const counterpart = isSender ? conv.receiver : conv.sender;
            const isOnline = onlineUserIds.includes(counterpart?.id);
            const isActive = activeDmId === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectDm(conv.id)}
                className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition text-left cursor-pointer ${
                  isActive ? 'bg-blue-600/20 border border-blue-500/40 text-white' : 'hover:bg-gray-800 text-gray-300 border border-transparent'
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center font-bold text-sm">
                    {counterpart?.avatar_url ? (
                      <img src={counterpart.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      counterpart?.username?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  {/* Online Indicator Dot */}
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                </div>

                <div className="flex-1 truncate">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold truncate">@{counterpart?.username || 'User'}</span>
                    {conv.status === 'pending' && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">Pending</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 block truncate">
                    {isOnline ? 'Active now' : 'Offline'}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}