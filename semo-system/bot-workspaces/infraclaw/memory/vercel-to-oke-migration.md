# Vercel → OKE (자체 인프라) 마이그레이션 가이드

> **작성일:** 2026-02-27  
> **기준 케이스:** cat 프로젝트 (Binance API 차단 이슈로 Vercel US East → OCI Seoul 이전)  
> **배포 방식:** GitOps (GitHub Actions → GHCR → ArgoCD → OKE)

---

## 📋 개요

### 마이그레이션이 필요한 경우
1. **지역 제약:** Vercel 리전에서 특정 API 차단 (예: Binance)
2. **비용 최적화:** 트래픽 많은 서비스의 자체 인프라 전환
3. **인프라 제어:** DB, 네트워크, 리소스 완전 제어 필요
4. **규정 준수:** 데이터 주권, 국내 서버 필요

### 배포 플로우
```
로컬 개발 → Git push (dev/main)
  ↓
GitHub Actions (ci-next-docker.yml)
  ↓
Docker 빌드 (NEXT_PUBLIC_* 빌드타임 주입)
  ↓
GHCR push (ghcr.io/semicolon-devteam/{서비스})
  ↓
Kustomize 이미지 태그 업데이트 (semi-colon-ops)
  ↓
ArgoCD 자동 싱크
  ↓
OKE 배포 완료
```

### 핵심 원칙
- **SSH 직접 배포 금지** — GitOps만 사용
- **GHCR 우선** — DockerHub rate limit 이슈 (2026-02-17 발생)
- **빌드타임 vs 런타임 분리**
  - `NEXT_PUBLIC_*` → 빌드타임 (Dockerfile ARG)
  - 시크릿 (API 키) → 런타임 (K8S Secret)
- **Health check 필수** — `/api/health` 엔드포인트

---

## 🔍 사전 확인 사항

### 1. 프로젝트 정보 수집
```bash
# Vercel 프로젝트에서
vercel env ls --project {프로젝트명}
vercel domains ls
vercel inspect {배포URL}
```

**필요 정보:**
- [ ] 프로젝트명 (GitHub 레포명)
- [ ] 현재 Vercel URL
- [ ] 환경 변수 리스트 (`NEXT_PUBLIC_*` / 시크릿 구분)
- [ ] DB 종류 (Supabase / PostgreSQL / MongoDB)
- [ ] 외부 API 의존성
- [ ] 포트 (기본 3000)

### 2. 레포 위치 확인
```bash
# MEMORY.md 프로젝트 디렉토리 매핑 참고
ls -la /Users/reus/Desktop/Sources/semicolon/projects/
```

**없으면:** SemiClaw에게 레포 세팅 요청 (임의로 clone 금지)

### 3. 인프라 리소스 확인
```bash
# Ingress LoadBalancer IP
kubectl get svc -n ingress-nginx

# cert-manager ClusterIssuer
kubectl get clusterissuer

# imagePullSecrets
kubectl get secret -A | grep ghcr
```

---

## 📦 Step 1: 프로젝트 레포 변경

### 1-1. next.config.ts 수정
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',  // ✅ 추가!
  // 기존 설정...
};
```

### 1-2. Dockerfile 작성
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# NEXT_PUBLIC_* 빌드타임 주입 (CI에서 --build-arg 전달)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_DESCRIPTION
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION

RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

**⚠️ 주의사항:**
- `ARG` → `ENV` 변환으로 빌드타임 주입
- CI 워크플로우에서 `--build-arg` 전달 (actions-template에서 자동 처리)

### 1-3. .dockerignore 작성
```
.next
node_modules
.env*
.git
.vercel
.claude
.vscode
```

### 1-4. Health Check 엔드포인트
`src/app/api/health/route.ts`:
```typescript
export function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

### 1-5. GitHub Actions 워크플로우
`.github/workflows/deploy-dev.yml`:
```yaml
name: Deploy to Dev
on:
  push:
    branches: [dev]
jobs:
  build-and-deploy:
    uses: semicolon-devteam/actions-template/.github/workflows/ci-next-docker.yml@main
    with:
      environment: dev
      registry: ghcr.io  # ✅ GHCR 우선
    secrets: inherit
```

`.github/workflows/deploy-prd.yml`:
```yaml
name: Deploy to Prd
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    uses: semicolon-devteam/actions-template/.github/workflows/ci-next-docker.yml@main
    with:
      environment: prd
      registry: ghcr.io
    secrets: inherit
```

### 1-6. dev 브랜치 생성
```bash
cd /Users/reus/Desktop/Sources/semicolon/projects/{프로젝트}/
git checkout -b dev
git push -u origin dev
```

---

## 🏗️ Step 2: semi-colon-ops 매니페스트 작성

### 2-1. 디렉토리 구조
```
semi-colon-ops/
├── base/{서비스}/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── kustomization.yaml
├── overlays/dev/{서비스}/
│   ├── ingress.yaml
│   ├── hpa.yaml
│   └── kustomization.yaml
└── overlays/prd/{서비스}/
    ├── ingress.yaml
    ├── hpa.yaml
    └── kustomization.yaml
```

### 2-2. base/{서비스}/deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {서비스}
  labels:
    app: {서비스}
spec:
  selector:
    matchLabels:
      app: {서비스}
  template:
    metadata:
      labels:
        app: {서비스}
    spec:
      imagePullSecrets:
        - name: ghcr-secret  # ✅ GHCR 우선
      containers:
        - name: {서비스}
          image: ghcr.io/semicolon-devteam/{서비스}:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          envFrom:
            - configMapRef:
                name: {서비스}-config
            - secretRef:
                name: {서비스}-secret
```

### 2-3. base/{서비스}/service.yaml
```yaml
apiVersion: v1
kind: Service
metadata:
  name: {서비스}
spec:
  type: ClusterIP
  selector:
    app: {서비스}
  ports:
    - port: 80
      targetPort: 3000
```

### 2-4. base/{서비스}/configmap.yaml
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {서비스}-config
data:
  PLACEHOLDER: "true"  # NEXT_PUBLIC_* 빌드타임 처리됨
```

### 2-5. base/{서비스}/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml
```

### 2-6. overlays/dev/{서비스}/ingress.yaml
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {서비스}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-staging  # ✅ dev = staging
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - {서비스}-dev.semi-colon.space
      secretName: {서비스}-dev-tls
  rules:
    - host: {서비스}-dev.semi-colon.space
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {서비스}
                port:
                  number: 80
```

### 2-7. overlays/dev/{서비스}/hpa.yaml
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {서비스}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {서비스}
  minReplicas: 1
  maxReplicas: 2  # dev = 최소 리소스
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### 2-8. overlays/dev/{서비스}/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: {서비스}
resources:
  - ../../base/{서비스}
  - ingress.yaml
  - hpa.yaml
images:
  - name: ghcr.io/semicolon-devteam/{서비스}
    newTag: dev-latest  # CI가 자동 업데이트
commonLabels:
  app: {서비스}
  environment: dev
configMapGenerator:
  - name: {서비스}-config
    behavior: replace
    literals:
      - NODE_ENV=development
```

### 2-9. overlays/prd/{서비스}/ingress.yaml
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {서비스}
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod  # ✅ prd = prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - {서비스}.semi-colon.space  # prd는 -prd 없음
      secretName: {서비스}-prd-tls
  rules:
    - host: {서비스}.semi-colon.space
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {서비스}
                port:
                  number: 80
```

### 2-10. overlays/prd/{서비스}/hpa.yaml
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {서비스}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {서비스}
  minReplicas: 1
  maxReplicas: 3  # prd = 더 많은 스케일링
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### 2-11. overlays/prd/{서비스}/kustomization.yaml
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: {서비스}
resources:
  - ../../base/{서비스}
  - ingress.yaml
  - hpa.yaml
images:
  - name: ghcr.io/semicolon-devteam/{서비스}
    newTag: prd-latest  # CI가 자동 업데이트
commonLabels:
  app: {서비스}
  environment: prd
configMapGenerator:
  - name: {서비스}-config
    behavior: replace
    literals:
      - NODE_ENV=production
```

---

## 🔐 Step 3: K8S 리소스 생성 (InfraClaw 작업)

### 3-1. Namespace 생성
```bash
kubectl create ns {서비스}
```

### 3-2. K8S Secret 생성
```bash
# Vercel env에서 추출한 시크릿 값으로 생성
kubectl create secret generic {서비스}-secret \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-... \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY=eyJh... \
  --from-literal=GOOGLE_AI_API_KEY=AIza... \
  -n {서비스}
```

**⚠️ 주의:**
- `NEXT_PUBLIC_*`는 여기 포함 안 함 (빌드타임 처리)
- 민감한 API 키만 K8S Secret으로

### 3-3. ArgoCD Application 등록
`argocd/{서비스}-dev.yaml`:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: {서비스}-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/semicolon-devteam/semi-colon-ops
    targetRevision: main
    path: overlays/dev/{서비스}
  destination:
    server: https://kubernetes.default.svc
    namespace: {서비스}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

`argocd/{서비스}-prd.yaml`:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: {서비스}-prd
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/semicolon-devteam/semi-colon-ops
    targetRevision: main
    path: overlays/prd/{서비스}
  destination:
    server: https://kubernetes.default.svc
    namespace: {서비스}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

**적용:**
```bash
kubectl apply -f argocd/{서비스}-dev.yaml
kubectl apply -f argocd/{서비스}-prd.yaml
```

### 3-4. DNS A 레코드 등록 (OCI Console)

**Ingress LoadBalancer IP 확인:**
```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

**OCI Console → Networking → DNS Zone Management:**
- `{서비스}-dev.semi-colon.space` → A 레코드 → Ingress IP
- `{서비스}.semi-colon.space` → A 레코드 → Ingress IP

**TTL:** 300초 (5분) 권장

---

## ✅ Step 4: 검증

### 4-1. 로컬 Docker 빌드 테스트
```bash
cd /Users/reus/Desktop/Sources/semicolon/projects/{프로젝트}/

# NEXT_PUBLIC_* 변수와 함께 빌드
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh... \
  -t {서비스}:test .

# 로컬 실행
docker run -p 3000:3000 {서비스}:test

# Health check 확인
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"2026-02-27T13:00:00.000Z"}
```

### 4-2. dev 배포 검증
```bash
# dev 브랜치 push
git checkout dev
git add .
git commit -m "chore: setup OKE deployment"
git push origin dev

# GitHub Actions 실행 확인
# https://github.com/semicolon-devteam/{프로젝트}/actions

# ArgoCD Sync 확인
kubectl get app -n argocd {서비스}-dev
# SYNC STATUS: Synced

# Pod 상태 확인
kubectl get pods -n {서비스}
# {서비스}-xxx-xxx   1/1   Running

# Ingress 확인
kubectl get ingress -n {서비스}
# {서비스}   {서비스}-dev.semi-colon.space   xxx.xxx.xxx.xxx

# 도메인 접속
curl https://{서비스}-dev.semi-colon.space
curl https://{서비스}-dev.semi-colon.space/api/health
```

### 4-3. prd 배포 검증
```bash
# main 브랜치 머지
git checkout main
git merge dev
git push origin main

# 동일하게 검증
kubectl get app -n argocd {서비스}-prd
kubectl get pods -n {서비스}
curl https://{서비스}.semi-colon.space
```

---

## 🐛 트러블슈팅

### ImagePullBackOff
**원인:** imagePullSecrets 없거나 잘못됨

**해결:**
```bash
# ghcr-secret 존재 확인
kubectl get secret ghcr-secret -n {서비스}

# 없으면 생성 (Garden/Bae에게 요청)
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=semicolon-devteam \
  --docker-password=ghp_xxx \
  -n {서비스}
```

### CrashLoopBackOff
**원인:** 컨테이너 시작 실패 (환경 변수 누락, 런타임 에러)

**해결:**
```bash
# 로그 확인
kubectl logs -n {서비스} {서비스}-xxx-xxx

# Secret 확인
kubectl get secret {서비스}-secret -n {서비스} -o yaml

# 환경 변수 누락 시 Secret 재생성
kubectl delete secret {서비스}-secret -n {서비스}
kubectl create secret generic {서비스}-secret \
  --from-literal=MISSING_VAR=value \
  -n {서비스}
```

### SSL 인증서 발급 실패
**원인:** cert-manager issuer 이름 틀림 또는 DNS 전파 안 됨

**해결:**
```bash
# Certificate 상태 확인
kubectl get certificate -n {서비스}

# cert-manager 로그 확인
kubectl logs -n cert-manager deploy/cert-manager

# DNS 전파 확인
dig {서비스}-dev.semi-colon.space +short
# Ingress IP 나와야 함

# 수동 인증서 재발급
kubectl delete certificate {서비스}-dev-tls -n {서비스}
# ArgoCD가 자동으로 재생성
```

### ArgoCD OutOfSync
**원인:** Kustomize 이미지 태그 업데이트 실패 또는 Git 충돌

**해결:**
```bash
# ArgoCD 상태 확인
kubectl get app -n argocd {서비스}-dev -o yaml

# 수동 Sync
kubectl patch app {서비스}-dev -n argocd \
  --type merge -p '{"operation":{"sync":{}}}'

# semi-colon-ops 레포 확인
cd /path/to/semi-colon-ops
git pull
cat overlays/dev/{서비스}/kustomization.yaml | grep newTag
```

### GitHub Actions 빌드 실패
**원인:** Dockerfile ARG 누락 또는 actions-template 파라미터 틀림

**해결:**
```bash
# Actions 로그 확인
# https://github.com/semicolon-devteam/{프로젝트}/actions

# Dockerfile ARG 확인
grep "ARG NEXT_PUBLIC" Dockerfile

# 워크플로우 파라미터 확인
cat .github/workflows/deploy-dev.yml
# registry: ghcr.io (맞는지)
```

---

## 🤝 Claude Code와 협업 프로토콜

### InfraClaw (나)가 먼저 제공할 정보
1. **이 가이드 전달** (`memory/vercel-to-oke-migration.md`)
2. **현재 인프라 상태:**
   - Ingress LoadBalancer IP
   - cert-manager ClusterIssuer 이름
   - imagePullSecrets 이름 (ghcr-secret / dockerhub-secret)
   - actions-template 워크플로우 파일명/파라미터
3. **프로젝트 레포 경로** (MEMORY.md 참고)

### Claude Code가 작업할 것
1. **프로젝트 레포 변경:**
   - Dockerfile, .dockerignore
   - next.config.ts
   - Health check 엔드포인트
   - GitHub Actions 워크플로우
   - dev 브랜치 생성
2. **semi-colon-ops 매니페스트 작성:**
   - base/{서비스}/ (deployment, service, configmap, kustomization)
   - overlays/dev/{서비스}/ (ingress, hpa, kustomization)
   - overlays/prd/{서비스}/ (ingress, hpa, kustomization)
3. **ArgoCD Application YAML 작성**
4. **Vercel 환경 변수 리스트 공유**

### InfraClaw (나)가 검증/처리할 것
1. **매니페스트 리뷰** (리소스, 라벨, 네이밍)
2. **K8S 리소스 생성:**
   - Namespace
   - Secret (환경 변수)
   - ArgoCD Application 적용
3. **DNS A 레코드 등록** (OCI Console)
4. **배포 검증:**
   - ArgoCD Sync 상태
   - Pod 헬스 체크
   - Ingress/도메인 접속
5. **트러블슈팅**

### 의사결정 필요 시
- **레지스트리 선택** (GHCR vs DockerHub) → InfraClaw 권장: GHCR
- **리소스 할당** (CPU/Memory) → InfraClaw 제안, Reus 승인
- **HPA 설정** (min/max replicas) → InfraClaw 제안
- **도메인 이름** → Reus/SemiClaw 결정

---

## 📚 참고 레포
- **actions-template:** https://github.com/semicolon-devteam/actions-template
- **semi-colon-ops:** https://github.com/semicolon-devteam/semi-colon-ops
- **기존 프로젝트 예시:**
  - `game-land` (game/ namespace)
  - `play-land` (play/ namespace)
  - `link-collect` (link-collect/ namespace)

---

## 🔄 업데이트 히스토리
- **2026-02-27:** 초안 작성 (cat 프로젝트 기준)

---

**이 가이드는 반복 사용 가능한 템플릿입니다. 새 프로젝트 마이그레이션 시:**
1. `{서비스}` → 실제 서비스명으로 치환
2. 환경 변수 리스트 업데이트
3. 리소스 할당 조정 (트래픽 예상치 기반)
4. 검증 후 배포!
