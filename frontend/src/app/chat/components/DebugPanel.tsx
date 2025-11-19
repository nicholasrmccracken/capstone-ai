"use client";
import { useState } from "react";

interface DebugPanelProps {
  debugForceEnv: boolean;
  debugForceUser: boolean;
  onToggleDebugForceEnv: () => void;
  onToggleDebugForceUser: () => void;
}

const GearIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DebugPanel = ({
  debugForceEnv,
  debugForceUser,
  onToggleDebugForceEnv,
  onToggleDebugForceUser,
}: DebugPanelProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="fixed top-4 right-4 z-[100000] flex flex-col items-end">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="rounded-lg bg-slate-700/90 p-2.5 text-slate-200 shadow-lg transition-all hover:bg-slate-600 border border-slate-600 hover:border-slate-500"
        title="Debug Settings"
      >
        <GearIcon className="w-5 h-5" />
      </button>

      {/* Panel */}
      {isVisible && (
        <div className="mt-2 w-80 rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Debug Controls</h3>
            <button
              onClick={() => setIsVisible(false)}
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
