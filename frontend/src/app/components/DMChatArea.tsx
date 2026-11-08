import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function DMChatArea({ conversationId, currentUserId }: { conversationId: string; currentUserId: string }) {
  const [conversation, setConversation] = useState<any>(null);
  const [counterpart, setCounterpart] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return;

    async function loadDmData() {
      // 1. Fetch conversation
      const { data: conv } = await supabase
        .from('direct_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (!conv) return;
      setConversation(conv);

      // 2. Fetch counterpart profile
      const counterpartId = conv.sender_id === currentUserId ? conv.receiver_id : conv.sender_id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', counterpartId)
        .single();
      setCounterpart(profile);

      // 3. Fetch messages
      const { data: msgs } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);
    }

    loadDmData();

    // Realtime subscription for DM messages & status updates
    const sub = supabase
      .channel(`dm:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_conversations', filter: `id=eq.${conversationId}` }, (payload) => {
        setConversation(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [conversationId, currentUserId]);

  const handleAcceptRequest = async () => {
    await supabase
      .from('direct_conversations')
      .update({ status: 'accepted' })
      .eq('id', conversationId);
  };

  const handleRejectRequest = async () => {
    await supabase
      .from('direct_conversations')
      .update({ status: 'rejected' })
      .eq('id', conversationId);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    // Check message count limit if status is pending and user is sender
    const mySentMessagesCount = messages.filter(m => m.sender_id === currentUserId).length;
    if (conversation.status === 'pending' && conversation.sender_id === currentUserId && mySentMessagesCount >= 5) {
      alert("You have reached the 5-message limit. Wait for the user to accept your chat request to continue chatting!");
      return;
    }

    const { error } = await supabase.from('direct_messages').insert([
      { conversation_id: conversationId, sender_id: currentUserId, content: newMessage }
    ]);

    if (!error) {
      setNewMessage('');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
        <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 overflow-hidden flex items-center justify-center font-bold text-sm text-blue-400">
          {counterpart?.avatar_url ? <img src={counterpart.avatar_url} className="w-full h-full object-cover" /> : counterpart?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-sm font-bold">@{counterpart?.username || 'Loading...'}</h2>
          <span className="text-[11px] text-gray-400">Direct Message</span>
        </div>
      </div>

      {/* Consent Banner for Receiver */}
      {isPending && isReceiver && (
        <div className="bg-blue-600/20 border-b border-blue-500/30 p-4 flex items-center justify-between text-xs">
          <div>
            <strong className="text-blue-300">@{counterpart?.username}</strong> wants to send you direct messages. Do you accept this chat request?
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
              <div className={`px-4 py-2 rounded-2xl max-w-md text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}>
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

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
          onChange={(e) => setNewMessage(e.target.value)}
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