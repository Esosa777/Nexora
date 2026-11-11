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
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
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

        // Fetch initial unread message counts where status != 'read' and sender != me
        const convIds = data.map((c: any) => c.id);
        if (convIds.length > 0) {
          const { data: unreadMsgs } = await supabase
            .from('direct_messages')
            .select('conversation_id')
            .in('conversation_id', convIds)
            .neq('sender_id', currentUserId)
            .neq('status', 'read');

          const map: Record<string, number> = {};
          unreadMsgs?.forEach((m: any) => {
            map[m.conversation_id] = (map[m.conversation_id] || 0) + 1;
          });
          setUnreadMap(map);
        }
      }
      setLoading(false);
    }

    loadConversations();

    // Global Presence Channel
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

    // Global unread listener for new incoming DMs and conversation updates
    const dmUnreadSub = supabase
      .channel('global_dm_unread_listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const msg = payload.new;
          if (
            msg.sender_id !== currentUserId &&
            msg.conversation_id !== activeDmId
          ) {
            setUnreadMap((prev) => ({
              ...prev,
              [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1,
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_conversations' },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalPresence);
      supabase.removeChannel(dmUnreadSub);
    };
  }, [currentUserId, activeDmId]);

  // Handle accepting a pending DM request
  const handleAcceptRequest = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    const { error } = await supabase
      .from('direct_conversations')
      .update({ status: 'active' })
      .eq('id', conversationId);

    if (error) {
      alert('Failed to accept request: ' + error.message);
    } else {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status: 'active' } : c))
      );
    }
  };

  // Clear unread count for active DM when selected
  const handleSelectDmWrapper = (dmId: string) => {
    setUnreadMap((prev) => ({ ...prev, [dmId]: 0 }));
    onSelectDm(dmId);
  };

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
            const unreadCount = unreadMap[conv.id] || 0;
            const isIncomingPending = conv.status === 'pending' && conv.receiver_id === currentUserId;

            return (
              <div
                key={conv.id}
                onClick={() => handleSelectDmWrapper(conv.id)}
                className={`w-full p-2.5 rounded-xl flex items-center justify-between transition cursor-pointer ${
                  isActive ? 'bg-blue-600/20 border border-blue-500/40 text-white' : 'hover:bg-gray-800 text-gray-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center font-bold text-sm">
                      {counterpart?.avatar_url ? (
                        <img src={counterpart.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        counterpart?.username?.[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold truncate">@{counterpart?.username || 'User'}</span>
                      {conv.status === 'pending' && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">Pending</span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 block truncate">
                      {isOnline ? 'Active now' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isIncomingPending && (
                    <button
                      onClick={(e) => handleAcceptRequest(e, conv.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition shadow"
                    >
                      Accept
                    </button>
                  )}

                  {unreadCount > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}