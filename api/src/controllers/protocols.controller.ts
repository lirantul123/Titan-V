import type { Request, Response } from "express";
import type { Protocol } from "../models/Protocol.js";

const PROTOCOLS: Protocol[] = [
  { cmd: "\\SCAN", info: "PING_ALL_NODES" },
  { cmd: "\\LOCATE [ID]", info: "WARP TO TARGET (E.G. \\LOCATE 1)" },
  { cmd: "\\CLEAR", info: "PURGE_TERMINAL_LOG" },
  { cmd: "\\HELP", info: "INDEX_COMMANDS" },
];

export function listProtocols(_req: Request, res: Response): void {
  res.json({ protocols: PROTOCOLS });
}
