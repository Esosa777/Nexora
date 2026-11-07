'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Adjust this import path if needed based on your folder structure

export default function ChatLayout() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [inputText, setInputText] = useState('');
  
  const feedRef = useRef(null);

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
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar for Conversations */}
      <div className="w-1/4 border-r border-gray-800 p-4 flex flex-col min-w-[240px]">
        <h2 className="text-xl font-bold mb-4 text-indigo-400">Nexora Chats</h2>
        <div className="space-y-2 overflow-y-auto flex-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveId(chat.id)}
              className={`p-3 rounded-lg cursor-pointer transition ${
                chat.id === activeId
                  ? 'bg-gray-800 ring-1 ring-indigo-500'
                  : 'bg-gray-800/50 hover:bg-gray-700'
              }`}
            >
              <p className="font-semibold">{chat.name}</p>
              <p className="text-sm text-gray-400 truncate">
                {chat.messages.length > 0
                  ? chat.messages[chat.messages.length - 1].text
                  : 'No messages yet'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-950">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-900">
          <h3 className="font-semibold text-lg">{activeChat?.name || 'Select a channel'}</h3>
        </div>

        {/* Message Feed */}
        <div ref={feedRef} className="flex-1 p-4 overflow-y-auto space-y-4">
          {activeChat?.messages.length === 0 && (
            <p className="text-gray-500 text-center mt-10">No messages yet. Start the conversation.</p>
          )}
          {activeChat?.messages.map((msg) => (
            <div key={msg.id} className="flex flex-col">
              <span className="text-xs text-gray-500 mb-1">{msg.user}</span>
              <div
                className={`p-3 rounded-lg max-w-md w-fit ${
                  msg.user === 'You' ? 'bg-indigo-600 text-white self-end' : 'bg-gray-800 text-gray-200'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Message Input Bar */}
        <div className="p-4 border-t border-gray-800 bg-gray-900 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={`Message ${activeChat?.name || 'channel'}...`}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-white"
          />
          <button
            onClick={handleSendMessage}
            className="bg-indigo-600 px-6 py-2 rounded-lg font-semibold hover:bg-indigo-500 transition text-white"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}