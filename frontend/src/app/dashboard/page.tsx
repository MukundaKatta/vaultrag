'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listKnowledgeBases } from '@/lib/api';
import type { KnowledgeBase } from '@/lib/types';
import { Database, FileText, Layers, MessageSquare, Search, Upload, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listKnowledgeBases()
      .then(setKbs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalDocs = kbs.reduce((s, kb) => s + kb.document_count, 0);
  const totalChunks = kbs.reduce((s, kb) => s + kb.chunk_count, 0);

  const stats = [
    { label: 'Knowledge Bases', value: kbs.length, icon: Database, color: 'text-vault-600 bg-vault-50' },
    { label: 'Documents', value: totalDocs, icon: FileText, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Chunks', value: totalChunks.toLocaleString(), icon: Layers, color: 'text-amber-600 bg-amber-50' },
  ];

  const quickActions = [
    { label: 'Chat with Knowledge', href: '/dashboard/chat', icon: MessageSquare, desc: 'Ask questions with source citations' },
    { label: 'Search Documents', href: '/dashboard/search', icon: Search, desc: 'Hybrid vector + keyword search' },
    { label: 'Upload Documents', href: '/dashboard/knowledge-bases', icon: Upload, desc: 'Ingest PDFs, DOCX, CSV, and more' },
    { label: 'Evaluate Retrieval', href: '/dashboard/evaluation', icon: BarChart3, desc: 'Precision, recall, MRR metrics' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '-' : stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href} className="card p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-vault-50 rounded-lg flex items-center justify-center group-hover:bg-vault-100 transition-colors">
                <action.icon className="w-5 h-5 text-vault-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900 group-hover:text-vault-700">{action.label}</div>
                <div className="text-sm text-gray-500 mt-0.5">{action.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent KBs */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Bases</h2>
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : kbs.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-500 mb-4">No knowledge bases yet. Create one to get started.</p>
          <Link href="/dashboard/knowledge-bases" className="btn-primary inline-block">
            Create Knowledge Base
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kbs.map((kb) => (
            <Link
              key={kb.id}
              href={`/dashboard/knowledge-bases/${kb.id}`}
              className="card p-5 hover:shadow-md transition-shadow"
            >
              <div className="font-medium text-gray-900 mb-1">{kb.name}</div>
              <div className="text-sm text-gray-500 mb-3 line-clamp-2">{kb.description || 'No description'}</div>
              <div className="flex gap-4 text-xs text-gray-400">
                <span>{kb.document_count} docs</span>
                <span>{kb.chunk_count} chunks</span>
                <span className="badge-info">{kb.embedding_model}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
