'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import CreateChannelModal from './CreateChannelModal'; // Ensure this path matches your folder structure

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

  const handleSendMessage = () => {
    if (inputText.trim() === '' || !activeId) return;

    const newMessage = {
      id: Date.now(),
      user: 'You',
      text: inputText,
    };

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === activeId
          ? { ...chat, messages: [...chat.messages, newMessage] }
          : chat
      )
    );

    setInputText('');
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
                  ? chat.messages[chat.messages.length - 1].text
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
          {activeChat?.messages?.map((msg: any) => (
            <div key={msg.id} className={`flex flex-col ${msg.user === 'You' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-gray-500 mb-1 px-1">{msg.user}</span>
              <div
                className={`p-3 rounded-2xl max-w-md w-fit shadow-md text-sm ${
                  msg.user === 'You' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
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