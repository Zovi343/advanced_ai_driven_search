from collections import defaultdict

from qdrant_client.http.models.models import QueryResponse
from gensim.parsing.preprocessing import STOPWORDS

import numpy as np

# Metadata-aware vector encoding
# Adapted from the reference implementation https://github.com/superlinked/superlinked

def encode_rating(rating, min_value=1, max_value=5):
    normalized = (rating - min_value) / (max_value - min_value)
    angle = normalized * (np.pi / 2)
    return np.array([np.sin(angle), np.cos(angle), 0.0])

def rating_query_vector():
    return np.array([1.0, 0.0, 1.0])

def build_query_vector(query_text_vec, rating_weight=0.5):
    return np.concatenate([query_text_vec, rating_query_vector() * rating_weight])

def build_doc_vector(text_vec, rating, rating_weight=0.5):
    return np.concatenate([text_vec, encode_rating(rating) * rating_weight])


def display_retrieval_result(retrieval_results: QueryResponse):
    print(f"{'SCORE':<8} {'RATING':<7} TEXT")
    print("-" * 65)
    for result in retrieval_results.points:
        rating = result.payload.get("rating", "-")
        print(f"{result.score:<8.3f} {str(rating):<7} {result.payload['text'][:50]}...")


# Wormhole-vector keyword helpers.
# Adapted from the reference implementation https://github.com/dimakan-dev/wormhole-vectors/blob/main/wormhole_vectors.py

def tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, drop gensim stopwords and short tokens."""
    tokens = (t.strip(".,!?;:()[]{}\"'") for t in text.lower().split())
    return [t for t in tokens if t not in STOPWORDS and len(t) > 2]


def build_background_df(documents) -> tuple[dict[str, int], int]:
    """Document-frequency of each term over the whole corpus (the background)."""
    background_df: dict[str, int] = defaultdict(int)
    for doc in documents:
        for term in set(tokenize(doc["text"])):
            background_df[term] += 1
    return background_df, len(documents)


def significant_terms(
    foreground_texts, background_df, background_total, keyword_size=10, min_fg_count=2
):
    """Replicate OpenSearch `significant_terms` with a JLH-style measure.

    Compares each term's probability in the foreground set vs. the background
    corpus; terms over-represented in the foreground score highest.
    """
    fg_df: dict[str, int] = defaultdict(int)
    for text in foreground_texts:
        for term in set(tokenize(text)):
            fg_df[term] += 1
    fg_total = max(len(foreground_texts), 1)
    out = []
    for term, fg in fg_df.items():
        if fg < min_fg_count:
            continue
        bg = background_df.get(term, fg)
        p_fg, p_bg = fg / fg_total, bg / background_total
        score = (p_fg - p_bg) * (p_fg / p_bg)
        out.append(
            {
                "term": term,
                "score": score,
                "foreground_count": fg,
                "background_count": bg,
            }
        )
    out.sort(key=lambda x: x["score"], reverse=True)
    return out[:keyword_size]


def positional_weights(foreground_texts, top_n=5):
    """Weight terms by the rank of the document they appear in (1/sqrt(rank))."""
    weights: dict[str, float] = defaultdict(float)
    for rank, text in enumerate(foreground_texts[:top_n], 1):
        w = 1.0 / (rank ** 0.5)
        for term in tokenize(text):
            weights[term] += w
    return dict(weights)


def combine_keyword_scores(stat_kw, pos_w, stat_weight=0.4, pos_weight=0.6):
    """Blend normalized statistical significance and positional importance."""
    norm_pos = {}
    if pos_w:
        mx = max(pos_w.values())
        norm_pos = {k: v / mx for k, v in pos_w.items()} if mx > 0 else {}
    norm_stat = {}
    if stat_kw:
        scores = [k["score"] for k in stat_kw]
        lo, hi = min(scores), max(scores)
        rng = hi - lo if hi > lo else 1.0
        norm_stat = {k["term"]: (k["score"] - lo) / rng for k in stat_kw}
    combined = {}
    for k in stat_kw:
        t = k["term"]
        combined[t] = {
            "term": t,
            "statistical_score": k["score"],
            "positional_score": norm_pos.get(t, 0.0),
            "combined_score": stat_weight * norm_stat.get(t, 0.0)
            + pos_weight * norm_pos.get(t, 0.0),
            "foreground_count": k["foreground_count"],
            "background_count": k["background_count"],
        }
    # Inject strong positional-only terms that were not statistically significant.
    for t, ps in norm_pos.items():
        if t not in combined and ps > 0.3:
            combined[t] = {
                "term": t,
                "statistical_score": 0.0,
                "positional_score": ps,
                "combined_score": pos_weight * ps,
                "foreground_count": 0,
                "background_count": 0,
            }
    return sorted(combined.values(), key=lambda x: x["combined_score"], reverse=True)
