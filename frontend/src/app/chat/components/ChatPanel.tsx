"use client";
import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import ChatMessages from "./ChatMessages";
import type { Message } from "../types";
import { Send, Trash2, AtSign, Key, FileCode } from "lucide-react";

interface ChatPanelProps {
  className: string;
  style?: React.CSSProperties;
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
  isAwaitingResponse: boolean;
}

const ChatPanel = ({
  className,
  style,
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
  isAwaitingResponse,
}: ChatPanelProps) => (
  <div className={`${className} bg-[#1e1e1e]/50 backdrop-blur-sm`} style={style}>
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#1e1e1e]/80">
      <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
        {title}
      </h3>
      <button
        type="button"
        onClick={onClearChatClick}
        className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors"
        title="Clear Chat"
      >
        <Trash2 size={16} />
      </button>
    </div>

    {/* Messages Area */}
    <ChatMessages
      messages={messages}
      chatMessagesRef={chatMessagesRef}
      onSourceFileClick={onSourceFileClick}
      isAwaitingResponse={isAwaitingResponse}
    />

    {/* Input Area */}
    <div className="p-4 border-t border-white/5 bg-[#1e1e1e]/80">
      <div className="relative">
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative flex-1 group">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={onInputChange}
              onKeyDown={onInputKeyDown}
              placeholder={inputPlaceholder}
              className="w-full p-3 pl-10 bg-black/20 border border-white/10 text-white rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-500"
              disabled={!isChatEnabled}
            />
            <button
              type="button"
              onClick={onAtButtonClick}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 w-7 h-7 text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded-md flex items-center justify-center transition-colors disabled:opacity-50"
              disabled={!isChatEnabled}
              title="Tag files (@)"
            >
              <AtSign size={16} />
            </button>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            disabled={!isChatEnabled}
          >
            <Send size={18} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {!isChatEnabled && repoUrl && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
            <div className="flex items-center gap-2">
              <Key size={14} />
              <span>Paste your OpenAI API key to unlock chat.</span>
            </div>
            <button
              type="button"
              onClick={onManageApiKeyClick}
              className="font-semibold text-blue-300 hover:text-white underline decoration-dotted underline-offset-2 transition-colors"
            >
              Add Key
            </button>
          </div>
        )}

        {showAutocomplete && autocompleteOptions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 bg-[#1e1e1e] border border-white/10 rounded-lg shadow-xl mb-2 max-h-48 overflow-y-auto z-[99999] backdrop-blur-xl">
            {autocompleteOptions.map((option, index) => (
              <button
                type="button"
                key={option}
                className={`w-full text-left px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors ${index === autocompleteIndex
                  ? "bg-blue-600/20 text-blue-300"
                  : "text-gray-300 hover:bg-white/5"
                  }`}
                onClick={() => onAutocompleteSelect(option)}
              >
                <FileCode size={14} className="opacity-50" />
                <span className="font-mono text-sm truncate">{option}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default ChatPanel;
