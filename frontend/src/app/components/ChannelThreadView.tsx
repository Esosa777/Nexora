import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ChannelThreadViewProps {
  channelId: string;
  parentMessage: any;
  currentUser: any;
  onClose: () => void;
}

export default function ChannelThreadView({ channelId, parentMessage, currentUser, onClose }: ChannelThreadViewProps) {
  const [threadReplies, setThreadReplies] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parentMessage?.id) return;

    async function fetchThreadReplies() {
      setLoading(true);
      const { data, error } = await supabase
        .from('channel_messages')
        .select(`
          *,
          profiles:sender_id(id, username, display_name, avatar_url)
        `)
        .eq('parent_message_id', parentMessage.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setThreadReplies(data);
      }
      setLoading(false);
    }

    fetchThreadReplies();

    // Real-time subscription for new thread replies
    const threadSub = supabase
      .channel(`channel_thread:${parentMessage.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `parent_message_id=eq.${parentMessage.id}`,
        },
        async (payload) => {
          let senderProfile = null;
          const newMsg: any = payload.new;

          if (newMsg.sender_id) {
            const { data } = await supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();
            senderProfile = data;
          }

          const newReply: any = {
            ...newMsg,
            profiles: senderProfile,
          };

          setThreadReplies((prev) => {
            if (prev.some((r) => r.id === newReply.id)) return prev;
            return [...prev, newReply];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(threadSub);
    };
  }, [parentMessage]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !currentUser) return;

    const { error } = await supabase.from('channel_messages').insert([
      {
        channel_id: channelId,
        parent_message_id: parentMessage.id,
        sender_id: currentUser.id,
        content: replyContent,
      },
    ]);

    if (error) {
      alert('Failed to send thread reply: ' + error.message);
    } else {
      setReplyContent('');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const parentSender = parentMessage.profiles;

  return (
    <div className="w-80 md:w-96 bg-gray-900 border-l border-gray-800 flex flex-col h-full text-white z-20 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span>🧵</span> Thread
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white cursor-pointer w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-800 transition"
        >
          ✕
        </button>
      </div>

      {/* Thread Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Root Parent Message */}
        <div className="pb-4 border-b border-gray-800 flex gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-sm">
            {parentSender?.avatar_url ? (
              <img src={parentSender.avatar_url} className="w-full h-full object-cover" />
            ) : (
              parentSender?.username?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-white">
                {parentSender?.display_name || `@${parentSender?.username || 'User'}`}
              </span>
              <span className="text-[10px] text-gray-400">{formatTime(parentMessage.created_at)}</span>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed break-words">{parentMessage.content}</p>
          </div>
        </div>

        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-2">
          {threadReplies.length} {threadReplies.length === 1 ? 'Reply' : 'Replies'}
        </div>

        {/* Replies List */}
        {loading ? (
          <div className="text-center text-xs text-gray-500 py-4">Loading replies...</div>
        ) : threadReplies.length === 0 ? (
          <div className="text-center text-xs text-gray-500 py-6">
            No replies yet. Start the conversation below!
          </div>
        ) : (
          threadReplies.map((reply) => {
            const sender = reply.profiles;
            const isMe = currentUser && reply.sender_id === currentUser.id;

            return (
              <div key={reply.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs">
                  {sender?.avatar_url ? (
                    <img src={sender.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    sender?.username?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">
                      {sender?.display_name || `@${sender?.username || 'User'}`}
                      {isMe && <span className="ml-1.5 text-[9px] bg-blue-600/30 text-blue-300 px-1 rounded">You</span>}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatTime(reply.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed break-words">{reply.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Input Form */}
      <form onSubmit={handleSendReply} className="p-3 border-t border-gray-800 bg-gray-900 flex items-center gap-2">
        <input
          type="text"
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Reply in thread..."
          className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 border border-gray-700"
        />
        <button
          type="submit"
          disabled={!replyContent.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-2 rounded-xl text-xs font-semibold text-white transition cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  );
}