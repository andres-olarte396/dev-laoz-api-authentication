const express = require('express');
const { body, param } = require('express-validator');
const { authMiddleware } = require('@dev-laoz/core');
const ctrl = require('../controllers/rolesController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Gestión de roles y permisos del sistema
 */

// Health — no auth
router.get('/health', (req, res) =>
  res.status(200).json({ status: 'healthy', service: 'api-roles' })
);

/**
 * @swagger
 * /api/roles/check:
 *   post:
 *     summary: Verifica si un conjunto de roles tiene un permiso (uso interno servicio-a-servicio)
 *     tags: [Roles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roles, permission]
 *             properties:
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["admin"]
 *               permission:
 *                 type: string
 *                 example: "files:write"
 *     responses:
 *       200:
 *         description: Resultado de la verificación
 */
// No auth — called internally by authorization-api only
router.post('/check', ctrl.checkPermission);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Lista todos los roles disponibles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authMiddleware, ctrl.getRoles);

/**
 * @swagger
 * /api/roles/name/{name}:
 *   get:
 *     summary: Obtiene un rol por su nombre
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/name/:name', authMiddleware, ctrl.getRoleByName);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Obtiene un rol por ID
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('ID inválido'),
], ctrl.getRoleById);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Crea un nuevo rol
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["files:read", "files:write"]
 */
router.post('/', authMiddleware, [
  body('name').trim().notEmpty().withMessage('Nombre requerido'),
  body('description').optional().isString(),
  body('permissions').optional().isArray(),
], ctrl.createRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Actualiza descripción y permisos de un rol
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('ID inválido'),
  body('description').optional().isString(),
  body('permissions').optional().isArray(),
], ctrl.updateRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Elimina un rol (no aplica a roles del sistema)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authMiddleware, [
  param('id').isMongoId().withMessage('ID inválido'),
], ctrl.deleteRole);

module.exports = router;
