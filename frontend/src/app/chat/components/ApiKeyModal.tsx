"use client";
import { useEffect, useState } from "react";

interface ApiKeyModalProps {
  isOpen: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (value: string) => void;
  onClear: () => void;
}

const ApiKeyModal = ({
  isOpen,
  initialValue,
  onClose,
  onSave,
  onClear,
}: ApiKeyModalProps) => {
  const [value, setValue] = useState(initialValue);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave(value);
  };

  const handleClear = () => {
    setValue("");
    onClear();
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Connect your OpenAI account</h3>
            <p className="mt-1 text-sm text-gray-400">
              Store your API key locally so RepoRover can call OpenAI on your behalf.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700/60 px-2 py-1 text-sm text-gray-300 hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          OpenAI API Key
        </label>
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 focus-within:border-blue-500">
          <input
            type={isVisible ? "text" : "password"}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-gray-100 outline-none"
          />
          <button
            type="button"
            onClick={() => setIsVisible((prev) => !prev)}
            className="text-xs font-semibold text-blue-200 hover:text-blue-100"
          >
            {isVisible ? "Hide" : "Show"}
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-gray-700 bg-gray-800/70 px-4 py-3 text-sm text-gray-300">
          <p className="font-semibold text-gray-100">How we handle your key</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-400">
            <li>Stored only in this browser using local storage.</li>
            <li>Sent with your ingestion and chat requests so they run against your quota.</li>
            <li>Never persisted on the server; remove it anytime.</li>
          </ul>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800"
          >
            Remove Key
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/50"
            disabled={!value.trim()}
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
