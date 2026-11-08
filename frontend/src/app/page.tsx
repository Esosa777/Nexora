'use client';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import ChatSidebar from './components/ChatSidebar';
import ChatArea from './components/ChatArea';
import AuthModal from './components/AuthModal';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
          setSelectedChannelId(fetchedChannels[0].id);
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
    setIsAuthModalOpen(true);
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-gray-950 text-white">
      <ChatSidebar
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
        currentUser={currentUser}
        onLogout={handleLogout}
        onChannelCreated={(newChannel) => {
          setChannels((prev) => [...prev, newChannel]);
          setSelectedChannelId(newChannel.id);
        }}
      />

      <div className="flex-1 flex flex-col h-full relative">
        {selectedChannelId ? (
          <ChatArea
            channelId={selectedChannelId}
            channelName={selectedChannel?.name}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {loading ? 'Loading channels...' : 'Select a channel to start messaging'}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          if (currentUser) setIsAuthModalOpen(false);
        }}
      />
    </main>
  );
}