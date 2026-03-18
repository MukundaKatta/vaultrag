'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  getKnowledgeBase, listDocuments, uploadDocument, deleteDocument,
  listPermissions, grantPermission, revokePermission, getIngestionStats, listIngestionJobs,
} from '@/lib/api';
import type { KnowledgeBase, Document, Permission, IngestionStats, IngestionJob, ChunkingStrategy } from '@/lib/types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import {
  FileText, Trash2, Upload, RefreshCw, Users, Shield,
  CheckCircle, XCircle, Loader2, AlertCircle,
} from 'lucide-react';

export default function KnowledgeBaseDetailPage() {
  const params = useParams();
  const kbId = params.id as string;

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [tab, setTab] = useState<'documents' | 'ingestion' | 'permissions'>('documents');
  const [uploading, setUploading] = useState(false);
  const [chunkStrategy, setChunkStrategy] = useState<ChunkingStrategy>('recursive');
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [permUserId, setPermUserId] = useState('');
  const [permLevel, setPermLevel] = useState('read');

  const load = useCallback(() => {
    getKnowledgeBase(kbId).then(setKb).catch(() => {});
    listDocuments(kbId).then(r => setDocs(r.documents)).catch(() => {});
    getIngestionStats(kbId).then(setStats).catch(() => {});
    listIngestionJobs(kbId).then(setJobs).catch(() => {});
    listPermissions('knowledge_base', kbId).then(setPerms).catch(() => {});
  }, [kbId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh jobs while processing
  useEffect(() => {
    const hasProcessing = jobs.some(j => j.status === 'processing' || j.status === 'parsing' || j.status === 'chunking' || j.status === 'embedding' || j.status === 'storing');
    if (!hasProcessing) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [jobs, load]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    for (const file of acceptedFiles) {
      try {
        await uploadDocument(kbId, file, chunkStrategy, chunkSize, chunkOverlap);
        toast.success(`Uploaded: ${file.name}`);
      } catch (err: unknown) {
        toast.error(`Failed: ${file.name} - ${err instanceof Error ? err.message : 'Error'}`);
      }
    }
    setUploading(false);
    load();
  }, [kbId, chunkStrategy, chunkSize, chunkOverlap, load]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'text/html': ['.html', '.htm'],
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt'],
    },
  });

  const handleDeleteDoc = async (docId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      await deleteDocument(docId);
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const handleGrantPerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await grantPermission({
        user_id: permUserId,
        resource_type: 'knowledge_base',
        resource_id: kbId,
        permission: permLevel,
      });
      toast.success('Permission granted');
      setPermUserId('');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  if (!kb) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{kb.name}</h1>
        <p className="text-gray-500 mt-1">{kb.description || 'No description'}</p>
        <div className="flex gap-4 mt-2 text-sm text-gray-400">
          <span>Model: {kb.embedding_model}</span>
          <span>{kb.document_count} documents</span>
          <span>{kb.chunk_count} chunks</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['documents', 'ingestion', 'permissions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              tab === t ? 'border-vault-600 text-vault-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-2 text-gray-400 hover:text-gray-600" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div>
          {/* Upload config */}
          <div className="card p-4 mb-4">
            <div className="text-sm font-medium text-gray-700 mb-3">Chunking Settings</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Strategy</label>
                <select className="input-field text-sm" value={chunkStrategy} onChange={e => setChunkStrategy(e.target.value as ChunkingStrategy)}>
                  <option value="recursive">Recursive</option>
                  <option value="semantic">Semantic</option>
                  <option value="sentence">Sentence</option>
                  <option value="fixed">Fixed-size</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chunk Size (tokens)</label>
                <input type="number" className="input-field text-sm" value={chunkSize} onChange={e => setChunkSize(Number(e.target.value))} min={50} max={4000} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Overlap (tokens)</label>
                <input type="number" className="input-field text-sm" value={chunkOverlap} onChange={e => setChunkOverlap(Number(e.target.value))} min={0} max={500} />
              </div>
            </div>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6',
              isDragActive ? 'border-vault-500 bg-vault-50' : 'border-gray-300 hover:border-vault-400 hover:bg-gray-50'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            {uploading ? (
              <p className="text-vault-600 font-medium">Uploading...</p>
            ) : isDragActive ? (
              <p className="text-vault-600 font-medium">Drop files here</p>
            ) : (
              <div>
                <p className="text-gray-600 font-medium">Drag & drop files or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">PDF, DOCX, CSV, HTML, Markdown, TXT (max 50MB)</p>
              </div>
            )}
          </div>

          {/* Document List */}
          {docs.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">No documents uploaded yet</div>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="card p-4 flex items-center gap-4">
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{doc.filename}</div>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                      <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                      <span>{doc.chunk_count} chunks</span>
                      <span>{doc.file_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusIcon(doc.status)}
                    <span className={clsx('text-xs font-medium', {
                      'text-green-600': doc.status === 'ready',
                      'text-red-600': doc.status === 'failed',
                      'text-blue-600': doc.status === 'processing',
                    })}>
                      {doc.status}
                    </span>
                  </div>
                  {doc.error_message && (
                    <span className="text-xs text-red-500 max-w-[200px] truncate" title={doc.error_message}>
                      {doc.error_message}
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteDoc(doc.id, doc.filename)}
                    className="text-gray-300 hover:text-red-500 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ingestion Tab */}
      {tab === 'ingestion' && (
        <div>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Total Docs', value: stats.total_documents },
                { label: 'Total Chunks', value: stats.total_chunks },
                { label: 'Processing', value: stats.documents_processing },
                { label: 'Completed', value: stats.documents_completed },
                { label: 'Est. Cost', value: `$${stats.estimated_total_cost.toFixed(4)}` },
              ].map(s => (
                <div key={s.label} className="card p-4 text-center">
                  <div className="text-xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <h3 className="font-semibold text-gray-700 mb-3">Ingestion Jobs</h3>
          {jobs.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">No ingestion jobs</div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900">{job.filename}</div>
                    <div className="flex items-center gap-2">
                      {statusIcon(job.status)}
                      <span className="text-xs text-gray-500">{job.status}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                    <div
                      className={clsx('h-2 rounded-full transition-all', {
                        'bg-vault-500': job.status !== 'failed',
                        'bg-red-500': job.status === 'failed',
                      })}
                      style={{ width: `${Math.round(job.progress * 100)}%` }}
                    />
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>{Math.round(job.progress * 100)}%</span>
                    <span>{job.chunk_count} chunks</span>
                    {job.estimated_cost != null && <span>~${job.estimated_cost.toFixed(4)}</span>}
                    {job.error_message && <span className="text-red-500">{job.error_message}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permissions Tab */}
      {tab === 'permissions' && (
        <div>
          <form onSubmit={handleGrantPerm} className="card p-4 mb-6 flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">User ID</label>
              <input className="input-field text-sm" value={permUserId} onChange={e => setPermUserId(e.target.value)} required placeholder="User UUID" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Permission</label>
              <select className="input-field text-sm" value={permLevel} onChange={e => setPermLevel(e.target.value)}>
                <option value="read">Read</option>
                <option value="write">Write</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary text-sm flex items-center gap-1">
              <Users className="w-4 h-4" /> Grant
            </button>
          </form>

          {perms.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <Shield className="w-8 h-8 mx-auto mb-2" />
              No shared permissions. Only the owner has access.
            </div>
          ) : (
            <div className="space-y-2">
              {perms.map(p => (
                <div key={p.id} className="card p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{p.user_email}</div>
                    <div className="text-xs text-gray-400">{p.permission} access</div>
                  </div>
                  <button
                    onClick={async () => { await revokePermission(p.id); toast.success('Revoked'); load(); }}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
