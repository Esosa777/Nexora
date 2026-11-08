import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DMSidebar({ currentUserId, activeDmId, onSelectDm, onOpenStartModal }: { currentUserId: string; activeDmId: string | null; onSelectDm: (id: string) => void; onOpenStartModal: () => void }) {
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUserId) return;

    async function fetchDms() {
      const { data, error } = await supabase
        .from('direct_conversations')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching DMs:', error);
        return;
      }

      // Fetch counterpart profile details for each conversation
      const convsWithProfiles = await Promise.all(
        (data || []).map(async (conv) => {
          const counterpartId = conv.sender_id === currentUserId ? conv.receiver_id : conv.sender_id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', counterpartId)
            .single();

          return { ...conv, counterpart: profile };
        })
      );

      setConversations(convsWithProfiles);
    }

    fetchDms();

    // Real-time listener for conversation updates (e.g. when someone accepts request)
    const sub = supabase
      .channel('public:direct_conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_conversations' }, () => {
        fetchDms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [currentUserId]);

  return (
    <div className="flex flex-col gap-2 mt-4">
      <div className="flex items-center justify-between px-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Direct Messages</span>
        <button 
          onClick={onOpenStartModal}
          className="w-5 h-5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center text-xs transition cursor-pointer"
          title="New Direct Message"
        >
          +
        </button>
      </div>

      <div className="space-y-1">
        {conversations.map((conv) => {
          const isActive = activeDmId === conv.id;
          const isPendingReceiver = conv.status === 'pending' && conv.receiver_id === currentUserId;

          return (
            <button
              key={conv.id}
              onClick={() => onSelectDm(conv.id)}
              className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                isActive ? 'bg-blue-600 text-white font-semibold' : 'text-gray-300 hover:bg-gray-800/60'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <div className="w-6 h-6 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center font-bold text-[10px] shrink-0">
                  {conv.counterpart?.avatar_url ? (
                    <img src={conv.counterpart.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    conv.counterpart?.username?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <span className="truncate">@{conv.counterpart?.username || 'user'}</span>
              </div>

              {isPendingReceiver && (
                <span className="bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  Request
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}