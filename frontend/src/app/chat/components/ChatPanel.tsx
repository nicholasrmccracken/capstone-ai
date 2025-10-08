"use client";
import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import ChatMessages from "./ChatMessages";
import type { Message } from "../types";

interface ChatPanelProps {
  className: string;
  title?: string;
  messages: Message[];
  chatMessagesRef: RefObject<HTMLDivElement | null>;
  onSourceFileClick: (filePath: string) => void;
  onClearChatClick: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  inputMessage: string;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  repoUrl: string;
  showAutocomplete: boolean;
  autocompleteOptions: string[];
  autocompleteIndex: number;
  onAutocompleteSelect: (option: string) => void;
  isChatEnabled: boolean;
  inputPlaceholder: string;
  onManageApiKeyClick: () => void;
  onAtButtonClick: () => void;
}

const ChatPanel = ({
  className,
  title = "Conversation",
  messages,
  chatMessagesRef,
  onSourceFileClick,
  onClearChatClick,
  inputRef,
  inputMessage,
  onInputChange,
  onInputKeyDown,
  onSubmit,
  repoUrl,
  showAutocomplete,
  autocompleteOptions,
  autocompleteIndex,
  onAutocompleteSelect,
  isChatEnabled,
  inputPlaceholder,
  onManageApiKeyClick,
  onAtButtonClick,
}: ChatPanelProps) => (
  <div className={className}>
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold text-gray-200">{title}</h3>
      <button
        type="button"
        onClick={onClearChatClick}
        className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-lg transition-colors border border-gray-600"
      >
        Clear Chat
      </button>
    </div>

    <ChatMessages
      messages={messages}
      chatMessagesRef={chatMessagesRef}
      onSourceFileClick={onSourceFileClick}
    />

    <div className="relative">
      <form onSubmit={onSubmit} className="flex gap-2 mt-4">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={onInputChange}
            onKeyDown={onInputKeyDown}
            placeholder={inputPlaceholder}
            className="w-full p-3 pl-12 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!isChatEnabled}
          />
          <button
            type="button"
            onClick={onAtButtonClick}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm transition-colors disabled:opacity-50"
            disabled={!isChatEnabled}
            title="Tag files"
          >
            @
          </button>
        </div>
        <button
          type="submit"
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
          disabled={!isChatEnabled}
        >
          Send
        </button>
      </form>
      {!isChatEnabled && repoUrl && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-900/10 px-3 py-2 text-xs text-blue-100/90">
          <span>Paste your OpenAI API key to unlock chat.</span>
          <button
            type="button"
            onClick={onManageApiKeyClick}
            className="font-semibold text-blue-200 underline decoration-dotted underline-offset-2 hover:text-blue-50"
          >
            Add Key
          </button>
        </div>
      )}
      {showAutocomplete && autocompleteOptions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg shadow-lg mb-1 max-h-32 overflow-y-auto z-[99999]">
          {autocompleteOptions.map((option, index) => (
            <button
              type="button"
              key={option}
              className={`w-full text-left p-2 cursor-pointer border-l-2 ${
                index === autocompleteIndex
                  ? "bg-blue-600 text-white border-blue-400"
                  : "text-gray-300 hover:bg-gray-700 border-transparent"
              }`}
              onClick={() => onAutocompleteSelect(option)}
            >
              <span className="font-mono text-sm">{option}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default ChatPanel;
