import { useEffect, useState, useRef } from 'react';
import { supabase } from "../lib/supabase";

export default function ChatArea({ channelId }: { channelId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Edit message state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Helper to scroll to bottom smoothly
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setUnreadCount(0);
    setShowScrollButton(false);
  };

  // Track scroll position to show/hide the jump-to-bottom button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollButton(isFarFromBottom);
    if (!isFarFromBottom) {
      setUnreadCount(0);
    }
  };

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

  // 2. Fetch messages & subscribe to database inserts/updates/deletes
  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      return;
    }

    setMessages([]);

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
        setTimeout(() => scrollToBottom(false), 50);
      }
    }

    getMessages();

    const channelSubscription = supabase
      .channel(`room:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            let senderProfile = null;
            if (payload.new.user_id) {
              const { data } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', payload.new.user_id)
                .single();
              senderProfile = data;
            }

            const fullMessage: any = {
              ...payload.new,
              profiles: senderProfile,
            };
            
            setMessages((prev) => {
              if ((prev as any[]).some((msg: any) => msg.id === fullMessage.id)) return prev;
              const updatedMessages = [...prev, fullMessage];

              const container = scrollContainerRef.current;
              const isNearBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight < 150) : true;
              
              if (isNearBottom || fullMessage.user_id === currentUser?.id) {
                setTimeout(() => scrollToBottom(true), 50);
              } else {
                setUnreadCount((count) => count + 1);
                setShowScrollButton(true);
              }

              return updatedMessages;
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === payload.new.id ? { ...msg, content: payload.new.content } : msg))
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((msg) => msg.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSubscription);
    };
  }, [channelId, currentUser]);

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
      scrollToBottom(true);
    }
  };

  // 6. Handle deleting messages
  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting message:', error);
    } else {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    }
  };

  // 7. Handle editing messages
  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;

    const { error } = await supabase
      .from('messages')
      .update({ content: editContent })
      .eq('id', messageId);

    if (error) {
      console.error('Error updating message:', error);
    } else {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content: editContent } : msg))
      );
      setEditingId(null);
      setEditContent('');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 text-white relative">
      {/* Messages Feed Container */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto space-y-4 relative"
      >
        {!channelId ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a channel from the sidebar to start chatting
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isMe = currentUser && msg.user_id === currentUser.id;
              const displayName = isMe ? 'You' : msg.profiles?.username || 'Anonymous';
              const avatarUrl = msg.profiles?.avatar_url;
              const isEditing = editingId === msg.id;

              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
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

                    {/* Edit/Delete Actions for Own Messages */}
                    {isMe && !isEditing && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 ml-2 text-[10px] text-gray-400">
                        <button 
                          onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}
                          className="hover:text-blue-400 underline"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="hover:text-red-400 underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Bubble or Edit Input */}
                  {isEditing ? (
                    <div className="flex flex-col gap-2 max-w-md w-full">
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex gap-2 justify-end text-xs">
                        <button 
                          onClick={() => setEditingId(null)} 
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleSaveEdit(msg.id)} 
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className={`p-3 rounded-xl max-w-md ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-br-none' 
                          : 'bg-gray-800 text-gray-200 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Scroll Anchor */}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* WhatsApp-Style Jump to Bottom Button */}
        {showScrollButton && (
          <button 
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition z-20 cursor-pointer"
          >
            ↓ {unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}` : 'Scroll to bottom'}
          </button>
        )}
      </div>

      {/* Typing Indicator Display */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-gray-400 italic bg-gray-900/50">
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