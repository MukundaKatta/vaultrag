from __future__ import annotations
import re
import tiktoken
from app.models.schemas import ChunkingConfig, ChunkPreview

_enc = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_enc.encode(text))


def chunk_text(text: str, config: ChunkingConfig) -> list[str]:
    if config.strategy == "fixed":
        return _chunk_fixed(text, config.chunk_size, config.chunk_overlap)
    elif config.strategy == "sentence":
        return _chunk_sentence(text, config.chunk_size, config.chunk_overlap)
    elif config.strategy == "semantic":
        return _chunk_semantic(text, config.chunk_size, config.chunk_overlap)
    elif config.strategy == "recursive":
        return _chunk_recursive(text, config.chunk_size, config.chunk_overlap)
    else:
        raise ValueError(f"Unknown strategy: {config.strategy}")


def preview_chunks(text: str, config: ChunkingConfig) -> list[ChunkPreview]:
    raw_chunks = chunk_text(text, config)
    previews = []
    for i, chunk in enumerate(raw_chunks):
        previews.append(
            ChunkPreview(
                index=i,
                text=chunk,
                token_count=count_tokens(chunk),
                char_count=len(chunk),
            )
        )
    return previews


def _chunk_fixed(text: str, chunk_size: int, overlap: int) -> list[str]:
    tokens = _enc.encode(text)
    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = start + chunk_size
        chunk_tokens = tokens[start:end]
        chunk_text_decoded = _enc.decode(chunk_tokens)
        if chunk_text_decoded.strip():
            chunks.append(chunk_text_decoded.strip())
        start = end - overlap
        if start >= len(tokens):
            break
        if end >= len(tokens):
            break
    return chunks


def _split_sentences(text: str) -> list[str]:
    sentence_endings = re.compile(r'(?<=[.!?])\s+')
    sentences = sentence_endings.split(text)
    return [s.strip() for s in sentences if s.strip()]


def _chunk_sentence(text: str, chunk_size: int, overlap: int) -> list[str]:
    sentences = _split_sentences(text)
    if not sentences:
        return [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current_sentences: list[str] = []
    current_tokens = 0

    for sentence in sentences:
        sent_tokens = count_tokens(sentence)
        if current_tokens + sent_tokens > chunk_size and current_sentences:
            chunks.append(" ".join(current_sentences))
            # Overlap: keep last N tokens worth of sentences
            overlap_sentences: list[str] = []
            overlap_tokens = 0
            for s in reversed(current_sentences):
                st = count_tokens(s)
                if overlap_tokens + st > overlap:
                    break
                overlap_sentences.insert(0, s)
                overlap_tokens += st
            current_sentences = overlap_sentences
            current_tokens = overlap_tokens

        current_sentences.append(sentence)
        current_tokens += sent_tokens

    if current_sentences:
        final = " ".join(current_sentences)
        if not chunks or final != chunks[-1]:
            chunks.append(final)

    return chunks


def _chunk_semantic(text: str, chunk_size: int, overlap: int) -> list[str]:
    paragraphs = re.split(r'\n\s*\n', text)
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    if not paragraphs:
        return [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current_group: list[str] = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = count_tokens(para)

        if para_tokens > chunk_size:
            if current_group:
                chunks.append("\n\n".join(current_group))
                current_group = []
                current_tokens = 0
            sub_chunks = _chunk_sentence(para, chunk_size, overlap)
            chunks.extend(sub_chunks)
            continue

        if current_tokens + para_tokens > chunk_size and current_group:
            chunks.append("\n\n".join(current_group))
            # Overlap: keep last paragraph if it fits
            if overlap > 0 and current_group:
                last = current_group[-1]
                lt = count_tokens(last)
                if lt <= overlap:
                    current_group = [last]
                    current_tokens = lt
                else:
                    current_group = []
                    current_tokens = 0
            else:
                current_group = []
                current_tokens = 0

        current_group.append(para)
        current_tokens += para_tokens

    if current_group:
        final = "\n\n".join(current_group)
        if not chunks or final != chunks[-1]:
            chunks.append(final)

    return chunks


def _chunk_recursive(
    text: str, chunk_size: int, overlap: int, separators: list[str] | None = None
) -> list[str]:
    if separators is None:
        separators = ["\n\n", "\n", ". ", " ", ""]

    if not text.strip():
        return []

    if count_tokens(text) <= chunk_size:
        return [text.strip()]

    sep = separators[0]
    remaining_seps = separators[1:] if len(separators) > 1 else [""]

    if sep == "":
        return _chunk_fixed(text, chunk_size, overlap)

    splits = text.split(sep)
    splits = [s for s in splits if s.strip()]

    chunks: list[str] = []
    current_parts: list[str] = []
    current_tokens = 0

    for part in splits:
        part_tokens = count_tokens(part)

        if part_tokens > chunk_size:
            if current_parts:
                chunks.append(sep.join(current_parts).strip())
                current_parts = []
                current_tokens = 0
            sub_chunks = _chunk_recursive(part, chunk_size, overlap, remaining_seps)
            chunks.extend(sub_chunks)
            continue

        if current_tokens + part_tokens > chunk_size and current_parts:
            chunks.append(sep.join(current_parts).strip())
            # Overlap
            overlap_parts: list[str] = []
            overlap_tok = 0
            for p in reversed(current_parts):
                pt = count_tokens(p)
                if overlap_tok + pt > overlap:
                    break
                overlap_parts.insert(0, p)
                overlap_tok += pt
            current_parts = overlap_parts
            current_tokens = overlap_tok

        current_parts.append(part)
        current_tokens += part_tokens

    if current_parts:
        final = sep.join(current_parts).strip()
        if final and (not chunks or final != chunks[-1]):
            chunks.append(final)

    return chunks
