# Workflow Templates

## Next.js CI (Reusable)

```yaml
name: Next Only {Service} CI

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
      SUPABASE_URL:
        required: true
      SUPABASE_ANON_KEY:
        required: true
      API_URL:
        required: true
      # ... service-specific secrets
    outputs:
      image_tag:
        description: "도커 이미지 태그"
        value: ${{ jobs.build-and-push.outputs.IMAGE_TAG }}

concurrency:
  group: deploy-${{ inputs.source_repository }}-${{ inputs.ref }}
  cancel-in-progress: true

permissions:
  contents: write
  id-token: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    name: Build & Push
    outputs:
      IMAGE_TAG: ${{ steps.set_image_tag.outputs.IMAGE_TAG }}
    environment: ${{ inputs.environment }}

    steps:
      - name: Checkout source repository
        uses: actions/checkout@v4
        with:
          repository: ${{ github.repository_owner }}/${{ inputs.source_repository }}
          ref: ${{ inputs.ref }}
          token: ${{ secrets.ACTION_TOKEN }}
          path: source

      - name: Checkout template repository
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
          build-args: |
            NEXT_PUBLIC_SUPABASE_URL=${{ secrets.SUPABASE_URL }}
            NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}
            NEXT_PUBLIC_API_URL=${{ secrets.API_URL }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## Deploy Workflow (SSH)

```yaml
name: Remote Compose Deploy

on:
  workflow_call:
    inputs:
      deploy_path:
        type: string
        required: true
      service:
        type: string
        required: true
      environment:
        type: string
        required: true
    secrets:
      SERVER_HOST:
        required: true
      SERVER_USERNAME:
        required: true
      SERVER_SSH_KEY:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: SSH deploy
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USERNAME }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd "${{ inputs.deploy_path }}"
            git pull origin ${{ inputs.environment }}
            docker compose --env-file=.env.${{ inputs.environment }} pull
            docker compose --env-file=.env.${{ inputs.environment }} up -d
```

---

## Consumer 측 호출 예시

```yaml
# .github/workflows/ci.yml (in consumer repo)
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    uses: semicolon-devteam/actions-template/.github/workflows/ci-next-only-land.yml@main
    with:
      source_repository: cm-land
      ref: ${{ github.ref }}
      environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
    secrets: inherit
```

---

## Tag 워크플로우

```yaml
name: Tag by Ops

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag (e.g., v1.2.3)'
        required: true
      service:
        description: 'Service to tag'
        required: true
        type: choice
        options:
          - cm-land
          - cm-office
          - core-backend

jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
      - name: Tag image
        run: |
          docker pull semicolonmanager/${{ inputs.service }}:latest
          docker tag semicolonmanager/${{ inputs.service }}:latest \
            semicolonmanager/${{ inputs.service }}:${{ inputs.version }}
          docker push semicolonmanager/${{ inputs.service }}:${{ inputs.version }}
```
