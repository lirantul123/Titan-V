import { Router } from "express";
import { geocode } from "../controllers/geocode.controller.js";
import { getMe } from "../controllers/me.controller.js";
import { listProtocols } from "../controllers/protocols.controller.js";
import { ping } from "../controllers/system.controller.js";
import { getTargets, postTarget, removeTarget } from "../controllers/targets.controller.js";
import { weather } from "../controllers/weather.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireSupabaseUser } from "../middleware/requireSupabaseUser.js";

export const v1Router = Router();

v1Router.get("/protocols", listProtocols);
v1Router.get("/system/ping", ping);
v1Router.get("/me", getMe);
v1Router.post("/geocode", asyncHandler(geocode));
v1Router.get("/weather", asyncHandler(weather));
v1Router.get("/targets", requireSupabaseUser, asyncHandler(getTargets));
v1Router.post("/targets", requireSupabaseUser, asyncHandler(postTarget));
v1Router.delete("/targets/:id", requireSupabaseUser, asyncHandler(removeTarget));
