import React, { useState } from "react";
import { Brain, Sparkles, TrendingUp, DollarSign, BarChart3, RefreshCw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const presetQuestions = [
    { icon: TrendingUp, label: "Top Performers", query: "Who are the top performers this quarter?" },
    { icon: DollarSign, label: "Revenue Trends", query: "Show me revenue trends" },
    { icon: BarChart3, label: "Key Metrics", query: "What are the key metrics?" },
  ];

  const handlePreset = (query: string) => {
    handleSubmit(query);
  };

  const handleSubmit = async (queryText?: string) => {
    const question = queryText || input;
    if (!question.trim()) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response (replace with actual API call later)
    setTimeout(() => {
      const aiMessage: Message = {
        role: "assistant",
        content: `This is a placeholder response for: "${question}". Integration with Gemini API coming soon.`,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-50">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-lg p-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-400" />
          <h1 className="font-semibold text-lg">ClearMetric</h1>
        </div>
        <button
          onClick={handleReset}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Reset Context"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Preset Questions */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col justify-center p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Quick Start</span>
          </div>
          {presetQuestions.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handlePreset(preset.query)}
              className="group flex items-center w-full gap-3 p-4 text-left bg-white/5 hover:bg-white/10 active:scale-[0.99] border border-white/5 hover:border-blue-500/30 backdrop-blur-md rounded-xl transition-all duration-200 ease-out shadow-sm hover:shadow-md hover:shadow-blue-500/5"
            >
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:text-blue-300 group-hover:bg-blue-400/20 transition-colors">
                <preset.icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200 group-hover:text-white">{preset.label}</span>
                <span className="text-[10px] text-gray-500 group-hover:text-gray-400">{preset.query}</span>
              </div>
            </button>
          ))}
          <div className="text-center mt-6 text-[11px] text-gray-600">
            ClearMetric analyzes visible data only. Privacy protected.
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-600/20 border border-blue-500/30"
                  : "glass"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="glass p-3 rounded-lg">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100" />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="glass p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask about your dashboard..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
