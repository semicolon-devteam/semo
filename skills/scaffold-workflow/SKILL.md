# scaffold-workflow

> GitHub Actions 워크플로우 생성 Skill

## 개요

CI/CD 워크플로우를 템플릿 기반으로 생성합니다.

## 트리거

- "워크플로우 만들어줘"
- "CI 생성해줘"
- "GitHub Actions 추가"

## 입력 파라미터

| 파라미터 | 필수 | 설명 | 예시 |
|----------|------|------|------|
| service_type | ✅ | 서비스 유형 | `next`, `gradle`, `go`, `node` |
| service_name | ✅ | 서비스 이름 | `cm-land`, `ms-notification` |
| environment | ❌ | 환경 (기본: stg) | `dev`, `stg`, `prod` |

## 실행 절차

### 1. 서비스 유형 확인

```text
next → ci-next-only 템플릿
gradle → ci-gradle 템플릿
go → ci-go 템플릿
node → ci-without-env 템플릿
```

### 2. 기존 워크플로우 참조

```bash
gh api repos/semicolon-devteam/actions-template/contents/.github/workflows \
  --jq '.[].name'
```

### 3. 워크플로우 생성

actions-template 레포에 새 워크플로우 파일 생성

### 4. 검증

```bash
# 문법 확인
act -n -W .github/workflows/{new_workflow}.yml
```

## 출력

```markdown
[SAX] scaffold-workflow: 완료

✅ **워크플로우 생성 완료**

파일: `.github/workflows/ci-{service_name}.yml`

### 다음 단계
1. 시크릿 설정 확인
2. Consumer 레포에서 호출 설정
3. 테스트 빌드 실행
```

## 템플릿

### Next.js CI

```yaml
name: {Service} CI

on:
  workflow_call:
    inputs:
      source_repository:
        required: true
        type: string
      ref:
        required: true
        type: string
      environment:
        required: true
        type: string
    secrets:
      ACTION_TOKEN:
        required: true
      DOCKERHUB_USERNAME:
        required: true
      DOCKERHUB_TOKEN:
        required: true
      # service-specific secrets...
    outputs:
      image_tag:
        value: ${{ jobs.build-and-push.outputs.IMAGE_TAG }}

concurrency:
  group: deploy-${{ inputs.source_repository }}-${{ inputs.ref }}
  cancel-in-progress: true

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    outputs:
      IMAGE_TAG: ${{ steps.set_image_tag.outputs.IMAGE_TAG }}
    environment: ${{ inputs.environment }}

    steps:
      - name: Checkout source
        uses: actions/checkout@v4
        with:
          repository: ${{ github.repository_owner }}/${{ inputs.source_repository }}
          ref: ${{ inputs.ref }}
          token: ${{ secrets.ACTION_TOKEN }}
          path: source

      - name: Checkout template
        uses: actions/checkout@v4
        with:
          repository: ${{ github.repository_owner }}/actions-template
          token: ${{ secrets.ACTION_TOKEN }}
          path: template

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Set image tag
        id: set_image_tag
        run: |
          TAG="${{ inputs.environment }}-$(echo ${{ inputs.ref }} | cut -c1-7)-$(date +%Y%m%d%H%M%S)"
          echo "IMAGE_TAG=$TAG" >> $GITHUB_OUTPUT

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./source
          file: ./template/Dockerfile-next
          push: true
          tags: |
            semicolonmanager/{service}:${{ steps.set_image_tag.outputs.IMAGE_TAG }}
            semicolonmanager/{service}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## 참조

- [ci-architect agent](../../agents/ci-architect/ci-architect.md)
- [workflow-templates.md](../../agents/ci-architect/references/workflow-templates.md)
