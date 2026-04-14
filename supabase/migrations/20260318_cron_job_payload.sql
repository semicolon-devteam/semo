DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'semo') THEN
    ALTER TABLE semo.bot_cron_jobs ADD COLUMN IF NOT EXISTS payload JSONB;
  END IF;
END $$;
