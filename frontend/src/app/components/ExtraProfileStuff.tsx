import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ProfileModalProps {
  currentUser: any;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export default function ProfileModal({ currentUser, isOpen, onClose, onProfileUpdated }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(currentUser?.user_metadata?.display_name || '');
  const [statusMessage, setStatusMessage] = useState(currentUser?.user_metadata?.status_message || '');
  const [loading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        status_message: statusMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentUser.id);

    if (error) {
      alert('Failed to update profile: ' + error.message);
    } else {
      onProfileUpdated();
      onClose();
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Edit Profile & Status</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Smith"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Status Message</label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="e.g. 💻 Coding, In a meeting..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-xs hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}