interface MessageStatusIndicatorProps {
  status: 'sent' | 'delivered' | 'read';
  isMe: boolean;
}

export default function MessageStatusIndicator({ status, isMe }: MessageStatusIndicatorProps) {
  if (!isMe) return null;

  return (
    <span className="inline-flex items-center ml-1 select-none" title={`Message ${status}`}>
      {status === 'sent' && (
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'delivered' && (
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7M11 13l4 4L23 7" />
        </svg>
      )}
      {status === 'read' && (
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7M11 13l4 4L23 7" />
        </svg>
      )}
    </span>
  );
}