const https = require('https');

class InsightsLogger {
    constructor() {
        this.serviceName = process.env.SERVICE_NAME || process.env.npm_package_name || 'unknown-service';
        this.baseUrl = 'http://api-insights:3600/api/insights';
        this.buffer = [];
        this.isFlushing = false;

        // Auto-flush cada 5 segundos
        setInterval(() => this.flush(), 5000);
    }

    _send(endpoint, data) {
        // Usar https.request o http.request según corresponda. Aquí es HTTP interno.
        const http = require('http');

        // Si data es array, enviarlo uno por uno o implementar batch endpoint en API.
        // Por simplicidad, enviaremos uno por uno en esta versión v1, pero lo ideal es enviar lote.
        // Como la API espera objeto único por ahora, enviaremos en loop.
        // TODO: Implementar /batch en API.

        const payload = JSON.stringify(data);

        const options = {
            hostname: 'api-insights',
            port: 3600,
            path: `/api/insights/${endpoint}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': payload.length
            },
            timeout: 1000 // Timeout corto para no bloquear
        };

        const req = http.request(options, (res) => {
            // Ignoramos respuesta para fire-and-forget
        });

        req.on('error', (e) => {
            // Silencio errores de logging para no tirar la app
            // console.error('Insights Error:', e.message); 
        });

        req.write(payload);
        req.end();
    }

    info(message, metadata) {
        this._send('log', { service: this.serviceName, level: 'info', message, metadata });
    }

    error(message, stack, metadata) {
        this._send('log', { service: this.serviceName, level: 'error', message, stack, metadata });
    }

    audit(actor, action, target, outcome, details) {
        this._send('audit', { actor, action, target, outcome, details });
    }

    transaction(path, method, statusCode, durationMs) {
        this._send('transaction', { service: this.serviceName, path, method, statusCode, durationMs });
    }

    flush() {
        // Implementar si usamos buffer local.
        // Por ahora enviamos directo para ver tiempo real inmediato.
    }
}

module.exports = new InsightsLogger();
