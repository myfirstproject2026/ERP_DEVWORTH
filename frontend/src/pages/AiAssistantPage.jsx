import React, { useEffect, useRef, useState } from 'react'
import { Sparkles, Send, MessageCircle, Mail } from 'lucide-react'
import { aiApi } from  "../api/services";

const TRY_ASKING = [
  'This month sales lowest — tell me',
  'This product fast moving',
  'This customer payment pending',
  'Next month, how much stock to order?',
  'Best supplier for raw material',
  'One-click GST report',
]

export default function AiAssistantPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [sending, setSending] = useState(false)
  const [channels, setChannels] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    aiApi.latestConversation().then((res) => setMessages(res.data))
    aiApi.channels().then((res) => setChannels(res.data))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const messageText = text ?? input
    if (!messageText.trim() || sending) return
    setSending(true)
    setInput('')

    // optimistic append
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, sender: 'user', content: messageText, created_at: new Date().toISOString() },
    ])

    try {
      const res = await aiApi.ask(messageText, conversationId)
      setConversationId(res.data.conversation_id)
      setMessages((prev) => [
        ...prev.filter((m) => !String(m.id).startsWith('temp-')),
        res.data.user_message,
        res.data.assistant_message,
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <p className="text-xs text-brand-600 font-medium mb-1">AI Assistant</p>
      <h1 className="text-xl font-bold text-slate-900 mb-1">AI Assistant</h1>
      <p className="text-sm text-slate-500 mb-5">Ask questions about sales, stock, payments or production in plain language.</p>

      <div className="grid grid-cols-3 gap-5">
        {/* CHAT PANEL */}
        <div className="col-span-2 bg-white border border-slate-200 rounded-xl flex flex-col h-[640px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                <Sparkles size={28} className="mb-3" />
                <p className="text-sm">Ask me anything about your business data.</p>
              </div>
            )}
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage() }}
            className="flex items-center gap-2 border-t border-slate-100 p-3"
          >
            <div className="flex-1 relative">
              <Sparkles size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about sales, stock, payments, production..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-50 border border-transparent focus:bg-white focus:border-brand-300 focus:outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send size={14} /> Send
            </button>
          </form>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Try asking</h3>
            <div className="space-y-2">
              {TRY_ASKING.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-100 hover:border-brand-200 hover:bg-brand-50/40 text-sm text-slate-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Connected channels</h3>
            <div className="space-y-3">
              {channels.map((c) => (
                <div key={c.channel_name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {c.channel_name.toLowerCase().includes('whatsapp') ? (
                      <MessageCircle size={16} className="text-green-600" />
                    ) : (
                      <Mail size={16} className="text-slate-500" />
                    )}
                    <span className="text-sm text-slate-700">{c.channel_name}</span>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'connected' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.status === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ message }) {
  const isUser = message.sender === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 mr-2">
          <Sparkles size={13} />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm animate-fade-in ${
          isUser ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-800 border border-slate-100'
        }`}
      >
        <p className="leading-relaxed">{message.content}</p>

        {message.payload_json?.type === 'table' && (
          <div className="mt-3 bg-white rounded-lg border border-slate-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="px-3 py-2 font-medium">CUSTOMER</th>
                  <th className="px-3 py-2 font-medium">LAST ORDER</th>
                  <th className="px-3 py-2 font-medium text-right">THIS MONTH</th>
                </tr>
              </thead>
              <tbody>
                {message.payload_json.rows.map((r) => (
                  <tr key={r.customer} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 text-slate-700">{r.customer}</td>
                    <td className="px-3 py-2 text-slate-500">{r.last_order}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                      ₹{Number(r.this_month).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-brand-600 font-medium border-t border-slate-100 hover:bg-slate-50">
              <MessageCircle size={12} /> Send re-engagement message to both
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
