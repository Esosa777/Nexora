'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import CreateChannelModal from './CreateChannelModal';

export default function ChatLayout() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const feedRef = useRef<HTMLDivElement>(null);

  // Function to fetch channels user belongs to
  const fetchChannels = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members!inner(user_id)
      `)
      .eq('channel_members.user_id', user.id);

    if (error) {
      console.error('Error fetching channels:', error);
    } else if (data && data.length > 0) {
      const channelsWithMessages = data.map(channel => ({
        ...channel,
        messages: channel.messages || []
      }));
      setChats(channelsWithMessages);
      
      setActiveId((prev) => prev || channelsWithMessages[0].id);
    }
  };

  // Fetch channels on mount
  useEffect(() => {
    fetchChannels();
  }, []);

  // Fetch messages for the active channel & subscribe to real-time updates
  useEffect(() => {
    if (!activeId) return;

    let chatSubscription: any = null;

    async function fetchMessagesForChannel() {
      // 1. Fetch existing messages from Supabase 'messages' table
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', activeId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === activeId ? { ...chat, messages: data } : chat
          )
        );
      }

      // 2. Setup real-time listener for new incoming messages
      chatSubscription = supabase
        .channel(`room-chat:${activeId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${activeId}`,
          },
          (payload) => {
            const incomingMessage = payload.new;
            setChats((prevChats) =>
              prevChats.map((chat) => {
                if (chat.id === activeId) {
                  // Prevent duplicate messages if already appended locally
                  const exists = chat.messages.some((m: any) => m.id === incomingMessage.id);
                  if (exists) return chat;
                  return { ...chat, messages: [...chat.messages, incomingMessage] };
                }
                return chat;
              })
            );
          }
        )
        .subscribe();
    }

    fetchMessagesForChannel();

    // Cleanup subscription on channel switch or unmount
    return () => {
      if (chatSubscription) {
        supabase.removeChannel(chatSubscription);
      }
    };
  }, [activeId]);

  // Handler to refresh channels and jump straight to the newly created channel
  const handleChannelCreated = async (newChannelId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members!inner(user_id)
      `)
      .eq('channel_members.user_id', user.id);

    if (!error && data) {
      const channelsWithMessages = data.map(channel => ({
        ...channel,
        messages: channel.messages || []
      }));
      setChats(channelsWithMessages);

      if (newChannelId) {
        setActiveId(newChannelId);
      }
    }
  };

  const activeChat = chats.find((c) => c.id === activeId);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [activeChat?.messages]);

  // Fully integrated Supabase message send handler
  const handleSendMessage = async () => {
    if (inputText.trim() === '' || !activeId) return;

    const messageText = inputText.trim();
    setInputText(''); // Clear input instantly for UI snappiness

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to send messages.");
        return;
      }

      // Insert message into Supabase database table
      const { error } = await supabase
        .from('messages')
        .insert({
          channel_id: activeId,
          user_id: user.id,
          content: messageText,
        });

      if (error) {
        console.error("Error sending message:", error.message);
        alert("Failed to send message: " + error.message);
      }
    } catch (err: any) {
      console.error("Unexpected error sending message:", err.message);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar for Conversations */}
      <div className="w-64 border-r border-gray-800 p-4 flex flex-col bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-indigo-400">Nexora Chats</h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition shadow"
          >
            + New
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveId(chat.id)}
              className={`p-3 rounded-xl cursor-pointer transition ${
                chat.id === activeId
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-800/50 hover:bg-gray-800 text-gray-300'
              }`}
            >
              <p className="font-semibold text-sm">{chat.name}</p>
              <p className={`text-xs truncate ${chat.id === activeId ? 'text-indigo-100' : 'text-gray-400'}`}>
                {chat.messages && chat.messages.length > 0
                  ? chat.messages[chat.messages.length - 1].content || chat.messages[chat.messages.length - 1].text
                  : chat.description || 'No messages yet'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-950">
        {/* Chat Header with Dynamic Name & Interactive Avatar Placeholder */}
        <div className="p-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
            {activeChat?.avatar_url ? (
              <img src={activeChat.avatar_url} alt={activeChat.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-indigo-400 font-bold">#</span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-base">{activeChat?.name || 'Select a channel'}</h3>
            {activeChat?.description && (
              <p className="text-xs text-gray-400 truncate">{activeChat.description}</p>
            )}
          </div>
        </div>

        {/* Message Feed */}
        <div ref={feedRef} className="flex-1 p-4 overflow-y-auto space-y-4">
          {(!activeChat || !activeChat.messages || activeChat.messages.length === 0) && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No messages yet. Start the conversation.
            </div>
          )}
          {activeChat?.messages?.map((msg: any) => {
            // Support both Supabase schema ('content') and mock schema ('text')
            const msgContent = msg.content || msg.text;
            return (
              <div key={msg.id} className="flex flex-col items-start">
                <div className="p-3 rounded-2xl max-w-md w-fit shadow-md text-sm bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700">
                  {msgContent}
                </div>
              </div>
            );
          })}
        </div>

        {/* Message Input Bar */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/95 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={`Message ${activeChat?.name || 'channel'}...`}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm text-white"
          />
          <button
            onClick={handleSendMessage}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded-xl font-medium transition text-sm shadow text-white cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>

      {/* Create Channel Modal Integration */}
      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onChannelCreated={handleChannelCreated}
      />
    </div>
  );
}