import { describe, it, expect } from "vitest";
import { filterByRoutePermission } from "@/lib/navigation/filter-restricted-items";

interface Item {
  id: string;
  path?: string;
}

const items: Item[] = [
  { id: "home", path: "/" },
  { id: "quotes", path: "/orcamentos" },
  { id: "users", path: "/admin/usuarios" },
  { id: "telemetry", path: "/admin/telemetria" },
  { id: "connections", path: "/admin/conexoes/status" },
  { id: "rbac", path: "/admin/rbac-rotas" },
  { id: "settings", path: "/configuracoes" },
];

describe("filterByRoutePermission", () => {
  it("agente vê só rotas autenticadas e ações sem path", () => {
    const out = filterByRoutePermission(items, (i) => i.path, {
      isDev: false,
      isAdmin: false,
    });
    expect(out.map((i) => i.id)).toEqual(["home", "quotes", "settings"]);
  });

  it("admin vê admin + autenticadas, mas NÃO vê dev-only", () => {
    const out = filterByRoutePermission(items, (i) => i.path, {
      isDev: false,
      isAdmin: true,
    });
    const ids = out.map((i) => i.id);
    expect(ids).toContain("users");
    expect(ids).not.toContain("telemetry");
    expect(ids).not.toContain("connections");
    expect(ids).not.toContain("rbac");
  });

  it("dev vê tudo", () => {
    const out = filterByRoutePermission(items, (i) => i.path, {
      isDev: true,
      isAdmin: true,
    });
    expect(out).toHaveLength(items.length);
  });

  it("itens com path válido para o papel são incluídos", () => {
    const out = filterByRoutePermission(items, (i) => i.path, {
      isDev: false,
      isAdmin: false,
    });
    expect(out.find((i) => i.id === "settings")).toBeTruthy();
  });
});
