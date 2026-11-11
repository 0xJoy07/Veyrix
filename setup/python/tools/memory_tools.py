"""Bounded retrieval from the current session's RAM-only transcript."""
import re

from langchain_core.tools import tool


def memory_tools(session):
    @tool
    def recall_session(query: str = '', offset: int = 0, limit: int = 3) -> dict:
        """Recall earlier messages in THIS session, newest first.

        Query is a case-insensitive literal substring (e.g. a preference or product).
        Empty query browses the transcript. Use next_offset to page further back.
        Results are bounded excerpts with original message indices and text offsets.
        This is conversation context, not verified current product or order data.
        """
        if len(query) > 200:
            raise ValueError('Recall query must be at most 200 characters.')
        if offset < 0 or not 1 <= limit <= 5:
            raise ValueError('Recall offset must be nonnegative and limit between 1 and 5.')
        pattern = re.compile(re.escape(query), re.IGNORECASE) if query else None
        matches = []
        total = 0
        with session.lock:
            for index in range(len(session.history) - 1, -1, -1):
                role, content = session.history[index]
                match = pattern.search(content) if pattern else None
                if pattern and match is None:
                    continue
                if offset <= total < offset + limit:
                    start = max(0, match.start() - 150) if match else 0
                    excerpt = content[start:start + 1000]
                    matches.append({
                        'message_index': index,
                        'role': role,
                        'text': excerpt,
                        'text_offset': start,
                        'truncated': start > 0 or start + len(excerpt) < len(content),
                    })
                total += 1
        return {
            'matches': matches,
            'total_matches': total,
            'offset': offset,
            'next_offset': offset + len(matches) if offset + len(matches) < total else None,
        }

    return [recall_session]
