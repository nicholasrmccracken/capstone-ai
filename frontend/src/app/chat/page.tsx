"use client";
import { useState } from "react";

export default function Chat() {
  const [question, setQuestion] = useState("");
  const [repoFilter, setRepoFilter] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "👋 Welcome to RepoRover! You can ask questions about code from ingested repositories, or enter 'ingest <github-url>' to add a new repository.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) return;

    const userQuestion = question.trim();
    setMessages((prev) => [...prev, { sender: "user", text: userQuestion }]);
    setQuestion("");
    setIsLoading(true);

    // Check if it's an ingestion command
    if (userQuestion.startsWith("ingest")) {
      const url = userQuestion.replace(/^ingest\s+/, "").trim();
      const githubRegex = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

      if (githubRegex.test(url)) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "✅ Processing repository ingestion..." },
        ]);

        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
          const response = await fetch(`${backendUrl}/api/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ github_url: url }),
          });
          const data = await response.json();
          setMessages((prev) => [
            ...prev,
            {
              sender: "bot",
              text: data.status === "started"
                ? "🚀 Ingestion started! Repository processing in background. (Note: This may take several minutes)"
                : `⚠️ Error: ${data.message || "Failed to start ingestion."}`,
            },
          ]);
        } catch (error) {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: "❌ Error connecting to backend. Please try again later." },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "❌ Invalid GitHub URL. Format: https://github.com/owner/repo" },
        ]);
      }
    } else {
      // Handle regular questions
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const response = await fetch(`${backendUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userQuestion,
            repo_filter: repoFilter.trim() || null
          }),
        });
        const data = await response.json();

        if (data.status === "success") {
          let answerText = data.answer;
          if (data.chunks_used > 0) {
            answerText += `\n\n📊 Used ${data.chunks_used} code chunks from repositories: ${data.repos.join(", ")}`;
          }
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: answerText },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { sender: "bot", text: `❌ ${data.message || "Error processing question"}` },
          ]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "❌ Error connecting to backend. Please try again later." },
        ]);
      }
    }

    setIsLoading(false);
  };

  return (
    <main className="flex flex-col items-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white py-10 px-6">
      <h2 className="text-4xl font-bold mb-6 text-blue-400 drop-shadow-md">
        RepoRover Chat
      </h2>

      {/* Chat Window */}
      <div className="w-full max-w-4xl bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg h-[500px] flex flex-col overflow-y-auto">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-3 p-3 rounded-lg max-w-[75%] whitespace-pre-wrap ${
              msg.sender === "bot"
                ? "bg-gray-700 text-gray-200 self-start"
                : "bg-blue-600 text-white self-end"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {isLoading && (
          <div className="self-start mb-3 p-3 rounded-lg bg-gray-700 text-gray-200">
            🤔 Thinking...
          </div>
        )}
      </div>

      {/* Optional Repo Filter */}
      <div className="w-full max-w-4xl mt-2 flex gap-2">
        <input
          type="text"
          value={repoFilter}
          onChange={(e) => setRepoFilter(e.target.value)}
          placeholder="Optional repo filter (owner/repo)"
          className="flex-1 p-2 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-4xl mt-4 flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about code or type 'ingest <github-url>' to add repository"
          className="flex-1 p-3 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-all"
        >
          {isLoading ? "..." : "Send"}
        </button>
      </form>
    </main>
  );
}
