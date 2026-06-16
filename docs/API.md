# API Reference — dev-laoz-authentication-api

## Base URL

```text
http://localhost:4000
```

En produccion el trafico pasa primero por Nginx; los clientes no llaman a este servicio directamente salvo para login, refresh y logout.

---

## POST /api/auth/login

Autentica al usuario con credenciales, crea una sesion en MongoDB y emite un par de tokens JWT.

**Auth:** No requerida

**Rate limit:** 5 intentos por IP cada 15 minutos. Al superar el limite responde 429.

**Request**

```json
{
  "username": "maria.garcia",
  "password": "S3cur3P@ss!"
}
```

**Response 200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMDAwMDAsImV4cCI6MTcxODAzNjAwMH0.SIGNATURE",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMDAwMDAsImV4cCI6MTcxODYwNDgwMH0.SIGNATURE"
}
```

> El `token` tiene vigencia de **1 hora**. El `refreshToken` tiene vigencia de **7 dias**. El payload JWT contiene unicamente `{ userId, sessionToken }` — no incluye roles ni permisos.

**Errores**

| Codigo | Razon |
| --- | --- |
| 400 | Cuerpo incompleto — falta `username` o `password` |
| 401 | Credenciales invalidas |
| 429 | Rate limit superado (5 intentos / 15 min) |
| 500 | Error interno del servidor |

**curl**

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "maria.garcia", "password": "S3cur3P@ss!"}'
```

---

## POST /api/auth/refresh

Emite un nuevo access token a partir de un refresh token valido. La sesion debe estar activa en MongoDB.

**Auth:** No requerida (el refresh token va en el body)

**Request**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMDAwMDAsImV4cCI6MTcxODYwNDgwMH0.SIGNATURE"
}
```

**Response 200**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMzYwMDAsImV4cCI6MTcxODA3MjAwMH0.NEW_SIGNATURE"
}
```

**Errores**

| Codigo | Razon |
| --- | --- |
| 400 | Body vacio o `refreshToken` ausente |
| 401 | Token invalido, expirado, o sesion inactiva en DB |
| 500 | Error interno del servidor |

**curl**

```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refresh_token>"}'
```

---

## POST /api/auth/logout

Invalida la sesion activa en MongoDB (establece `isActive: false`). Despues de este llamado el access token del usuario seguira siendo valido criptograficamente hasta que expire, pero la sesion queda revocada en DB y `/api/auth/verify` rechazara el token.

**Auth:** No requerida en el header (el refresh token va en el body)

**Request**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjRhMWYyZTkwYWJjMTIzNDU2Nzg5YWIiLCJzZXNzaW9uVG9rZW4iOiJhYmMxMjMiLCJpYXQiOjE3MTgwMDAwMDAsImV4cCI6MTcxODYwNDgwMH0.SIGNATURE"
}
```

**Response 200**

```json
{
  "message": "Sesion cerrada correctamente"
}
```

**Errores**

| Codigo | Razon |
| --- | --- |
| 400 | Body vacio, `refreshToken` ausente o con formato invalido |
| 401 | Token invalido, expirado, o sesion ya cerrada |
| 500 | Error interno del servidor |

**curl**

```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refresh_token>"}'
```

---

## GET /api/auth/verify

Verifica que el access token sea valido y que la sesion siga activa en MongoDB. Pensado para uso interno de Nginx mediante la directiva `auth_request`. Los clientes no deben llamar a este endpoint directamente.

**Auth:** Bearer token en header `Authorization`

**Request**

Sin body. Solo el header:

```text
Authorization: Bearer <access_token>
```

**Response 200**

```json
{
  "message": "Token valid",
  "userId": "664a1f2e90abc123456789ab"
}
```

**Errores**

| Codigo | Razon |
| --- | --- |
| 401 | Token ausente, invalido, expirado, o sesion revocada en DB |

**curl**

```bash
curl -X GET http://localhost:4000/api/auth/verify \
  -H "Authorization: Bearer <access_token>"
```

---

## GET /api/auth/health

Healthcheck para orquestadores (Docker, Kubernetes) y load balancers.

**Auth:** No requerida

**Response 200**

```json
{
  "status": "healthy",
  "service": "authentication-api"
}
```

**curl**

```bash
curl http://localhost:4000/api/auth/health
```
