// SEMO Office - Workflow Types for Order Zone Commands

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  name: string;
  agent: string;
  description?: string;
}

/**
 * Workflow definition from DB
 * Matches the workflow_definitions table schema
 */
export interface WorkflowDefinition {
  id: string;
  office_id: string;
  name: string;
  description: string | null;
  steps: WorkflowStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Order command payload for submitting to Orchestrator
 */
export interface OrderCommand {
  command: string;
  workflowId: string | null;  // null = auto-detect by Orchestrator
}
