interface ChannelJoinModalProps {
  channel: any;
  onClose: () => void;
  onConfirmJoin: () => void;
}

export default function ChannelJoinModal({ channel, onClose, onConfirmJoin }: ChannelJoinModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 w-full max-w-sm rounded-2xl p-6 text-white text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
          #
        </div>
        <div>
          <h3 className="text-base font-bold">Join #{channel.name}?</h3>
          <p className="text-xs text-gray-400 mt-1">
            You are not a member of this channel yet. Join now to view and send messages.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmJoin}
            className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer text-white"
          >
            Yes, Join
          </button>
        </div>
      </div>
    </div>
  );
}