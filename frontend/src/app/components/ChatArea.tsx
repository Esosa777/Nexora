import { useEffect, useState, useRef } from 'react';
import { supabase } from "../lib/supabase";
import MemberManagementModal from './MemberManagementModal';

// Helper for direct background downloads without page redirection
async function handleDirectDownload(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    window.open(url, '_blank');
  }
}

function AudioMessagePlayer({ src, initialDuration }: { src: string; initialDuration?: string }) {
  const [duration, setDuration] = useState<string>(initialDuration || '0:00');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fileName = src.split('/').pop() || 'voicenote.webm';
    handleDirectDownload(src, fileName);
  }, [src]);

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.duration === Infinity || isNaN(audio.duration)) {
      audio.currentTime = 1e101;
      audio.ontimeupdate = () => {
        audio.ontimeupdate = null;
        const dur = audio.duration;
        audio.currentTime = 0;
        if (dur && isFinite(dur) && !isNaN(dur)) {
          const mins = Math.floor(dur / 60);
          const secs = Math.floor(dur % 60);
          setDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
        }
      };
    } else {
      const dur = audio.duration;
      if (dur && isFinite(dur)) {
        const mins = Math.floor(dur / 60);
        const secs = Math.floor(dur % 60);
        setDuration(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }
  };

  const handleEnded = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className="flex flex-col gap-1 mt-1">
      <audio 
        ref={audioRef}
        controls 
        src={src} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="h-8 max-w-[220px]" 
      />
      <div className="flex justify-between items-center text-[10px] text-gray-300 select-none px-1">
        <span>Voice Note • {duration}</span>
        <button 
          onClick={() => handleDirectDownload(src, 'voicenote.webm')} 
          className="hover:underline text-blue-300 cursor-pointer bg-transparent border-none p-0 text-[10px]"
        >
          Download
        </button>
      </div>
    </div>
  );
}

function DownloadableImage({ src }: { src: string }) {
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const fileName = src.split('/').pop() || 'image.jpg';
    handleDirectDownload(src, fileName);
    setDownloaded(true);
  }, [src]);

  return (
    <div className="relative group rounded-lg overflow-hidden max-h-60 mt-1 flex items-center justify-center bg-black/50">
      <img 
        src={src} 
        alt="attachment" 
        className={`w-full h-full object-cover transition duration-300 ${!downloaded ? 'filter blur-md scale-105 opacity-60' : 'filter blur-0 opacity-100'}`} 
      />
      {!downloaded && (
        <button 
          type="button"
          onClick={() => {
            const fileName = src.split('/').pop() || 'image.jpg';
            handleDirectDownload(src, fileName);
            setDownloaded(true);
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40 backdrop-blur-sm cursor-pointer hover:bg-black/50 transition border-none w-full h-full"
          title="Tap to download image"
        >
          <div className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xl transition transform hover:scale-105">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-white tracking-wide">Tap to Download</span>
        </button>
      )}
    </div>
  );
}

export default function ChatArea({ channelId, channelName, customBackground }: { channelId: string; channelName?: string; customBackground?: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reactionsMap, setReactionsMap] = useState<Record<string, any[]>>({});

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [stagedFile, setStagedFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize current user immediately on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

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

  // Real-time Typing Indicator Broadcast Listener
  useEffect(() => {
    if (!channelId || !currentUser) return;

    const typingChannel = supabase.channel(`room_typing:${channelId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { username, isTyping } = payload.payload;
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

  useEffect(() => {
    if (!channelId || !currentUser) return;

    const presenceChannel = supabase.channel(`room_presence:${channelId}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: currentUser.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [channelId, currentUser]);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setReactionsMap({});
      return;
    }

    setMessages([]);
    setReactionsMap({});

    async function getMessages() {
      const { data: rawMessages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('Supabase error fetching messages:', msgError);
        return;
      }

      if (!rawMessages || rawMessages.length === 0) {
        setMessages([]);
        return;
      }

      const messageIds = rawMessages.map(m => m.id);
      
      // Fetch reactions
      const { data: reactionsData } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);

      const rMap: Record<string, any[]> = {};
      reactionsData?.forEach(r => {
        if (!rMap[r.message_id]) rMap[r.message_id] = [];
        rMap[r.message_id].push(r);
      });
      setReactionsMap(rMap);

      const userIds = Array.from(new Set(rawMessages.map(m => m.user_id).filter(Boolean)));
      let profilesMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, role')
          .in('id', userIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      const messagesWithProfiles = rawMessages.map(msg => ({
        ...msg,
        profiles: msg.user_id ? profilesMap[msg.user_id] || null : null
      }));

      setMessages(messagesWithProfiles);
      setTimeout(() => scrollToBottom(false), 50);
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
                .select('username, avatar_url, role')
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

    // Reaction real-time sync subscription
    const reactionSubscription = supabase
      .channel(`room_reactions:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        async () => {
          if (messages.length === 0) return;
          const { data: reactionsData } = await supabase
            .from('message_reactions')
            .select('*')
            .in('message_id', messages.map(m => m.id));

          const rMap: Record<string, any[]> = {};
          reactionsData?.forEach(r => {
            if (!rMap[r.message_id]) rMap[r.message_id] = [];
            rMap[r.message_id].push(r);
          });
          setReactionsMap(rMap);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSubscription);
      supabase.removeChannel(reactionSubscription);
    };
  }, [channelId, currentUser]);

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;

    const existingReactions = reactionsMap[messageId] || [];
    const existing = existingReactions.find(
      r => r.user_id === currentUser.id && r.emoji === emoji
    );

    if (existing) {
      setReactionsMap(prev => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter(r => r.id !== existing.id)
      }));
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      const tempId = Math.random().toString();
      setReactionsMap(prev => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), { id: tempId, message_id: messageId, user_id: currentUser.id, emoji }]
      }));
      
      const { data } = await supabase
        .from('message_reactions')
        .insert([{ message_id: messageId, user_id: currentUser.id, emoji }])
        .select()
        .single();

      if (data) {
        setReactionsMap(prev => ({
          ...prev,
          [messageId]: (prev[messageId] || []).map(r => r.id === tempId ? data : r)
        }));
      }
    }
  };

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
    const typingChannel = supabase.channel(`room_typing:${channelId}`);
    
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

  const handleSendMessage = async (e: React.FormEvent, customMediaUrl?: string, customMediaType?: string, contentOverride?: string) => {
    e?.preventDefault?.();
    const finalContent = contentOverride || newMessage;
    const mediaUrl = customMediaUrl || stagedFile?.url || null;
    const mediaType = customMediaType || stagedFile?.type || null;

    if ((!finalContent.trim() && !mediaUrl) || !channelId) return;

    playPopSound();

    const { error } = await supabase.from('messages').insert([
      {
        channel_id: channelId,
        content: finalContent,
        user_id: currentUser?.id ?? null,
        media_url: mediaUrl,
        media_type: mediaType,
        reply_to_id: replyingTo?.id || null,
      }
    ]);

    if (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message: ' + error.message);
    } else {
      setNewMessage('');
      setStagedFile(null);
      setReplyingTo(null);
      setShowEmojiPicker(false);
      scrollToBottom(true);
    }
  };

  const handleFileUploadStage = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';

    setStagedFile({ url: data.publicUrl, type: mediaType, name: file.name });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordingSeconds(0);
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
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        const finalSecs = recordingSeconds;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `voice_${Math.random().toString(36).substring(2)}.webm`;
        const filePath = `${channelId}/${fileName}`;

        setUploading(true);
        const { error } = await supabase.storage.from('chat-media').upload(filePath, audioBlob);
        if (error) {
          alert('Voice note upload failed: ' + error.message);
        } else {
          const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
          const durationStr = formatDuration(finalSecs);
          
          await handleSendMessage({} as any, data.publicUrl, 'audio', `[Voice Note duración: ${durationStr}]`);
        }
        setUploading(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message: ' + error.message);
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
    setActiveMenuId(null);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    const { error } = await supabase.from('messages').update({ content: editContent, updated_at: new Date().toISOString() }).eq('id', messageId);
    if (error) {
      alert('Failed to update message: ' + error.message);
    } else {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content: editContent, updated_at: new Date().toISOString() } : m));
    }
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

      {/* Channel Header */}
      {channelId && (
        <div className="relative z-20 px-6 py-3 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between shadow-md backdrop-blur-sm">
          <div 
            onClick={() => setIsMemberModalOpen(true)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-lg group-hover:bg-blue-600/30 transition">
              #
            </div>
            <div>
              <h2 className="text-sm font-bold text-white group-hover:text-blue-400 transition flex items-center gap-2">
                {channelName || 'Channel Chat'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {typingUsers.length > 0 ? (
                  <span className="text-blue-400 font-medium animate-pulse">
                    {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                ) : (
                  <span>
                    <strong className="text-emerald-400 font-semibold">{onlineCount}</strong> online • Click to manage members
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsMemberModalOpen(true)}
            className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Members
          </button>
        </div>
      )}

      {/* Chat Messages Feed */}
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
              const userRole = msg.profiles?.role;
              const isEditing = editingId === msg.id;
              const isEdited = msg.updated_at && msg.updated_at !== msg.created_at;
              const isMenuOpen = activeMenuId === msg.id;
              const repliedToMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;

              let voiceDuration = '0:00';
              let cleanContent = msg.content;
              if (msg.media_type === 'audio' && msg.content && msg.content.includes('[Voice Note duración:')) {
                const match = msg.content.match(/\[Voice Note duración: (.*?)\]/);
                if (match) {
                  voiceDuration = match[1];
                  cleanContent = ''; 
                }
              }

              const hasMedia = !!msg.media_type;

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

                    {userRole === 'creator' && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        👑 Creator
                      </span>
                    )}
                    {userRole === 'admin' && (
                      <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        🛡️ Admin
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    {isMenuOpen && (
                      <div 
                        onClick={(e) => e.stopPropagation()} 
                        className={`absolute top-0 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} bg-gray-900 border border-gray-700 shadow-xl rounded-xl py-1 z-30 w-36 text-xs flex flex-col`}
                      >
                        <button onClick={() => { setReplyingTo(msg); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-gray-800 transition">Reply</button>
                        {!hasMedia && (
                          <button onClick={() => { navigator.clipboard.writeText(msg.content); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-gray-800 transition">Copy</button>
                        )}
                        {isMe && (
                          <>
                            {!hasMedia && (
                              <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-gray-800 transition">Edit</button>
                            )}
                            {hasMedia && (
                              <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content || ''); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-gray-800 transition">Edit Caption</button>
                            )}
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
                          placeholder={hasMedia ? "Edit caption..." : "Edit message..."}
                        />
                        <div className="flex gap-2 justify-end text-xs">
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-700 rounded text-gray-300">Cancel</button>
                          <button onClick={() => handleSaveEdit(msg.id)} className="px-2 py-1 bg-blue-600 rounded text-white">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : msg.id); }}
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
                          <DownloadableImage src={msg.media_url} />
                        )}
                        {msg.media_type === 'video' && (
                          <div className="flex flex-col gap-1 mt-1">
                            <video controls src={msg.media_url} className="rounded-lg max-h-60 max-w-[240px]" />
                            <a href={msg.media_url} download target="_blank" rel="noreferrer" className="text-[10px] text-blue-200 self-end hover:underline">Download Video</a>
                          </div>
                        )}
                        {msg.media_type === 'audio' && (
                          <AudioMessagePlayer src={msg.media_url} initialDuration={voiceDuration} />
                        )}
                        {msg.media_type === 'file' && (
                          <div className="flex flex-col gap-1 mt-1">
                            <a href={msg.media_url} target="_blank" rel="noreferrer" className="underline text-blue-200 text-xs block">📎 Download Attachment</a>
                          </div>
                        )}

                        {cleanContent && <p className="text-sm leading-relaxed break-words">{cleanContent}</p>}
                        
                        <div className={`flex items-center gap-1.5 text-[10px] select-none ${isMe ? 'text-blue-200 justify-end' : 'text-gray-400 justify-start'}`}>
                          {isEdited && <span>(edited)</span>}
                          <span>{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Reactions UI */}
                  <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(
                      (reactionsMap[msg.id] || []).reduce((acc, r) => {
                        acc[r.emoji] = acc[r.emoji] || { count: 0, hasReacted: false };
                        acc[r.emoji].count += 1;
                        if (r.user_id === currentUser?.id) acc[r.emoji].hasReacted = true;
                        return acc;
                      }, {} as Record<string, { count: number; hasReacted: boolean }>)
                    ).map(([emoji, data]: [string, any]) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
                        className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition cursor-pointer ${
                          data.hasReacted 
                            ? 'bg-blue-600/30 border-blue-500 text-blue-200' 
                            : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="font-semibold">{data.count}</span>
                      </button>
                    ))}

                    {/* Quick Add Reaction Button */}
                    <div className="relative group/react inline-block">
                      <button className="px-2 py-0.5 rounded-full text-xs bg-gray-800/40 hover:bg-gray-700 border border-gray-700/50 text-gray-400 hover:text-white transition cursor-pointer">
                        +
                      </button>
                      <div className="absolute bottom-full mb-1 left-0 hidden group-hover/react:flex items-center gap-1 bg-gray-900 border border-gray-700 p-1 rounded-xl shadow-xl z-30">
                        {['👍', '❤️', '🔥', '😂', '🚀', '👀'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className="w-7 h-7 hover:bg-gray-800 rounded-lg flex items-center justify-center text-sm transition cursor-pointer border-none bg-transparent"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
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

      {replyingTo && (
        <div className="px-4 py-2 bg-gray-900/90 border-t border-gray-800 flex justify-between items-center text-xs z-10">
          <div>
            <span className="text-blue-400 font-semibold">Replying to message:</span>
            <p className="text-gray-300 truncate max-w-md">{replyingTo.content || 'Media attachment'}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white font-bold px-2">✕</button>
        </div>
      )}

      {stagedFile && (
        <div className="px-4 py-2 bg-gray-900/95 border-t border-gray-800 flex items-center justify-between text-xs z-10">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase">{stagedFile.type} Staged</span>
            <span className="text-gray-300 truncate max-w-xs">{stagedFile.name}</span>
          </div>
          <button onClick={() => setStagedFile(null)} className="text-red-400 hover:text-red-300 font-bold px-2">Remove ✕</button>
        </div>
      )}

      {/* Chat Input Bar */}
      {channelId && (
        <div className="relative">
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
              onChange={handleFileUploadStage} 
              className="hidden" 
            />
            
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl transition flex items-center justify-center border border-gray-700 shadow-sm cursor-pointer"
              title="Attach picture, video or file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

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
              placeholder={isRecording ? `Recording voice note (${formatDuration(recordingSeconds)})...` : stagedFile ? "Add a caption..." : uploading ? "Uploading media..." : "Type a message, caption or @username..."}
              disabled={!currentUser || uploading}
              className="flex-1 bg-gray-800 text-white px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 text-sm shadow-inner border border-gray-700/50"
            />

            {isRecording ? (
              <button 
                type="button"
                onClick={stopRecording}
                className="p-2.5 rounded-xl transition flex items-center justify-center border shadow-sm bg-red-600 border-red-500 animate-pulse text-white cursor-pointer"
                title="Stop recording"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button 
                type="button"
                onClick={startRecording}
                className="p-2.5 rounded-xl transition flex items-center justify-center border shadow-sm bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700 cursor-pointer"
                title="Record voice note"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </button>
            )}

            <button 
              type="submit"
              disabled={!currentUser || uploading || (!newMessage.trim() && !stagedFile && !isRecording)}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2.5 rounded-xl font-medium transition text-sm shadow text-white cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Member Management Modal */}
      <MemberManagementModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        channelId={channelId}
      />
    </div>
  );
}