import { useEffect, useState, useRef } from 'react';
import { supabase } from "../lib/supabase";

export default function ChatArea({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Track logged-in user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch messages & subscribe to database inserts
  useEffect(() => {
    if (!channelId) return;

    async function getMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles:user_id ( username, avatar_url )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
    }

    getMessages();

    const channelSubscription = supabase
      .channel(`room:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          let senderProfile = null;
          if (payload.new.user_id) {
            const { data } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', payload.new.user_id)
              .single();
            senderProfile = data;
          }

          const fullMessage = {
            ...payload.new,
            profiles: senderProfile,
          };
          
          setMessages((prev) => {
  if ((prev as any[]).some((msg: any) => msg.id === (fullMessage as any).id)) return prev;
  return [...prev, fullMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSubscription);
    };
  }, [channelId]);

  // 3. Typing Broadcast channel effect
  useEffect(() => {
    if (!channelId || !currentUser) return;

    const typingChannel = supabase.channel(`typing:${channelId}`);

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, username, isTyping } = payload.payload;
        if (userId === currentUser.id) return;

        setTypingUsers((prev) => {
          if (isTyping) {
            return prev.includes(username) ? prev : [...prev, username];
          } else {
            return prev.filter((u) => u !== username);
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [channelId, currentUser]);

  // 4. Handle input change & broadcast typing status
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (!channelId || !currentUser) return;

    const typingChannel = supabase.channel(`typing:${channelId}`);
    
    typingChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUser.id,
        username: currentUser.email?.split('@')[0] || 'Someone',
        isTyping: true,
      },
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      typingChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: currentUser.id,
          username: currentUser.email?.split('@')[0] || 'Someone',
          isTyping: false,
        },
      });
    }, 2000);
  };

  // 5. Handle sending messages
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !channelId) return;

    const { error } = await supabase.from('messages').insert([
      {
        channel_id: channelId,
        content: newMessage,
        user_id: currentUser?.id ?? null,
      }
    ]);

    if (error) {
      console.error('Error sending message:', error);
    } else {
      setNewMessage('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 text-white">
      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {!channelId ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a channel from the sidebar to start chatting
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUser && msg.user_id === currentUser.id;
            const displayName = isMe ? 'You' : msg.profiles?.username || 'Anonymous';
            const avatarUrl = msg.profiles?.avatar_url;

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Sender Avatar & Username Header */}
                <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-gray-300 font-bold">
                        {displayName[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {displayName}
                  </span>
                </div>

                {/* Message Bubble */}
                <div 
                  className={`p-3 rounded-xl max-w-md ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-gray-800 text-gray-200 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Typing Indicator Display */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-gray-400 italic">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Message Input Form */}
      {channelId && (
        <form onSubmit={handleSendMessage} className="p-4 bg-gray-900 border-t border-gray-800 flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder={currentUser ? "Type a message..." : "Sign in to send messages"}
            disabled={!currentUser}
            className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!currentUser}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2 rounded-lg font-medium transition"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}