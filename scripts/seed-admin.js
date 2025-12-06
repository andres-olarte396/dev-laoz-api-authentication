const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

const seedAdmin = async () => {
    try {
        // Conectar a MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        // Verificar si ya existe el usuario admin
        const existingAdmin = await User.findOne({ username: 'admin' });

        if (existingAdmin) {
            console.log('⚠️  El usuario admin ya existe');
            console.log('   Username:', existingAdmin.username);
            console.log('   Role:', existingAdmin.role);
            console.log('   Permissions:', existingAdmin.permissions);
            process.exit(0);
        }

        // Crear usuario administrador
        const admin = await User.create({
            username: 'admin',
            password: 'Admin123!', // Se hasheará automáticamente por el pre-save hook
            role: 'admin',
            permissions: ['read', 'write', 'delete']
        });

        console.log('✅ Usuario administrador creado exitosamente:');
        console.log('   Username: admin');
        console.log('   Password: Admin123! (¡CAMBIAR INMEDIATAMENTE!)');
        console.log('   Role:', admin.role);
        console.log('   Permissions:', admin.permissions);
        console.log('');
        console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al crear usuario admin:', error);
        process.exit(1);
    }
};

seedAdmin();
