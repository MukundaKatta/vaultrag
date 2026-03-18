'use client';

import { useEffect, useState } from 'react';
import { listKnowledgeBases, runEvaluation } from '@/lib/api';
import type { KnowledgeBase, EvalResponse, EvalMetric, SearchMode } from '@/lib/types';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { BarChart3, Plus, Trash2, Play } from 'lucide-react';

interface QueryInput {
  query: string;
  relevant_chunk_ids: string;
}

export default function EvaluationPage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState('');
  const [queries, setQueries] = useState<QueryInput[]>([{ query: '', relevant_chunk_ids: '' }]);
  const [kValues, setKValues] = useState('1,3,5,10');
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
  const [vectorWeight, setVectorWeight] = useState(0.7);
  const [results, setResults] = useState<EvalResponse | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    listKnowledgeBases().then(list => {
      setKbs(list);
      if (list.length > 0) setSelectedKB(list[0].id);
    }).catch(() => {});
  }, []);

  const addQuery = () => setQueries([...queries, { query: '', relevant_chunk_ids: '' }]);
  const removeQuery = (i: number) => setQueries(queries.filter((_, idx) => idx !== i));
  const updateQuery = (i: number, field: keyof QueryInput, val: string) => {
    const updated = [...queries];
    updated[i] = { ...updated[i], [field]: val };
    setQueries(updated);
  };

  const handleRun = async () => {
    const validQueries = queries
      .filter(q => q.query.trim() && q.relevant_chunk_ids.trim())
      .map(q => ({
        query: q.query,
        relevant_chunk_ids: q.relevant_chunk_ids.split(',').map(s => s.trim()).filter(Boolean),
      }));

    if (validQueries.length === 0) {
      toast.error('Add at least one query with relevant chunk IDs');
      return;
    }

    const parsedK = kValues.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (parsedK.length === 0) {
      toast.error('Enter valid k values');
      return;
    }

    setRunning(true);
    try {
      const res = await runEvaluation({
        knowledge_base_id: selectedKB,
        queries: validQueries,
        k_values: parsedK,
        search_mode: searchMode,
        vector_weight: vectorWeight,
      });
      setResults(res);
      toast.success('Evaluation complete');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setRunning(false);
    }
  };

  const chartData = results?.aggregate.map(m => ({
    k: `k=${m.k}`,
    'Precision@k': Number((m.precision * 100).toFixed(1)),
    'Recall@k': Number((m.recall * 100).toFixed(1)),
    'MRR': Number((m.mrr * 100).toFixed(1)),
  })) || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <BarChart3 className="w-6 h-6" /> Retrieval Evaluation
      </h1>

      {/* Config */}
      <div className="card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Knowledge Base</label>
            <select className="input-field" value={selectedKB} onChange={e => setSelectedKB(e.target.value)}>
              {kbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Mode</label>
            <select className="input-field" value={searchMode} onChange={e => setSearchMode(e.target.value as SearchMode)}>
              <option value="hybrid">Hybrid</option>
              <option value="vector">Vector</option>
              <option value="keyword">Keyword</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vector Weight</label>
            <input type="number" className="input-field" value={vectorWeight} onChange={e => setVectorWeight(Number(e.target.value))} min={0} max={1} step={0.1} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">K Values (comma-sep)</label>
            <input className="input-field" value={kValues} onChange={e => setKValues(e.target.value)} placeholder="1,3,5,10" />
          </div>
        </div>

        {/* Queries */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Evaluation Queries</label>
            <button onClick={addQuery} className="text-sm text-vault-600 hover:text-vault-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Query
            </button>
          </div>
          <div className="space-y-3">
            {queries.map((q, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    className="input-field text-sm mb-1"
                    value={q.query}
                    onChange={e => updateQuery(i, 'query', e.target.value)}
                    placeholder="Query text..."
                  />
                  <input
                    className="input-field text-sm text-xs"
                    value={q.relevant_chunk_ids}
                    onChange={e => updateQuery(i, 'relevant_chunk_ids', e.target.value)}
                    placeholder="Relevant chunk IDs (comma-separated UUIDs)"
                  />
                </div>
                {queries.length > 1 && (
                  <button onClick={() => removeQuery(i)} className="text-gray-300 hover:text-red-500 mt-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleRun} disabled={running} className="btn-primary flex items-center gap-2">
          <Play className="w-4 h-4" /> {running ? 'Running...' : 'Run Evaluation'}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div>
          {/* Aggregate Charts */}
          <div className="card p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Aggregate Metrics</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend />
                  <Bar dataKey="Precision@k" fill="#4c6ef5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Recall@k" fill="#51cf66" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="MRR" fill="#fcc419" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line chart */}
          <div className="card p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Metrics Over K</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="Precision@k" stroke="#4c6ef5" strokeWidth={2} />
                  <Line type="monotone" dataKey="Recall@k" stroke="#51cf66" strokeWidth={2} />
                  <Line type="monotone" dataKey="MRR" stroke="#fcc419" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-query results table */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Per-Query Results</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-600 font-medium">Query</th>
                    {results.aggregate.map(m => (
                      <th key={m.k} className="text-center py-2 px-2 text-gray-600 font-medium" colSpan={3}>
                        k={m.k}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th></th>
                    {results.aggregate.map(m => (
                      <>
                        <th key={`p${m.k}`} className="text-center py-1 px-1 text-xs text-gray-400">P</th>
                        <th key={`r${m.k}`} className="text-center py-1 px-1 text-xs text-gray-400">R</th>
                        <th key={`m${m.k}`} className="text-center py-1 px-1 text-xs text-gray-400">MRR</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-900 max-w-[200px] truncate">{r.query}</td>
                      {r.metrics.map(m => (
                        <>
                          <td key={`p${m.k}`} className="text-center py-2 px-1 font-mono text-xs">{(m.precision * 100).toFixed(0)}%</td>
                          <td key={`r${m.k}`} className="text-center py-2 px-1 font-mono text-xs">{(m.recall * 100).toFixed(0)}%</td>
                          <td key={`m${m.k}`} className="text-center py-2 px-1 font-mono text-xs">{(m.mrr * 100).toFixed(0)}%</td>
                        </>
                      ))}
                    </tr>
                  ))}
                  {/* Aggregate row */}
                  <tr className="bg-gray-50 font-medium">
                    <td className="py-2 px-3 text-gray-700">Average</td>
                    {results.aggregate.map(m => (
                      <>
                        <td key={`ap${m.k}`} className="text-center py-2 px-1 font-mono text-xs text-vault-700">{(m.precision * 100).toFixed(1)}%</td>
                        <td key={`ar${m.k}`} className="text-center py-2 px-1 font-mono text-xs text-vault-700">{(m.recall * 100).toFixed(1)}%</td>
                        <td key={`am${m.k}`} className="text-center py-2 px-1 font-mono text-xs text-vault-700">{(m.mrr * 100).toFixed(1)}%</td>
                      </>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
