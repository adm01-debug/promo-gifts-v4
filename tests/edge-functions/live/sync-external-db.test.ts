/**
 * Integração LIVE — sync-external-db
 * Gerado por scripts/gen-edge-live-tests.mjs. Enriqueça o descritor em
 * tests/edge-functions/live/descriptors.ts (não edite este shim).
 */
import { runLiveSuite } from "./_live-suite";
import { descriptorFor } from "./descriptors";

runLiveSuite(descriptorFor("sync-external-db"));
