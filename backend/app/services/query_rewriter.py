from __future__ import annotations
import openai
from app.core.config import get_settings


async def rewrite_query(query: str) -> str:
    settings = get_settings()
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.0,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a query rewriter for a RAG system. Your job is to take a user's "
                    "natural language question and rewrite it into an optimized search query. "
                    "Expand abbreviations, add synonyms, and rephrase for better retrieval. "
                    "Output ONLY the rewritten query, nothing else. Keep it concise (under 100 words)."
                ),
            },
            {"role": "user", "content": query},
        ],
        max_tokens=200,
    )

    rewritten = response.choices[0].message.content
    if not rewritten or not rewritten.strip():
        return query
    return rewritten.strip()
