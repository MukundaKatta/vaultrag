from __future__ import annotations
from app.services.search import search_chunks
from app.models.schemas import EvalRequest, EvalResponse, EvalResult, EvalMetric


async def evaluate_retrieval(request: EvalRequest, embedding_model: str) -> EvalResponse:
    all_results: list[EvalResult] = []
    aggregate_metrics: dict[int, list[dict]] = {k: [] for k in request.k_values}

    for eval_query in request.queries:
        max_k = max(request.k_values)
        retrieved = await search_chunks(
            query=eval_query.query,
            knowledge_base_id=request.knowledge_base_id,
            embedding_model=embedding_model,
            mode=request.search_mode,
            vector_weight=request.vector_weight,
            top_k=max_k,
        )

        retrieved_ids = [r.get("id", "") for r in retrieved]
        relevant_set = set(eval_query.relevant_chunk_ids)

        metrics: list[EvalMetric] = []
        for k in request.k_values:
            top_k_ids = retrieved_ids[:k]
            top_k_set = set(top_k_ids)

            # Precision@k
            relevant_in_top_k = len(top_k_set & relevant_set)
            precision = relevant_in_top_k / k if k > 0 else 0.0

            # Recall@k
            recall = relevant_in_top_k / len(relevant_set) if relevant_set else 0.0

            # MRR (reciprocal rank of first relevant result)
            mrr = 0.0
            for i, rid in enumerate(top_k_ids):
                if rid in relevant_set:
                    mrr = 1.0 / (i + 1)
                    break

            metric = EvalMetric(k=k, precision=round(precision, 4), recall=round(recall, 4), mrr=round(mrr, 4))
            metrics.append(metric)
            aggregate_metrics[k].append({"precision": precision, "recall": recall, "mrr": mrr})

        all_results.append(EvalResult(query=eval_query.query, metrics=metrics))

    # Compute aggregates
    aggregate: list[EvalMetric] = []
    for k in request.k_values:
        entries = aggregate_metrics[k]
        n = len(entries) or 1
        avg_p = sum(e["precision"] for e in entries) / n
        avg_r = sum(e["recall"] for e in entries) / n
        avg_mrr = sum(e["mrr"] for e in entries) / n
        aggregate.append(EvalMetric(k=k, precision=round(avg_p, 4), recall=round(avg_r, 4), mrr=round(avg_mrr, 4)))

    return EvalResponse(results=all_results, aggregate=aggregate)
