import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function StartDmModal({ isOpen, onClose, currentUserId, onDmStarted }: { isOpen: boolean; onClose: () => void; currentUserId: string; onDmStarted: (convId: string) => void }) {
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleStartDm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = usernameInput.trim().replace(/^@/, '');
    if (!cleanUsername) return;

    setLoading(true);

    // 1. Find profile by username
    const { data: targetProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', cleanUsername)
      .single();

    if (profileErr || !targetProfile) {
      alert('User not found!');
      setLoading(false);
      return;
    }

    if (targetProfile.id === currentUserId) {
      alert("You can't message yourself!");
      setLoading(false);
      return;
    }

    // 2. Check if conversation already exists between these two
    const { data: existingConv } = await supabase
      .from('direct_conversations')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetProfile.id}),and(sender_id.eq.${targetProfile.id},receiver_id.eq.${currentUserId})`)
      .maybeSingle();

    if (existingConv) {
      onDmStarted(existingConv.id);
      setLoading(false);
      onClose();
      return;
    }

    // 3. Create new pending conversation
    const { data: newConv, error: insertErr } = await supabase
      .from('direct_conversations')
      .insert([{ sender_id: currentUserId, receiver_id: targetProfile.id, status: 'pending' }])
      .select()
      .single();

    if (insertErr) {
      alert('Failed to start conversation: ' + insertErr.message);
    } else if (newConv) {
      onDmStarted(newConv.id);
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl text-white">
        <h3 className="text-lg font-bold mb-2">Direct Message by Username</h3>
        <p className="text-xs text-gray-400 mb-4">Enter a user's exact Nexora username. Your first message will send a chat request!</p>
        
        <form onSubmit={handleStartDm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. esosagabriel"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-xs rounded-xl font-medium transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs rounded-xl font-medium transition">{loading ? 'Searching...' : 'Open DM'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}