"use client";
import { useState, useEffect } from "react";
import { X, Key, Trash2, Moon, Sun, Monitor, Check } from "lucide-react";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
    onSaveApiKey: (key: string) => void;
    onClearChat: () => void;
}

export default function SettingsModal({
    isOpen,
    onClose,
    apiKey,
    onSaveApiKey,
    onClearChat,
}: SettingsModalProps) {
    const [localApiKey, setLocalApiKey] = useState(apiKey);
    const [activeTab, setActiveTab] = useState<"general" | "api">("general");

    useEffect(() => {
        setLocalApiKey(apiKey);
    }, [apiKey, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <h2 className="text-lg font-semibold text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex h-[400px]">
                    {/* Sidebar */}
                    <div className="w-1/3 border-r border-white/5 bg-black/20 p-2 space-y-1">
                        <button
                            onClick={() => setActiveTab("general")}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "general"
                                    ? "bg-blue-600/20 text-blue-300"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab("api")}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "api"
                                    ? "bg-blue-600/20 text-blue-300"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            API Keys
                        </button>
                    </div>

                    {/* Main Panel */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {activeTab === "general" && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-3">Appearance</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button className="flex flex-col items-center gap-2 p-3 rounded-xl border border-blue-500/50 bg-blue-500/10 text-blue-200">
                                            <Moon size={20} />
                                            <span className="text-xs">Dark</span>
                                        </button>
                                        <button className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 opacity-50 cursor-not-allowed" title="Coming soon">
                                            <Sun size={20} />
                                            <span className="text-xs">Light</span>
                                        </button>
                                        <button className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 opacity-50 cursor-not-allowed" title="Coming soon">
                                            <Monitor size={20} />
                                            <span className="text-xs">System</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-300 mb-3">Data</h3>
                                    <button
                                        onClick={() => {
                                            if (confirm("Are you sure you want to clear the chat history?")) {
                                                onClearChat();
                                                onClose();
                                            }
                                        }}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                                    >
                                        <span className="text-sm">Clear Chat History</span>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === "api" && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        OpenAI API Key
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={localApiKey}
                                            onChange={(e) => setLocalApiKey(e.target.value)}
                                            placeholder="sk-..."
                                            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                        />
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500">
                                        Your key is stored locally in your browser and never sent to our servers.
                                    </p>
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={() => {
                                            onSaveApiKey(localApiKey);
                                            onClose();
                                        }}
                                        disabled={!localApiKey && !apiKey}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Check size={16} />
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
