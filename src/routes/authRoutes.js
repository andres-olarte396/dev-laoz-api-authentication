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
 *     summary: Inicia sesión de un usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso
 *       401:
 *         description: Credenciales inválidas
 *       500:
 *         description: Error del servidor
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
 *     summary: Refresca el access token usando un refresh token válido
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nuevo access token emitido
 *       401:
 *         description: Refresh token inválido o expirado
 *       400:
 *         description: Refresh token requerido
 */
router.post('/refresh', refreshTokenController);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cierra la sesión del usuario e invalida el refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesión cerrada correctamente
 *       401:
 *         description: Refresh token inválido o sesión ya cerrada
 *       400:
 *         description: Refresh token requerido
 */
router.post('/logout', logoutController);

// Healthcheck endpoint para Docker
router.get('/health', (req, res) => {
	res.status(200).json({ status: 'healthy', service: 'authentication-api' });
});

module.exports = router;

