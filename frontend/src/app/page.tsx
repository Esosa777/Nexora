'use client';

import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import ChatSidebar from './components/ChatSidebar';
import ChatArea from './components/ChatArea';
import AuthModal from './components/AuthModal';
import DMSidebar from './components/DMSidebar';
import DMChatArea from './components/DMChatArea';
import StartDmModal from './components/StartDmModal';
import UserProfileModal from './components/UserProfileModal';
import SettingsModal from './components/SettingsModal';
import MessageSearchModal from './components/MessageSearchModal';
import ChannelJoinModal from './components/ChannelJoinModal';
import ChannelSettingsModal from './components/ChannelSettingsModal';
import ChannelThreadView from './components/ChannelThreadView';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Direct Messaging State
  const [activeTab, setActiveTab] = useState<'channel' | 'dm'>('channel');
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [activeRecipient, setActiveRecipient] = useState<any>(null);
  const [isStartDmOpen, setIsStartDmOpen] = useState(false);

  // Profile & Settings Modals State
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Global Message Search & Highlight State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | undefined>(undefined);

  // Channel Membership, Join Modal & Settings Modals State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingChannel, setPendingChannel] = useState<any>(null);
  const [showChannelSettings, setShowChannelSettings] = useState(false);

  // Channel Side Thread View State
  const [activeThreadMessage, setActiveThreadMessage] = useState<any>(null);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (currentUser) {
          setIsSearchOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    async function loadChannels() {
      setLoading(true);
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setChannels(data);
        if (data.length > 0 && !selectedChannelId) {
          setSelectedChannelId(data[0].id);
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
    setActiveRecipient(null);
    setIsAuthModalOpen(true);
  };

  // Check channel membership before opening channel
  const handleSelectChannel = async (channelId: string, messageId?: string) => {
    if (!currentUser) return;

    let targetChannel = channels.find((c) => c.id === channelId);
    if (!targetChannel) {
      const { data: chan } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();
      if (chan) {
        targetChannel = chan;
        setChannels((prev) => [...prev, chan]);
      }
    }

    if (!targetChannel) return;

    // Check if user is a member of this channel
    const { data: membership } = await supabase
      .from('channel_members')
      .select('role')
      .eq('channel_id', channelId)
      .eq('user_id', currentUser.id)
      .single();

    if (!membership) {
      // Prompt join modal if not a member yet
      setPendingChannel(targetChannel);
      setShowJoinModal(true);
      return;
    }

    setActiveTab('channel');
    setHighlightedMessageId(messageId);
    setSelectedChannelId(channelId);
    setActiveDmId(null);
    setActiveThreadMessage(null); // Close thread when switching channels
  };

  const handleConfirmJoin = async () => {
    if (!pendingChannel || !currentUser) return;

    const { error } = await supabase.from('channel_members').insert([
      {
        channel_id: pendingChannel.id,
        user_id: currentUser.id,
        role: 'member',
      },
    ]);

    if (error) {
      alert('Failed to join channel: ' + error.message);
    } else {
      setShowJoinModal(false);
      setActiveTab('channel');
      setSelectedChannelId(pendingChannel.id);
      setPendingChannel(null);
    }
  };

  const handleSelectDm = (dmId: string, messageId?: string, recipient?: any) => {
    setActiveTab('dm');
    setHighlightedMessageId(messageId);
    setActiveDmId(dmId);
    if (recipient) setActiveRecipient(recipient);
    setSelectedChannelId(null);
    setActiveThreadMessage(null);
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-gray-950 text-white relative">
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
              onSelectDm={(dmId) => handleSelectDm(dmId)}
              onOpenStartModal={() => setIsStartDmOpen(true)}
            />
          )}
        </div>

        {currentUser && (
          <div className="p-3 border-t border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-400 truncate max-w-[120px]">@{currentUser.email?.split('@')[0]}</span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              Settings
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col h-full relative">
        {currentUser && (
          <div className="h-12 px-4 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between z-20 shrink-0 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold tracking-wide uppercase text-gray-400">Nexora Workspace</span>
            </div>

            <div className="flex items-center gap-3">
              {activeTab === 'channel' && selectedChannel && (
                <button
                  onClick={() => setShowChannelSettings(true)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>⚙️</span> Channel Settings
                </button>
              )}

              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/60 text-gray-300 px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                title="Search messages across channels and DMs (Cmd+K / Ctrl+K)"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Search messages...</span>
                <kbd className="bg-gray-900 border border-gray-700 text-gray-400 text-[10px] px-1.5 py-0.5 rounded font-mono ml-2">
                  ⌘K
                </kbd>
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {activeTab === 'channel' ? (
              selectedChannelId ? (
                <ChatArea
                  channelId={selectedChannelId}
                  channelName={selectedChannel?.name}
                  onOpenUserProfile={(userId) => setSelectedProfileUserId(userId)}
                  highlightedMessageId={highlightedMessageId}
                  onOpenThread={(message) => setActiveThreadMessage(message)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  {loading ? 'Loading channels...' : 'Select a channel to start messaging'}
                </div>
              )
            ) : activeDmId && currentUser ? (
              <DMChatArea
                conversationId={activeDmId}
                recipientUser={activeRecipient}
                onOpenUserProfile={(userId) => setSelectedProfileUserId(userId)}
                highlightedMessageId={highlightedMessageId}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm gap-2">
                <span>Select a direct conversation or click "+" to message by username</span>
              </div>
            )}
          </div>

          {/* Slide-out Thread Drawer */}
          {activeThreadMessage && selectedChannelId && (
            <ChannelThreadView
              channelId={selectedChannelId}
              parentMessage={activeThreadMessage}
              currentUser={currentUser}
              onClose={() => setActiveThreadMessage(null)}
            />
          )}
        </div>
      </div>

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
        <>
          <StartDmModal
            isOpen={isStartDmOpen}
            onClose={() => setIsStartDmOpen(false)}
            currentUserId={currentUser.id}
            onDmStarted={(dmId) => handleSelectDm(dmId)}
          />

          <UserProfileModal
            isOpen={!!selectedProfileUserId}
            onClose={() => setSelectedProfileUserId(null)}
            targetUserId={selectedProfileUserId}
            currentUserId={currentUser.id}
            onStartDm={(dmId) => {
              handleSelectDm(dmId);
            }}
          />

          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            currentUser={currentUser}
            onLogout={handleLogout}
          />

          <MessageSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            currentUserId={currentUser.id}
            onSelectChannel={(channelId, messageId) => handleSelectChannel(channelId, messageId)}
            onSelectDm={(dmId, messageId) => handleSelectDm(dmId, messageId)}
          />

          {showJoinModal && pendingChannel && (
            <ChannelJoinModal
              channel={pendingChannel}
              onClose={() => {
                setShowJoinModal(false);
                setPendingChannel(null);
              }}
              onConfirmJoin={handleConfirmJoin}
            />
          )}

          {showChannelSettings && selectedChannel && (
            <ChannelSettingsModal
              channel={selectedChannel}
              currentUser={currentUser}
              onClose={() => setShowChannelSettings(false)}
              onChannelUpdated={(updated) => {
                setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
              }}
            />
          )}
        </>
      )}
    </main>
  );
}