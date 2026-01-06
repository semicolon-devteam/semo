import { create } from 'zustand';

export interface Agent {
  id: string;
  role: string;
  name: string;
  x: number;
  y: number;
  status: 'idle' | 'working' | 'blocked';
  currentTask?: string;
  lastMessage?: string;
}

export interface Job {
  id: string;
  description: string;
  status: 'pending' | 'ready' | 'processing' | 'done' | 'merged' | 'failed';
  agentRole?: string;
  progress?: number;
  prNumber?: number;
}

export interface Message {
  id: string;
  fromAgentId?: string;
  toAgentId?: string;
  content: string;
  timestamp: Date;
}

interface OfficeState {
  officeId: string | null;
  agents: Agent[];
  jobs: Job[];
  messages: Message[];
  selectedAgentId: string | null;

  // Actions
  setOfficeId: (id: string) => void;
  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setJobs: (jobs: Job[]) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  addMessage: (message: Message) => void;
  selectAgent: (id: string | null) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
  officeId: null,
  agents: [],
  jobs: [],
  messages: [],
  selectedAgentId: null,

  setOfficeId: (id) => set({ officeId: id }),

  setAgents: (agents) => set({ agents }),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, ...updates } : agent
      ),
    })),

  setJobs: (jobs) => set({ jobs }),

  updateJob: (id, updates) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, ...updates } : job
      ),
    })),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message].slice(-100), // Keep last 100
    })),

  selectAgent: (id) => set({ selectedAgentId: id }),
}));
