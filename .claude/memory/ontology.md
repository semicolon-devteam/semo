# Ontology

> 자동 생성: semo context sync (2026-03-20T09:00:34.890Z)


## bot:designclaw (v1)

DesignClaw (UI/UX 디자인) 도메인 경계 및 역할

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "컴포넌트/디자인 토큰 식별자"
    },
    "content": {
      "type": "string",
      "description": "UI 스펙, 컬러/타이포/간격 토큰, 접근성 기준"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "ui-component",
            "design-token",
            "accessibility",
            "publishing"
          ]
        },
        "bot_id": {
          "enum": [
            "designclaw"
          ]
        }
      }
    }
  }
}
```


## bot:growthclaw (v1)

GrowthClaw (그로스/마케팅) 도메인 경계 및 역할

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "마케팅/성장 전략 식별자"
    },
    "content": {
      "type": "string",
      "description": "SEO 전략, 마케팅 계획, 성장 지표"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "seo",
            "marketing",
            "growth-hack",
            "analytics",
            "content"
          ]
        },
        "bot_id": {
          "enum": [
            "growthclaw"
          ]
        }
      }
    }
  }
}
```


## bot:infraclaw (v1)

InfraClaw (인프라/CI/CD) 도메인 경계 및 역할

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "인프라 리소스/파이프라인 식별자"
    },
    "content": {
      "type": "string",
      "description": "서버 설정, CI/CD 파이프라인, 배포 절차"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "server",
            "cicd",
            "database",
            "deployment",
            "monitoring"
          ]
        },
        "bot_id": {
          "enum": [
            "infraclaw"
          ]
        }
      }
    }
  }
}
```


## bot:planclaw (v1)

PlanClaw (기획/스펙) 도메인 경계 및 역할

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "기능/스펙 식별자"
    },
    "content": {
      "type": "string",
      "description": "PRD, 스펙 문서, AC 정의"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "prd",
            "spec",
            "ac-definition",
            "user-story"
          ]
        },
        "bot_id": {
          "enum": [
            "planclaw"
          ]
        }
      }
    }
  }
}
```


## bot:reviewclaw (v1)

ReviewClaw (QA/코드리뷰) 도메인 경계 및 역할

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "리뷰 기준/정책 식별자"
    },
    "content": {
      "type": "string",
      "description": "AC 검증 기준, 리뷰 판정 로직"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "code-review",
            "ac-validation",
            "qa",
            "e2e"
          ]
        },
        "bot_id": {
          "enum": [
            "reviewclaw"
          ]
        }
      }
    }
  }
}
```


## bot:semiclaw (v1)

SemiClaw (PM/오케스트레이터) 도메인 경계 및 역할

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "역할/정책 식별자"
    },
    "content": {
      "type": "string",
      "description": "역할 설명, 정책, 판단 기준"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "orchestration",
            "delegation",
            "escalation",
            "monitoring"
          ]
        },
        "bot_id": {
          "enum": [
            "semiclaw"
          ]
        }
      }
    }
  }
}
```


## bot:workclaw (v1)

WorkClaw (구현 전담) 도메인 경계 및 역할

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "기능/작업 식별자"
    },
    "content": {
      "type": "string",
      "description": "구현 스펙, 기술 결정, 코드 패턴"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "implementation",
            "bugfix",
            "refactor",
            "test"
          ]
        },
        "bot_id": {
          "enum": [
            "workclaw"
          ]
        }
      }
    }
  }
}
```


## decision (v1)

의사결정 기록

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "결정 제목"
    },
    "content": {
      "type": "string",
      "description": "결정 내용, 배경, 근거"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "team",
            "project",
            "bot",
            "infra"
          ]
        },
        "decided_at": {
          "type": "string",
          "format": "date"
        },
        "decided_by": {
          "type": "string"
        }
      }
    }
  }
}
```


## infra (v1)

인프라 구성, 서버, DB, CI/CD

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "인프라 리소스명"
    },
    "content": {
      "type": "string",
      "description": "설정, 접근 방법, 구조"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "type": {
          "enum": [
            "server",
            "database",
            "service",
            "ci-cd",
            "monitoring"
          ]
        },
        "environment": {
          "enum": [
            "production",
            "staging",
            "development"
          ]
        }
      }
    }
  }
}
```


## kpi (v1)

KPI 목표·측정값·인사이트 요약 (primary bot: growthclaw)

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "{project_id}-kpi-summary 또는 {project_id}-insight-{YYYY-WW}"
    },
    "content": {
      "type": "string",
      "description": "KPI 현황 요약 마크다운 또는 주간 인사이트"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "scope": {
          "enum": [
            "performance",
            "target",
            "measurement",
            "insight"
          ]
        },
        "project_id": {
          "type": "string"
        },
        "primary_bot": {
          "enum": [
            "growthclaw"
          ],
          "type": "string"
        }
      }
    }
  }
}
```


## process (v1)

업무 프로세스, 규칙, 가이드라인

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "프로세스명"
    },
    "content": {
      "type": "string",
      "description": "프로세스 설명, 단계"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "type": {
          "enum": [
            "workflow",
            "rule",
            "guideline",
            "checklist"
          ]
        },
        "applies_to": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    }
  }
}
```


## project (v1)

프로젝트 정보, 현황, 기술 스택

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "프로젝트명"
    },
    "content": {
      "type": "string",
      "description": "프로젝트 설명, 현황"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "owner": {
          "type": "string"
        },
        "stack": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "status": {
          "enum": [
            "active",
            "paused",
            "completed",
            "planned"
          ]
        }
      }
    }
  }
}
```


## session-log (v1)

봇 일일 세션 로그. ## 섹션 단위로 청킹하여 저장. 시맨틱 검색으로 봇 간 과거 활동 조회.

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "Format: {bot_id}/{YYYY-MM-DD}/chunk-{N}"
    },
    "content": {
      "type": "string",
      "description": "세션 로그 청크 (마크다운)"
    },
    "metadata": {
      "type": "object",
      "required": [
        "bot_id",
        "date"
      ],
      "properties": {
        "date": {
          "type": "string",
          "format": "date"
        },
        "bot_id": {
          "type": "string"
        },
        "topics": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "chunk_index": {
          "type": "integer",
          "minimum": 0
        },
        "total_chunks": {
          "type": "integer",
          "minimum": 1
        }
      }
    }
  }
}
```


## team (v1)

팀원 정보, R&R, 스킬셋

```json
{
  "type": "object",
  "required": [
    "key",
    "content"
  ],
  "properties": {
    "key": {
      "type": "string",
      "description": "팀원 이름 또는 역할"
    },
    "content": {
      "type": "string",
      "description": "역할, 스킬, 연락처 등"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "role": {
          "type": "string"
        },
        "skills": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    }
  }
}
```
