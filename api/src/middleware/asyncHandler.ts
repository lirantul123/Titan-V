import type { NextFunction, Request, Response } from "express";

export type AsyncController = (req: Request, res: Response) => Promise<void>;

export function asyncHandler(fn: AsyncController) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res)).catch(next);
  };
}
