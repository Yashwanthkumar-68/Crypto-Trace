import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, X, Bot, User } from 'lucide-react';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { api } from '../services/api'; // Make sure this API wrapper exists

interface CryptoCopilotProps {
  onComplete: (data: any) => void;
  onCancel: () => void;
}

interface ChatMessage {
  role: 'agent' | 'user';
  content: string;
}

export const CryptoCopilotVoiceUI: React.FC<CryptoCopilotProps> = ({ onComplete, onCancel }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<'en-IN' | 'hi-IN'>('en-IN');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isListening, transcript, startListening, stopListening } = useSpeechToText({
    lang: lang,
    continuous: false,
    onResult: (text) => setCurrentInput(text),
  });

  // Welcome message
  useEffect(() => {
    setMessages([
      { role: 'agent', content: "Hello! I am Crypto Copilot. I'm here to help you file your complaint. To get started, could you please tell me your full name?" }
    ]);
    speakText("Hello! I am Crypto Copilot. I'm here to help you file your complaint. To get started, could you please tell me your full name?");
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentInput]);

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (textToSend: string = currentInput) => {
    if (!textToSend.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: textToSend };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setCurrentInput('');
    setLoading(true);

    try {
      // Direct fetch call since we just created the endpoint and might not have added it to api.ts wrapper
      const response = await fetch('/api/agent/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
          latest_user_input: textToSend
        })
      });

      if (response.ok) {
        const data = await response.json();
        const agentMessage: ChatMessage = { role: 'agent', content: data.reply_text };
        setMessages(prev => [...prev, agentMessage]);
        speakText(data.reply_text);

        if (data.is_complete) {
          setTimeout(() => {
            onComplete(data.extracted_data);
          }, 2000);
        }
      } else {
        console.error("API error", response.statusText);
      }
    } catch (err) {
      console.error('Error communicating with Crypto Copilot', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
      if (transcript) {
        handleSend(transcript);
      }
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Bot size={24} />
          <div>
            <h3 className="font-bold text-lg leading-tight">Crypto Copilot</h3>
            <p className="text-indigo-200 text-xs">AI Voice Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select 
            className="bg-indigo-700 text-white border-none rounded text-sm px-2 py-1 outline-none"
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
          >
            <option value="en-IN">English (IN)</option>
            <option value="hi-IN">हिन्दी (Hindi)</option>
          </select>
          <button onClick={onCancel} className="text-indigo-200 hover:text-white transition">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
              msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {msg.role === 'user' ? <User size={14} className="opacity-70" /> : <Bot size={14} className="text-indigo-500" />}
                <span className="text-xs opacity-70 font-medium">
                  {msg.role === 'user' ? 'You' : 'Copilot'}
                </span>
              </div>
              <p className="text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        {currentInput && (
           <div className="flex justify-end">
             <div className="max-w-[80%] bg-indigo-100 text-indigo-900 px-4 py-3 rounded-2xl rounded-br-none shadow-sm opacity-70 text-sm italic">
               {currentInput}...
             </div>
           </div>
        )}
        {loading && (
          <div className="flex justify-start">
             <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
               <span className="flex gap-1">
                 <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                 <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                 <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
               </span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white p-4 border-t border-slate-200 flex items-center gap-3">
        <button
          onClick={handleMicClick}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600'
          }`}
        >
          {isListening ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <input
          type="text"
          className="flex-1 border border-slate-300 rounded-full px-5 py-3 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
          placeholder="Speak or type your answer..."
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          onClick={() => handleSend()}
          disabled={!currentInput.trim() || loading}
          className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-slate-300 transition-colors"
        >
          <Send size={18} className="ml-1" />
        </button>
      </div>
    </div>
  );
};
