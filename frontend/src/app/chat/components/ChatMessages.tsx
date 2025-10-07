"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RefObject } from "react";
import type { Message } from "../types";

interface ChatMessagesProps {
  messages: Message[];
  chatMessagesRef: RefObject<HTMLDivElement | null>;
  onSourceFileClick: (filePath: string) => void;
}

const highlightUserTags = (text: string) => {
  const parts = text.split(/(@[^\s]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span key={index} className="bg-blue-500 text-white px-1 rounded font-mono text-sm">
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
    <div className="mt-2 pt-2 border-t border-gray-600">
      <div className="text-xs text-gray-400 mb-1">Sources:</div>
      <div className="flex flex-wrap gap-1">
        {uniqueFiles.map((filePath, index) => (
          <button
            key={`${filePath}-${index}`}
            type="button"
            onClick={() => onSourceFileClick(filePath)}
            className="text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 px-2 py-1 rounded font-mono transition-colors"
            title={`Click to open ${filePath}`}
          >
            {filePath.split("/").pop()}
          </button>
        ))}
      </div>
    </div>
  );
};

const ChatMessages = ({ messages, chatMessagesRef, onSourceFileClick }: ChatMessagesProps) => (
  <div ref={chatMessagesRef} className="flex-1 overflow-y-auto">
    {messages.map((message, index) => (
      <div
        key={index}
        className={`markdown-content mb-3 p-3 rounded-lg max-w-[95%] mx-auto ${
          message.sender === "bot" ? "bg-gray-700 text-gray-200" : "bg-blue-600 text-white"
        }`}
      >
        {message.sender === "user"
          ? highlightUserTags(message.text)
          : <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>}
        {message.sender === "bot" && (
          <SourceFiles sourceFiles={message.sourceFiles || []} onSourceFileClick={onSourceFileClick} />
        )}
      </div>
    ))}
  </div>
);

export default ChatMessages;


