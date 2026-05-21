"""
STT 후처리 보정 모듈.

두 단계:
1. 직접 치환 (`replacements: dict[str, str]`) — 이미 알려진 오인식 매핑 (예: "스페이스실" → "Space CL")
2. 퍼지 매칭 (`fuzzy_entities: list[str]`) — KB 엔티티 사전 기준으로 비슷한 토큰을 정정

대화 맥락(서비스명/멤버/브랜드) 은 호출자(스킬 LLM) 가 KB 조회로 빌드해서 넘긴다.
"""

from __future__ import annotations

from difflib import SequenceMatcher
from typing import Iterable


def apply_dict_corrections(
    text: str,
    replacements: dict[str, str],
) -> tuple[str, list[dict]]:
    """알려진 오인식 매핑을 직접 치환. 대소문자/공백 그대로 매칭."""
    corrected = text
    log: list[dict] = []
    for wrong, right in replacements.items():
        if wrong and wrong in corrected:
            count = corrected.count(wrong)
            corrected = corrected.replace(wrong, right)
            log.append({
                "type": "dict",
                "original": wrong,
                "corrected": right,
                "count": count,
            })
    return corrected, log


def fuzzy_correct(
    text: str,
    entities: Iterable[str],
    threshold: float = 0.75,
    min_token_len: int = 3,
    max_len_diff: int = 3,
) -> tuple[str, list[dict]]:
    """
    공백 단위 토큰을 엔티티 사전과 비교, 유사도 threshold 이상이고 완전일치가 아니면
    엔티티로 치환.

    규칙 (보수적):
    - multi-word entity (공백 포함) 는 fuzzy 매칭 대상에서 제외. 그런 entity 는
      dict 치환으로만 들어와야 하고, 한 번 들어오면 토큰이 쪼개져서 substring 매칭이 어렵다.
    - token 안에 entity 가 substring 으로 이미 포함되어 있으면 매칭 스킵
      (예: "FTX라는" 안에 "FTX" → 한글 조사 보존 위해 그대로 둠).
    - 짧은 토큰 / 길이 차 큰 entity 는 스킵.
    """
    entity_list = [e for e in entities if e]
    single_word_entities = [e for e in entity_list if " " not in e]
    if not single_word_entities:
        return text, []
    entity_set = set(entity_list)

    tokens = text.split()
    out: list[str] = []
    log: list[dict] = []

    for tok in tokens:
        # 구두점 제거한 코어 토큰으로 매칭, 원본의 trailing 구두점은 살림
        core, trailing = _split_trailing_punct(tok)
        if len(core) < min_token_len or core in entity_set:
            out.append(tok)
            continue
        # core 안에 entity 가 substring 으로 정확히 포함되어 있으면 보존
        # (예: "FTX라는" 안에 "FTX" — 조사가 따라붙은 케이스. 이미 entity 가 들어있으므로 보정 불필요)
        if any(e in core for e in entity_list):
            out.append(tok)
            continue

        best_score = 0.0
        best_entity: str | None = None
        for e in single_word_entities:
            if abs(len(e) - len(core)) > max_len_diff:
                continue
            score = SequenceMatcher(None, core, e).ratio()
            if score > best_score:
                best_score = score
                best_entity = e

        if best_entity and threshold <= best_score < 1.0:
            out.append(best_entity + trailing)
            log.append({
                "type": "fuzzy",
                "original": core,
                "corrected": best_entity,
                "score": round(best_score, 3),
            })
        else:
            out.append(tok)

    return " ".join(out), log


def _split_trailing_punct(tok: str) -> tuple[str, str]:
    """토큰의 후행 구두점 (예: '스페이스실,' → ('스페이스실', ',')) 분리."""
    i = len(tok)
    while i > 0 and not tok[i - 1].isalnum() and ord(tok[i - 1]) < 0xAC00:
        i -= 1
    return tok[:i], tok[i:]


def correct_utterances(
    utterances: list[dict],
    replacements: dict[str, str] | None = None,
    fuzzy_entities: list[str] | None = None,
    fuzzy_threshold: float = 0.75,
) -> tuple[list[dict], list[dict]]:
    """
    utterances 배열 전체 보정.

    각 utterance 의 `msg` 를 두 단계로 보정. 원본 텍스트는 `msg_original` 에 보관
    (보정이 일어난 경우에만 — 그대로면 None).
    """
    replacements = replacements or {}
    fuzzy_entities = fuzzy_entities or []
    full_log: list[dict] = []
    out: list[dict] = []

    for idx, u in enumerate(utterances):
        orig = u.get("msg", "")
        msg = orig
        utt_log: list[dict] = []

        if replacements:
            msg, dict_log = apply_dict_corrections(msg, replacements)
            for entry in dict_log:
                entry["utterance_idx"] = idx
            utt_log.extend(dict_log)

        if fuzzy_entities:
            msg, fuzzy_log = fuzzy_correct(msg, fuzzy_entities, threshold=fuzzy_threshold)
            for entry in fuzzy_log:
                entry["utterance_idx"] = idx
            utt_log.extend(fuzzy_log)

        new_u = dict(u)
        new_u["msg_original"] = orig if utt_log and msg != orig else None
        new_u["msg"] = msg
        out.append(new_u)
        full_log.extend(utt_log)

    return out, full_log
