import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated?: (channelId: string) => void;
}

export default function CreateChannelModal({ isOpen, onClose, onChannelCreated }: CreateChannelModalProps) {
  const [channelName, setChannelName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // 1. Insert the new channel
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .insert([{ name: channelName.trim(), description: description.trim() }])
        .select()
        .single();

      if (channelError) throw channelError;

      // 2. Automatically assign the creator role to the logged-in user
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert([
          {
            channel_id: channelData.id,
            user_id: user.id,
            role: 'creator',
          },
        ]);

      if (memberError) throw memberError;

      setChannelName('');
      setDescription('');
      onClose();
      if (onChannelCreated) onChannelCreated(channelData.id);
    } catch (err: any) {
      console.error('Error creating channel:', err);
      alert('Failed to create channel: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">Create New Channel</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white font-bold p-1 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreateChannel} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Channel Name
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g. Announcements, General Chat"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !channelName.trim()}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition shadow-md"
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}