import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface ChatSidebarProps {
  onSelectChannel: (channelId: string) => void;
  selectedChannelId: string;
}

export default function ChatSidebar({ onSelectChannel, selectedChannelId }: ChatSidebarProps) {
  const [channels, setChannels] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [formatAsSlug, setFormatAsSlug] = useState(true); // Toggle state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchChannels = async () => {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching channels:', error);
    } else {
      setChannels(data || []);
      if (data && data.length > 0 && !selectedChannelId) {
        onSelectChannel(data[0].id);
      }
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    // Apply slug formatting only if the toggle is checked
    const finalChannelName = formatAsSlug
      ? newChannelName.trim().toLowerCase().replace(/\s+/g, '-')
      : newChannelName.trim();

    const { data, error } = await supabase
      .from('channels')
      .insert([{ name: finalChannelName }])
      .select()
      .single();

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
    } else if (data) {
      setNewChannelName('');
      setFormatAsSlug(true); // Reset toggle
      setShowCreateModal(false);
      setChannels((prev) => [...prev, data]);
      onSelectChannel(data.id);
    }
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full text-white">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="font-bold text-lg tracking-wide text-blue-500">Nexora</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center font-bold text-lg transition"
          title="Create Channel"
        >
          +
        </button>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <span className="text-xs font-semibold text-gray-500 px-3 uppercase tracking-wider block mb-2">
          Channels
        </span>
        {channels.map((channel) => {
          const isActive = channel.id === selectedChannelId;
          return (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-gray-500 font-bold">#</span>
              <span className="truncate">{channel.name}</span>
            </button>
          );
        })}
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl w-full max-w-sm text-white relative">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setErrorMsg(null);
              }}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded-full text-xl font-bold transition"
            >
              &times;
            </button>

            <h2 className="text-xl font-bold mb-4">Create a Channel</h2>

            {errorMsg && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 text-sm p-2 rounded mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Channel Name
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-gray-500 font-bold">#</span>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="General Chat"
                    className="w-full bg-gray-800 text-white pl-8 pr-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Formatting Toggle Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="slugToggle"
                  checked={formatAsSlug}
                  onChange={(e) => setFormatAsSlug(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="slugToggle" className="text-xs text-gray-300 cursor-pointer select-none">
                  Format as slug (lowercase & hyphens)
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2 rounded font-medium transition"
              >
                {loading ? 'Creating...' : 'Create Channel'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}