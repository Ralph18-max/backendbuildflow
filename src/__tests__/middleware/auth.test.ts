// U-01 à U-05 — authMiddleware & requireRole
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, requireRole, AuthRequest } from '../../middleware/auth.middleware';

const SECRET = 'test-secret-key';

function makeRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res as Response;
}

function makeNext(): NextFunction { return jest.fn(); }

// ── U-01 : Token valide → req.user populé ───────────────────────────────────
test('U-01 token valide → req.user populé et next() appelé', () => {
  const payload = { id: 1, email: 'a@b.ci', role: 'admin', tenant_id: 'tid1' };
  const token = jwt.sign(payload, SECRET);

  const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
  const res = makeRes();
  const next = makeNext();

  authMiddleware(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.user?.email).toBe('a@b.ci');
  expect(req.user?.role).toBe('admin');
  expect(req.user?.tenant_id).toBe('tid1');
});

// ── U-02 : Token absent → 401 ───────────────────────────────────────────────
test('U-02 token absent → 401', () => {
  const req = { headers: {} } as AuthRequest;
  const res = makeRes();
  const next = makeNext();

  authMiddleware(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

// ── U-03 : Token expiré → 401 ───────────────────────────────────────────────
test('U-03 token expiré → 401', () => {
  const token = jwt.sign({ id: 1, email: 'a@b.ci', role: 'admin', tenant_id: 't' }, SECRET, { expiresIn: -1 });
  const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
  const res = makeRes();
  const next = makeNext();

  authMiddleware(req, res, next);

  expect(res.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

// ── U-04 : requireRole('admin') avec rôle conducteur → 403 ──────────────────
test('U-04 requireRole admin — rôle conducteur → 403', () => {
  const req = { user: { id: 1, email: 'a@b.ci', role: 'conducteur', tenant_id: 't' } } as AuthRequest;
  const res = makeRes();
  const next = makeNext();

  requireRole('admin')(req, res, next);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

// ── U-05 : requireRole avec rôle dans la liste → passe ──────────────────────
test('U-05 requireRole admin|conducteur — rôle conducteur → next()', () => {
  const req = { user: { id: 1, email: 'a@b.ci', role: 'conducteur', tenant_id: 't' } } as AuthRequest;
  const res = makeRes();
  const next = makeNext();

  requireRole('admin', 'conducteur')(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
});
