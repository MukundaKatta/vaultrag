'use client';

import { useEffect, useState } from 'react';
import { listKnowledgeBases, searchKnowledgeBase } from '@/lib/api';
import type { KnowledgeBase, SearchResult, SearchMode } from '@/lib/types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { Search, FileText, Sparkles } from 'lucide-react';

export default function SearchPage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [rewrittenQuery, setRewrittenQuery] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Settings
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [topK, setTopK] = useState(10);
  const [rewrite, setRewrite] = useState(false);

  useEffect(() => {
    listKnowledgeBases().then(list => {
      setKbs(list);
      if (list.length > 0) setSelectedKB(list[0].id);
    }).catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!query.trim() || !selectedKB) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await searchKnowledgeBase({
        query,
        knowledge_base_id: selectedKB,
        mode,
        vector_weight: vectorWeight,
        top_k: topK,
        rewrite,
      });
      setResults(res.results);
      setRewrittenQuery(res.rewritten_query || null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Search</h1>

      {/* Search Controls */}
      <div className="card p-6 mb-6">
        <div className="flex gap-3 mb-4">
          <select className="input-field !w-auto" value={selectedKB} onChange={e => setSelectedKB(e.target.value)}>
            {kbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
          </select>
          <input
            className="input-field flex-1"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search your knowledge base..."
          />
          <button onClick={handleSearch} disabled={searching || !query.trim()} className="btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" />
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div className="flex flex-wrap gap-4 items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Mode:</span>
            <select className="input-field !py-1 !w-auto text-sm" value={mode} onChange={e => setMode(e.target.value as SearchMode)}>
              <option value="hybrid">Hybrid</option>
              <option value="vector">Vector Only</option>
              <option value="keyword">Keyword Only</option>
            </select>
          </div>

          {mode === 'hybrid' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Vector Weight:</span>
              <input type="range" min="0" max="1" step="0.1" value={vectorWeight} onChange={e => setVectorWeight(Number(e.target.value))} className="w-24" />
              <span className="text-gray-600 font-mono text-xs w-8">{vectorWeight}</span>
              <span className="text-xs text-gray-400">(keyword: {(1 - vectorWeight).toFixed(1)})</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Top-K:</span>
            <input type="number" className="input-field !py-1 !w-16 text-sm" value={topK} onChange={e => setTopK(Number(e.target.value))} min={1} max={50} />
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={rewrite} onChange={e => setRewrite(e.target.checked)} />
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-gray-600">Query Rewriting</span>
          </label>
        </div>
      </div>

      {/* Rewritten Query */}
      {rewrittenQuery && (
        <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <span className="font-medium text-amber-700">Rewritten Query:</span>{' '}
          <span className="text-amber-600">{rewrittenQuery}</span>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div className="mb-3 text-sm text-gray-500">
          {results.length} result{results.length !== 1 ? 's' : ''} found
        </div>
      )}

      <div className="space-y-3">
        {results.map((result, i) => (
          <div key={result.chunk_id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-900">{result.document_name}</span>
                {result.page && <span className="badge-info text-xs">Page {result.page}</span>}
                {result.paragraph && <span className="badge bg-gray-100 text-gray-600 text-xs">Para {result.paragraph}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">#{i + 1}</span>
                <div className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  result.score > 0.8 ? 'bg-green-100 text-green-700' :
                  result.score > 0.5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                )}>
                  {(result.score * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{result.text}</p>
          </div>
        ))}
      </div>

      {hasSearched && results.length === 0 && !searching && (
        <div className="card p-12 text-center text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3" />
          <p>No results found. Try different keywords or adjust search settings.</p>
        </div>
      )}
    </div>
  );
}
