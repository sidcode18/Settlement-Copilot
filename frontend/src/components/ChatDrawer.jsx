import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Wrench, 
  CornerDownLeft, 
  RefreshCw,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { sendChatMessage } from '../api';

export default function ChatDrawer({ isOpen, onClose, initialQuery, health }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your **Settlement Copilot Finance Assistant**.\n\nI have real-time access to the settlement ledger and reconciliation matches. You can ask me to explain why specific payouts failed, inspect multi-order splits, or audit tie-breaker decisions.",
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
        content: `Error querying copilot: ${err.message}. Please check backend logs.`,
        tool_calls: []
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Settlement Copilot Chat</h3>
            <p className="text-[11px] text-slate-400">
              {health?.is_fallback ? 'Running in Heuristic Fallback' : `Powered by ${health?.provider || 'LLM'}`}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((m, idx) => {
          const isAssistant = m.role === 'assistant';
          return (
            <div key={idx} className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white ${
                isAssistant ? 'bg-indigo-600' : 'bg-sky-600'
              }`}>
                {isAssistant ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              
              <div className={`max-w-[85%] space-y-2`}>
                
                {/* Tool calls execution badge */}
                {m.tool_calls && m.tool_calls.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 font-mono">
                    <Wrench className="w-3 h-3 text-indigo-400" />
                    <span>Tool executed: <strong className="text-slate-300">{m.tool_calls[0].tool}()</strong></span>
                  </div>
                )}

                {/* Message Content */}
                <div className={`p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                  isAssistant 
                    ? 'bg-slate-800/90 text-slate-200 border border-slate-700/60 shadow-sm' 
                    : 'bg-sky-600 text-white rounded-tr-none'
                }`}>
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Analyzing reconciliation records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      {suggestedChips.length > 0 && (
        <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] uppercase font-semibold text-slate-500 flex-shrink-0">Suggestions:</span>
          {suggestedChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white transition-colors whitespace-nowrap"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/80">
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
            className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl disabled:opacity-50 transition-colors shadow-md shadow-sky-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
}
