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
import useChatPageState from "./hooks/useChatPageState";

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

  return (
    <main
      className="flex flex-col items-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 gap-4"
      style={{ height: "100vh" }}
    >
      <h2 className="text-4xl font-bold text-blue-400 drop-shadow-md">
        RepoRover Chat
      </h2>

      {/* Hide API key banner when using environment variable in force mode */}
      {!apiKeyManager.debugForceEnv && (
        <ApiKeyBanner
          hasApiKey={apiKeyManager.hasApiKey}
          maskedKey={apiKeyManager.maskedKey}
          updatedAtLabel={apiKeyManager.updatedAtLabel}
          onManageClick={apiKeyManager.onOpen}
        />
      )}

      <div className="flex w-full max-w-[120rem] flex-1 gap-4 overflow-hidden">
        <div className={layout.leftContainerClassName}>
          <TreePanel className={layout.treePanelClassName} {...treePanel} />
        </div>

        {codeViewer.tabs.length > 0 && (
          <>
            <div
              className={layout.codeViewerClassName}
              style={{ width: `${layout.codeViewerWidth}%` }}
            >
              <CodeViewer className="flex-1 flex flex-col pt-2 pr-2 pb-2 pl-0 max-w-full min-w-0 bg-gray-900/70 border border-gray-700 rounded-xl shadow-lg overflow-hidden" {...codeViewer} />
            </div>

            <ResizeHandle onResize={layout.onResize} />
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
    </main>
  );
}
