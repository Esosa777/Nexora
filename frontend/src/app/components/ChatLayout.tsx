'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Adjust this import path if needed based on your folder structure

export default function ChatLayout() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  
  const feedRef = useRef<HTMLDivElement>(null);

  // 1. Fetch channels from Supabase when the component first loads
  useEffect(() => {
    async function fetchChannels() {
      const { data, error } = await supabase.from('channels').select('*');
      if (error) {
        console.error('Error fetching channels:', error);
      } else if (data && data.length > 0) {
        // Map channels and give each an empty messages array for now
        const channelsWithMessages = data.map(channel => ({
          ...channel,
          messages: []
        }));
        setChats(channelsWithMessages);
        setActiveId(channelsWithMessages[0].id); // Set the first channel as active by default
      }
    }

    fetchChannels();
  }, []);

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

    // Update local state so it shows up instantly
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
        <h2 className="text-xl font-bold mb-4 text-indigo-400">Nexora Chats</h2>
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
                {chat.messages.length > 0
                  ? chat.messages[chat.messages.length - 1].text
                  : chat.description || 'No messages yet'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-950">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur-sm">
          <h3 className="font-semibold text-base">{activeChat?.name || 'Select a channel'}</h3>
          {activeChat?.description && (
            <p className="text-xs text-gray-400 truncate">{activeChat.description}</p>
          )}
        </div>

        {/* Message Feed */}
        <div ref={feedRef} className="flex-1 p-4 overflow-y-auto space-y-4">
          {(!activeChat || activeChat.messages.length === 0) && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No messages yet. Start the conversation.
            </div>
          )}
          {activeChat?.messages.map((msg: any) => (
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
    </div>
  );
}