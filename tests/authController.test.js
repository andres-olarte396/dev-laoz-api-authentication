/**
 * Tests unitarios del controlador de autenticación (authController).
 *
 * Estrategia:
 *  - Se mockean User, Session, bcrypt (vía el método matchPassword del modelo)
 *    y jsonwebtoken para aislar completamente la lógica del controlador.
 *  - No se levanta ningún servidor HTTP; se llama directamente a las funciones
 *    del controlador con objetos req/res simulados.
 *  - Los tests se ejecutan en español siguiendo la convención del proyecto.
 */

'use strict';

// ── Mocks de dependencias externas ──────────────────────────────────────────

jest.mock('../src/models/User');
jest.mock('../src/models/Session');
jest.mock('jsonwebtoken');
jest.mock('@dev-laoz/core', () => ({
  logger: {
    audit: jest.fn(),
    error: jest.fn(),
  },
  config: { loadRemoteSecrets: jest.fn() },
  createSwaggerDocs: jest.fn(() => () => {}),
}));

const User = require('../src/models/User');
const Session = require('../src/models/Session');
const jwt = require('jsonwebtoken');

// Importar el controlador DESPUÉS de configurar los mocks
const {
  loginUser,
  refreshTokenController,
  logoutController,
  verifyToken,
} = require('../src/controllers/authController');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Construye un objeto req mínimo para las pruebas.
 */
const buildReq = (body = {}, headers = {}) => ({
  body,
  headers,
  ip: '127.0.0.1',
});

/**
 * Construye un objeto res con métodos de Jest espiables.
 */
const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// ── Setup global ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // JWT_SECRET disponible en todos los tests
  process.env.JWT_SECRET = 'test-secret';
});

// ─────────────────────────────────────────────────────────────────────────────
// loginUser
// ─────────────────────────────────────────────────────────────────────────────

describe('loginUser', () => {
  it('debería responder 200 con token y refreshToken si las credenciales son válidas', async () => {
    const fakeUser = {
      _id: 'userId123',
      username: 'maria.garcia',
      matchPassword: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(fakeUser);
    Session.create.mockResolvedValue({});
    jwt.sign
      .mockReturnValueOnce('access-token-mock')
      .mockReturnValueOnce('refresh-token-mock');

    const req = buildReq({ username: 'maria.garcia', password: 'S3cur3P@ss!' });
    const res = buildRes();

    await loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      token: 'access-token-mock',
      refreshToken: 'refresh-token-mock',
    });
  });

  it('debería responder 401 si el usuario no existe en la base de datos', async () => {
    User.findOne.mockResolvedValue(null);

    const req = buildReq({ username: 'noexiste', password: 'pass' });
    const res = buildRes();

    await loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('debería responder 401 si la contraseña es incorrecta', async () => {
    const fakeUser = {
      _id: 'userId123',
      username: 'maria.garcia',
      matchPassword: jest.fn().mockResolvedValue(false),
    };
    User.findOne.mockResolvedValue(fakeUser);

    const req = buildReq({ username: 'maria.garcia', password: 'wrong' });
    const res = buildRes();

    await loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
  });

  it('debería crear la sesión en MongoDB con isActive:true y expiresAt ~1h al loguearse', async () => {
    const fakeUser = {
      _id: 'userId123',
      username: 'maria.garcia',
      matchPassword: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(fakeUser);
    Session.create.mockResolvedValue({});
    jwt.sign.mockReturnValue('any-token');

    const req = buildReq({ username: 'maria.garcia', password: 'pass' });
    const res = buildRes();

    await loginUser(req, res);

    expect(Session.create).toHaveBeenCalledTimes(1);
    const sessionArg = Session.create.mock.calls[0][0];
    expect(sessionArg).toMatchObject({
      userId: 'userId123',
      isActive: undefined, // el default lo aplica Mongoose; no se fuerza en el objeto
    });
    expect(sessionArg.sessionToken).toMatch(/^[0-9a-f]{128}$/); // 64 bytes hex
    expect(sessionArg.expiresAt).toBeDefined();
  });

  it('debería responder 500 si se produce un error inesperado al consultar la base de datos', async () => {
    User.findOne.mockRejectedValue(new Error('DB connection error'));

    const req = buildReq({ username: 'maria.garcia', password: 'pass' });
    const res = buildRes();

    await loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });

  it('debería registrar auditoría FAILURE cuando las credenciales son inválidas', async () => {
    const { logger } = require('@dev-laoz/core');
    User.findOne.mockResolvedValue(null);

    const req = buildReq({ username: 'unknown_user', password: 'pass' });
    const res = buildRes();

    await loginUser(req, res);

    expect(logger.audit).toHaveBeenCalledWith(
      'unknown_user',
      'LOGIN',
      'auth-api',
      'FAILURE',
      expect.objectContaining({ reason: 'Invalid credentials' })
    );
  });

  it('debería registrar auditoría SUCCESS con ip cuando el login es exitoso', async () => {
    const { logger } = require('@dev-laoz/core');
    const fakeUser = {
      _id: 'userId123',
      username: 'maria.garcia',
      matchPassword: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(fakeUser);
    Session.create.mockResolvedValue({});
    jwt.sign.mockReturnValue('token');

    const req = buildReq({ username: 'maria.garcia', password: 'pass' });
    const res = buildRes();

    await loginUser(req, res);

    expect(logger.audit).toHaveBeenCalledWith(
      'maria.garcia',
      'LOGIN',
      'auth-api',
      'SUCCESS',
      expect.objectContaining({ ip: req.ip })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// refreshTokenController
// ─────────────────────────────────────────────────────────────────────────────

describe('refreshTokenController', () => {
  it('debería responder 400 si no se envía refreshToken en el body', async () => {
    const req = buildReq({});
    const res = buildRes();

    await refreshTokenController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token requerido' });
  });

  it('debería responder 200 con nuevo access token si el refresh token es válido y la sesión está activa', async () => {
    jwt.verify.mockReturnValue({ userId: 'uid1', sessionToken: 'tok1' });
    Session.findOne.mockResolvedValue({ isActive: true, userId: 'uid1', sessionToken: 'tok1' });
    jwt.sign.mockReturnValue('nuevo-access-token');

    const req = buildReq({ refreshToken: 'valid.refresh.token' });
    const res = buildRes();

    await refreshTokenController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ token: 'nuevo-access-token' });
  });

  it('debería responder 401 si la sesión no existe en MongoDB', async () => {
    jwt.verify.mockReturnValue({ userId: 'uid1', sessionToken: 'tok1' });
    Session.findOne.mockResolvedValue(null);

    const req = buildReq({ refreshToken: 'valid.refresh.token' });
    const res = buildRes();

    await refreshTokenController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Refresh token inválido o sesión expirada',
    });
  });

  it('debería responder 401 si el refresh token tiene firma inválida', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    const req = buildReq({ refreshToken: 'bad.token.here' });
    const res = buildRes();

    await refreshTokenController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Refresh token inválido o expirado',
    });
  });

  it('debería responder 401 si el refresh token está expirado (TokenExpiredError)', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    const req = buildReq({ refreshToken: 'expired.token.here' });
    const res = buildRes();

    await refreshTokenController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Refresh token inválido o expirado',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// logoutController
// ─────────────────────────────────────────────────────────────────────────────

describe('logoutController', () => {
  it('debería responder 400 si no se envía refreshToken en el body', async () => {
    const req = buildReq({});
    const res = buildRes();

    await logoutController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token requerido' });
  });

  it('debería responder 400 si el refreshToken no tiene formato JWT válido', async () => {
    const req = buildReq({ refreshToken: 'no-es-un-jwt' });
    const res = buildRes();

    await logoutController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Refresh token con formato inválido',
    });
  });

  it('debería responder 200 y marcar la sesión como inactiva si el token es válido', async () => {
    jwt.verify.mockReturnValue({ userId: 'uid1', sessionToken: 'tok1' });
    Session.findOneAndUpdate.mockResolvedValue({
      sessionToken: 'tok1',
      userId: 'uid1',
      isActive: true,
    });

    const req = buildReq({ refreshToken: 'valid.refresh.token' });
    const res = buildRes();

    await logoutController(req, res);

    expect(Session.findOneAndUpdate).toHaveBeenCalledWith(
      { sessionToken: 'tok1', userId: 'uid1', isActive: true },
      { isActive: false }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Sesión cerrada correctamente' });
  });

  it('debería responder 401 si la sesión ya estaba cerrada (isActive: false)', async () => {
    jwt.verify.mockReturnValue({ userId: 'uid1', sessionToken: 'tok1' });
    // findOneAndUpdate devuelve null cuando no encuentra un documento con isActive:true
    Session.findOneAndUpdate.mockResolvedValue(null);

    const req = buildReq({ refreshToken: 'valid.refresh.token' });
    const res = buildRes();

    await logoutController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Refresh token inválido o sesión ya cerrada',
    });
  });

  it('debería responder 401 si el refresh token tiene firma inválida', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    const req = buildReq({ refreshToken: 'bad.token.here' });
    const res = buildRes();

    await logoutController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Refresh token inválido o expirado',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyToken
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('debería responder 401 si no se envía la cabecera Authorization', async () => {
    const req = buildReq({}, {});
    const res = buildRes();

    await verifyToken(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
  });

  it('debería responder 200 con userId si el token es válido y la sesión está activa', async () => {
    jwt.verify.mockReturnValue({ userId: 'uid1', sessionToken: 'tok1' });
    Session.findOne.mockResolvedValue({ isActive: true, userId: 'uid1', sessionToken: 'tok1' });

    const req = buildReq({}, { authorization: 'Bearer valid.jwt.token' });
    const res = buildRes();

    await verifyToken(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token valid', userId: 'uid1' })
    );
  });

  it('debería responder 401 con "Session revoked" si la sesión fue revocada en MongoDB', async () => {
    jwt.verify.mockReturnValue({ userId: 'uid1', sessionToken: 'tok1' });
    Session.findOne.mockResolvedValue(null);

    const req = buildReq({}, { authorization: 'Bearer valid.jwt.token' });
    const res = buildRes();

    await verifyToken(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Session revoked' });
  });

  it('debería responder 401 con "Invalid token" si la firma del token es incorrecta', async () => {
    jwt.verify.mockImplementation(() => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    const req = buildReq({}, { authorization: 'Bearer bad.token.here' });
    const res = buildRes();

    await verifyToken(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });
});
