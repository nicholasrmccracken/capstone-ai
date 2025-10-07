"use client";
import TreePanel from "./components/TreePanel";
import CodeViewer from "./components/CodeViewer";
import ChatPanel from "./components/ChatPanel";
import ClearChatModal from "./components/ClearChatModal";
import ClearRepositoriesModal from "./components/ClearRepositoriesModal";
import useChatPageState from "./hooks/useChatPageState";

export default function Chat() {
  const {
    layout,
    treePanel,
    codeViewer,
    chatPanel,
    clearChatModal,
    clearRepositoriesModal,
  } = useChatPageState();

  return (
    <main
      className="flex flex-col items-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4 gap-4"
      style={{ height: "100vh" }}
    >
      <h2 className="text-4xl font-bold text-blue-400 drop-shadow-md">
        RepoRover Chat
      </h2>

      <div className="flex w-full max-w-[120rem] flex-1 gap-4 overflow-hidden">
        <div className="flex flex-1 bg-gray-900/70 border border-gray-700 rounded-xl shadow-lg overflow-hidden">
          <TreePanel className={layout.treePanelClassName} {...treePanel} />

          {layout.codeViewerVisible && (
            <div
              className={layout.codeViewerWrapperClassName}
              aria-hidden={layout.codeViewerAriaHidden}
            >
              <CodeViewer {...codeViewer} />
            </div>
          )}
        </div>

        <ChatPanel className={layout.chatPanelClassName} {...chatPanel} />
      </div>

      <ClearChatModal {...clearChatModal} />
      <ClearRepositoriesModal {...clearRepositoriesModal} />
    </main>
  );
}
