import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { resetTargetStore } from "../src/repositories/targetRepository.js";

describe("Titan-V API", () => {
  const app = createApp();

  beforeEach(() => {
    resetTargetStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetTargetStore();
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", service: "titan-v-api" });
  });

  it("GET /api/v1/protocols returns protocols array", async () => {
    const res = await request(app).get("/api/v1/protocols").expect(200);
    expect(Array.isArray(res.body.protocols)).toBe(true);
    expect(res.body.protocols.length).toBeGreaterThan(0);
    expect(res.body.protocols[0]).toHaveProperty("cmd");
  });

  it("GET /api/v1/system/ping returns serverTime", async () => {
    const res = await request(app).get("/api/v1/system/ping").expect(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.serverTime).toBe("string");
  });

  it("POST /api/v1/geocode validates body", async () => {
    await request(app).post("/api/v1/geocode").send({}).expect(400);
  });

  it("POST /api/v1/geocode maps nominatim results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          json: async () => [{ lat: "1.23", lon: "4.56", display_name: "Test City, X" }],
        }),
      ) as unknown as typeof fetch,
    );

    const res = await request(app).post("/api/v1/geocode").send({ q: "Test" }).expect(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({
      lat: 1.23,
      lon: 4.56,
      displayName: "Test City, X",
    });
  });

  it("GET /api/v1/weather validates query", async () => {
    await request(app).get("/api/v1/weather").expect(400);
  });

  it("GET /api/v1/weather returns current_weather", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            current_weather: {
              temperature: 12,
              windspeed: 30,
              winddirection: 180,
              weathercode: 0,
              time: "2026-01-01T00:00",
            },
          }),
        }),
      ) as unknown as typeof fetch,
    );

    const res = await request(app).get("/api/v1/weather?lat=10&lon=20").expect(200);
    expect(res.body.current_weather.temperature).toBe(12);
  });

  it("GET /api/v1/targets with Bearer returns 503 when API has no Supabase keys", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    try {
      const res = await request(app).get("/api/v1/targets").set("Authorization", "Bearer fake.jwt.token").expect(503);
      expect(res.body.error).toBe("API_NOT_CONFIGURED_FOR_AUTH");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("CRUD /api/v1/targets", async () => {
    const empty = await request(app).get("/api/v1/targets").expect(200);
    expect(empty.body.targets).toEqual([]);

    const created = await request(app)
      .post("/api/v1/targets")
      .send({ name: "NODE_A", lat: 1, lon: 2 })
      .expect(201);
    const id = created.body.target.id as string;

    const listed = await request(app).get("/api/v1/targets").expect(200);
    expect(listed.body.targets).toHaveLength(1);

    await request(app).delete(`/api/v1/targets/${id}`).expect(204);
    const after = await request(app).get("/api/v1/targets").expect(200);
    expect(after.body.targets).toEqual([]);
  });

  it("GET /openapi.json serves spec", async () => {
    const res = await request(app).get("/openapi.json").expect(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.paths["/health"]).toBeDefined();
  });

  it("unknown route is 404", async () => {
    await request(app).get("/nope").expect(404);
  });
});
