import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  MessageSquare, 
  User, 
  Wrench, 
  RefreshCw,
} from 'lucide-react';
import { sendChatMessage } from '../api';

export default function ChatDrawer({ isOpen, onClose, initialQuery, health }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Ask about payout matches, unresolved items, or split payments.",
      tool_calls: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedChips, setSuggestedChips] = useState([
    "Why wasn't payout PAY-561 matched?",
    "Show split payments > ₹10,000",
    "How many payouts are still unresolved?",
    "Explain tie-breaker cases"
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (initialQuery) {
      handleSend(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const userText = textToSend || input;
    if (!userText.trim() || loading) return;

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChatMessage(userText, messages);
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: res.reply,
        tool_calls: res.tool_calls_made || []
      }]);
      if (res.suggested_followups && res.suggested_followups.length > 0) {
        setSuggestedChips(res.suggested_followups);
      }
    } catch (err) {
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: `Request failed: ${err.message}. Check backend logs.`,
        tool_calls: []
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#0d1117] border-l border-[#30363d] flex flex-col animate-in slide-in-from-right duration-200">
      
      <div className="px-5 py-4 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#21262d] text-[#58a6ff] border border-[#30363d] flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Chat</h3>
            {health?.quota_exceeded ? (
              <p className="text-[11px] text-[#d29922]">Quota exceeded — heuristic mode</p>
            ) : health?.is_fallback ? (
              <p className="text-[11px] text-[#d29922]">Fallback mode (no key)</p>
            ) : null}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((m, idx) => {
          const isAssistant = m.role === 'assistant';
          return (
            <div key={idx} className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white ${
                isAssistant ? 'bg-[#21262d] border border-[#30363d] text-[#58a6ff]' : 'bg-[#1f6feb]'
              }`}>
                {isAssistant ? <MessageSquare className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              
              <div className="max-w-[85%] space-y-2">
                {m.tool_calls && m.tool_calls.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#161b22] border border-[#30363d] text-[10px] text-[#8b949e] font-mono">
                    <Wrench className="w-3 h-3 text-[#58a6ff]" />
                    <span>Tool: <strong className="text-[#c9d1d9]">{m.tool_calls[0].tool}()</strong></span>
                  </div>
                )}

                <div className={`p-3.5 rounded-lg leading-relaxed whitespace-pre-wrap ${
                  isAssistant 
                    ? 'bg-[#161b22] text-[#c9d1d9] border border-[#30363d]' 
                    : 'bg-[#1f6feb] text-white'
                }`}>
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#21262d] border border-[#30363d] flex items-center justify-center text-[#58a6ff]">
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div className="p-3.5 rounded-lg bg-[#161b22] border border-[#30363d] text-[#8b949e] flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#58a6ff]" />
              <span>Loading...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {suggestedChips.length > 0 && (
        <div className="px-4 py-2 bg-[#161b22] border-t border-[#30363d] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] uppercase font-semibold text-[#8b949e] flex-shrink-0">Suggestions</span>
          {suggestedChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="px-2.5 py-1 rounded-full bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-[11px] text-[#c9d1d9] hover:text-white transition-colors whitespace-nowrap"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 border-t border-[#30363d] bg-[#161b22]">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about payouts, splits, exceptions..."
            className="flex-1 px-3.5 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-white placeholder:text-[#8b949e] focus:outline-none focus:border-[#58a6ff] transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
}
