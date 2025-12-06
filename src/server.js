const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const swaggerDocs = require('./config/swagger');
const bodyParser = require('body-parser');

const loadSecrets = require('./config/secretLoader');

dotenv.config();

const startServer = async () => {
  if (process.env.NODE_ENV !== 'test') {
    await loadSecrets();
    connectDB();
  }

  const app = express();
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use('/api/auth', authRoutes);

  swaggerDocs(app);

  const PORT = process.env.LOCAL_PORT || 4000;
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`Authentication API running on port ${PORT}`);
    });
  }

  return app;
};

let app;
if (require.main === module) {
  startServer().then(application => {
    app = application;
  });
} else {
  // Para tests
  startServer().then(application => {
    app = application;
  });
}

module.exports = startServer; // Exportar función para mayor flexibilidad en tests
