-- Rollback della migrazione 0003_square_tag.
--
-- Generato da scripts/genera-rollback.mjs e riletto a mano.
--
-- ATTENZIONE: eliminare una tabella elimina i suoi dati. Serve ad annullare
-- un rilascio andato male in staging, non all'uso ordinario in produzione.
-- Fare un backup prima di eseguirlo.
--
--   npm run db:rollback

-- Tabelle introdotte dalla migrazione
DROP TABLE IF EXISTS "conversions" CASCADE;

