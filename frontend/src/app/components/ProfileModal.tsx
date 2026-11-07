import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ProfileModalProps {
  userId: string;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export default function ProfileModal({ userId, onClose, onProfileUpdated }: ProfileModalProps) {
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Load current profile data
  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single();

      if (data) {
        setUsername(data.username || '');
        setAvatarUrl(data.avatar_url || null);
      }
      setLoading(false);
    }

    if (userId) loadProfile();
  }, [userId]);

  // Handle uploading avatar image to Supabase Storage
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMsg(null);

      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
      setMsg({ text: 'Image uploaded successfully!' });
    } catch (err: any) {
      setMsg({ text: err.message || 'Upload failed', error: true });
    } finally {
      setUploading(false);
    }
  };

  // Save changes to database
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });

    setLoading(false);

    if (error) {
      setMsg({ text: error.message, error: true });
    } else {
      setMsg({ text: 'Profile updated!' });
      if (onProfileUpdated) onProfileUpdated();
      setTimeout(onClose, 800);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl w-full max-w-sm text-white relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded-full text-xl font-bold transition"
        >
          &times;
        </button>

        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>

        {msg && (
          <div
            className={`text-sm p-2 rounded mb-4 border ${
              msg.error
                ? 'bg-red-900/50 border-red-500 text-red-200'
                : 'bg-green-900/50 border-green-500 text-green-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-6 text-gray-400">Loading profile...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Avatar Preview & Upload */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-800 border border-gray-700 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-gray-400">
                    {username ? username[0].toUpperCase() : '?'}
                  </span>
                )}
              </div>
              <label className="text-xs text-blue-400 hover:underline cursor-pointer font-medium">
                {uploading ? 'Uploading...' : 'Change Photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Username Input */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 py-2 rounded font-medium transition"
            >
              Save Profile
            </button>
          </form>
        )}
      </div>
    </div>
  );
}