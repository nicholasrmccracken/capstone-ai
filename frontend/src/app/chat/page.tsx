"use client";
import { useState } from "react";

export default function Chat() {
  const [url, setUrl] = useState("");
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "👋 Welcome to RepoReaper! Please enter a GitHub repository URL to get started.",
    },
  ]);

  // Regex to validate GitHub repo URLs
  const githubRegex =
    /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) return;

    setMessages((prev) => [...prev, { sender: "user", text: url }]);

    if (githubRegex.test(url)) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "✅ Thanks! That looks like a valid GitHub repository. Processing...",
        },
      ]);
      try {
        const response = await fetch(
          process.env.NEXT_PUBLIC_BACKEND_URL ||
            "http://localhost:5000/api/ingest",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ github_url: url }),
          }
        );
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text:
              data.status === "started"
                ? "🚀 Ingestion started! Please wait while we process the repository."
                : `⚠️ Error: ${data.message || "Failed to start ingestion."}`,
          },
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "❌ Error connecting to backend. Please try again later.",
          },
        ]);
      }
    } else {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "❌ That doesn’t look like a valid GitHub repository. Please try again.",
        },
      ]);
    }

    setUrl("");
  };

  return (
    <main className="flex flex-col items-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white py-10 px-6">
      <h2 className="text-4xl font-bold mb-6 text-blue-400 drop-shadow-md">
        RepoReaper Chat
      </h2>

      {/* Chat Window */}
      <div className="w-full max-w-xl bg-gray-900/70 border border-gray-700 p-6 rounded-xl shadow-lg h-[500px] flex flex-col overflow-y-auto">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-3 p-3 rounded-lg max-w-[75%] ${
              msg.sender === "bot"
                ? "bg-gray-700 text-gray-200 self-start"
                : "bg-blue-600 text-white self-end"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-xl mt-4 flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter a GitHub repository URL"
          className="flex-1 p-3 border border-gray-600 bg-gray-800 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
        >
          Send
        </button>
      </form>
    </main>
  );
}
