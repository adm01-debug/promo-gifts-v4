import { afterEach, describe, expect, it } from "vitest";
import { resetExternalMocks } from "../../p0/_mocks";
import {
  createEdgeFixtureFactory,
  expectEdgeResponse,
  invokeMockedEdgeFunction,
  type EdgePayloadFixtures,
} from "./edge-function-harness";

afterEach(() => {
  resetExternalMocks();
});

describe("edge-function-harness", () => {
  it("invoca edge function mockada com contexto de autenticação", async () => {
    const result = await invokeMockedEdgeFunction(
      "/validate-access",
      {
        status: 200,
        body: { allowed: true, reason: "ok" },
        headers: { "x-request-id": "req-1" },
      },
      {
        method: "POST",
        auth: { token: "valid-jwt", userId: "user-123", role: "seller" },
        payload: { resource: "quotes", action: "read" },
      },
    );

    await expectEdgeResponse(result, {
      status: 200,
      headers: {
        "content-type": /application\/json/i,
        "x-request-id": "req-1",
      },
      body: { allowed: true, reason: "ok" },
    });
  });

  it("permite fixture de payload com clone defensivo", () => {
    const fixtures: EdgePayloadFixtures<{ flow: string; tags: string[] }> = {
      minimal: { flow: "lead", tags: ["a"] },
    };

    const payloads = createEdgeFixtureFactory(fixtures);
    const first = payloads.get("minimal");
    first.tags.push("mutated");

    const second = payloads.get("minimal");
    expect(second.tags).toEqual(["a"]);
  });

  it("assertion padronizada aceita predicado de body", async () => {
    const result = await invokeMockedEdgeFunction("/health-check", {
      status: 503,
      body: { status: "unhealthy", checks: { db: { status: "down" } } },
    });

    await expectEdgeResponse(result, {
      status: 503,
      bodyPredicate: (body) => {
        const parsed = body as { status: string; checks: { db: { status: string } } };
        expect(parsed.status).toBe("unhealthy");
        expect(parsed.checks.db.status).toBe("down");
      },
    });
  });
});
