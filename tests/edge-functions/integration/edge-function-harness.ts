import { expect } from "vitest";
import { mockEdgeFunctionFetch, type EdgeFnResponseSpec } from "../../p0/_mocks";

const DEFAULT_BASE_URL = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

type Primitive = string | number | boolean | null;
export type Json = Primitive | Json[] | { [k: string]: Json };

export interface EdgeAuthMock {
  token?: string;
  userId?: string;
  role?: string;
}

export interface EdgeRequestContext<TPayload extends Json | undefined = Json | undefined> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  headers?: Record<string, string>;
  auth?: EdgeAuthMock;
  payload?: TPayload;
}

export type EdgePayloadFixtures<TPayload extends Json> = Record<string, TPayload>;

export interface EdgeInvocationResult {
  response: Response;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export function createEdgeFixtureFactory<TPayload extends Json>(fixtures: EdgePayloadFixtures<TPayload>) {
  return {
    get(name: keyof typeof fixtures): TPayload {
      return structuredClone(fixtures[name]);
    },
    list(): Array<keyof typeof fixtures> {
      return Object.keys(fixtures);
    },
  };
}

export function buildEdgeHeaders(ctx: EdgeRequestContext): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(ctx.headers ?? {}),
  };

  if (ctx.auth?.token) {
    headers.Authorization = `Bearer ${ctx.auth.token}`;
  }

  if (ctx.auth?.userId) {
    headers["x-test-user-id"] = ctx.auth.userId;
  }

  if (ctx.auth?.role) {
    headers["x-test-role"] = ctx.auth.role;
  }

  return headers;
}

export async function invokeMockedEdgeFunction(
  route: string,
  expectedResponse: EdgeFnResponseSpec,
  ctx: EdgeRequestContext = {},
  options?: { baseUrl?: string },
): Promise<EdgeInvocationResult> {
  const fetchMock = mockEdgeFunctionFetch({ [route]: expectedResponse });
  const method = ctx.method ?? "POST";
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const requestInit: RequestInit = {
    method,
    headers: buildEdgeHeaders(ctx),
  };

  if (ctx.payload !== undefined) {
    requestInit.body = JSON.stringify(ctx.payload);
  }

  const response = await fetch(`${baseUrl}${route}`, requestInit);

  expect(fetchMock).toHaveBeenCalledTimes(1);

  return {
    response,
    json: () => response.clone().json(),
    text: () => response.clone().text(),
  };
}

export async function expectEdgeResponse(
  result: EdgeInvocationResult,
  expected: {
    status: number;
    headers?: Record<string, string | RegExp>;
    body?: unknown;
    bodyPredicate?: (body: unknown) => void;
  },
): Promise<void> {
  expect(result.response.status).toBe(expected.status);

  if (expected.headers) {
    for (const [headerName, value] of Object.entries(expected.headers)) {
      const current = result.response.headers.get(headerName.toLowerCase());
      expect(current, `Header ${headerName} não encontrado`).toBeTruthy();
      if (value instanceof RegExp) {
        expect(current).toMatch(value);
      } else {
        expect(current).toBe(value);
      }
    }
  }

  if (expected.body !== undefined || expected.bodyPredicate) {
    const body = await result.json();
    if (expected.body !== undefined) expect(body).toEqual(expected.body);
    expected.bodyPredicate?.(body);
  }
}
