'use client';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import ChatSidebar from './components/ChatSidebar';
import ChatArea from './components/ChatArea';
import AuthModal from './components/AuthModal';
import DMSidebar from './components/DMSidebar';
import DMChatArea from './components/DMChatArea';
import StartDmModal from './components/StartDmModal';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Direct Messaging State
  const [activeTab, setActiveTab] = useState<'channel' | 'dm'>('channel');
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [isStartDmOpen, setIsStartDmOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if (!user) setIsAuthModalOpen(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (!user) setIsAuthModalOpen(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    async function loadChannels() {
      setLoading(true);
      const { data, error } = await supabase
        .from('channel_members')
        .select('channel_id, channels(*)')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');

      if (!error && data) {
        const fetchedChannels = data.map((item) => item.channels).filter(Boolean);
        setChannels(fetchedChannels);
        if (fetchedChannels.length > 0 && !selectedChannelId) {
          setSelectedChannelId((fetchedChannels[0] as any)?.id);
        }
      }
      setLoading(false);
    }

    loadChannels();
  }, [currentUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setChannels([]);
    setSelectedChannelId(null);
    setActiveDmId(null);
    setIsAuthModalOpen(true);
  };

  const handleSelectChannel = (channelId: string) => {
    setActiveTab('channel');
    setSelectedChannelId(channelId);
    setActiveDmId(null);
  };

  const handleSelectDm = (dmId: string) => {
    setActiveTab('dm');
    setActiveDmId(dmId);
    setSelectedChannelId(null);
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-gray-950 text-white">
      {/* Sidebar Area with Navigation Switcher */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full shrink-0">
        <div className="p-3 border-b border-gray-800 flex gap-2">
          <button
            onClick={() => setActiveTab('channel')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'channel'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Channels
          </button>
          <button
            onClick={() => setActiveTab('dm')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'dm'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Direct Messages
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'channel' ? (
            <ChatSidebar
              channels={channels}
              selectedChannelId={selectedChannelId}
              onSelectChannel={handleSelectChannel}
              currentUser={currentUser}
              onLogout={handleLogout}
              onChannelCreated={(newChannel) => {
                setChannels((prev) => [...prev, newChannel]);
                handleSelectChannel(newChannel.id);
              }}
            />
          ) : (
            <DMSidebar
              currentUserId={currentUser?.id}
              activeDmId={activeDmId}
              onSelectDm={handleSelectDm}
              onOpenStartModal={() => setIsStartDmOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Main View Feed */}
      <div className="flex-1 flex flex-col h-full relative">
        {activeTab === 'channel' ? (
          selectedChannelId ? (
            <ChatArea
              channelId={selectedChannelId}
              channelName={selectedChannel?.name}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {loading ? 'Loading channels...' : 'Select a channel to start messaging'}
            </div>
          )
        ) : activeDmId && currentUser ? (
          <DMChatArea
            conversationId={activeDmId}
            currentUserId={currentUser.id}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm gap-2">
            <span>Select a direct conversation or click "+" to message by username</span>
          </div>
        )}
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          if (currentUser) setIsAuthModalOpen(false);
        }}
        onAuthSuccess={() => {
          setIsAuthModalOpen(false);
          window.location.reload();
        }}
      />

      {currentUser && (
        <StartDmModal
          isOpen={isStartDmOpen}
          onClose={() => setIsStartDmOpen(false)}
          currentUserId={currentUser.id}
          onDmStarted={(dmId) => handleSelectDm(dmId)}
        />
      )}
    </main>
  );
}