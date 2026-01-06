/**
 * Persona Injector
 *
 * Generates and injects CLAUDE.md files for Agent personas.
 * Creates role-specific context and constraints for Claude Code sessions.
 */

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import type { AgentPersona, AgentRole, Job } from '../types.js';

export interface InjectorConfig {
  /** Template directory path */
  templateDir: string;
  /** Whether to include core skills */
  includeSkills: boolean;
  /** Whether to include knowledge refs */
  includeKnowledge: boolean;
  /** Custom sections to include */
  customSections: Record<string, string>;
}

export interface InjectionContext {
  persona: AgentPersona;
  job?: Job;
  worktreePath: string;
  officeId: string;
  projectContext?: ProjectContext;
}

export interface ProjectContext {
  techStack?: string[];
  existingFiles?: string[];
  conventions?: string[];
  repoUrl?: string;
}

export interface InjectionResult {
  success: boolean;
  claudeMdPath: string;
  content: string;
  error?: string;
}

const DEFAULT_CONFIG: InjectorConfig = {
  templateDir: '',
  includeSkills: true,
  includeKnowledge: true,
  customSections: {},
};

// Role-specific configurations
const ROLE_CONFIGS: Record<AgentRole, RoleConfig> = {
  PO: {
    emoji: '📋',
    title: 'Product Owner',
    focusAreas: ['요구사항 분석', '기획서 작성', 'User Story 정의'],
    restrictions: ['코드 직접 수정 금지', 'docs/ 영역만 작업'],
    outputFormat: 'Markdown 문서',
  },
  PM: {
    emoji: '📊',
    title: 'Project Manager',
    focusAreas: ['일정 관리', '리소스 배분', '진행 상황 추적'],
    restrictions: ['README, .github/ 영역만 작업'],
    outputFormat: '프로젝트 문서',
  },
  Architect: {
    emoji: '🏛️',
    title: 'Software Architect',
    focusAreas: ['시스템 설계', '인터페이스 정의', '아키텍처 문서화'],
    restrictions: ['types/, lib/ 영역 우선', '구현보다 설계 중심'],
    outputFormat: '설계 문서, 타입 정의',
  },
  FE: {
    emoji: '🎨',
    title: 'Frontend Developer',
    focusAreas: ['UI 구현', '컴포넌트 개발', '스타일링'],
    restrictions: ['src/app/, components/ 영역만 작업', 'BE 코드 수정 금지'],
    outputFormat: 'React 컴포넌트, CSS',
  },
  BE: {
    emoji: '⚙️',
    title: 'Backend Developer',
    focusAreas: ['API 개발', '비즈니스 로직', '데이터베이스'],
    restrictions: ['src/api/, lib/db/ 영역만 작업', 'FE 코드 수정 금지'],
    outputFormat: 'API 엔드포인트, 서비스 클래스',
  },
  QA: {
    emoji: '🔍',
    title: 'QA Engineer',
    focusAreas: ['테스트 작성', '버그 검증', '품질 보증'],
    restrictions: ['tests/, e2e/ 영역만 작업', '프로덕션 코드 수정 금지'],
    outputFormat: '테스트 코드, 버그 리포트',
  },
  DevOps: {
    emoji: '🚀',
    title: 'DevOps Engineer',
    focusAreas: ['CI/CD 설정', '인프라 구성', '배포 자동화'],
    restrictions: ['설정 파일, .github/workflows/ 영역', '비즈니스 로직 수정 금지'],
    outputFormat: 'YAML 설정, 스크립트',
  },
};

interface RoleConfig {
  emoji: string;
  title: string;
  focusAreas: string[];
  restrictions: string[];
  outputFormat: string;
}

export class PersonaInjector {
  private config: InjectorConfig;

  constructor(config: Partial<InjectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate and inject CLAUDE.md for a persona
   */
  async inject(context: InjectionContext): Promise<InjectionResult> {
    const { persona, worktreePath } = context;

    try {
      // Generate CLAUDE.md content
      const content = this.generateClaudeMd(context);

      // Ensure .claude directory exists
      const claudeDir = join(worktreePath, '.claude');
      await mkdir(claudeDir, { recursive: true });

      // Write CLAUDE.md
      const claudeMdPath = join(claudeDir, 'CLAUDE.md');
      await writeFile(claudeMdPath, content, 'utf-8');

      return {
        success: true,
        claudeMdPath,
        content,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        claudeMdPath: '',
        content: '',
        error: message,
      };
    }
  }

  /**
   * Generate CLAUDE.md content
   */
  generateClaudeMd(context: InjectionContext): string {
    const { persona, job, officeId, projectContext } = context;
    const roleConfig = ROLE_CONFIGS[persona.role];

    const sections: string[] = [];

    // Header
    sections.push(this.generateHeader(persona, roleConfig));

    // Persona Section
    sections.push(this.generatePersonaSection(persona, roleConfig));

    // Current Task Section
    if (job) {
      sections.push(this.generateTaskSection(job));
    }

    // Scope Restrictions
    sections.push(this.generateScopeSection(persona, roleConfig));

    // Skills Section
    if (this.config.includeSkills && persona.core_skills.length > 0) {
      sections.push(this.generateSkillsSection(persona));
    }

    // Knowledge Section
    if (this.config.includeKnowledge && persona.knowledge_refs.length > 0) {
      sections.push(this.generateKnowledgeSection(persona));
    }

    // Project Context
    if (projectContext) {
      sections.push(this.generateProjectContextSection(projectContext));
    }

    // Rules Section
    sections.push(this.generateRulesSection(persona, roleConfig, job));

    // Custom Sections
    for (const [name, content] of Object.entries(this.config.customSections)) {
      sections.push(`## ${name}\n\n${content}`);
    }

    // Footer
    sections.push(this.generateFooter(officeId, persona));

    return sections.join('\n\n---\n\n');
  }

  private generateHeader(persona: AgentPersona, roleConfig: RoleConfig): string {
    return `# ${roleConfig.emoji} ${persona.name || roleConfig.title} Agent

> **Role**: ${persona.role} | **Office**: Semo Office Agent
> **Generated**: ${new Date().toISOString()}

이 파일은 Semo Office에서 자동 생성되었습니다.
Agent의 역할과 권한을 정의합니다.`;
  }

  private generatePersonaSection(persona: AgentPersona, roleConfig: RoleConfig): string {
    return `## 🎭 페르소나

${persona.persona_prompt}

### 핵심 역량
${roleConfig.focusAreas.map((area) => `- ${area}`).join('\n')}

### 성격 특성
- **역할**: ${roleConfig.title}
- **출력 형식**: ${roleConfig.outputFormat}`;
  }

  private generateTaskSection(job: Job): string {
    return `## 📋 현재 작업

**Job ID**: \`${job.id}\`
**설명**: ${job.description}
**우선순위**: ${job.priority}
${job.depends_on.length > 0 ? `**의존성**: ${job.depends_on.join(', ')}` : ''}

### 작업 목표
- [ ] ${job.description}
- [ ] 커밋 메시지에 Job ID 포함
- [ ] PR 생성 (필요 시)`;
  }

  private generateScopeSection(persona: AgentPersona, roleConfig: RoleConfig): string {
    const patterns = persona.scope_patterns.length > 0
      ? persona.scope_patterns
      : ['*'];

    return `## 🔒 작업 범위 제한

### 허용 영역
\`\`\`
${patterns.join('\n')}
\`\`\`

### 제한 사항
${roleConfig.restrictions.map((r) => `- ⚠️ ${r}`).join('\n')}

> **중요**: 위 범위를 벗어난 파일 수정은 금지됩니다.`;
  }

  private generateSkillsSection(persona: AgentPersona): string {
    return `## 🛠️ 사용 가능한 스킬

${persona.core_skills.map((skill) => `- \`${skill}\``).join('\n')}

스킬은 \`/skill-name\` 형식으로 호출할 수 있습니다.`;
  }

  private generateKnowledgeSection(persona: AgentPersona): string {
    return `## 📚 참조 지식

${persona.knowledge_refs.map((ref) => `- ${ref}`).join('\n')}

위 문서들을 참조하여 일관된 코드/문서 스타일을 유지하세요.`;
  }

  private generateProjectContextSection(context: ProjectContext): string {
    const parts: string[] = ['## 🏗️ 프로젝트 컨텍스트'];

    if (context.techStack && context.techStack.length > 0) {
      parts.push(`### 기술 스택\n${context.techStack.map((t) => `- ${t}`).join('\n')}`);
    }

    if (context.conventions && context.conventions.length > 0) {
      parts.push(`### 코딩 컨벤션\n${context.conventions.map((c) => `- ${c}`).join('\n')}`);
    }

    if (context.repoUrl) {
      parts.push(`### 레포지토리\n- ${context.repoUrl}`);
    }

    return parts.join('\n\n');
  }

  private generateRulesSection(
    persona: AgentPersona,
    roleConfig: RoleConfig,
    job?: Job
  ): string {
    return `## 📜 필수 규칙

### 커밋 규칙
1. 커밋 메시지는 Conventional Commits 형식 사용
2. Job ID를 커밋 메시지에 포함: \`[${job?.id || 'JOB_ID'}]\`
3. 작업 완료 후 반드시 커밋

### PR 규칙
1. PR 제목에 작업 내용 명시
2. PR 본문에 변경 사항 요약
3. \`gh pr create\` 명령어 사용

### 협업 규칙
1. 다른 Agent 영역 수정 금지
2. 의존성 있는 작업은 순서 준수
3. 문제 발생 시 즉시 보고

### 품질 규칙
1. \`npm run lint\` 통과 필수
2. \`npm run build\` 통과 필수
3. 테스트 코드 작성 권장`;
  }

  private generateFooter(officeId: string, persona: AgentPersona): string {
    return `## ℹ️ 메타 정보

- **Office ID**: \`${officeId}\`
- **Persona ID**: \`${persona.id}\`
- **Role**: \`${persona.role}\`
- **Generated By**: Semo Office PersonaInjector
- **Version**: 1.0.0

---

_이 파일을 수동으로 수정하지 마세요. Semo Office에서 자동 관리됩니다._`;
  }

  /**
   * Load existing CLAUDE.md from worktree
   */
  async loadExisting(worktreePath: string): Promise<string | null> {
    try {
      const claudeMdPath = join(worktreePath, '.claude', 'CLAUDE.md');
      const content = await readFile(claudeMdPath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Merge custom sections with generated content
   */
  async mergeWithExisting(
    context: InjectionContext,
    preserveSections: string[] = []
  ): Promise<InjectionResult> {
    const existing = await this.loadExisting(context.worktreePath);

    if (existing && preserveSections.length > 0) {
      // Extract sections to preserve
      const preservedContent: Record<string, string> = {};
      for (const section of preserveSections) {
        const regex = new RegExp(`## ${section}\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
        const match = existing.match(regex);
        if (match) {
          preservedContent[section] = match[1].trim();
        }
      }

      // Merge with config
      this.config.customSections = {
        ...this.config.customSections,
        ...preservedContent,
      };
    }

    return this.inject(context);
  }

  /**
   * Validate persona constraints
   */
  validatePersona(persona: AgentPersona): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!persona.role) {
      errors.push('Role is required');
    }

    if (!persona.persona_prompt || persona.persona_prompt.length < 50) {
      warnings.push('Persona prompt is short, consider adding more detail');
    }

    if (persona.scope_patterns.length === 0) {
      warnings.push('No scope patterns defined, agent will have full access');
    }

    if (persona.core_skills.length === 0) {
      warnings.push('No core skills defined');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
