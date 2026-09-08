/**
 * Retention parking on the push loop.
 *
 * A session past the org's retention window fails its push with
 * ORG2_RETENTION_EXPIRED on every pass; retention only recedes further
 * within a signed-in run, so the engine must stop re-walking the doomed
 * upload chain instead of retrying it each pass.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { sessionsAtom } from "@src/store/session/sessionAtom/atoms";

import { org2CloudRetentionParkedAtom } from "./org2CloudSyncAtoms";
import { Org2CloudSyncError } from "./org2CloudSyncClient";
import {
  SESSION,
  cleanupEngineFixture,
  createEngineFixture,
} from "./org2CloudSyncEngine.testUtils";
import type { EngineFixture } from "./org2CloudSyncEngine.testUtils";
import {
  getSyncJournalSnapshot,
  resetSyncJournalForTests,
} from "./org2CloudSyncJournal";

describe("Org2CloudSyncEngine retention parking", () => {
  let fixture: EngineFixture;
  let engine: EngineFixture["engine"];

  beforeEach(() => {
    resetSyncJournalForTests();
    fixture = createEngineFixture();
    ({ engine } = fixture);
  });

  afterEach(() => {
    cleanupEngineFixture(engine);
    resetSyncJournalForTests();
  });

  it("parks a retention-expired session instead of retrying every pass", async () => {
    fixture.client.upsertSessionMetadata.mockRejectedValue(
      new Org2CloudSyncError("ORG2_RETENTION_EXPIRED", 400)
    );

    await engine.runSyncPass();
    expect(fixture.client.upsertSessionMetadata).toHaveBeenCalledTimes(1);
    expect(
      getSyncJournalSnapshot().some(
        (event) =>
          event.kind === "session_retention_parked" &&
          event.code === "ORG2_RETENTION_EXPIRED"
      )
    ).toBe(true);

    await engine.runSyncPass();
    expect(fixture.client.upsertSessionMetadata).toHaveBeenCalledTimes(1);
  });

  it("keeps retrying pushes that fail with other codes", async () => {
    fixture.client.upsertSessionMetadata.mockRejectedValue(
      new Org2CloudSyncError("ORG2_VALIDATION", 400)
    );

    await engine.runSyncPass();
    await engine.runSyncPass();
    expect(fixture.client.upsertSessionMetadata).toHaveBeenCalledTimes(2);
  });

  it("persists the park so a fresh engine on the next boot does not retry the same local state", async () => {
    fixture.client.upsertSessionMetadata.mockRejectedValue(
      new Org2CloudSyncError("ORG2_RETENTION_EXPIRED", 400)
    );
    await engine.runSyncPass();
    expect(fixture.client.upsertSessionMetadata).toHaveBeenCalledTimes(1);
    expect(fixture.store.get(org2CloudRetentionParkedAtom)).toEqual({
      [`corg-1|${SESSION.session_id}`]: SESSION.updated_at,
    });

    const persisted = fixture.store.get(org2CloudRetentionParkedAtom);
    cleanupEngineFixture(engine);
    const rebooted = createEngineFixture();
    engine = rebooted.engine;
    rebooted.store.set(org2CloudRetentionParkedAtom, persisted);
    rebooted.client.upsertSessionMetadata.mockRejectedValue(
      new Org2CloudSyncError("ORG2_RETENTION_EXPIRED", 400)
    );
    await engine.runSyncPass();
    expect(rebooted.client.upsertSessionMetadata).not.toHaveBeenCalled();

    rebooted.store.set(org2CloudRetentionParkedAtom, {});
    await engine.runSyncPass();
    expect(rebooted.client.upsertSessionMetadata).toHaveBeenCalledTimes(1);
  });

  it("releases a persisted park once the session has new local activity", async () => {
    fixture.store.set(org2CloudRetentionParkedAtom, {
      [`corg-1|${SESSION.session_id}`]: SESSION.updated_at,
    });
    fixture.client.upsertSessionMetadata.mockRejectedValue(
      new Org2CloudSyncError("ORG2_RETENTION_EXPIRED", 400)
    );

    await engine.runSyncPass();
    expect(fixture.client.upsertSessionMetadata).not.toHaveBeenCalled();

    fixture.store.set(sessionsAtom, [
      { ...SESSION, updated_at: "2026-07-02T00:00:00.000Z" },
    ]);
    await engine.runSyncPass();
    expect(fixture.client.upsertSessionMetadata).toHaveBeenCalledTimes(1);
    expect(fixture.store.get(org2CloudRetentionParkedAtom)).toEqual({
      [`corg-1|${SESSION.session_id}`]: "2026-07-02T00:00:00.000Z",
    });
  });
});
