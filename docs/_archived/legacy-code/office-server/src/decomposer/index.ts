/**
 * Task Decomposer
 *
 * Analyzes natural language requests and decomposes them into
 * role-based jobs with dependency graphs.
 */

import type {
  DecompositionRequest,
  DecompositionResult,
  DecomposedJob,
  DependencyEdge,
  AgentRole,
} from '../types.js';

interface RoleKeywords {
  role: AgentRole;
  keywords: string[];
  scope_patterns: string[];
  core_skills: string[];
}

const ROLE_DEFINITIONS: RoleKeywords[] = [
  {
    role: 'PO',
    keywords: ['기획', '요구사항', '스펙', '유저스토리', '명세', '정의'],
    scope_patterns: ['docs/**', '.github/ISSUE_TEMPLATE/**'],
    core_skills: ['generate-spec', 'ideate'],
  },
  {
    role: 'PM',
    keywords: ['일정', '마일스톤', '리소스', '진행상황', '관리'],
    scope_patterns: ['README.md', '.github/**'],
    core_skills: ['planner', 'notify-slack'],
  },
  {
    role: 'Architect',
    keywords: ['설계', '아키텍처', '구조', '패턴', '인터페이스'],
    scope_patterns: ['**/types/**', 'lib/**', 'src/lib/**'],
    core_skills: ['planner', 'write-code'],
  },
  {
    role: 'FE',
    keywords: ['UI', '페이지', '컴포넌트', '스타일', '폼', '프론트', '화면'],
    scope_patterns: ['src/app/**', 'src/components/**', 'src/styles/**'],
    core_skills: ['write-code', 'create-pr', 'request-test'],
  },
  {
    role: 'BE',
    keywords: ['API', '서버', 'DB', '로직', '엔드포인트', '백엔드', '데이터'],
    scope_patterns: ['src/api/**', 'src/server/**', 'src/lib/**', 'lib/db/**'],
    core_skills: ['write-code', 'create-pr', 'request-test'],
  },
  {
    role: 'QA',
    keywords: ['테스트', '검증', '버그', 'E2E', '품질', '테스팅'],
    scope_patterns: ['tests/**', 'e2e/**', '__tests__/**'],
    core_skills: ['write-test', 'request-test'],
  },
  {
    role: 'DevOps',
    keywords: ['배포', 'CI/CD', '인프라', '모니터링', '도커', '컨테이너'],
    scope_patterns: ['package.json', 'tsconfig.json', '.github/workflows/**', 'docker/**'],
    core_skills: ['deployer', 'circuit-breaker'],
  },
];

// Default dependency patterns between roles
const DEFAULT_DEPENDENCIES: Array<[AgentRole, AgentRole]> = [
  ['PO', 'FE'],
  ['PO', 'BE'],
  ['Architect', 'FE'],
  ['Architect', 'BE'],
  ['FE', 'QA'],
  ['BE', 'QA'],
  ['FE', 'DevOps'],
  ['BE', 'DevOps'],
];

export class TaskDecomposer {
  /**
   * Decompose a natural language request into jobs
   */
  async decompose(request: DecompositionRequest): Promise<DecompositionResult> {
    const { request: userRequest, context } = request;

    // Phase 1: Analyze request
    const analysis = this.analyzeRequest(userRequest);

    // Phase 2: Identify required roles
    const roles = this.identifyRoles(userRequest, analysis);

    // Phase 3: Create jobs for each role
    const jobs = this.createJobs(roles, userRequest, analysis);

    // Phase 4: Build dependency graph
    const { graph, order } = this.buildDependencyGraph(jobs);

    // Phase 5: Calculate execution groups
    const executionOrder = this.calculateExecutionOrder(jobs, graph);

    return {
      request_summary: analysis.summary,
      jobs,
      dependency_graph: graph,
      execution_order: executionOrder,
      estimated_agents: roles.length,
    };
  }

  private analyzeRequest(request: string): RequestAnalysis {
    // Extract key information from the request
    const lowerRequest = request.toLowerCase();

    // Detect domain
    const domains = ['쇼핑몰', '결제', '로그인', '인증', '대시보드', '관리자'];
    const detectedDomain = domains.find((d) => lowerRequest.includes(d)) ?? 'general';

    // Detect action type
    let actionType: 'create' | 'update' | 'fix' | 'delete' = 'create';
    if (lowerRequest.includes('수정') || lowerRequest.includes('변경')) {
      actionType = 'update';
    } else if (lowerRequest.includes('버그') || lowerRequest.includes('수정')) {
      actionType = 'fix';
    } else if (lowerRequest.includes('삭제') || lowerRequest.includes('제거')) {
      actionType = 'delete';
    }

    // Generate summary
    const summary = `${detectedDomain} - ${actionType}`;

    return {
      summary,
      domain: detectedDomain,
      actionType,
      keywords: this.extractKeywords(request),
    };
  }

  private extractKeywords(request: string): string[] {
    // Simple keyword extraction
    const words = request
      .split(/[\s,]+/)
      .filter((w) => w.length > 1)
      .map((w) => w.toLowerCase());

    return [...new Set(words)];
  }

  private identifyRoles(request: string, analysis: RequestAnalysis): AgentRole[] {
    const lowerRequest = request.toLowerCase();
    const detectedRoles = new Set<AgentRole>();

    // Explicit role detection from keywords
    for (const def of ROLE_DEFINITIONS) {
      if (def.keywords.some((kw) => lowerRequest.includes(kw))) {
        detectedRoles.add(def.role);
      }
    }

    // Implicit role inference based on action type
    if (analysis.actionType === 'create' || analysis.actionType === 'update') {
      // Most features need FE and BE
      if (!detectedRoles.has('PO') && !detectedRoles.has('Architect')) {
        // Add PO for feature requests without explicit spec
        if (lowerRequest.includes('기능')) {
          detectedRoles.add('PO');
        }
      }

      // If no explicit roles detected, infer from common patterns
      if (detectedRoles.size === 0) {
        detectedRoles.add('FE');
        detectedRoles.add('BE');
      }

      // QA is recommended for most features
      if (detectedRoles.has('FE') || detectedRoles.has('BE')) {
        detectedRoles.add('QA');
      }
    }

    return Array.from(detectedRoles);
  }

  private createJobs(
    roles: AgentRole[],
    request: string,
    analysis: RequestAnalysis
  ): DecomposedJob[] {
    const jobs: DecomposedJob[] = [];
    let priority = 0;

    // Sort roles by natural dependency order
    const roleOrder: AgentRole[] = ['PO', 'Architect', 'PM', 'FE', 'BE', 'QA', 'DevOps'];
    const sortedRoles = roles.sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b));

    for (const role of sortedRoles) {
      const def = ROLE_DEFINITIONS.find((d) => d.role === role);
      if (!def) continue;

      const job: DecomposedJob = {
        id: `job-${role.toLowerCase()}-${Date.now()}`,
        role,
        description: this.generateJobDescription(role, request, analysis),
        scope: def.scope_patterns,
        depends_on: [], // Will be filled in buildDependencyGraph
        skills: def.core_skills,
        priority,
      };

      jobs.push(job);
      priority++;
    }

    return jobs;
  }

  private generateJobDescription(
    role: AgentRole,
    request: string,
    analysis: RequestAnalysis
  ): string {
    const descriptions: Record<AgentRole, string> = {
      PO: `${analysis.domain} 기능 기획서 작성 및 요구사항 정의`,
      PM: `${analysis.domain} 프로젝트 일정 및 리소스 관리`,
      Architect: `${analysis.domain} 시스템 설계 및 인터페이스 정의`,
      FE: `${analysis.domain} UI 구현 및 프론트엔드 개발`,
      BE: `${analysis.domain} API 구현 및 백엔드 개발`,
      QA: `${analysis.domain} 테스트 작성 및 품질 검증`,
      DevOps: `${analysis.domain} 배포 파이프라인 및 인프라 설정`,
    };

    return descriptions[role] ?? `${role}: ${request}`;
  }

  private buildDependencyGraph(jobs: DecomposedJob[]): {
    graph: DependencyEdge[];
    order: Map<string, number>;
  } {
    const graph: DependencyEdge[] = [];
    const jobByRole = new Map<AgentRole, DecomposedJob>();
    const order = new Map<string, number>();

    // Index jobs by role
    for (const job of jobs) {
      jobByRole.set(job.role, job);
    }

    // Apply default dependencies
    for (const [fromRole, toRole] of DEFAULT_DEPENDENCIES) {
      const fromJob = jobByRole.get(fromRole);
      const toJob = jobByRole.get(toRole);

      if (fromJob && toJob) {
        graph.push({ from: fromJob.id, to: toJob.id });
        toJob.depends_on.push(fromJob.id);
      }
    }

    // Calculate topological order
    let orderIndex = 0;
    for (const job of jobs) {
      if (!order.has(job.id)) {
        this.topologicalSort(job, jobs, order, orderIndex);
        orderIndex++;
      }
    }

    return { graph, order };
  }

  private topologicalSort(
    job: DecomposedJob,
    allJobs: DecomposedJob[],
    order: Map<string, number>,
    currentOrder: number
  ): void {
    if (order.has(job.id)) return;

    // Visit dependencies first
    for (const depId of job.depends_on) {
      const depJob = allJobs.find((j) => j.id === depId);
      if (depJob && !order.has(depId)) {
        this.topologicalSort(depJob, allJobs, order, currentOrder);
      }
    }

    order.set(job.id, currentOrder);
  }

  private calculateExecutionOrder(jobs: DecomposedJob[], graph: DependencyEdge[]): string[][] {
    const groups: string[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(jobs.map((j) => j.id));

    while (remaining.size > 0) {
      const currentGroup: string[] = [];

      for (const jobId of remaining) {
        const job = jobs.find((j) => j.id === jobId);
        if (!job) continue;

        // Check if all dependencies are completed
        const allDepsCompleted = job.depends_on.every((dep) => completed.has(dep));
        if (allDepsCompleted) {
          currentGroup.push(jobId);
        }
      }

      if (currentGroup.length === 0 && remaining.size > 0) {
        // Circular dependency detected, force add remaining
        console.warn('Circular dependency detected');
        currentGroup.push(...remaining);
      }

      // Mark as completed
      for (const jobId of currentGroup) {
        completed.add(jobId);
        remaining.delete(jobId);
      }

      groups.push(currentGroup);
    }

    return groups;
  }
}

interface RequestAnalysis {
  summary: string;
  domain: string;
  actionType: 'create' | 'update' | 'fix' | 'delete';
  keywords: string[];
}
