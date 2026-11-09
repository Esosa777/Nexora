import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface MessageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onSelectChannel: (channelId: string) => void;
  onSelectDm: (dmId: string) => void;
}

export default function MessageSearchModal({
  isOpen,
  onClose,
  currentUserId,
  onSelectChannel,
  onSelectDm,
}: MessageSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [channelResults, setChannelResults] = useState<any[]>([]);
  const [dmResults, setDmResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || !currentUserId) {
      setChannelResults([]);
      setDmResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);

      // 1. Search channel messages
      const { data: chanMsgs } = await supabase
        .from('messages')
        .select(`
          *,
          channels(id, name),
          profiles!user_id(username, avatar_url)
        `)
        .ilike('content', `%${searchQuery}%`)
        .limit(10);

      // 2. Search direct messages
      const { data: dmMsgs } = await supabase
        .from('direct_messages')
        .select(`
          *,
          profiles!sender_id(username, avatar_url)
        `)
        .ilike('content', `%${searchQuery}%`)
        .limit(10);

      setChannelResults(chanMsgs || []);
      setDmResults(dmMsgs || []);
      setLoading(false);
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        
        {/* Search Header */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past messages across channels and DMs..."
            autoFocus
            className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-gray-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white text-xs">Clear</button>
          )}
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center text-xs text-gray-500 py-8">Searching messages...</div>
          ) : !searchQuery.trim() ? (
            <div className="text-center text-xs text-gray-500 py-12">Type something to search your chat history.</div>
          ) : channelResults.length === 0 && dmResults.length === 0 ? (
            <div className="text-center text-xs text-gray-500 py-12">No messages found matching "{searchQuery}"</div>
          ) : (
            <>
              {/* Channel Results */}
              {channelResults.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Channel Messages</h4>
                  <div className="space-y-2">
                    {channelResults.map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => {
                          if (msg.channel_id) {
                            onSelectChannel(msg.channel_id);
                            onClose();
                          }
                        }}
                        className="p-3 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 rounded-xl cursor-pointer transition flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-blue-400 font-bold">#{msg.channels?.name || 'channel'}</span>
                          <span className="text-[10px] text-gray-500">@{msg.profiles?.username || 'User'}</span>
                        </div>
                        <p className="text-sm text-gray-200 truncate">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DM Results */}
              {dmResults.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 mt-4">Direct Messages</h4>
                  <div className="space-y-2">
                    {dmResults.map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => {
                          if (msg.conversation_id) {
                            onSelectDm(msg.conversation_id);
                            onClose();
                          }
                        }}
                        className="p-3 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 rounded-xl cursor-pointer transition flex flex-col gap-1"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-emerald-400 font-bold">Direct Message</span>
                          <span className="text-[10px] text-gray-500">@{msg.profiles?.username || 'User'}</span>
                        </div>
                        <p className="text-sm text-gray-200 truncate">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-950 border-t border-gray-800 flex justify-between items-center text-[11px] text-gray-500">
          <span>Tip: Click any result to jump directly to that conversation</span>
          <button onClick={onClose} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg">Close</button>
        </div>
      </div>
    </div>
  );
}