"use client";
import { useEffect, useState } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasApiKey: boolean;
  maskedKey: string;
  currentValue: string;
  updatedAtLabel: string | null;
  onSaveApiKey: (value: string) => void;
  onClearApiKey: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  hasApiKey,
  maskedKey,
  currentValue,
  updatedAtLabel,
  onSaveApiKey,
  onClearApiKey,
}: SettingsModalProps) {
  const [apiKeyValue, setApiKeyValue] = useState(currentValue);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setApiKeyValue(currentValue);
  }, [currentValue, isOpen]);

  if (!isOpen) return null;

  const handleSaveApiKey = () => {
    const trimmed = apiKeyValue.trim();
    if (!trimmed) {
      onClearApiKey();
    } else {
      onSaveApiKey(trimmed);
    }
  };

  const handleClearApiKey = () => {
    setApiKeyValue("");
    onClearApiKey();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-white">Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* OpenAI API Key Section */}
          <div className="border-t border-gray-700 pt-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-3xl">{hasApiKey ? "✅" : "🧠"}</span>
              <div className="flex-1">
                <h4 className="text-lg font-medium text-white">OpenAI API Key</h4>
                <p className="text-sm text-gray-400 mt-1">
                  {hasApiKey ? "Your API key is configured and ready to use" : "Connect your OpenAI account to unlock RepoRover"}
                </p>
                {hasApiKey && (
                  <p className="text-xs text-gray-500 mt-2">
                    Stored as {maskedKey}
                    {updatedAtLabel ? ` · updated ${updatedAtLabel}` : ""}
                  </p>
                )}
              </div>
            </div>

            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              OpenAI API Key
            </label>
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 focus-within:border-blue-500">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                className="flex-1 bg-transparent text-sm text-gray-100 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(prev => !prev)}
                className="text-xs font-semibold text-blue-200 hover:text-blue-100"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-gray-700 bg-gray-800/70 px-4 py-3 text-sm text-gray-300">
              <p className="font-semibold text-gray-100">How we handle your key</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-gray-400">
                <li>Stored only in this browser using local storage.</li>
                <li>Sent with your ingestion and chat requests so they run against your quota.</li>
                <li>Never persisted on the server; remove it anytime.</li>
              </ul>
            </div>

            <div className="flex flex-row-reverse gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleClearApiKey}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800"
              >
                Remove Key
              </button>
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/50"
                disabled={!apiKeyValue.trim() && !hasApiKey}
              >
                Save Key
              </button>
            </div>
          </div>

          {/* Placeholder for future settings */}
          <div className="border-t border-gray-700 pt-6">
            <div className="text-gray-300">
              <p className="text-sm">More settings coming soon...</p>
              <p className="text-xs text-gray-500 mt-2">
                Future settings may include theme preferences, Elasticsearch configuration, and other app preferences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
