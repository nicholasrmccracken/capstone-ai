"use client";
import TreePanel from "./components/TreePanel";
import CodeViewer from "./components/CodeViewer";
import ChatPanel from "./components/ChatPanel";
import ClearChatModal from "./components/ClearChatModal";
import ClearRepositoriesModal from "./components/ClearRepositoriesModal";
import ApiKeyBanner from "./components/ApiKeyBanner";
import ApiKeyModal from "./components/ApiKeyModal";
import DebugPanel from "./components/DebugPanel";
import ResizeHandle from "./components/ResizeHandle";
import SettingsModal from "./components/SettingsModal";
import useChatPageState from "./hooks/useChatPageState";

import { useState } from "react";

export default function Chat() {
  const {
    layout,
    treePanel,
    codeViewer,
    chatPanel,
    clearChatModal,
    clearRepositoriesModal,
    apiKeyManager,
  } = useChatPageState();

  const [showSettings, setShowSettings] = useState(false);

  return (
    <main
      className="flex flex-col items-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 gap-4"
      style={{ height: "100vh" }}
    >
      <div className="flex items-center gap-4">
        <h2 className="text-4xl font-bold text-blue-400 drop-shadow-md">
          RepoRover Chat
        </h2>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          title="Settings"
        >
          <svg
            className="w-6 h-6 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Hide API key banner when using environment variable in force mode */}
      {!apiKeyManager.debugForceEnv && (
        <ApiKeyBanner
          hasApiKey={apiKeyManager.hasApiKey}
          maskedKey={apiKeyManager.maskedKey}
          updatedAtLabel={apiKeyManager.updatedAtLabel}
          onManageClick={apiKeyManager.onOpen}
        />
      )}

      <div className="flex w-full max-w-[120rem] flex-1 gap-4 overflow-hidden min-h-0">
        <div className={layout.leftContainerClassName}>
          <TreePanel className={layout.treePanelClassName} {...treePanel} />
        </div>

        {layout.shouldRenderCodeViewer && (
          <>
            <div
              className={layout.codeViewerClassName}
              style={{
                width: `${layout.codeViewerVisibleWidth}%`,
                opacity: layout.codeViewerOpacity,
                pointerEvents: layout.codeViewerVisibleWidth > 0 ? "auto" : "none",
              }}
            >
              {codeViewer.tabs.length > 0 && (
                <CodeViewer
                  className="flex-1 flex flex-col pt-2 pr-2 pb-2 pl-0 max-w-full min-w-0 bg-gray-900/70 border border-gray-700 rounded-xl shadow-lg overflow-hidden"
                  {...codeViewer}
                />
              )}
            </div>

            {codeViewer.tabs.length > 0 && (
              <ResizeHandle
                onResize={layout.onResize}
                onResizeStart={layout.onResizeStart}
                onResizeEnd={layout.onResizeEnd}
              />
            )}
          </>
        )}

        <ChatPanel
          className={layout.chatPanelClassName}
          {...chatPanel}
        />
      </div>

      <ClearChatModal {...clearChatModal} />
      <ClearRepositoriesModal {...clearRepositoriesModal} />
      <ApiKeyModal
        isOpen={apiKeyManager.isModalOpen}
        initialValue={apiKeyManager.currentValue}
        onClose={apiKeyManager.onClose}
        onSave={apiKeyManager.onSave}
        onClear={apiKeyManager.onClear}
      />
      <DebugPanel
        debugForceEnv={apiKeyManager.debugForceEnv}
        debugForceUser={apiKeyManager.debugForceUser}
        onToggleDebugForceEnv={apiKeyManager.onToggleDebugForceEnv}
        onToggleDebugForceUser={apiKeyManager.onToggleDebugForceUser}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </main>
  );
}
