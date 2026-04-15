from qdrant_client.http.models.models import QueryResponse

import numpy as np

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