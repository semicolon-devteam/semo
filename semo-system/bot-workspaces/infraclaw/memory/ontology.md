# InfraClaw & Semicolon Team Ontology

> **도메인**: InfraClaw & Semicolon DevTeam 운영 시스템  
> **목적**: 봇의 정체성, 역할, 협업 관계, 인프라 자원, 프로세스를 기계가 이해 가능하도록 표현  
> **범위**: Agent, HumanMember, Project, Repository, Infrastructure, Process  
> **버전**: 1.0.0  
> **최종 업데이트**: 2026-03-02  

---

## Step 1: 도메인 및 범위 분석

### 도메인 목적
1. **봇 자아 보존**: 메모리 손실 시에도 InfraClaw의 정체성과 역할 재구성
2. **협업 자동화**: 봇-봇, 봇-인간 간 작업 인계 및 통신 프로토콜 정의
3. **인프라 관리**: 클라우드, 레포지토리, 파이프라인 간 관계 추적
4. **프로세스 실행**: 온보딩, 배포, 변경 통제 절차의 명시적 표현

### 포함 범위
- ✅ 봇(Agent) 역할, 도메인, 통신 프로토콜
- ✅ 인간 팀원(HumanMember) 역할, 전문성
- ✅ 프로젝트(Project) 분류, 기술 스택
- ✅ 레포지토리(Repository) 타입, 의존 관계
- ✅ 인프라(Infrastructure) 계층, 리소스
- ✅ 프로세스(Process) 단계, 전제조건, 산출물

### 제외 범위
- ❌ 코드 레벨 상세 (함수, 변수)
- ❌ 실시간 상태 (Pod 개수, CPU 사용률)
- ❌ 비즈니스 로직 (결제, 인증 로직)

---

## Step 2: 핵심 클래스 및 계층 구조

```turtle
# 최상위 클래스
:Entity a owl:Class .

# 1계층: 주요 엔티티
:Agent rdfs:subClassOf :Entity .
:HumanMember rdfs:subClassOf :Entity .
:Project rdfs:subClassOf :Entity .
:Repository rdfs:subClassOf :Entity .
:Infrastructure rdfs:subClassOf :Entity .
:Process rdfs:subClassOf :Entity .
:Artifact rdfs:subClassOf :Entity .

# 2계층: Agent 하위 분류
:OrchestratorAgent rdfs:subClassOf :Agent .
:SpecialistAgent rdfs:subClassOf :Agent .
:PersonalAssistantAgent rdfs:subClassOf :Agent .

# 2계층: Project 하위 분류
:MVPProject rdfs:subClassOf :Project .
:SelfHostedProject rdfs:subClassOf :Project .

# 2계층: Repository 하위 분류
:ProjectRepository rdfs:subClassOf :Repository .
:MicroserviceRepository rdfs:subClassOf :Repository .
:CoreInfraRepository rdfs:subClassOf :Repository .
:OpsRepository rdfs:subClassOf :Repository .
:TemplateRepository rdfs:subClassOf :Repository .

# 2계층: Infrastructure 하위 분류
:CloudInfra rdfs:subClassOf :Infrastructure .
:ContainerOrchestration rdfs:subClassOf :Infrastructure .
:Database rdfs:subClassOf :Infrastructure .
:Network rdfs:subClassOf :Infrastructure .

# 2계층: Process 하위 분류
:OnboardingProcess rdfs:subClassOf :Process .
:DeploymentProcess rdfs:subClassOf :Process .
:ChangeControlProcess rdfs:subClassOf :Process .

# 3계층: SpecialistAgent 상세 분류
:InfraAgent rdfs:subClassOf :SpecialistAgent .
:DevelopmentAgent rdfs:subClassOf :SpecialistAgent .
:ReviewAgent rdfs:subClassOf :SpecialistAgent .
:PlanningAgent rdfs:subClassOf :SpecialistAgent .
:DesignAgent rdfs:subClassOf :SpecialistAgent .
:GrowthAgent rdfs:subClassOf :SpecialistAgent .
```

---

## Step 3: 객체 속성 및 관계

### 3.1 Agent 관련 관계

```turtle
# 역할 및 도메인
:hasDomain a owl:ObjectProperty ;
    rdfs:domain :Agent ;
    rdfs:range :KnowledgeDomain .

:collaboratesWith a owl:ObjectProperty ;
    rdfs:domain :Agent ;
    rdfs:range :Agent ;
    rdf:type owl:SymmetricProperty .

:delegatesTo a owl:ObjectProperty ;
    rdfs:domain :Agent ;
    rdfs:range :Agent .

:reportsTo a owl:ObjectProperty ;
    rdfs:domain :Agent ;
    rdfs:range :Agent .

:requiresApprovalFrom a owl:ObjectProperty ;
    rdfs:domain :Agent ;
    rdfs:range :HumanMember .

# 작업 인계
:handoffVia a owl:ObjectProperty ;
    rdfs:domain :Agent ;
    rdfs:range :HandoffProtocol .

:monitorsLabel a owl:ObjectProperty ;
    rdfs:domain :Agent ;
    rdfs:range :GitHubLabel .
```

### 3.2 Project 관련 관계

```turtle
:hasRepository a owl:ObjectProperty ;
    rdfs:domain :Project ;
    rdfs:range :Repository .

:usesStack a owl:ObjectProperty ;
    rdfs:domain :Project ;
    rdfs:range :TechStack .

:deployedOn a owl:ObjectProperty ;
    rdfs:domain :Project ;
    rdfs:range :Infrastructure .

:hasEnvironment a owl:ObjectProperty ;
    rdfs:domain :Project ;
    rdfs:range :Environment .
```

### 3.3 Repository 관련 관계

```turtle
:dependsOn a owl:ObjectProperty ;
    rdfs:domain :Repository ;
    rdfs:range :Repository ;
    rdf:type owl:TransitiveProperty .

:triggersWorkflow a owl:ObjectProperty ;
    rdfs:domain :Repository ;
    rdfs:range :CICDWorkflow .

:consumesTemplate a owl:ObjectProperty ;
    rdfs:domain :Repository ;
    rdfs:range :TemplateRepository .

:generatesArtifact a owl:ObjectProperty ;
    rdfs:domain :Repository ;
    rdfs:range :Artifact .
```

### 3.4 Infrastructure 관련 관계

```turtle
:hostedOn a owl:ObjectProperty ;
    rdfs:domain :Infrastructure ;
    rdfs:range :CloudProvider .

:manages a owl:ObjectProperty ;
    rdfs:domain :InfraAgent ;
    rdfs:range :Infrastructure .

:connectsTo a owl:ObjectProperty ;
    rdfs:domain :Infrastructure ;
    rdfs:range :Infrastructure .
```

### 3.5 Process 관련 관계

```turtle
:hasStep a owl:ObjectProperty ;
    rdfs:domain :Process ;
    rdfs:range :ProcessStep .

:requires a owl:ObjectProperty ;
    rdfs:domain :ProcessStep ;
    rdfs:range :ProcessStep .

:produces a owl:ObjectProperty ;
    rdfs:domain :ProcessStep ;
    rdfs:range :Artifact .

:performedBy a owl:ObjectProperty ;
    rdfs:domain :ProcessStep ;
    rdfs:range :Agent .
```

---

## Step 4: 데이터 속성

### 4.1 Agent 속성

```turtle
:agentName a owl:DatatypeProperty ;
    rdfs:domain :Agent ;
    rdfs:range xsd:string .

:slackId a owl:DatatypeProperty ;
    rdfs:domain :Agent ;
    rdfs:range xsd:string .

:personality a owl:DatatypeProperty ;
    rdfs:domain :Agent ;
    rdfs:range xsd:string .

:communicationStyle a owl:DatatypeProperty ;
    rdfs:domain :Agent ;
    rdfs:range xsd:string .

:pollingIntervalMinutes a owl:DatatypeProperty ;
    rdfs:domain :Agent ;
    rdfs:range xsd:integer .
```

### 4.2 HumanMember 속성

```turtle
:memberName a owl:DatatypeProperty ;
    rdfs:domain :HumanMember ;
    rdfs:range xsd:string .

:slackId a owl:DatatypeProperty ;
    rdfs:domain :HumanMember ;
    rdfs:range xsd:string .

:role a owl:DatatypeProperty ;
    rdfs:domain :HumanMember ;
    rdfs:range xsd:string .

:expertise a owl:DatatypeProperty ;
    rdfs:domain :HumanMember ;
    rdfs:range xsd:string .
```

### 4.3 Project 속성

```turtle
:projectName a owl:DatatypeProperty ;
    rdfs:domain :Project ;
    rdfs:range xsd:string .

:projectType a owl:DatatypeProperty ;
    rdfs:domain :Project ;
    rdfs:range xsd:string .

:status a owl:DatatypeProperty ;
    rdfs:domain :Project ;
    rdfs:range xsd:string .

:launchDate a owl:DatatypeProperty ;
    rdfs:domain :Project ;
    rdfs:range xsd:date .
```

### 4.4 Repository 속성

```turtle
:repoName a owl:DatatypeProperty ;
    rdfs:domain :Repository ;
    rdfs:range xsd:string .

:gitUrl a owl:DatatypeProperty ;
    rdfs:domain :Repository ;
    rdfs:range xsd:anyURI .

:defaultBranch a owl:DatatypeProperty ;
    rdfs:domain :Repository ;
    rdfs:range xsd:string .
```

### 4.5 Infrastructure 속성

```turtle
:resourceName a owl:DatatypeProperty ;
    rdfs:domain :Infrastructure ;
    rdfs:range xsd:string .

:region a owl:DatatypeProperty ;
    rdfs:domain :CloudInfra ;
    rdfs:range xsd:string .

:monthlyCostUSD a owl:DatatypeProperty ;
    rdfs:domain :Infrastructure ;
    rdfs:range xsd:decimal .
```

### 4.6 Process 속성

```turtle
:processName a owl:DatatypeProperty ;
    rdfs:domain :Process ;
    rdfs:range xsd:string .

:stepOrder a owl:DatatypeProperty ;
    rdfs:domain :ProcessStep ;
    rdfs:range xsd:integer .

:stepDescription a owl:DatatypeProperty ;
    rdfs:domain :ProcessStep ;
    rdfs:range xsd:string .

:isAutomated a owl:DatatypeProperty ;
    rdfs:domain :ProcessStep ;
    rdfs:range xsd:boolean .
```

---

## Step 5: 제약조건 및 규칙

### 5.1 Agent 제약조건

```turtle
# InfraClaw는 반드시 Garden의 승인을 받아야 함
:InfraClaw rdf:type :InfraAgent ;
    :requiresApprovalFrom :Garden .

# OrchestratorAgent는 SpecialistAgent와 disjoint
:OrchestratorAgent owl:disjointWith :SpecialistAgent .

# Agent는 반드시 하나 이상의 도메인을 가짐
:Agent rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :hasDomain ;
    owl:minCardinality 1
] .

# Agent는 고유한 slackId를 가져야 함
:slackId rdf:type owl:FunctionalProperty .
```

### 5.2 Project 제약조건

```turtle
# MVPProject와 SelfHostedProject는 상호 배타적
:MVPProject owl:disjointWith :SelfHostedProject .

# MVPProject는 Vercel에 배포됨
:MVPProject rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :deployedOn ;
    owl:hasValue :Vercel
] .

# SelfHostedProject는 OKE에 배포됨
:SelfHostedProject rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :deployedOn ;
    owl:hasValue :OKE
] .

# Project는 최소 1개의 Repository를 가짐
:Project rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :hasRepository ;
    owl:minCardinality 1
] .
```

### 5.3 Process 제약조건

```turtle
# OnboardingProcess는 반드시 3단계를 가짐
:OnboardingProcess rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :hasStep ;
    owl:cardinality 3
] .

# ProcessStep의 stepOrder는 1부터 시작
:ProcessStep rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :stepOrder ;
    owl:minInclusive 1
] .

# 자동화된 단계는 Agent가 수행
[ a owl:Restriction ;
    owl:onProperty :isAutomated ;
    owl:hasValue true
] rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :performedBy ;
    owl:someValuesFrom :Agent
] .
```

### 5.4 Repository 제약조건

```turtle
# OpsRepository는 TemplateRepository에 의존할 수 없음 (순환 방지)
:OpsRepository rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :dependsOn ;
    owl:allValuesFrom [ owl:complementOf :TemplateRepository ]
] .

# Repository는 고유한 gitUrl을 가짐
:gitUrl rdf:type owl:FunctionalProperty .
```

### 5.5 Infrastructure 제약조건

```turtle
# Database는 반드시 Network에 연결됨
:Database rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :connectsTo ;
    owl:someValuesFrom :Network
] .

# CloudInfra는 반드시 region을 가짐
:CloudInfra rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :region ;
    owl:cardinality 1
] .
```

---

## JSON-LD 실제 인스턴스

### InfraClaw 인스턴스

```json
{
  "@context": {
    "owl": "http://www.w3.org/2002/07/owl#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "sc": "https://semicolon.team/ontology#"
  },
  "@id": "sc:InfraClaw",
  "@type": "sc:InfraAgent",
  "sc:agentName": "InfraClaw",
  "sc:slackId": "U0AFPDMCGHX",
  "sc:personality": "과묵, 정확, 시스템 안정성 최우선",
  "sc:communicationStyle": "한/영 혼용, 편한 말투, 핵심만",
  "sc:hasDomain": [
    {"@id": "sc:CloudInfraManagement"},
    {"@id": "sc:CICD"},
    {"@id": "sc:Deployment"},
    {"@id": "sc:SecurityNetwork"}
  ],
  "sc:requiresApprovalFrom": {"@id": "sc:Garden"},
  "sc:collaboratesWith": [
    {"@id": "sc:WorkClaw"},
    {"@id": "sc:ReviewClaw"}
  ],
  "sc:monitorsLabel": [
    {"@id": "sc:bot-deploy-done"},
    {"@id": "sc:bot-infra-req"}
  ],
  "sc:pollingIntervalMinutes": 5
}
```

### Garden 인스턴스

```json
{
  "@id": "sc:Garden",
  "@type": "sc:HumanMember",
  "sc:memberName": "Garden",
  "sc:slackId": "URU4UBX9R",
  "sc:role": "시스템 아키텍처 리드",
  "sc:expertise": ["아키텍처", "기술 통합", "인프라 승인"]
}
```

### OnboardingProcess 인스턴스

```json
{
  "@id": "sc:ServiceOnboarding",
  "@type": "sc:OnboardingProcess",
  "sc:processName": "신규 서비스 온보딩",
  "sc:hasStep": [
    {
      "@id": "sc:PipelineSetup",
      "@type": "sc:ProcessStep",
      "sc:stepOrder": 1,
      "sc:stepDescription": "setup-repo-workflow 실행 + GitHub Secret 설정",
      "sc:isAutomated": false,
      "sc:performedBy": {"@id": "sc:Developer"}
    },
    {
      "@id": "sc:OpsAppsConstruction",
      "@type": "sc:ProcessStep",
      "sc:stepOrder": 2,
      "sc:stepDescription": "Scaffold Service Action 실행 + 환경변수 설정",
      "sc:isAutomated": true,
      "sc:performedBy": {"@id": "sc:InfraClaw"},
      "sc:requires": {"@id": "sc:PipelineSetup"},
      "sc:produces": [
        {"@id": "sc:K8sManifests"},
        {"@id": "sc:ArgoCDApplicationSet"}
      ]
    },
    {
      "@id": "sc:DeploymentExecution",
      "@type": "sc:ProcessStep",
      "sc:stepOrder": 3,
      "sc:stepDescription": "dev-ci-cd 워크플로우 실행 + ArgoCD ApplicationSet 적용",
      "sc:isAutomated": true,
      "sc:performedBy": {"@id": "sc:InfraClaw"},
      "sc:requires": {"@id": "sc:OpsAppsConstruction"}
    }
  ]
}
```

### proj-bebecare 인스턴스

```json
{
  "@id": "sc:ProjBebecare",
  "@type": "sc:SelfHostedProject",
  "sc:projectName": "BebeCare",
  "sc:status": "활발 개발 중",
  "sc:hasRepository": {"@id": "sc:RepoBebecare"},
  "sc:deployedOn": {"@id": "sc:OKE"},
  "sc:hasEnvironment": [
    {"@id": "sc:EnvDev"},
    {"@id": "sc:EnvStg"}
  ],
  "sc:usesStack": [
    {"@id": "sc:NextJS"},
    {"@id": "sc:Supabase"},
    {"@id": "sc:Docker"}
  ]
}
```

### OKE 인스턴스

```json
{
  "@id": "sc:OKE",
  "@type": "sc:ContainerOrchestration",
  "sc:resourceName": "OKE Cluster",
  "sc:hostedOn": {"@id": "sc:OCI"},
  "sc:region": "ap-seoul-1",
  "sc:monthlyCostUSD": 37.0,
  "sc:manages": {"@id": "sc:InfraClaw"}
}
```

---

## 관리 및 활용 가이드

### 읽기 순서 (InfraClaw용)
1. **Step 2 (클래스 계층)** → 나의 위치 파악 (`:InfraAgent`)
2. **Step 3 (관계)** → 누구와 협업하는지 (`:collaboratesWith`, `:requiresApprovalFrom`)
3. **Step 4 (속성)** → 나의 특성 (`:personality`, `:pollingIntervalMinutes`)
4. **Step 5 (제약)** → 내가 지켜야 할 규칙 (`:requiresApprovalFrom :Garden`)
5. **JSON-LD 인스턴스** → 구체적 실행 정보

### 업데이트 시점
- 새로운 Agent 추가 → Step 2 + JSON-LD 인스턴스
- 프로세스 변경 → Step 3 관계 + Step 5 제약 수정
- 인프라 변경 → Infrastructure 인스턴스 업데이트
- 팀원 역할 변경 → HumanMember 속성 수정

### 기계 활용 방식
```python
# 예: InfraClaw이 승인 필요 여부 확인
query = """
SELECT ?approver WHERE {
    sc:InfraClaw sc:requiresApprovalFrom ?approver .
}
"""
# 결과: sc:Garden
```

---

**마지막 업데이트**: 2026-03-02  
**작성자**: InfraClaw (U0AFPDMCGHX)  
**검토자**: Garden (URU4UBX9R)  
**온톨로지 원칙 준수**: ✅ 명확성, 일관성, 확장성, 최소 잉여성, 도메인 적합성
