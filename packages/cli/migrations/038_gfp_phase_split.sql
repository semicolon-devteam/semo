BEGIN;

-- GFP Phase 3 분리: Clarification(Q&A) + Design System(디자인)
-- Phase 3 → Clarification(3) + Design System(4), 이후 Phase +1 shift → 10단계(0-9)

-- 1. Shift phases 8→9, 7→8, 6→7, 5→6, 4→5 (descending to avoid UNIQUE violation)
UPDATE semo.gfp_phase_sections SET phase = 9 WHERE phase = 8;
UPDATE semo.gfp_phase_sections SET phase = 8 WHERE phase = 7;
UPDATE semo.gfp_phase_sections SET phase = 7 WHERE phase = 6;
UPDATE semo.gfp_phase_sections SET phase = 6 WHERE phase = 5;
UPDATE semo.gfp_phase_sections SET phase = 5 WHERE phase = 4;

-- 2. Move phase 3 design-prefixed sections → phase 4
UPDATE semo.gfp_phase_sections SET phase = 4
WHERE phase = 3
  AND (section_key LIKE 'ref-%' OR section_key LIKE 'ds-%'
    OR section_key LIKE 'impl-%' OR section_key LIKE 'review-%'
    OR section_key LIKE 'handoff-%' OR section_key LIKE 'stitch-%');

-- 3. Phase 3 non-design sections (Q&A) stay at 3

-- 4. Shift gfp_projects.current_phase for existing projects
UPDATE semo.gfp_projects SET current_phase = current_phase + 1 WHERE current_phase >= 4;

COMMIT;
