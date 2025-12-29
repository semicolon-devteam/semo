#!/usr/bin/env python3
"""
SEMO Self-Learning RAG - PR 피드백 인덱서

GitHub PR 코멘트를 수집하여 Qdrant 벡터 DB에 인덱싱합니다.
이 데이터는 Few-shot 학습에 사용됩니다.
"""

import os
import json
import hashlib
from datetime import datetime
from typing import Optional

import requests
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
)

# 환경변수
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "semo-feedback")

# GitHub 조직/레포 목록
REPOS = [
    "semicolon-devteam/semo",
]

# 벡터 차원 (Claude Embedding 대신 간단한 해시 기반)
VECTOR_DIM = 384


def get_embedding(text: str) -> list[float]:
    """
    텍스트 임베딩 생성

    TODO: 실제 운영에서는 Anthropic Embedding API 또는 OpenAI ada-002 사용
    현재는 간단한 해시 기반 벡터 생성
    """
    # 간단한 해시 기반 임베딩 (데모용)
    hash_bytes = hashlib.sha384(text.encode()).digest()
    vector = [float(b) / 255.0 for b in hash_bytes]
    return vector


def classify_feedback(comment_body: str) -> dict:
    """
    피드백 분류 (LLM 기반)

    카테고리:
    - code-quality: 코드 품질 (가독성, 네이밍, 구조)
    - security: 보안 이슈
    - performance: 성능 최적화
    - testing: 테스트 관련
    - documentation: 문서화
    - style: 코드 스타일
    """
    # TODO: 실제 운영에서는 Claude API 호출
    # 현재는 키워드 기반 분류

    body_lower = comment_body.lower()

    if any(kw in body_lower for kw in ["sql injection", "xss", "csrf", "secret", "password"]):
        return {"category": "security", "severity": "HIGH"}

    if any(kw in body_lower for kw in ["performance", "slow", "optimize", "n+1", "cache"]):
        return {"category": "performance", "severity": "MEDIUM"}

    if any(kw in body_lower for kw in ["test", "coverage", "mock", "assert"]):
        return {"category": "testing", "severity": "MEDIUM"}

    if any(kw in body_lower for kw in ["doc", "comment", "readme", "jsdoc"]):
        return {"category": "documentation", "severity": "LOW"}

    if any(kw in body_lower for kw in ["naming", "variable", "function name", "readable"]):
        return {"category": "code-quality", "severity": "LOW"}

    return {"category": "style", "severity": "LOW"}


def fetch_pr_comments(repo: str, since_days: int = 30) -> list[dict]:
    """
    GitHub PR 코멘트 수집
    """
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }

    # 최근 PR 목록 조회
    url = f"https://api.github.com/repos/{repo}/pulls"
    params = {"state": "all", "per_page": 50, "sort": "updated", "direction": "desc"}

    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        prs = response.json()
    except Exception as e:
        print(f"[ERROR] Failed to fetch PRs from {repo}: {e}")
        return []

    comments = []

    for pr in prs:
        pr_number = pr["number"]
        pr_title = pr["title"]

        # PR 리뷰 코멘트 조회
        review_url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}/comments"

        try:
            review_response = requests.get(review_url, headers=headers, timeout=30)
            review_response.raise_for_status()
            pr_comments = review_response.json()

            for comment in pr_comments:
                comments.append({
                    "id": comment["id"],
                    "repo": repo,
                    "pr_number": pr_number,
                    "pr_title": pr_title,
                    "body": comment["body"],
                    "path": comment.get("path", ""),
                    "diff_hunk": comment.get("diff_hunk", ""),
                    "user": comment["user"]["login"],
                    "created_at": comment["created_at"],
                    "url": comment["html_url"],
                })
        except Exception as e:
            print(f"[WARN] Failed to fetch comments for PR #{pr_number}: {e}")
            continue

    return comments


def index_to_qdrant(client: QdrantClient, comments: list[dict]):
    """
    Qdrant에 피드백 인덱싱
    """
    points = []

    for comment in comments:
        # 피드백 분류
        classification = classify_feedback(comment["body"])

        # 임베딩 생성 (본문 + 코드 컨텍스트)
        text = f"{comment['body']}\n\nCode context:\n{comment['diff_hunk']}"
        vector = get_embedding(text)

        # 포인트 생성
        point = PointStruct(
            id=comment["id"],
            vector=vector,
            payload={
                "repo": comment["repo"],
                "pr_number": comment["pr_number"],
                "pr_title": comment["pr_title"],
                "body": comment["body"],
                "path": comment["path"],
                "diff_hunk": comment["diff_hunk"],
                "user": comment["user"],
                "created_at": comment["created_at"],
                "url": comment["url"],
                "category": classification["category"],
                "severity": classification["severity"],
                "indexed_at": datetime.utcnow().isoformat(),
            },
        )
        points.append(point)

    # 배치 업서트
    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        print(f"[INFO] Indexed {len(points)} feedback points")


def main():
    print("[INFO] SEMO Self-Learning RAG Indexer starting...")

    # Qdrant 클라이언트 초기화
    client = QdrantClient(url=QDRANT_URL)

    # 컬렉션 생성 (없으면)
    collections = client.get_collections().collections
    collection_names = [c.name for c in collections]

    if COLLECTION_NAME not in collection_names:
        print(f"[INFO] Creating collection: {COLLECTION_NAME}")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )

    # 각 레포에서 피드백 수집 및 인덱싱
    total_indexed = 0

    for repo in REPOS:
        print(f"[INFO] Fetching comments from {repo}...")
        comments = fetch_pr_comments(repo)

        if comments:
            index_to_qdrant(client, comments)
            total_indexed += len(comments)

    print(f"[SUCCESS] Total indexed: {total_indexed} feedback points")


if __name__ == "__main__":
    main()
