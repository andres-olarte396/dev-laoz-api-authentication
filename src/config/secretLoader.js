const https = require('https');

const fetchSecret = (key) => {
    return new Promise((resolve) => {
        const data = JSON.stringify({ key });

        const options = {
            hostname: 'api-secrets',
            port: 3501,
            path: '/api/secrets/authentication-api',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            },
            rejectUnauthorized: false, // Permitir certificados autofirmados
            timeout: 3000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(body);
                        resolve(parsed.value);
                    } catch (e) {
                        console.warn(`Error parsing secret ${key}. Using env.`);
                        resolve(process.env[key]);
                    }
                } else {
                    console.warn(`Secret API returned ${res.statusCode} for ${key}. Using env.`);
                    resolve(process.env[key]);
                }
            });
        });

        req.on('error', (error) => {
            console.warn(`Error fetching secret ${key}: ${error.message}. Using env.`);
            resolve(process.env[key]);
        });

        req.on('timeout', () => {
            req.destroy();
            console.warn(`Timeout fetching secret ${key}. Using env.`);
            resolve(process.env[key]);
        });

        req.write(data);
        req.end();
    });
};

const loadSecrets = async () => {
    console.log('🔒 Cargando secretos remotos...');
    const jwt = await fetchSecret('JWT_SECRET');
    if (jwt) process.env.JWT_SECRET = jwt;

    const mongo = await fetchSecret('MONGO_URI');
    if (mongo) process.env.MONGO_URI = mongo;

    console.log('🔒 Configuración completa.');
};

module.exports = loadSecrets;
