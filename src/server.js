const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { config, createSwaggerDocs } = require('@dev-laoz/core');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');

dotenv.config();

const swaggerDocs = createSwaggerDocs({
    title: 'Auth API',
    description: 'API para autenticación.\n\n**Novedades v2.0.0:**\n- Validaciones robustas en todos los endpoints\n- Documentación Swagger mejorada',
    routesGlob: path.join(__dirname, 'routes/*.js'),
});

const startServer = async () => {
    if (process.env.NODE_ENV !== 'test') {
        await config.loadRemoteSecrets('authentication-api', ['JWT_SECRET', 'MONGO_URI']);
        connectDB();
    }

    const app = express();
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use('/api/auth', authRoutes);
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
