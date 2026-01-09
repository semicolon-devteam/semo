import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { useOfficeStore, Agent, Job, Message } from '@/stores/officeStore';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function useSupabaseRealtime(officeId: string | null) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const { setAgents, updateAgent, updateJob, addMessage } = useOfficeStore();

  useEffect(() => {
    if (!officeId || officeId === 'demo' || !supabaseUrl || !supabaseKey) return;

    const supabase = getSupabaseClient();

    // Presence channel for agent positions
    const presenceChannel = supabase
      .channel(`office:${officeId}:presence`)
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const agents: Agent[] = [];

        for (const [key, presences] of Object.entries(state)) {
          for (const presence of presences as any[]) {
            agents.push({
              id: presence.agentId,
              role: presence.role,
              name: presence.name || presence.role,
              x: presence.x,
              y: presence.y,
              status: presence.status,
              currentTask: presence.currentTask,
              lastMessage: presence.lastMessage,
            });
          }
        }

        setAgents(agents);
      })
      .subscribe();

    channelsRef.current.push(presenceChannel);

    // Broadcast channel for messages
    const messageChannel = supabase
      .channel(`office:${officeId}:messages`)
      .on('broadcast', { event: 'agent_message' }, ({ payload }) => {
        addMessage({
          id: payload.id,
          fromAgentId: payload.from_agent_id,
          toAgentId: payload.to_agent_id,
          content: payload.content,
          timestamp: new Date(payload.created_at),
        });

        // Update agent's last message
        if (payload.from_agent_id) {
          updateAgent(payload.from_agent_id, {
            lastMessage: payload.content,
          });
        }
      })
      .subscribe();

    channelsRef.current.push(messageChannel);

    // Postgres changes for jobs
    const jobChannel = supabase
      .channel(`office:${officeId}:jobs`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_queue',
          filter: `office_id=eq.${officeId}`,
        },
        (payload) => {
          const job = payload.new as any;
          if (job) {
            updateJob(job.id, {
              status: job.status,
              prNumber: job.pr_number,
              progress: job.status === 'done' || job.status === 'merged' ? 100 :
                        job.status === 'processing' ? 50 :
                        job.status === 'ready' ? 10 : 0,
            });
          }
        }
      )
      .subscribe();

    channelsRef.current.push(jobChannel);

    // Postgres changes for agents
    const agentChannel = supabase
      .channel(`office:${officeId}:agents`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'office_agents',
          filter: `office_id=eq.${officeId}`,
        },
        (payload) => {
          const agent = payload.new as any;
          if (agent) {
            updateAgent(agent.id, {
              status: agent.status,
              currentTask: agent.current_task,
              lastMessage: agent.last_message,
            });
          }
        }
      )
      .subscribe();

    channelsRef.current.push(agentChannel);

    // Cleanup
    return () => {
      for (const channel of channelsRef.current) {
        supabase.removeChannel(channel);
      }
      channelsRef.current = [];
    };
  }, [officeId, setAgents, updateAgent, updateJob, addMessage]);
}
