'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { VitoUtterance } from '@/lib/vito';

interface TeamMember {
  domain: string;
  name: string;
  role: string;
}

interface TranscriptPreviewProps {
  utterances: VitoUtterance[];
  speakerMap: Record<string, string>;
  activeTimeMs?: number;
  onPlayAt?: (startMs: number) => void;
  onSpeakerChange?: (spkId: number, newName: string) => void;
  editable?: boolean;
}

export default function TranscriptPreview({
  utterances, speakerMap, activeTimeMs, onPlayAt, onSpeakerChange, editable,
}: TranscriptPreviewProps) {
  const [editingGroup, setEditingGroup] = useState<{ spk: number; idx: number } | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const selectRef = useRef<HTMLSelectElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const lastScrolledGroup = useRef<number>(-1);

  // Load team members when editable
  useEffect(() => {
    if (!editable) return;
    fetch('/api/meetings/team')
      .then((r) => r.ok ? r.json() : { members: [] })
      .then((data) => setTeamMembers(data.members ?? []))
      .catch(() => {});
  }, [editable]);

  // Focus select when editing starts (without scrolling the container)
  useEffect(() => {
    if (editingGroup && selectRef.current) {
      // preventScroll stops the browser from auto-scrolling
      selectRef.current.focus({ preventScroll: true });
    }
  }, [editingGroup]);

  // Auto-scroll to active group during playback
  useEffect(() => {
    if (activeTimeMs === undefined || !activeRowRef.current || !containerRef.current) return;

    // Find active group index
    const activeIdx = grouped.findIndex((g) => isGroupActive(g));
    if (activeIdx === -1 || activeIdx === lastScrolledGroup.current) return;

    lastScrolledGroup.current = activeIdx;
    activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimeMs]);

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Group consecutive utterances by same speaker
  const grouped = useMemo(() => {
    const result: {
      speaker: string;
      spk: number;
      messages: { text: string; startMs: number; endMs: number }[];
    }[] = [];
    for (let i = 0; i < utterances.length; i++) {
      const u = utterances[i];
      const nextU = utterances[i + 1];
      const speakerName = speakerMap[String(u.spk)] || `Speaker ${u.spk}`;
      const endMs = nextU ? nextU.start_at : u.start_at + u.duration;
      const last = result[result.length - 1];
      if (last && last.spk === u.spk) {
        last.messages.push({ text: u.msg, startMs: u.start_at, endMs });
      } else {
        result.push({
          speaker: speakerName,
          spk: u.spk,
          messages: [{ text: u.msg, startMs: u.start_at, endMs }],
        });
      }
    }
    return result;
  }, [utterances, speakerMap]);

  // Check if a group is currently being played
  const isGroupActive = useCallback((group: typeof grouped[0]): boolean => {
    if (activeTimeMs === undefined) return false;
    const firstMsg = group.messages[0];
    const lastMsg = group.messages[group.messages.length - 1];
    return activeTimeMs >= firstMsg.startMs && activeTimeMs < lastMsg.endMs;
  }, [activeTimeMs]);

  // Check if a specific message is the currently playing one
  function isMessageActive(msg: { startMs: number; endMs: number }): boolean {
    if (activeTimeMs === undefined) return false;
    return activeTimeMs >= msg.startMs && activeTimeMs < msg.endMs;
  }

  function handleSpeakerSelect(spk: number, newName: string) {
    setEditingGroup(null);
    if (newName && onSpeakerChange) {
      onSpeakerChange(spk, newName);
    }
  }

  function handleSpeakerClick(spk: number, groupIdx: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!editable) return;
    setEditingGroup({ spk, idx: groupIdx });
  }

  return (
    <div ref={containerRef} className="space-y-1 max-h-[600px] overflow-y-auto scroll-smooth">
      {grouped.map((group, i) => {
        const active = isGroupActive(group);
        const isEditing = editingGroup?.idx === i;

        return (
          <div
            key={i}
            ref={active ? activeRowRef : undefined}
            className={`flex gap-3 rounded-lg p-2 -mx-2 transition-colors ${
              active ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' : 'border-l-2 border-transparent'
            }`}
          >
            {/* Speaker name + time */}
            <div className="shrink-0 w-32 relative">
              {isEditing ? (
                <select
                  ref={selectRef}
                  defaultValue={group.speaker}
                  onChange={(e) => handleSpeakerSelect(group.spk, e.target.value)}
                  onBlur={() => setEditingGroup(null)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingGroup(null); }}
                  className="w-full border border-blue-400 rounded px-1 py-0.5 text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 z-10"
                >
                  <option value="" disabled>-- 선택 --</option>
                  {teamMembers.map((m) => (
                    <option key={m.domain} value={m.name}>{m.name}</option>
                  ))}
                  {!teamMembers.some(m => m.name === group.speaker) && (
                    <option value={group.speaker}>{group.speaker}</option>
                  )}
                </select>
              ) : (
                <span
                  onClick={(e) => handleSpeakerClick(group.spk, i, e)}
                  className={`text-sm font-medium text-blue-700 dark:text-blue-400 inline-block ${
                    editable ? 'cursor-pointer hover:underline hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 -mx-1' : ''
                  }`}
                  title={editable ? '클릭하여 화자 변경' : undefined}
                >
                  {group.speaker}
                </span>
              )}
              <span className="block text-xs text-gray-400 mt-0.5">
                {formatTime(group.messages[0].startMs)}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 min-w-0">
              {group.messages.map((msg, j) => {
                const msgActive = isMessageActive(msg);
                return (
                  <p
                    key={j}
                    onClick={() => onPlayAt?.(msg.startMs)}
                    className={`text-sm leading-relaxed break-words rounded px-1 -mx-1 transition-colors ${
                      msgActive
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-gray-900 dark:text-yellow-100 font-medium'
                        : 'text-gray-800 dark:text-gray-200'
                    } ${
                      onPlayAt ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50' : ''
                    }`}
                  >
                    {msg.text}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
