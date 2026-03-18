'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, listEmbeddingModels } from '@/lib/api';
import type { KnowledgeBase, EmbeddingModelInfo } from '@/lib/types';
import toast from 'react-hot-toast';
import { Plus, Trash2, Database, X } from 'lucide-react';

export default function KnowledgeBasesPage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [models, setModels] = useState<EmbeddingModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', embedding_model: 'openai' });
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([listKnowledgeBases(), listEmbeddingModels()])
      .then(([kbList, modelList]) => { setKbs(kbList); setModels(modelList); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const model = models.find(m => m.id === form.embedding_model);
      await createKnowledgeBase({
        name: form.name,
        description: form.description,
        embedding_model: form.embedding_model,
        embedding_dimension: model?.dimension || 1536,
      });
      toast.success('Knowledge base created');
      setShowCreate(false);
      setForm({ name: '', description: '', embedding_model: 'openai' });
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its documents? This cannot be undone.`)) return;
    try {
      await deleteKnowledgeBase(id);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Bases</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Knowledge Base
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create Knowledge Base</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="e.g., Product Documentation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What this knowledge base contains..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Embedding Model</label>
                <select
                  className="input-field"
                  value={form.embedding_model}
                  onChange={e => setForm({ ...form, embedding_model: e.target.value })}
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider}) - {m.dimension}d - ${m.cost_per_1k_tokens}/1k tokens
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : kbs.length === 0 ? (
        <div className="card p-12 text-center">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No knowledge bases yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kbs.map(kb => (
            <div key={kb.id} className="card p-5 hover:shadow-md transition-shadow group relative">
              <Link href={`/dashboard/knowledge-bases/${kb.id}`} className="block">
                <div className="font-medium text-gray-900 mb-1 group-hover:text-vault-700">{kb.name}</div>
                <div className="text-sm text-gray-500 mb-3 line-clamp-2">{kb.description || 'No description'}</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="badge-info">{kb.embedding_model}</span>
                  <span className="badge bg-gray-100 text-gray-600">{kb.document_count} docs</span>
                  <span className="badge bg-gray-100 text-gray-600">{kb.chunk_count} chunks</span>
                </div>
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(kb.id, kb.name); }}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
