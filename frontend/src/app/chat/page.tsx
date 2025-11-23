"use client";
import TreePanel from "./components/TreePanel";
import CodeViewer from "./components/CodeViewer";
import ChatPanel from "./components/ChatPanel";
import ApiKeyBanner from "./components/ApiKeyBanner";
import DebugPanel from "./components/DebugPanel";
import ResizeHandle from "./components/ResizeHandle";
import useChatPageState from "./hooks/useChatPageState";
import Link from "next/link";
import SettingsModal from "./components/SettingsModal";
import ClearChatModal from "./components/ClearChatModal";
import ClearRepositoriesModal from "./components/ClearRepositoriesModal";
import { Settings } from "lucide-react";

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

  // Use the existing apiKeyManager state to control the settings modal
  // or create a new state if we want to separate them. 
  // The apiKeyManager has isModalOpen, onOpen, onClose.
  // Let's use that for the Settings Modal since it's the primary place for API keys.

  return (
    <main className="flex h-screen w-full flex-col bg-[#0a0a0a] overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="z-20 w-full flex justify-between items-center px-4 py-2 bg-transparent relative">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 cursor-pointer">
            <span className="text-blue-500">Repo</span>Rover
          </h2>
        </Link>

        <div className="flex items-center gap-3">
          {/* Hide API key banner when using environment variable in force mode */}
          {!apiKeyManager.debugForceEnv && (
            <ApiKeyBanner
              hasApiKey={apiKeyManager.hasApiKey}
              maskedKey={apiKeyManager.maskedKey}
              updatedAtLabel={apiKeyManager.updatedAtLabel}
              onManageClick={apiKeyManager.onOpen}
            />
          )}

          {/* Debug Controls */}
          <DebugPanel
            debugForceEnv={apiKeyManager.debugForceEnv}
            debugForceUser={apiKeyManager.debugForceUser}
            onToggleDebugForceEnv={apiKeyManager.onToggleDebugForceEnv}
            onToggleDebugForceUser={apiKeyManager.onToggleDebugForceUser}
          />

          <button
            onClick={apiKeyManager.onOpen}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5 hover:border-white/10"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="z-10 flex flex-1 min-h-0 gap-4 p-4 pt-0">
        {/* Left Panel (Tree) - Fixed width */}
        <div className={layout.leftContainerClassName}>
          <TreePanel
            {...treePanel}
            className={layout.treePanelClassName}
            isApiKeySet={layout.isApiKeySet}
            onManageApiKeyClick={layout.onManageApiKeyClick}
            effectiveHasApiKey={treePanel.effectiveHasApiKey}
            debugForceEnv={treePanel.debugForceEnv}
          />
        </div>

        {/* Right Panel (Code Viewer & Chat) - Takes remaining space */}
        <div className="flex flex-row gap-0 min-w-0 min-h-0 flex-1">
          {layout.shouldRenderCodeViewer && (
            <>
              <div
                className={layout.codeViewerClassName}
                style={{
                  width: `${layout.codeViewerWidth}%`,
                  minWidth: 0,
                  flexShrink: 0
                }}
              >
                <CodeViewer
                  className="flex-1 flex flex-col min-w-0 h-full"
                  {...codeViewer}
                />
              </div>

              {/* Resize Handle - Between Code and Chat */}
              <ResizeHandle
                onResize={layout.onResize}
                onResizeStart={layout.onResizeStart}
                onResizeEnd={layout.onResizeEnd}
                isResizing={layout.isResizingPanels}
              />
            </>
          )}

          <div
            className={layout.chatPanelClassName}
            style={{
              flex: 1,
              minWidth: 0
            }}
          >
            <ChatPanel
              className="flex-1 flex flex-col min-w-0 h-full"
              {...chatPanel}
              onManageApiKeyClick={apiKeyManager.onOpen}
            />
          </div>
        </div>
      </div>

      {/* Settings Modal (Replaces old API Key Modal) */}
      <SettingsModal
        isOpen={apiKeyManager.isModalOpen}
        onClose={apiKeyManager.onClose}
        apiKey={apiKeyManager.currentValue}
        onSaveApiKey={apiKeyManager.onSave}
        onClearChat={chatPanel.onClearChatClick}
      />

      {/* Restore other modals that might be triggered */}
      <ClearChatModal {...clearChatModal} />
      <ClearRepositoriesModal {...clearRepositoriesModal} />
    </main>
  );
}
