const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { config, createSwaggerDocs } = require('@dev-laoz/core');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const rolesRoutes = require('./routes/rolesRoutes');
const { seedDefaultRoles } = require('./controllers/rolesController');

dotenv.config();

const swaggerDocs = createSwaggerDocs({
    title: 'Auth & Roles API',
    description: 'API para autenticación y gestión de roles.\n\n**Novedades v2.1.0:**\n- Gestión de roles y permisos integrada (`/api/roles`)\n- Validaciones robustas en todos los endpoints\n- Documentación Swagger mejorada',
    routesGlob: path.join(__dirname, 'routes/*.js'),
});

const startServer = async () => {
    if (process.env.NODE_ENV !== 'test') {
        await config.loadRemoteSecrets('authentication-api', ['JWT_SECRET', 'MONGO_URI']);
        await connectDB();
        await seedDefaultRoles();
    }

    const app = express();
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use('/api/auth', authRoutes);
    app.use('/api/roles', rolesRoutes);
    swaggerDocs(app);

    const PORT = process.env.LOCAL_PORT || 4000;
    if (process.env.NODE_ENV !== 'test') {
        app.listen(PORT, () => console.log(`Authentication API running on port ${PORT}`));
    }

    return app;
};

let app;
if (require.main === module) {
    startServer().then(application => { app = application; });
} else {
    startServer().then(application => { app = application; });
}

module.exports = startServer;
