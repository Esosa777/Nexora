// src/components/ChannelDiscoveryModal.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Channel {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  member_count?: number;
  created_at?: string;
}

interface ChannelDiscoveryModalProps {
  onClose: () => void;
  onJoined: () => void;
}

export default function ChannelDiscoveryModal({ onClose, onJoined }: ChannelDiscoveryModalProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'newest'>('trending');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchDiscoverableChannels();
  }, []);

  const fetchDiscoverableChannels = async () => {
    setLoading(true);
    // Fetch channels and count their members for the FYP ranking algorithm
    const { data, error } = await supabase
      .from('channels')
      .select(`
        *,
        channel_members(count)
      `);

    if (!error && data) {
      const formatted = data.map((ch: any) => ({
        ...ch,
        member_count: ch.channel_members?.[0]?.count || 0
      }));
      setChannels(formatted);
    }
    setLoading(false);
  };

  // Filter channels by search query and rank them (FYP Trending vs Newest)
  const filteredChannels = channels
    .filter(ch => 
      ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ch.description && ch.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'trending') {
        // FYP Ranking: Highest member count first (popularity)
        return (b.member_count || 0) - (a.member_count || 0);
      } else {
        // Newest channels first
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });

  const handleJoin = async (channelId: string) => {
    setNotice(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Use upsert with conflict handling to gracefully manage duplicate joins
    const { error } = await supabase
      .from('channel_members')
      .upsert({
        channel_id: channelId,
        user_id: user.id,
        status: 'active',
        role: 'member'
      }, { onConflict: 'channel_id,user_id' });

    if (error) {
      if (error.code === '23505') {
        setNotice("You are already a member of this channel!");
      } else {
        setNotice("Failed to join channel. Please try again.");
        console.error("Join error:", error.message);
      }
    } else {
      onJoined();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-xl rounded-2xl p-6 text-white shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Discover Channels</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-2xl transition"
          >
            &times;
          </button>
        </div>

        {/* Notice Banner for Duplicate Join Warnings */}
        {notice && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-lg text-sm flex justify-between items-center">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-amber-400 hover:text-amber-200 text-lg">&times;</button>
          </div>
        )}

        {/* Search Bar & FYP / Sort Filters */}
        <div className="space-y-3 mb-4">
          <input
            type="text"
            placeholder="Search channels by name or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition"
          />

          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('trending')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                sortBy === 'trending' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              🔥 Trending (FYP)
            </button>
            <button
              onClick={() => setSortBy('newest')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                sortBy === 'newest' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              ✨ Newest
            </button>
          </div>
        </div>

        {/* Channel List Container */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {loading ? (
            <div className="text-center text-gray-400 py-12 flex flex-col items-center justify-center space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p>Discovering channels...</p>
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p className="text-lg">No channels found</p>
              <p className="text-sm text-gray-500 mt-1">Try searching with a different keyword or create your own channel.</p>
            </div>
          ) : (
            filteredChannels.map(channel => (
              <div 
                key={channel.id} 
                className="bg-gray-800/60 border border-gray-700/50 p-4 rounded-xl flex items-center justify-between hover:border-gray-600 transition"
              >
                <div className="pr-4">
                  <h3 className="font-semibold text-base text-white">{channel.name}</h3>
                  <p className="text-sm text-gray-400 line-clamp-1 mt-0.5">
                    {channel.description || 'No description provided.'}
                  </p>
                  <span className="text-xs text-indigo-400 mt-2 inline-flex items-center gap-1">
                    👥 {channel.member_count} active member{channel.member_count === 1 ? '' : 's'}
                  </span>
                </div>
                <button
                  onClick={() => handleJoin(channel.id)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition shrink-0 shadow-md"
                >
                  Join
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}