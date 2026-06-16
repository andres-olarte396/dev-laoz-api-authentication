# Documento de Requerimientos — dev-laoz-authentication-api

**Versión:** 1.0.0
**Fecha:** 2026-06-15
**Estado:** Aprobado

---

## 1. Descripción del servicio

`dev-laoz-authentication-api` es el servicio de identidad del ecosistema Dev Laoz. Es el único responsable de:

- Verificar credenciales (username + password con bcrypt) contra MongoDB.
- Emitir tokens JWT firmados cuyo payload contiene **únicamente** `{ userId, sessionToken }`.
- Persistir sesiones en MongoDB con tiempo de expiración explícito (`expiresAt`) y bandera de estado (`isActive`).
- Revocar sesiones de forma inmediata mediante logout.
- Proveer un endpoint de verificación (`/verify`) consumido por Nginx a través de la directiva `auth_request`.

Los roles y permisos **no** se resuelven en este servicio; esa responsabilidad recae sobre `dev-laoz-authorization-api`.

---

## 2. Actores

| Actor | Rol |
|---|---|
| **Usuario final** | Inicia sesión, renueva token, cierra sesión a través del cliente (web/móvil). |
| **API Gateway (Nginx)** | Llama a `/api/auth/verify` mediante `auth_request` antes de enrutar cada petición. |
| **dev-laoz-authorization-api** | Consume el JWT emitido aquí para extraer `userId` y `sessionToken`; valida la sesión activa en MongoDB. |
| **Orquestador (Docker/K8s)** | Llama a `/api/auth/health` para comprobar disponibilidad del servicio. |
| **`@dev-laoz/core`** | Provee carga de secretos remotos (`JWT_SECRET`, `MONGO_URI`), logger de auditoría y Swagger. |

---

## 3. Requerimientos Funcionales

### RF-AUTH-001 — Login de usuario
El sistema debe autenticar a un usuario mediante `username` y `password`. Si las credenciales son válidas, debe crear una sesión en MongoDB y devolver un access token (vigencia 1 h) y un refresh token (vigencia 7 d).

**Precondición:** El usuario existe en MongoDB con contraseña hasheada con bcrypt.
**Respuesta exitosa:** HTTP 200 con `{ token, refreshToken }`.
**Fallo de credenciales:** HTTP 401 con `{ error: "Invalid credentials" }`.
**Campos incompletos:** HTTP 400 con `{ error: "Datos incompletos" }`.
**Rate limit superado:** HTTP 429 (5 intentos por IP / 15 min).

---

### RF-AUTH-002 — Registro de sesión en MongoDB
Al producirse un login exitoso, el sistema debe persistir un documento `Session` con los campos:
- `sessionToken`: cadena hexadecimal de 64 bytes generada con `crypto.randomBytes`.
- `userId`: referencia ObjectId al usuario.
- `expiresAt`: timestamp UTC = `Date.now() + 1 h`.
- `isActive`: `true` por defecto.

---

### RF-AUTH-003 — Emisión de tokens JWT
Los tokens deben firmarse con `JWT_SECRET` (cargado vía `@dev-laoz/core`) y contener **únicamente** `{ userId, sessionToken }` en el payload. No deben incluir roles, permisos ni ningún dato sensible adicional.

| Token | Algoritmo | Expiración |
|---|---|---|
| Access token | HS256 | 1 hora |
| Refresh token | HS256 | 7 días |

---

### RF-AUTH-004 — Renovación de access token (refresh)
El endpoint `POST /api/auth/refresh` debe:
1. Rechazar la petición con HTTP 400 si no se incluye `refreshToken`.
2. Verificar la firma criptográfica del refresh token.
3. Validar que la sesión asociada exista en MongoDB y tenga `isActive: true`.
4. Si todo es válido, emitir un nuevo access token (1 h) y devolver HTTP 200 con `{ token }`.
5. Si el token es inválido o la sesión está inactiva/inexistente, devolver HTTP 401.

---

### RF-AUTH-005 — Cierre de sesión (logout)
El endpoint `POST /api/auth/logout` debe:
1. Rechazar con HTTP 400 si falta `refreshToken` o su formato no es un JWT (tres partes separadas por `.`).
2. Verificar la firma del refresh token.
3. Buscar la sesión con `isActive: true` y marcarla como `isActive: false` en MongoDB.
4. Devolver HTTP 200 con `{ message: "Sesión cerrada correctamente" }`.
5. Si la sesión ya fue cerrada o no existe, devolver HTTP 401.

---

### RF-AUTH-006 — Verificación de token (uso interno de Nginx)
El endpoint `GET /api/auth/verify` debe:
1. Leer el token de la cabecera `Authorization: Bearer <token>`.
2. Rechazar con HTTP 401 si la cabecera está ausente.
3. Verificar la firma JWT.
4. Consultar MongoDB para confirmar que la sesión sigue activa (`isActive: true`).
5. Devolver HTTP 200 con `{ message: "Token valid", userId }` si todo es válido.
6. Devolver HTTP 401 con `{ error: "Session revoked" }` si la sesión fue revocada.
7. Devolver HTTP 401 con `{ error: "Invalid token" }` si la firma es inválida o el token expiró.

---

### RF-AUTH-007 — Healthcheck
El endpoint `GET /api/auth/health` debe devolver HTTP 200 con `{ status: "healthy", service: "authentication-api" }` sin requerir autenticación. Debe responder en menos de 200 ms.

---

### RF-AUTH-008 — Validación de entrada en login
El sistema debe rechazar con HTTP 400 cualquier petición a `/api/auth/login` que no incluya `username` (string, no vacío) y `password` (string, no vacío), antes de consultar la base de datos.

---

### RF-AUTH-009 — Auditoría de eventos
El sistema debe registrar mediante `logger.audit` de `@dev-laoz/core`:
- Cada intento de login exitoso (nivel SUCCESS) con `ip`.
- Cada intento de login fallido (nivel FAILURE) con `reason`.
- Cada logout exitoso (nivel SUCCESS).

---

## 4. Requerimientos No Funcionales

### RNF-AUTH-001 — Seguridad: hashing de contraseñas
Las contraseñas deben almacenarse hasheadas con `bcryptjs` con salt de 10 rondas. Nunca se almacena ni se transmite la contraseña en texto plano.

### RNF-AUTH-002 — Seguridad: firmado de tokens
`JWT_SECRET` no debe estar en código fuente. Debe cargarse en tiempo de arranque mediante `config.loadRemoteSecrets` de `@dev-laoz/core`. Si el secreto no está disponible, el servicio no debe arrancar.

### RNF-AUTH-003 — Seguridad: rate limiting en login
El endpoint de login debe limitar a **5 intentos por IP cada 15 minutos** usando `express-rate-limit`. Al superarse el límite, responder con HTTP 429.

### RNF-AUTH-004 — Seguridad: payload JWT mínimo
El payload del JWT solo debe contener `{ userId, sessionToken }`. Ningún dato de roles, permisos o información personal debe incluirse.

### RNF-AUTH-005 — Rendimiento: tiempo de respuesta
- `POST /api/auth/login`: P95 < 300 ms bajo carga normal (hasta 100 req/s).
- `GET /api/auth/verify`: P95 < 100 ms (es la ruta crítica consultada por Nginx en cada petición).
- `GET /api/auth/health`: P99 < 50 ms.

### RNF-AUTH-006 — Disponibilidad
El servicio debe tener una disponibilidad mínima del 99.5 % mensual en producción. Debe estar preparado para reinicio automático por orquestadores (Docker health check sobre `/api/auth/health`).

### RNF-AUTH-007 — Compatibilidad de entorno
El servicio debe ejecutarse en Node.js >= 18 LTS. En entornos de test (`NODE_ENV=test`) no debe intentar conectar a MongoDB ni cargar secretos remotos.

### RNF-AUTH-008 — Tamaño de payload
El servidor acepta bodies JSON de hasta 10 MB para compatibilidad con el ecosistema, aunque las peticiones de autenticación normales son inferiores a 1 KB.

### RNF-AUTH-009 — Observabilidad
Todos los errores internos (HTTP 500) deben registrarse con stack trace completo mediante `logger.error` de `@dev-laoz/core`. Los logs de auditoría deben incluir al menos: actor, acción, servicio, resultado y metadatos contextuales.

---

## 5. Restricciones Técnicas

| Restricción | Detalle |
|---|---|
| Runtime | Node.js >= 18 LTS |
| Framework | Express 4.x |
| Base de datos | MongoDB (Mongoose 8.x) |
| Librería JWT | `jsonwebtoken` 9.x |
| Hashing | `bcryptjs` 2.x |
| Librería core | `@dev-laoz/core` (archivo local `../dev-laoz-config-loader`) |
| Validación de entrada | `express-validator` 7.x |
| Rate limiting | `express-rate-limit` (incluido en dependencias de `express-rate-limit`) |
| Tests | Jest 30.x + Supertest 7.x; entorno `node` |
| Variables de entorno obligatorias | `JWT_SECRET`, `MONGO_URI`, `LOCAL_PORT` (default 4000) |
| El JWT no debe contener roles | Los roles se resuelven exclusivamente en `dev-laoz-authorization-api` |

---

## 6. Modelo de datos relevante

### Colección `sessions`

```
{
  sessionToken: String  (único, requerido),
  userId:       ObjectId (ref: User, requerido),
  createdAt:    Date (default: Date.now),
  expiresAt:    Date (requerido),
  isActive:     Boolean (default: true)
}
```

### Colección `users` (solo campos relevantes para autenticación)

```
{
  username:    String (único, requerido),
  password:    String (bcrypt hash, requerido),
  role:        String (enum: admin|user|guest),
  permissions: [String]
}
```
