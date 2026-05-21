import type { AgentListItem } from '@/lib/agents-db';
import AgentStatusCard from './AgentStatusCard';

interface Props {
  agents: AgentListItem[];
}

export default function AgentStatusGrid({ agents }: Props) {
  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        등록된 agent가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentStatusCard key={agent.agent_id} agent={agent} />
      ))}
    </div>
  );
}
