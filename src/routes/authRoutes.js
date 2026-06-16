const express = require('express');
const router = express.Router();

const { loginUser, refreshTokenController, logoutController } = require('../controllers/authController');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Rate limiter para login: 5 intentos por IP cada 15 minutos
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	message: { error: 'Demasiados intentos de login, intenta más tarde.' },
	standardHeaders: true,
	legacyHeaders: false,
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Autentica un usuario y emite tokens JWT
 *     description: |
 *       Valida las credenciales del usuario contra la base de datos, crea una sesion
 *       en MongoDB y emite un access token (1h) y un refresh token (7d).
 *       El payload JWT contiene unicamente `{ userId, sessionToken }`.
 *       Rate limit: 5 intentos por IP cada 15 minutos.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Nombre de usuario registrado en el sistema
 *                 example: "maria.garcia"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Contrasena del usuario
 *                 example: "S3cur3P@ss!"
 *     responses:
 *       200:
 *         description: Autenticacion exitosa. Retorna access token y refresh token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Access token JWT con vigencia de 1 hora
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMDAwMDAsImV4cCI6MTcxODAzNjAwMH0.SIGNATURE"
 *                 refreshToken:
 *                   type: string
 *                   description: Refresh token JWT con vigencia de 7 dias
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMDAwMDAsImV4cCI6MTcxODYwNDgwMH0.SIGNATURE"
 *       400:
 *         description: Datos de entrada invalidos o incompletos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Datos incompletos"
 *       401:
 *         description: Credenciales invalidas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid credentials"
 *       429:
 *         description: Rate limit superado — demasiados intentos de login desde esta IP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Demasiados intentos de login, intenta más tarde."
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Server error"
 */
router.post(
	'/login',
	loginLimiter,
	[
		body('username').isString().notEmpty(),
		body('password').isString().notEmpty(),
	],
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ error: 'Datos incompletos' });
		}
		next();
	},
	loginUser
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Emite un nuevo access token usando un refresh token valido
 *     description: |
 *       Verifica la firma del refresh token y valida que la sesion asociada
 *       siga activa en MongoDB. Si ambas condiciones se cumplen, emite un
 *       nuevo access token con vigencia de 1 hora.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token JWT emitido durante el login (vigencia 7 dias)
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMDAwMDAsImV4cCI6MTcxODYwNDgwMH0.SIGNATURE"
 *     responses:
 *       200:
 *         description: Nuevo access token emitido correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Nuevo access token JWT con vigencia de 1 hora
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMzYwMDAsImV4cCI6MTcxODA3MjAwMH0.NEW_SIGNATURE"
 *       400:
 *         description: Refresh token ausente en el body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Refresh token requerido"
 *       401:
 *         description: Refresh token invalido, expirado, o sesion inactiva en MongoDB
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Refresh token inválido o sesión expirada"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Server error"
 */
router.post('/refresh', refreshTokenController);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cierra la sesion del usuario e invalida el token en base de datos
 *     description: |
 *       Verifica el refresh token, localiza la sesion activa en MongoDB y la
 *       marca como inactiva (`isActive: false`). Despues de este llamado,
 *       `/api/auth/verify` rechazara el access token asociado aunque este
 *       no haya expirado criptograficamente.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token JWT a invalidar
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMDAwMDAsImV4cCI6MTcxODYwNDgwMH0.SIGNATURE"
 *     responses:
 *       200:
 *         description: Sesion cerrada y token invalidado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sesión cerrada correctamente"
 *       400:
 *         description: Refresh token ausente o con formato invalido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Refresh token requerido"
 *       401:
 *         description: Refresh token invalido, expirado, o sesion ya cerrada previamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Refresh token inválido o sesión ya cerrada"
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Server error"
 */
router.post('/logout', logoutController);

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verifica la validez de un token JWT (uso interno de Nginx)
 *     description: |
 *       Valida la firma del access token y comprueba que la sesion asociada
 *       siga activa en MongoDB. Disenado para ser llamado por Nginx mediante
 *       la directiva `auth_request`. Los clientes externos no deben usar
 *       este endpoint directamente; para validar permisos deben usar
 *       `dev-laoz-authorization-api`.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valido y sesion activa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Token valid"
 *                 userId:
 *                   type: string
 *                   example: "664a1f2e90abc123456789ab"
 *       401:
 *         description: Token ausente, invalido, expirado, o sesion revocada en MongoDB
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Session revoked"
 */
const { verifyToken } = require('../controllers/authController');
router.get('/verify', verifyToken);

/**
 * @swagger
 * /api/auth/health:
 *   get:
 *     summary: Healthcheck del servicio
 *     description: Endpoint de salud para Docker y orquestadores. No requiere autenticacion.
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Servicio funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 service:
 *                   type: string
 *                   example: "authentication-api"
 */
router.get('/health', (req, res) => {
	res.status(200).json({ status: 'healthy', service: 'authentication-api' });
});

module.exports = router;
