DO $$
BEGIN
  IF to_regclass('public."Indicator"') IS NOT NULL
     AND to_regclass('public."Indicators"') IS NULL THEN
    ALTER TABLE "Indicator" RENAME TO "Indicators";
  END IF;
END $$;

-- Optional: keep naming consistent after table rename
DO $$
BEGIN
  IF to_regclass('public."Indicator_coinId_time_idx"') IS NOT NULL THEN
    ALTER INDEX "Indicator_coinId_time_idx" RENAME TO "Indicators_coinId_time_idx";
  END IF;

  IF to_regclass('public."Indicator_overallSignal_idx"') IS NOT NULL THEN
    ALTER INDEX "Indicator_overallSignal_idx" RENAME TO "Indicators_overallSignal_idx";
  END IF;

  IF to_regclass('public."Indicator_coinId_timeframeId_time_key"') IS NOT NULL THEN
    ALTER INDEX "Indicator_coinId_timeframeId_time_key" RENAME TO "Indicators_coinId_timeframeId_time_key";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'Indicators'
      AND constraint_name = 'Indicator_pkey'
  ) THEN
    ALTER TABLE "Indicators" RENAME CONSTRAINT "Indicator_pkey" TO "Indicators_pkey";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'Indicators'
      AND constraint_name = 'Indicator_coinId_fkey'
  ) THEN
    ALTER TABLE "Indicators" RENAME CONSTRAINT "Indicator_coinId_fkey" TO "Indicators_coinId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'Indicators'
      AND constraint_name = 'Indicator_timeframeId_fkey'
  ) THEN
    ALTER TABLE "Indicators" RENAME CONSTRAINT "Indicator_timeframeId_fkey" TO "Indicators_timeframeId_fkey";
  END IF;
END $$;
