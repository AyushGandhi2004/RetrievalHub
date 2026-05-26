from config.settings import settings


ANSWER_PROMPT = """You are a precise document analyst.
You must follow these rules:
1) Answer the questions using ONLY the provided context sections below.
2) If the context does not contain enough information, reply with exactly:
    Retrieved data is not enough to answer this question.
3) Do not invent citations. Cite page numbers only when they are present in context.

Context:
{context}

Question: {question}

Answer:"""


def estimate_tokens(text: str) -> int:
    # Rough heuristic: 1 token is about 4 characters for English prose.
    return max(1, (len(text) + 3) // 4)


def truncate_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


def build_context(chunks: list[dict], question: str) -> str:
    if not chunks:
        return ""

    prompt_overhead_tokens = estimate_tokens(
        ANSWER_PROMPT.format(context="", question=question)
    )
    remaining_budget = max(0, settings.rag_context_token_budget - prompt_overhead_tokens)

    context_parts: list[str] = []
    used_tokens = 0

    for chunk in chunks:
        text = truncate_text(chunk["text"], settings.rag_chunk_char_budget)
        block = f"[Page {chunk['page_number']}]\n{text}"
        block_tokens = estimate_tokens(block)

        if context_parts and used_tokens + block_tokens > remaining_budget:
            break

        if not context_parts and block_tokens > remaining_budget:
            # Keep at least one chunk by truncating it further to the remaining budget.
            max_chars = max(200, remaining_budget * 4)
            text = truncate_text(chunk["text"], max_chars)
            block = f"[Page {chunk['page_number']}]\n{text}"
            block_tokens = estimate_tokens(block)

        context_parts.append(block)
        used_tokens += block_tokens

        if used_tokens >= remaining_budget:
            break

    return "\n\n---\n\n".join(context_parts)