"use client";
interface ClearRepositoriesModalProps {
  isOpen: boolean;
  isClearing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ClearRepositoriesModal = ({
  isOpen,
  isClearing,
  onCancel,
  onConfirm,
}: ClearRepositoriesModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-xl font-bold text-white mb-4 text-center">Clear All Repositories?</h3>
        <p className="text-gray-300 mb-6 text-center">
          This will permanently delete all ingested repositories and their data from Elasticsearch.
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
            disabled={isClearing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
            disabled={isClearing}
          >
            {isClearing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Clearing...
              </>
            ) : (
              <>Clear All</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearRepositoriesModal;

