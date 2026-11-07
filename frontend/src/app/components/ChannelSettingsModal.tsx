// src/components/ChannelSettingsModal.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface Channel {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
}

interface ChannelSettingsModalProps {
  channel: Channel;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ChannelSettingsModal({ channel, onClose, onUpdate }: ChannelSettingsModalProps) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [avatarUrl, setAvatarUrl] = useState(channel.avatar_url || '');
  const [uploading, setUploading] = useState(false);

  // Handle avatar image selection & upload to Supabase Storage ('chat-media')
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${channel.id}-${Math.random()}.${fileExt}`;
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
    } catch (error: any) {
      alert("Error uploading avatar: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from('channels')
      .update({
        name,
        description,
        avatar_url: avatarUrl
      })
      .eq('id', channel.id);

    if (error) {
      alert("Failed to update channel settings: " + error.message);
    } else {
      onUpdate();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl p-6 text-white shadow-2xl">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Channel Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {/* Interactive Channel Profile Picture Slot */}
        <div className="flex flex-col items-center mb-6">
          <label className="relative group cursor-pointer">
            <div className="w-24 h-24 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden hover:border-indigo-500 transition">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Channel Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-2">
                  <span className="text-2xl">📷</span>
                  <p className="text-[10px] text-gray-400 mt-1">Add Photo</p>
                </div>
              )}
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-xs">
                Uploading...
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleAvatarUpload} 
              className="hidden" 
            />
          </label>
          <span className="text-xs text-gray-400 mt-2">Tap circle to change channel picture</span>
        </div>

        {/* Inputs */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition shadow-lg shadow-indigo-600/20"
          >
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}