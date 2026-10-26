import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("../auth", () => ({ auth: mockAuth }));
import { GET, POST } from "../app/api/admin/[...segments]/route";
import { assertSameOrigin } from "../lib/api";

describe("admin API authentication and CSRF", () => {
  beforeEach(() => mockAuth.mockReset().mockResolvedValue(null));
  it("returns 401 for an unauthenticated request", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/campuses"), { params: Promise.resolve({ segments: ["campuses"] }) });
    expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
  });
  it("rejects writes without a same-origin header", async () => {
    mockAuth.mockResolvedValue({ user: { id: "test-user" } });
    const response = await POST(new NextRequest("http://localhost/api/admin/campuses", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), { params: Promise.resolve({ segments: ["campuses"] }) });
    expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ ok: false, error: { code: "CSRF_REJECTED" } });
  });
  it("accepts matching Origin and Host", () => {
    const request = new NextRequest("http://localhost/api/admin/campuses", { headers: { origin: "http://localhost", host: "localhost" } });
    expect(assertSameOrigin(request)).toBe(true);
  });
});
