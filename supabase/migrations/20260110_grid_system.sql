-- Grid System Migration
-- Adds moving/listening status and target position columns for Order Zone feature

-- 1. Drop existing status CHECK constraint
ALTER TABLE office_agents
DROP CONSTRAINT IF EXISTS office_agents_status_check;

-- 2. Add extended status CHECK constraint (including 'moving', 'listening')
ALTER TABLE office_agents
ADD CONSTRAINT office_agents_status_check
CHECK (status IN ('idle', 'working', 'blocked', 'moving', 'listening', 'error'));

-- 3. Add target position columns for agent movement
ALTER TABLE office_agents
ADD COLUMN IF NOT EXISTS target_x INT,
ADD COLUMN IF NOT EXISTS target_y INT;

-- 4. Add comments for documentation
COMMENT ON COLUMN office_agents.target_x IS 'Target X position when agent is moving';
COMMENT ON COLUMN office_agents.target_y IS 'Target Y position when agent is moving';
COMMENT ON COLUMN office_agents.status IS 'Agent status: idle, working, blocked, moving, listening, error';

-- 5. Update existing agents to have grid-aligned positions (50x50 grid)
-- Align positions to grid center (position = gridCell * 50 + 25)
UPDATE office_agents
SET
  position_x = (FLOOR(position_x / 50) * 50 + 25)::INT,
  position_y = (FLOOR(position_y / 50) * 50 + 25)::INT
WHERE position_x > 0 AND position_y > 0;

-- 6. Create index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_office_agents_status ON office_agents(status);

-- 7. Create index for office + status queries
CREATE INDEX IF NOT EXISTS idx_office_agents_office_status ON office_agents(office_id, status);
