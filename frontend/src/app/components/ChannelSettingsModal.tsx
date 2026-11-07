import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: {
    id: string;
    name: string;
    description?: string;
    avatar_url?: string;
  };
  onChannelUpdated: () => void;
}

export default function ChannelSettingsModal({ isOpen, onClose, channel, onChannelUpdated }: ChannelSettingsModalProps) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [avatarUrl, setAvatarUrl] = useState(channel.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `channel_avatar_${channel.id}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file);

    if (uploadError) {
      alert('Avatar upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const { error } = await supabase
      .from('channels')
      .update({
        name: name.trim(),
        description: description.trim(),
        avatar_url: avatarUrl,
      })
      .eq('id', channel.id);

    if (error) {
      alert('Failed to update channel: ' + error.message);
    } else {
      onChannelUpdated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white">
        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
          <h2 className="text-lg font-bold">Channel Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold p-1">✕</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex flex-col items-center justify-center gap-2 mb-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-500 transition relative group"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Channel Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-gray-400">{name[0]?.toUpperCase() || '#'}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-semibold transition">
                Change
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
            <span className="text-xs text-gray-400">{uploading ? 'Uploading...' : 'Click to change channel picture'}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              disabled={uploading || !name.trim()}
              className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition shadow-md"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}