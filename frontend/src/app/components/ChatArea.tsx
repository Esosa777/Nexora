import { useEffect, useState, useRef } from 'react';
import { supabase } from "../lib/supabase";

// Helper component to render audio messages with automatic duration formatting
function AudioMessagePlayer({ src }: { src: string }) {
  const [duration, setDuration] = useState<string>('0:00');
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (!isNaN(dur)) {
        const mins = Math.floor(dur / 60);
        const secs = Math.floor(dur % 60);
        setDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1 mt-1">
      <audio 
        ref={audioRef}
        controls 
        src={src} 
        onLoadedMetadata={handleLoadedMetadata}
        className="h-8 max-w-[220px]" 
      />
      <span className="text-[10px] text-gray-300 self-end select-none">
        Voice Note • {duration}
      </span>
    </div>
  );
}

export default function ChatArea({ channelId, customBackground }: { channelId: string; customBackground?: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Advanced chat states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Media, Mention & Emoji states
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subtle pop sound effect
  const playPopSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setUnreadCount(0);
    setShowScrollButton(false);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollButton(isFarFromBottom);
    if (!isFarFromBottom) setUnreadCount(0);
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

  // 2. Fetch messages & subscribe
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
          updated_at,
          user_id,
          media_url,
          media_type,
          reply_to_id,
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

              if (fullMessage.user_id !== currentUser?.id) {
                playPopSound();
              }

              return updatedMessages;
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) => 
                msg.id === payload.new.id 
                  ? { ...msg, content: payload.new.content, updated_at: payload.new.updated_at } 
                  : msg
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSubscription);
    };
  }, [channelId, currentUser]);

  // 3. Handle input & check for @mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    const mentionMatch = value.match(/@([a-zA-Z0-9_]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      fetchMentionSuggestions(query);
    } else {
      setMentionQuery(null);
      setMentionSuggestions([]);
    }

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

  const fetchMentionSuggestions = async (query: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .ilike('username', `${query}%`)
      .limit(5);

    setMentionSuggestions(data || []);
  };

  const selectMention = (username: string) => {
    const updated = newMessage.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
    setNewMessage(updated);
    setMentionQuery(null);
    setMentionSuggestions([]);
  };

  // 4. Handle sending text/reply message
  const handleSendMessage = async (e: React.FormEvent, mediaUrl?: string, mediaType?: string) => {
    e?.preventDefault?.();
    if ((!newMessage.trim() && !mediaUrl) || !channelId) return;

    playPopSound();

    const { error } = await supabase.from('messages').insert([
      {
        channel_id: channelId,
        content: newMessage,
        user_id: currentUser?.id ?? null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        reply_to_id: replyingTo?.id || null,
      }
    ]);

    if (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message: ' + error.message);
    } else {
      setNewMessage('');
      setReplyingTo(null);
      setShowEmojiPicker(false);
      scrollToBottom(true);
    }
  };

  // 5. Handle file uploads
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${channelId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file);
    
    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      alert('Upload failed! Details: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
    const mediaType = file.type.startsWith('image/') ? 'image' : 'file';

    await handleSendMessage({} as any, data.publicUrl, mediaType);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 6. High-Quality Voice Note Recording Handler
  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          sampleRate: 44100 
        } 
      });

      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/ogg;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = {} as any;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `voice_${Math.random().toString(36).substring(2)}.webm`;
        const filePath = `${channelId}/${fileName}`;

        setUploading(true);
        const { error } = await supabase.storage.from('chat-media').upload(filePath, audioBlob);
        if (error) {
          alert('Voice note upload failed: ' + error.message);
        } else {
          const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
          await handleSendMessage({} as any, data.publicUrl, 'audio');
        }
        setUploading(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    await supabase.from('messages').delete().eq('id', messageId);
    setActiveMenuId(null);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    await supabase.from('messages').update({ content: editContent, updated_at: new Date().toISOString() }).eq('id', messageId);
    setEditingId(null);
    setEditContent('');
    setActiveMenuId(null);
  };

  return (
    <div 
      className="flex-1 flex flex-col h-full text-white relative bg-cover bg-center"
      style={{ backgroundImage: customBackground ? `url(${customBackground})` : undefined }}
    >
      <div className={`absolute inset-0 ${customBackground ? 'bg-black/60' : 'bg-gray-950'} z-0 pointer-events-none`} />

      {/* Messages Feed Container */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto space-y-4 relative z-10"
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
              const isEdited = msg.updated_at && msg.updated_at !== msg.created_at;
              const isMenuOpen = activeMenuId === msg.id;
              const repliedToMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;

              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col relative group ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-gray-300 font-bold">{displayName[0].toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{displayName}</span>
                  </div>

                  <div className="relative">
                    {isMenuOpen && (
                      <div className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} bg-gray-900 border border-gray-700 shadow-xl rounded-xl py-1 z-30 w-36 text-xs flex flex-col`}>
                        <button onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-gray-800 transition">Reply</button>
                        <button onClick={() => { navigator.clipboard.writeText(msg.content); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-gray-800 transition">Copy</button>
                        {isMe && (
                          <>
                            <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-gray-800 transition">Edit</button>
                            <button onClick={() => handleDeleteMessage(msg.id)} className="px-3 py-2 text-left text-red-400 hover:bg-gray-800 transition">Delete</button>
                          </>
                        )}
                      </div>
                    )}

                    {isEditing ? (
                      <div className="flex flex-col gap-2 max-w-md w-full bg-gray-900 p-2 rounded-xl">
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none"
                        />
                        <div className="flex gap-2 justify-end text-xs">
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-700 rounded text-gray-300">Cancel</button>
                          <button onClick={() => handleSaveEdit(msg.id)} className="px-2 py-1 bg-blue-600 rounded text-white">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onContextMenu={(e) => { e.preventDefault(); setActiveMenuId(isMenuOpen ? null : msg.id); }}
                        className={`px-4 py-2.5 rounded-2xl max-w-md shadow-md flex flex-col gap-1 cursor-pointer ${
                          isMe 
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm' 
                            : 'bg-gray-800/90 border border-gray-700/60 text-gray-100 rounded-bl-sm'
                        }`}
                      >
                        {repliedToMsg && (
                          <div className="bg-black/30 border-l-2 border-blue-400 px-2 py-1 rounded text-[11px] mb-1 opacity-90 truncate">
                            <span className="font-semibold block">{repliedToMsg.user_id === currentUser?.id ? 'You' : 'Someone'}</span>
                            {repliedToMsg.content || 'Media attachment'}
                          </div>
                        )}

                        {msg.media_type === 'image' && (
                          <img src={msg.media_url} alt="attachment" className="rounded-lg max-h-60 object-cover mt-1" />
                        )}
                        {msg.media_type === 'audio' && (
                          <AudioMessagePlayer src={msg.media_url} />
                        )}
                        {msg.media_type === 'file' && (
                          <a href={msg.media_url} target="_blank" rel="noreferrer" className="underline text-blue-200 text-xs mt-1 block">📎 Download Attachment</a>
                        )}

                        {msg.content && <p className="text-sm leading-relaxed break-words">{msg.content}</p>}
                        
                        <div className={`flex items-center gap-1.5 text-[10px] select-none ${isMe ? 'text-blue-200 justify-end' : 'text-gray-400 justify-start'}`}>
                          {isEdited && <span>(edited)</span>}
                          <span>{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}

        {showScrollButton && (
          <button 
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition z-20 cursor-pointer"
          >
            ↓ {unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}` : 'Scroll to bottom'}
          </button>
        )}
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-gray-400 italic bg-gray-900/50 z-10">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-gray-900/90 border-t border-gray-800 flex justify-between items-center text-xs z-10">
          <div>
            <span className="text-blue-400 font-semibold">Replying to message:</span>
            <p className="text-gray-300 truncate max-w-md">{replyingTo.content || 'Media attachment'}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white font-bold px-2">✕</button>
        </div>
      )}

      {/* Message Input, Emoji Picker & Mention Suggestions Box */}
      {channelId && (
        <div className="relative">
          {/* Mention Suggestions Popup */}
          {mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-64 overflow-hidden z-30">
              <div className="px-3 py-1.5 text-[10px] text-gray-400 bg-gray-800/80 border-b border-gray-700 font-semibold">
                People matching @{mentionQuery}
              </div>
              {mentionSuggestions.map((user) => (
                <button
                  key={user.username}
                  onClick={() => selectMention(user.username)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-800 text-xs flex items-center gap-2 transition"
                >
                  <div className="w-5 h-5 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center font-bold text-[10px]">
                    {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : user.username[0].toUpperCase()}
                  </div>
                  <span className="font-medium text-white">@{user.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* Emoji Picker Popup */}
          {showEmojiPicker && (
            <div className="absolute bottom-full left-16 mb-2 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-3 grid grid-cols-6 gap-2 z-30 w-64">
              <div className="col-span-6 pb-1 mb-1 border-b border-gray-800 text-[10px] text-gray-400 font-semibold">
                Choose an emoji
              </div>
              {['😊', '😂', '❤️', '👍', '🔥', '🎉', '😎', '😢', '🙏', '✨', '👀', '💯', '🚀', '⭐', '🙌', '💡', '💬', '👏'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setNewMessage((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-8 h-8 hover:bg-gray-800 rounded-xl flex items-center justify-center text-lg transition cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => handleSendMessage(e)} className="p-4 bg-gray-900/95 border-t border-gray-800 flex items-center gap-3 z-10">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            
            {/* Attach File Button */}
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl transition flex items-center justify-center border border-gray-700 shadow-sm cursor-pointer"
              title="Attach file or image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {/* Emoji Picker Toggle Button */}
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl transition flex items-center justify-center border border-gray-700 shadow-sm cursor-pointer text-base"
              title="Insert emoji"
            >
              😊
            </button>

            <input
              type="text"
              name="chat-message-input"
              autoComplete="new-password"
              value={newMessage}
              onChange={handleInputChange}
              placeholder={uploading ? "Uploading media..." : "Type a message or @username..."}
              disabled={!currentUser || uploading}
              className="flex-1 bg-gray-800 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 text-sm shadow-inner border border-gray-700/50"
            />

            {/* Voice Note Recording Button */}
            <button 
              type="button"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`p-2.5 rounded-xl transition flex items-center justify-center border shadow-sm ${
                isRecording 
                  ? 'bg-red-600 border-red-500 animate-pulse text-white' 
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
              }`}
              title="Hold to record voice note"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            </button>

            <button 
              type="submit"
              disabled={!currentUser || uploading || (!newMessage.trim() && !isRecording)}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2.5 rounded-xl font-medium transition text-sm shadow text-white cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}