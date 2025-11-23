"use client";
import { useState } from "react";
import type { FC } from "react";
import { Key, ChevronRight, ChevronDown, Settings } from "lucide-react";

interface ApiKeyBannerProps {
  hasApiKey: boolean;
  maskedKey: string;
  updatedAtLabel: string | null;
  onManageClick: () => void;
}

const ApiKeyBanner: FC<ApiKeyBannerProps> = ({
  hasApiKey,
  maskedKey,
  updatedAtLabel,
  onManageClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hasApiKey) {
    return (
      <button
        onClick={onManageClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 text-xs font-medium transition-all border border-blue-500/30 hover:border-blue-500/50 backdrop-blur-sm"
      >
        <Key size={14} />
        <span>Add API Key</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border backdrop-blur-sm ${isExpanded
            ? "bg-gray-800/80 border-gray-600 text-gray-200"
            : "bg-gray-800/40 hover:bg-gray-800/60 border-gray-700/50 hover:border-gray-600 text-gray-400 hover:text-gray-200"
          }`}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <span className="text-xs font-medium">API Ready</span>
        </div>
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-64 p-3 rounded-xl bg-gray-900/95 border border-gray-700 shadow-xl backdrop-blur-md z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 rounded-lg bg-gray-800 text-gray-300">
              <Key size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-200">OpenAI API Key</p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                {maskedKey}
              </p>
              {updatedAtLabel && (
                <p className="text-[10px] text-gray-600 mt-0.5">
                  Updated {updatedAtLabel}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setIsExpanded(false);
              onManageClick();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition-colors border border-gray-700 hover:border-gray-600"
          >
            <Settings size={12} />
            Manage Key
          </button>
        </div>
      )}
    </div>
  );
};

export default ApiKeyBanner;
