/**
 * Surface map: maps bot IDs to their cmux surface refs (e.g. "surface:38").
 * Source of truth is JSON at SEMO_SURFACE_MAP (default /tmp/semo-surface-map.json),
 * produced by semo-agents-start.sh when the workspace is set up.
 */
import * as fs from 'fs';

export interface SurfaceMap {
  workspace: string;
  surfaces: Record<string, string>;
}

export function loadSurfaceMap(): SurfaceMap {
  const mapPath = process.env.SEMO_SURFACE_MAP || '/tmp/semo-surface-map.json';
  try {
    return JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch {
    // No fallback pane guessing — wrong pane indices can send /quit to
    // unrelated sessions. Empty surfaces means callers treat all bots as
    // "manual mode" and skip automatic restart (safer default).
    const workspace = process.env.SEMO_WORKSPACE || 'semo-agents';
    return { workspace, surfaces: {} };
  }
}
