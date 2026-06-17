const { validationResult } = require('express-validator');
const Role = require('../models/Role');

const DEFAULT_ROLES = [
  {
    name: 'admin',
    description: 'Acceso total al sistema',
    permissions: [
      'users:read', 'users:write', 'users:delete',
      'roles:read', 'roles:write', 'roles:delete',
      'files:read', 'files:write', 'files:delete',
      'secrets:read', 'secrets:write',
      'insights:read', 'insights:write',
      'billing:read', 'billing:write',
    ],
    isSystem: true,
  },
  {
    name: 'editor',
    description: 'Puede gestionar archivos y consultar logs',
    permissions: ['files:read', 'files:write', 'files:delete', 'insights:read'],
    isSystem: true,
  },
  {
    name: 'viewer',
    description: 'Acceso de solo lectura a archivos e insights',
    permissions: ['files:read', 'insights:read'],
    isSystem: false,
  },
  {
    name: 'user',
    description: 'Usuario estándar con acceso básico',
    permissions: ['files:read'],
    isSystem: false,
  },
];

const seedDefaultRoles = async () => {
  for (const role of DEFAULT_ROLES) {
    await Role.findOneAndUpdate({ name: role.name }, role, { upsert: true, new: true });
  }
  console.log('Default roles seeded');
};

exports.seedDefaultRoles = seedDefaultRoles;

exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRoleByName = async (req, res) => {
  try {
    const role = await Role.findOne({ name: req.params.name.toLowerCase() });
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, description, permissions } = req.body;
    const role = await Role.create({ name, description, permissions: permissions || [] });
    res.status(201).json(role);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'El rol ya existe' });
    res.status(500).json({ error: err.message });
  }
};

exports.updateRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });

    const { description, permissions } = req.body;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;

    await role.save();
    res.json(role);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
    if (role.isSystem) return res.status(403).json({ error: 'No se puede eliminar un rol del sistema' });

    await role.deleteOne();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Internal endpoint: checks if any of the given role names has the required permission.
// Called by authorization-api — no auth middleware applied to this route.
exports.checkPermission = async (req, res) => {
  try {
    const { roles, permission } = req.body;
    if (!Array.isArray(roles) || !permission) {
      return res.status(400).json({ error: 'Se requieren roles[] y permission' });
    }

    const roleNames = roles.map(r => r.toLowerCase());
    const matchingRoles = await Role.find({ name: { $in: roleNames } });
    const allPermissions = new Set(matchingRoles.flatMap(r => r.permissions));
    const hasPermission = allPermissions.has(permission);

    res.json({ hasPermission, permissions: [...allPermissions] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
