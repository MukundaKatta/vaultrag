'use client';

import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  listKnowledgeBases, sendChatMessage, listConversations,
  getConversationMessages, deleteConversation,
} from '@/lib/api';
import type { KnowledgeBase, ChatMessage, Citation, Conversation, SearchMode } from '@/lib/types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import {
  Send, MessageSquare, Trash2, FileText, ChevronDown, ChevronUp,
  Sparkles, Settings2, Bot, User,
} from 'lucide-react';

export default function ChatPage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [topK, setTopK] = useState(5);
  const [rewriteQuery, setRewriteQuery] = useState(true);
  const [model, setModel] = useState('gpt-4o');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listKnowledgeBases().then(list => {
      setKbs(list);
      if (list.length > 0) setSelectedKB(list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedKB) {
      listConversations(selectedKB).then(setConversations).catch(() => {});
    }
  }, [selectedKB]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async (convId: string) => {
    try {
      const msgs = await getConversationMessages(convId);
      setMessages(msgs.map((m: Record<string, unknown>) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
        citations: (m.citations as Citation[]) || [],
        timestamp: m.created_at as string,
      })));
      setCurrentConvId(convId);
    } catch { toast.error('Failed to load conversation'); }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedKB || sending) return;

    const userMsg: ChatMessage = { role: 'user', content: input, citations: [] };
    setMessages(prev => [...prev, userMsg]);
    const query = input;
    setInput('');
    setSending(true);

    try {
      const res = await sendChatMessage({
        message: query,
        knowledge_base_id: selectedKB,
        conversation_id: currentConvId,
        search_mode: searchMode,
        vector_weight: vectorWeight,
        top_k: topK,
        rewrite_query: rewriteQuery,
        model,
      });

      setCurrentConvId(res.conversation_id);
      setMessages(prev => [...prev, res.message]);

      // Refresh conversations list
      listConversations(selectedKB).then(setConversations).catch(() => {});
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
      setMessages(prev => prev.slice(0, -1)); // Remove optimistic user message
    } finally {
      setSending(false);
    }
  };

  const startNewChat = () => {
    setCurrentConvId(undefined);
    setMessages([]);
  };

  const handleDeleteConv = async (convId: string) => {
    try {
      await deleteConversation(convId);
      if (currentConvId === convId) startNewChat();
      setConversations(prev => prev.filter(c => c.id !== convId));
    } catch { toast.error('Failed to delete'); }
  };

  const CitationBlock = ({ citation, index }: { citation: Citation; index: number }) => {
    const key = `${citation.chunk_id}-${index}`;
    const isExpanded = expandedCitation === key;
    return (
      <button
        onClick={() => setExpandedCitation(isExpanded ? null : key)}
        className="text-left w-full"
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-vault-50 rounded-lg border border-vault-200 hover:bg-vault-100 transition-colors text-sm">
          <FileText className="w-3.5 h-3.5 text-vault-600 flex-shrink-0" />
          <span className="font-medium text-vault-700 truncate">{citation.document_name}</span>
          {citation.page && <span className="text-vault-500 text-xs">p.{citation.page}</span>}
          {citation.paragraph && <span className="text-vault-500 text-xs">para.{citation.paragraph}</span>}
          <span className="ml-auto text-xs text-vault-400">{(citation.relevance_score * 100).toFixed(0)}%</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
        {isExpanded && (
          <div className="mt-1 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 border max-h-40 overflow-y-auto">
            {citation.chunk_text}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <select className="input-field text-sm mb-3" value={selectedKB} onChange={e => { setSelectedKB(e.target.value); startNewChat(); }}>
            {kbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
          </select>
          <button onClick={startNewChat} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={clsx(
                'px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 group flex items-center',
                currentConvId === conv.id && 'bg-vault-50'
              )}
            >
              <button onClick={() => loadConversation(conv.id)} className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{conv.title}</div>
                <div className="text-xs text-gray-400">{new Date(conv.updated_at).toLocaleDateString()}</div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id); }}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Settings bar */}
        <div className="border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <Settings2 className="w-4 h-4" />
            Settings
          </button>
          {showSettings && (
            <div className="flex items-center gap-4 text-xs">
              <select className="input-field !py-1 text-xs !w-auto" value={searchMode} onChange={e => setSearchMode(e.target.value as SearchMode)}>
                <option value="hybrid">Hybrid</option>
                <option value="vector">Vector</option>
                <option value="keyword">Keyword</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Weight:</span>
                <input type="range" min="0" max="1" step="0.1" value={vectorWeight} onChange={e => setVectorWeight(Number(e.target.value))} className="w-20" />
                <span className="text-gray-600 w-8">{vectorWeight}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Top-K:</span>
                <input type="number" className="input-field !py-1 text-xs !w-14" value={topK} onChange={e => setTopK(Number(e.target.value))} min={1} max={20} />
              </div>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={rewriteQuery} onChange={e => setRewriteQuery(e.target.checked)} />
                <Sparkles className="w-3 h-3" />
                <span className="text-gray-500">Rewrite</span>
              </label>
              <select className="input-field !py-1 text-xs !w-auto" value={model} onChange={e => setModel(e.target.value)}>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Bot className="w-12 h-12 mb-3" />
              <p className="text-lg font-medium">Ask anything about your documents</p>
              <p className="text-sm mt-1">Responses include source citations</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={clsx('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-vault-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-vault-600" />
                </div>
              )}
              <div className={clsx('max-w-[70%]', msg.role === 'user' ? 'order-first' : '')}>
                <div className={clsx(
                  'rounded-2xl px-4 py-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-vault-600 text-white rounded-br-md'
                    : 'bg-white border border-gray-200 rounded-bl-md'
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 space-y-1 max-w-full">
                    <div className="text-xs text-gray-400 mb-1">Sources ({msg.citations.length})</div>
                    {msg.citations.map((cit, ci) => (
                      <CitationBlock key={ci} citation={cit} index={ci} />
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-8 h-8 bg-vault-100 rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 text-vault-600 animate-pulse" />
              </div>
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex gap-3">
            <input
              className="input-field flex-1"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={selectedKB ? 'Ask a question...' : 'Select a knowledge base first'}
              disabled={!selectedKB || sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedKB || sending}
              className="btn-primary flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
