// U-08 à U-09 — asyncHandler
import { asyncHandler } from '../../utils/asyncHandler';
import { Request, Response, NextFunction } from 'express';

const req = {} as Request;
const res = {} as Response;

// ── U-08 : Erreur async propagée vers next() ─────────────────────────────────
test('U-08 erreur async propagée vers next()', async () => {
  const error = new Error('boom');
  const fn = async () => { throw error; };
  const next = jest.fn() as NextFunction;

  await asyncHandler(fn)(req, res, next);

  expect(next).toHaveBeenCalledWith(error);
});

// ── U-09 : Succès async → next() non appelé avec erreur ─────────────────────
test('U-09 succès async → next() non appelé', async () => {
  const fn = async (_req: any, _res: any, _next: any) => { /* no-op */ };
  const next = jest.fn() as NextFunction;

  await asyncHandler(fn)(req, res, next);

  expect(next).not.toHaveBeenCalled();
});
