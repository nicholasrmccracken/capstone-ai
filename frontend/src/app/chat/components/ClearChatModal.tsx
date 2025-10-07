"use client";
interface ClearChatModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ClearChatModal = ({ isOpen, onCancel, onConfirm }: ClearChatModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-xl font-bold text-white mb-3 text-center">Clear Chat History?</h3>
        <p className="text-gray-300 mb-5 text-center">
          All chat messages will be removed and the welcome message will be restored.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Clear Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearChatModal;

