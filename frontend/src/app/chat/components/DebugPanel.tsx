"use client";
import { useState } from "react";

interface DebugPanelProps {
  debugForceEnv: boolean;
  debugForceUser: boolean;
  onToggleDebugForceEnv: () => void;
  onToggleDebugForceUser: () => void;
  onClose: () => void;
}

const DebugPanel = ({
  debugForceEnv,
  debugForceUser,
  onToggleDebugForceEnv,
  onToggleDebugForceUser,
  onClose,
}: DebugPanelProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-[100000]">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="mb-2 rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-200 shadow-lg transition-colors hover:bg-gray-700"
      >
        🔧 Debug
      </button>

      {/* Panel */}
      {isVisible && (
        <div className="w-80 rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Debug Controls</h3>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-700/60 px-2 py-1 text-sm text-gray-300 hover:bg-gray-800"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
              <h4 className="mb-2 text-sm font-semibold text-gray-100">
                OpenAI API Key Source
              </h4>
              <p className="mb-3 text-xs text-gray-400">
                Control where the app gets the OpenAI API key from:
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={debugForceEnv}
                    onChange={onToggleDebugForceEnv}
                    className="rounded border-gray-600 bg-gray-700 text-blue-600"
                  />
                  Force environment variable (NEXT_PUBLIC_OPENAI_API_KEY)
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={debugForceUser}
                    onChange={onToggleDebugForceUser}
                    className="rounded border-gray-600 bg-gray-700 text-blue-600"
                  />
                  Force user input (ignore env/localStorage)
                </label>
              </div>

              <div className="mt-3 rounded-lg bg-blue-900/20 p-2 text-xs text-blue-200">
                <p className="font-semibold">Current behavior:</p>
                <p>
                  {!debugForceEnv && !debugForceUser
                    ? "Auto: Environment → localStorage → User prompt"
                    : debugForceEnv
                    ? "Using environment variable only"
                    : "Prompting user for API key"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;
