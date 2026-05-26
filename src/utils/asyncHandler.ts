import { Request, Response, NextFunction } from 'express';

type AsyncFn = (req: any, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
