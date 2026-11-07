'use client';

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import ChatSidebar from './components/ChatSidebar';
import ChatArea from './components/ChatArea';
import AuthModal from './components/AuthModal';
import ProfileModal from './components/ProfileModal';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setShowAuthModal(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex h-screen bg-gray-950 relative">
      {/* Top bar user controls */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-3 bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-800 text-xs text-white">
        {user ? (
          <>
            <span className="text-gray-300">{user.email}</span>
            <button 
              onClick={() => setShowProfileModal(true)}
              className="bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded font-medium transition border border-gray-700"
            >
              Profile
            </button>
            <button 
              onClick={handleSignOut}
              className="bg-red-600/80 hover:bg-red-600 px-2 py-1 rounded font-medium transition"
            >
              Log Out
            </button>
          </>
        ) : (
          <button 
            onClick={() => setShowAuthModal(true)}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded font-medium transition"
          >
            Log In / Sign Up
          </button>
        )}
      </div>

      {showAuthModal && !user && (
        <AuthModal 
          onAuthSuccess={() => setShowAuthModal(false)} 
          onClose={() => setShowAuthModal(false)} 
        />
      )}

      {showProfileModal && user && (
        <ProfileModal 
          userId={user.id} 
          onClose={() => setShowProfileModal(false)} 
        />
      )}

      <ChatSidebar 
        onSelectChannel={setSelectedChannelId} 
        selectedChannelId={selectedChannelId} 
      />
      <ChatArea channelId={selectedChannelId} />
    </div>
  );
}