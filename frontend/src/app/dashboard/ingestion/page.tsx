'use client';

import { useEffect, useState } from 'react';
import { listKnowledgeBases, listIngestionJobs, getIngestionStats, listEmbeddingModels } from '@/lib/api';
import type { KnowledgeBase, IngestionJob, IngestionStats, EmbeddingModelInfo } from '@/lib/types';
import { clsx } from 'clsx';
import { Activity, CheckCircle, XCircle, Loader2, AlertCircle, DollarSign, Cpu } from 'lucide-react';

export default function IngestionPage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState('');
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [models, setModels] = useState<EmbeddingModelInfo[]>([]);

  useEffect(() => {
    listKnowledgeBases().then(list => {
      setKbs(list);
      if (list.length > 0) setSelectedKB(list[0].id);
    }).catch(() => {});
    listEmbeddingModels().then(setModels).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedKB) return;
    const load = () => {
      listIngestionJobs(selectedKB).then(setJobs).catch(() => {});
      getIngestionStats(selectedKB).then(setStats).catch(() => {});
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [selectedKB]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing': case 'parsing': case 'chunking': case 'embedding': case 'storing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ingestion Monitor</h1>
        <select className="input-field !w-auto" value={selectedKB} onChange={e => setSelectedKB(e.target.value)}>
          {kbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Documents', value: stats.total_documents, icon: Activity },
            { label: 'Chunks', value: stats.total_chunks.toLocaleString(), icon: Activity },
            { label: 'Processing', value: stats.documents_processing, icon: Loader2, color: 'text-blue-600' },
            { label: 'Completed', value: stats.documents_completed, icon: CheckCircle, color: 'text-green-600' },
            { label: 'Failed', value: stats.documents_failed, icon: XCircle, color: 'text-red-600' },
            { label: 'Est. Cost', value: `$${stats.estimated_total_cost.toFixed(4)}`, icon: DollarSign, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={clsx('w-4 h-4', s.color || 'text-gray-400')} />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Embedding Models Info */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Cpu className="w-5 h-5" /> Embedding Models
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {models.map(m => (
            <div key={m.id} className="card p-4">
              <div className="font-medium text-gray-900 mb-1">{m.name}</div>
              <div className="text-xs text-gray-500 mb-2">{m.provider}</div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Dimension</span>
                  <span className="font-mono">{m.dimension}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Tokens</span>
                  <span className="font-mono">{m.max_tokens}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost/1k tokens</span>
                  <span className="font-mono">${m.cost_per_1k_tokens}</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">{m.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Jobs */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Ingestion Jobs</h2>
      {jobs.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No ingestion jobs yet. Upload documents to a knowledge base.</div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {statusIcon(job.status)}
                  <span className="font-medium text-gray-900">{job.filename}</span>
                </div>
                <span className={clsx('text-xs font-medium px-2 py-0.5 rounded', {
                  'bg-green-100 text-green-700': job.status === 'completed',
                  'bg-red-100 text-red-700': job.status === 'failed',
                  'bg-blue-100 text-blue-700': !['completed', 'failed'].includes(job.status),
                })}>
                  {job.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div
                  className={clsx('h-2 rounded-full transition-all duration-500', {
                    'bg-green-500': job.status === 'completed',
                    'bg-red-500': job.status === 'failed',
                    'bg-vault-500': !['completed', 'failed'].includes(job.status),
                  })}
                  style={{ width: `${Math.round(job.progress * 100)}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <span>{Math.round(job.progress * 100)}% complete</span>
                <span>{job.chunk_count} chunks</span>
                {job.estimated_cost != null && <span>~${job.estimated_cost.toFixed(5)}</span>}
                {job.started_at && <span>Started: {new Date(job.started_at).toLocaleString()}</span>}
                {job.completed_at && <span>Finished: {new Date(job.completed_at).toLocaleString()}</span>}
              </div>
              {job.error_message && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded">{job.error_message}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
