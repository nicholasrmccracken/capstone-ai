"use client";
import type { FC } from "react";

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
  return (
    <div className="w-full max-w-[120rem] rounded-2xl border border-gray-700/70 bg-gray-900/80 px-5 py-4 shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{hasApiKey ? "✅" : "🧠"}</span>
          <div>
            <p className="text-sm font-semibold text-gray-200">
              {hasApiKey ? "OpenAI API key ready to use" : "Add your OpenAI API key to unlock RepoRover"}
            </p>
            <p className="text-xs text-gray-400">
              {hasApiKey
                ? `Stored locally as ${maskedKey}${
                    updatedAtLabel ? ` · updated ${updatedAtLabel}` : ""
                  }`
                : "We keep your key in this browser only and include it with requests you initiate."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onManageClick}
          className="self-start rounded-lg border border-blue-500/40 px-4 py-2 text-sm font-semibold text-blue-100 transition-all hover:border-blue-400 hover:bg-blue-600/10"
        >
          {hasApiKey ? "Manage API Key" : "Add API Key"}
        </button>
      </div>
    </div>
  );
};

export default ApiKeyBanner;
