const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  description: { type: String, default: '' },
  // Permissions as 'resource:action' strings, e.g. 'users:read', 'files:write'
  permissions: { type: [String], default: [] },
  // System roles (admin, viewer) cannot be deleted via API
  isSystem: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
