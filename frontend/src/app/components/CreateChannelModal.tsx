// src/components/CreateChannelModal.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channelId: string) => void;
}

export default function CreateChannelModal({ isOpen, onClose, onChannelCreated }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle optional channel avatar upload during creation
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `channel-${Math.random()}.${fileExt}`;
      const filePath = `channel-avatars/${fileName}`;

      setUploading(true);
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
    } catch (err: any) {
      alert("Error uploading image: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Channel name is required.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMsg("You must be logged in to create a channel.");
        setLoading(false);
        return;
      }

      // 1. Insert the channel into 'channels'
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .insert({
          name: name.trim(),
          description: description.trim(),
          avatar_url: avatarUrl || null
        })
        .select()
        .single();

      if (channelError || !channelData) {
        throw new Error(channelError?.message || "Failed to create channel record.");
      }

      // 2. Automatically enroll the creator into 'channel_members' as 'creator'
      const { error: memberError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channelData.id,
          user_id: user.id,
          role: 'creator',
          status: 'active'
        });

      if (memberError) {
        throw new Error("Channel created, but failed to assign creator role: " + memberError.message);
      }

      // Success!
      setName('');
      setDescription('');
      setAvatarUrl('');
      onChannelCreated(channelData.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-white">
        
        <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
          <h2 className="text-lg font-bold">Create New Channel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold p-1">&times;</button>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Avatar Picker */}
          <div className="flex flex-col items-center">
            <label className="relative group cursor-pointer">
              <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden hover:border-indigo-500 transition">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-1">
                    <span className="text-xl">📷</span>
                    <p className="text-[9px] text-gray-400 mt-0.5">Cover Photo</p>
                  </div>
                )}
              </div>
              {uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-[10px]">
                  Uploading...
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Channel Name *</label>
            <input
              type="text"
              placeholder="e.g. Tech Founders & Builders"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              placeholder="What is this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}