"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RefObject } from "react";
import type { Message } from "../types";
import { Bot, User, FileCode } from "lucide-react";

interface ChatMessagesProps {
  messages: Message[];
  chatMessagesRef: RefObject<HTMLDivElement | null>;
  onSourceFileClick: (filePath: string) => void;
  isAwaitingResponse: boolean;
}

const highlightUserTags = (text: string) => {
  const parts = text.split(/(@[^\s]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span key={index} className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono border border-blue-500/30">
          {part}
        </span>
      );
    }
    return part;
  });
};

const SourceFiles = ({
  sourceFiles,
  onSourceFileClick,
}: {
  sourceFiles: string[];
  onSourceFileClick: (filePath: string) => void;
}) => {
  if (!sourceFiles || sourceFiles.length === 0) return null;

  const uniqueFiles = sourceFiles.filter((file, index, arr) => arr.indexOf(file) === index);

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
        <FileCode size={12} />
        <span>Referenced Sources:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {uniqueFiles.map((filePath, index) => (
          <button
            key={`${filePath}-${index}`}
            type="button"
            onClick={() => onSourceFileClick(filePath)}
            className="text-xs bg-white/5 hover:bg-white/10 text-blue-300 border border-white/10 hover:border-blue-500/30 px-2.5 py-1.5 rounded-md font-mono transition-all truncate max-w-[200px]"
            title={`Click to open ${filePath}`}
          >
            {filePath.split("/").pop()}
          </button>
        ))}
      </div>
    </div>
  );
};

const TypingBubble = () => (
  <div className="flex items-start gap-3 max-w-[80%]">
    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
      <Bot size={16} className="text-blue-400" />
    </div>
    <div className="bg-gray-800/50 border border-gray-700/50 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  </div>
);

const ChatMessages = ({ messages, chatMessagesRef, onSourceFileClick, isAwaitingResponse }: ChatMessagesProps) => (
  <div ref={chatMessagesRef} className="flex-1 overflow-y-auto p-4 space-y-6">
    {messages.length === 0 && (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
        <Bot size={48} className="mb-4 text-gray-600" />
        <p className="text-lg font-medium">How can I help you today?</p>
      </div>
    )}

    {messages.map((message, index) => (
      <div
        key={index}
        className={`flex gap-3 ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
      >
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border
          ${message.sender === "bot"
            ? "bg-blue-600/20 border-blue-500/30 text-blue-400"
            : "bg-purple-600/20 border-purple-500/30 text-purple-400"}
        `}>
          {message.sender === "bot" ? <Bot size={16} /> : <User size={16} />}
        </div>

        <div className={`
          max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed min-w-0 break-words overflow-hidden
          ${message.sender === "bot"
            ? "bg-gray-800/50 border border-gray-700/50 rounded-tl-none text-gray-200"
            : "bg-blue-600 text-white rounded-tr-none"}
        `}>
          <div className="markdown-content overflow-x-auto max-w-full">
            {message.sender === "user"
              ? highlightUserTags(message.text)
              : <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>}
          </div>

          {message.sender === "bot" && (
            <SourceFiles sourceFiles={message.sourceFiles || []} onSourceFileClick={onSourceFileClick} />
          )}
        </div>
      </div>
    ))}

    {isAwaitingResponse && <TypingBubble />}
  </div>
);

export default ChatMessages;
