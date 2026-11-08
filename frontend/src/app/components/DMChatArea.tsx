import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

function MessageStatusIndicator({ status, isMe }: { status: 'sent' | 'delivered' | 'read'; isMe: boolean }) {
  if (!isMe) return null;

  return (
    <span className="inline-flex items-center ml-1 select-none" title={`Message ${status}`}>
      {status === 'sent' && (
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'delivered' && (
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7M11 13l4 4L23 7" />
        </svg>
      )}
      {status === 'read' && (
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7M11 13l4 4L23 7" />
        </svg>
      )}
    </span>
  );
}

export default function DMChatArea({ conversationId, currentUserId }: { conversationId: string; currentUserId: string }) {
  const [conversation, setConversation] = useState<any>(null);
  const [counterpart, setCounterpart] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCounterpartTyping, setIsCounterpartTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    async function loadDmData() {
      const { data: conv } = await supabase
        .from('direct_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (!conv) return;
      setConversation(conv);

      const counterpartId = conv.sender_id === currentUserId ? conv.receiver_id : conv.sender_id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', counterpartId)
        .single();
      setCounterpart(profile);

      const { data: msgs } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);

      await supabase
        .from('direct_messages')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .neq('status', 'read');
    }

    loadDmData();

    // Realtime subscription for messages & typing broadcast
    const sub = supabase
      .channel(`dm:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        setMessages((prev) => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });

        if (payload.new.sender_id !== currentUserId) {
          await supabase
            .from('direct_messages')
            .update({ status: 'read', read_at: new Date().toISOString() })
            .eq('id', payload.new.id);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev) => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_conversations', filter: `id=eq.${conversationId}` }, (payload) => {
        setConversation(payload.new);
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== currentUserId) {
          setIsCounterpartTyping(payload.payload.isTyping);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [conversationId, currentUserId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!conversationId || !currentUserId) return;
    const dmChannel = supabase.channel(`dm:${conversationId}`);

    dmChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: true },
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      dmChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping: false },
      });
    }, 2000);
  };

  const handleAcceptRequest = async () => {
    await supabase.from('direct_conversations').update({ status: 'accepted' }).eq('id', conversationId);
  };

  const handleRejectRequest = async () => {
    await supabase.from('direct_conversations').update({ status: 'rejected' }).eq('id', conversationId);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    const mySentMessagesCount = messages.filter(m => m.sender_id === currentUserId).length;
    if (conversation.status === 'pending' && conversation.sender_id === currentUserId && mySentMessagesCount >= 5) {
      alert("You have reached the 5-message limit. Wait for acceptance to continue!");
      return;
    }

    const { error } = await supabase.from('direct_messages').insert([
      { conversation_id: conversationId, sender_id: currentUserId, content: newMessage, status: 'sent' }
    ]);

    if (!error) {
      setNewMessage('');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const mySentCount = messages.filter(m => m.sender_id === currentUserId).length;
  const isPending = conversation?.status === 'pending';
  const isReceiver = conversation?.receiver_id === currentUserId;
  const isSender = conversation?.sender_id === currentUserId;
  const reachedLimit = isPending && isSender && mySentCount >= 5;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 text-white relative">
      {/* DM Header */}
      <div className="px-6 py-3 bg-gray-900 border-b border-gray-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 overflow-hidden flex items-center justify-center font-bold text-sm text-blue-400 relative">
          {counterpart?.avatar_url ? <img src={counterpart.avatar_url} className="w-full h-full object-cover" /> : counterpart?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-sm font-bold">@{counterpart?.username || 'Loading...'}</h2>
          <span className="text-[11px] text-gray-400">
            {isCounterpartTyping ? <span className="text-blue-400 animate-pulse font-medium">typing...</span> : 'Direct Message'}
          </span>
        </div>
      </div>

      {/* Consent Banner for Receiver */}
      {isPending && isReceiver && (
        <div className="bg-blue-600/20 border-b border-blue-500/30 p-4 flex items-center justify-between text-xs">
          <div>
            <strong className="text-blue-300">@{counterpart?.username}</strong> wants to send you direct messages. Do you accept?
          </div>
          <div className="flex gap-2">
            <button onClick={handleAcceptRequest} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition cursor-pointer">Accept</button>
            <button onClick={handleRejectRequest} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition cursor-pointer">Decline</button>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2 rounded-2xl max-w-md text-sm flex flex-col gap-1 ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}>
                <span>{msg.content}</span>
                <div className={`flex items-center gap-1 text-[10px] select-none ${isMe ? 'text-blue-200 justify-end' : 'text-gray-400 justify-start'}`}>
                  <span>{formatTime(msg.created_at)}</span>
                  <MessageStatusIndicator status={msg.status || 'sent'} isMe={isMe} />
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing status bar */}
      {isCounterpartTyping && (
        <div className="px-4 py-1 text-xs text-blue-400 italic animate-pulse bg-gray-900/50">
          @{counterpart?.username} is typing...
        </div>
      )}

      {/* Message Input / Limit Banner */}
      {isPending && isSender && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 text-amber-300 text-xs flex justify-between items-center">
          <span>Chat request pending. Messages sent: {mySentCount} / 5</span>
          {reachedLimit && <span className="font-bold">Limit reached! Waiting for acceptance.</span>}
        </div>
      )}

      <form onSubmit={handleSendMessage} className="p-4 bg-gray-900 border-t border-gray-800 flex gap-3">
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder={reachedLimit ? "5-message limit reached waiting for reply..." : "Type a direct message..."}
          disabled={reachedLimit}
          className="flex-1 bg-gray-800 text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
        />
        <button 
          type="submit" 
          disabled={reachedLimit || !newMessage.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2.5 rounded-xl font-medium text-sm transition cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  );
}