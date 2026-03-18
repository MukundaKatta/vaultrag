'use client';

import { useState } from 'react';
import { previewChunks } from '@/lib/api';
import type { ChunkPreview, ChunkingStrategy } from '@/lib/types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { Scissors, Eye, Layers } from 'lucide-react';

const SAMPLE_TEXT = `Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It focuses on the development of computer programs that can access data and use it to learn for themselves.

The process of learning begins with observations or data, such as examples, direct experience, or instruction, in order to look for patterns in data and make better decisions in the future based on the examples that we provide.

There are several types of machine learning algorithms:

Supervised Learning: The algorithm learns from labeled training data, and makes predictions based on that data. Common algorithms include linear regression, decision trees, and neural networks.

Unsupervised Learning: The algorithm learns from unlabeled data and must find patterns and relationships in the data on its own. Clustering and dimensionality reduction are common techniques.

Reinforcement Learning: The algorithm learns by interacting with an environment, receiving rewards or penalties for actions taken. This approach is commonly used in robotics and game playing.

Deep learning is a subset of machine learning that uses neural networks with many layers. These deep neural networks are capable of learning complex patterns in large amounts of data. They have been particularly successful in image recognition, natural language processing, and speech recognition tasks.`;

const strategies: { id: ChunkingStrategy; label: string; desc: string }[] = [
  { id: 'fixed', label: 'Fixed-size', desc: 'Split by token count with overlap' },
  { id: 'sentence', label: 'Sentence', desc: 'Group sentences up to token limit' },
  { id: 'semantic', label: 'Semantic', desc: 'Split on paragraph boundaries' },
  { id: 'recursive', label: 'Recursive', desc: 'Hierarchical splitting by separators' },
];

export default function ChunkingPreviewPage() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [strategy, setStrategy] = useState<ChunkingStrategy>('recursive');
  const [chunkSize, setChunkSize] = useState(128);
  const [chunkOverlap, setChunkOverlap] = useState(20);
  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [avgTokens, setAvgTokens] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);

  const handlePreview = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await previewChunks({
        text,
        config: {
          strategy,
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap,
        },
      });
      setChunks(res.chunks);
      setTotalChunks(res.total_chunks);
      setAvgTokens(res.avg_tokens);
      setSelectedChunk(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Scissors className="w-6 h-6" /> Chunking Preview
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div>
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Input Text</h2>
            <textarea
              className="input-field font-mono text-sm"
              rows={12}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste text to preview chunking..."
            />

            <div className="mt-4 space-y-3">
              {/* Strategy selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strategy</label>
                <div className="grid grid-cols-2 gap-2">
                  {strategies.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStrategy(s.id)}
                      className={clsx(
                        'p-3 rounded-lg border text-left transition-colors',
                        strategy === s.id
                          ? 'border-vault-500 bg-vault-50 text-vault-700'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="font-medium text-sm">{s.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chunk Size (tokens)</label>
                  <input type="number" className="input-field" value={chunkSize} onChange={e => setChunkSize(Number(e.target.value))} min={10} max={4000} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Overlap (tokens)</label>
                  <input type="number" className="input-field" value={chunkOverlap} onChange={e => setChunkOverlap(Number(e.target.value))} min={0} max={500} />
                </div>
              </div>

              <button onClick={handlePreview} disabled={loading || !text.trim()} className="btn-primary w-full flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" /> {loading ? 'Processing...' : 'Preview Chunks'}
              </button>
            </div>
          </div>
        </div>

        {/* Output */}
        <div>
          {chunks.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Layers className="w-5 h-5" /> Chunks
                </h2>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>{totalChunks} chunks</span>
                  <span>avg {avgTokens} tokens</span>
                </div>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {chunks.map((chunk) => (
                  <button
                    key={chunk.index}
                    onClick={() => setSelectedChunk(selectedChunk === chunk.index ? null : chunk.index)}
                    className={clsx(
                      'w-full text-left rounded-lg border p-3 transition-colors',
                      selectedChunk === chunk.index
                        ? 'border-vault-500 bg-vault-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-500">Chunk #{chunk.index + 1}</span>
                      <div className="flex gap-2 text-xs text-gray-400">
                        <span>{chunk.token_count} tokens</span>
                        <span>{chunk.char_count} chars</span>
                      </div>
                    </div>
                    <p className={clsx(
                      'text-sm text-gray-700',
                      selectedChunk === chunk.index ? '' : 'line-clamp-3'
                    )}>
                      {chunk.text}
                    </p>
                  </button>
                ))}
              </div>

              {/* Token distribution visualization */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-500 mb-2">Token Distribution</div>
                <div className="flex gap-1 items-end h-16">
                  {chunks.map((chunk) => {
                    const maxTokens = Math.max(...chunks.map(c => c.token_count));
                    const height = maxTokens > 0 ? (chunk.token_count / maxTokens) * 100 : 0;
                    return (
                      <div
                        key={chunk.index}
                        className={clsx(
                          'flex-1 rounded-t transition-colors cursor-pointer min-w-[4px]',
                          selectedChunk === chunk.index ? 'bg-vault-500' : 'bg-vault-200 hover:bg-vault-300'
                        )}
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`Chunk #${chunk.index + 1}: ${chunk.token_count} tokens`}
                        onClick={() => setSelectedChunk(selectedChunk === chunk.index ? null : chunk.index)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {chunks.length === 0 && !loading && (
            <div className="card p-12 text-center text-gray-400">
              <Scissors className="w-10 h-10 mx-auto mb-3" />
              <p>Configure settings and click "Preview Chunks" to see how your text will be split.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
