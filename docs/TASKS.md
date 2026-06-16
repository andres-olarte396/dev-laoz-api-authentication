# Tareas de Desarrollo — dev-laoz-authentication-api

**Versión:** 1.0.0
**Fecha:** 2026-06-15

---

## Épicas

| ID | Épica | Descripción |
|---|---|---|
| EP-AUTH-01 | Autenticación de usuarios | Flujo completo de login, generación de tokens y registro de sesión. |
| EP-AUTH-02 | Gestión del ciclo de vida de sesiones | Renovación, invalidación y verificación de sesiones. |
| EP-AUTH-03 | Seguridad y cumplimiento | Rate limiting, hashing, secretos remotos, auditoría. |
| EP-AUTH-04 | Operabilidad | Healthcheck, observabilidad, compatibilidad de entorno de test. |

---

## User Stories

---

### EP-AUTH-01 — Autenticación de usuarios

---

#### US-AUTH-001 — Login con credenciales válidas

**Como** usuario del sistema,
**quiero** autenticarme con mi nombre de usuario y contraseña,
**para** obtener un access token y un refresh token que me permitan acceder a los demás servicios.

**Criterios de aceptación (BDD):**

```
Dado que existe un usuario "maria.garcia" con contraseña "S3cur3P@ss!" en la base de datos
Cuando envío POST /api/auth/login con { username: "maria.garcia", password: "S3cur3P@ss!" }
Entonces recibo HTTP 200
Y el cuerpo contiene { token: <JWT>, refreshToken: <JWT> }
Y se crea un documento Session en MongoDB con isActive: true
Y el payload del JWT contiene únicamente { userId, sessionToken }
```

**Estimación:** M

---

#### US-AUTH-002 — Rechazo de credenciales inválidas

**Como** sistema de seguridad,
**quiero** rechazar intentos de login con credenciales incorrectas,
**para** proteger las cuentas de accesos no autorizados.

**Criterios de aceptación (BDD):**

```
Dado que existe el usuario "maria.garcia"
Cuando envío POST /api/auth/login con { username: "maria.garcia", password: "wrongpass" }
Entonces recibo HTTP 401
Y el cuerpo contiene { error: "Invalid credentials" }
Y no se crea ninguna sesión en MongoDB
Y se registra un evento de auditoría FAILURE con reason "Invalid credentials"

Dado que no existe el usuario "noexiste"
Cuando envío POST /api/auth/login con { username: "noexiste", password: "cualquier" }
Entonces recibo HTTP 401
Y el cuerpo contiene { error: "Invalid credentials" }
```

**Estimación:** S

---

#### US-AUTH-003 — Validación de campos obligatorios en login

**Como** sistema de validación,
**quiero** rechazar peticiones de login con campos faltantes o vacíos,
**para** evitar procesamiento innecesario y dar mensajes claros al cliente.

**Criterios de aceptación (BDD):**

```
Dado que envío POST /api/auth/login sin el campo password
Entonces recibo HTTP 400
Y el cuerpo contiene { error: "Datos incompletos" }

Dado que envío POST /api/auth/login con username vacío ("")
Entonces recibo HTTP 400
Y el cuerpo contiene { error: "Datos incompletos" }

Dado que envío POST /api/auth/login con un body vacío {}
Entonces recibo HTTP 400
Y el cuerpo contiene { error: "Datos incompletos" }
```

**Estimación:** S

---

#### US-AUTH-004 — Rate limiting en el endpoint de login

**Como** sistema de seguridad,
**quiero** limitar los intentos de login a 5 por IP cada 15 minutos,
**para** mitigar ataques de fuerza bruta.

**Criterios de aceptación (BDD):**

```
Dado que una IP realiza 5 intentos de login consecutivos (exitosos o fallidos)
Cuando realiza el sexto intento desde la misma IP dentro de la ventana de 15 minutos
Entonces recibo HTTP 429
Y el cuerpo contiene { error: "Demasiados intentos de login, intenta más tarde." }
Y las cabeceras incluyen RateLimit-Limit y RateLimit-Remaining (standard headers)
```

**Estimación:** S

---

#### US-AUTH-005 — Registro de sesión en MongoDB

**Como** sistema de gestión de sesiones,
**quiero** persistir cada sesión iniciada con token único, userId y expiresAt,
**para** poder revocarlas y validarlas en tiempo real.

**Criterios de aceptación (BDD):**

```
Dado que un login es exitoso
Entonces se crea un documento Session con:
  - sessionToken: cadena hexadecimal de 128 caracteres (64 bytes)
  - userId: ObjectId del usuario autenticado
  - expiresAt: Date.now() + 1 hora (en UTC)
  - isActive: true
  - createdAt: fecha actual

Y el sessionToken generado es único (no existe previamente en la colección)
```

**Estimación:** M

---

#### US-AUTH-006 — Auditoría de eventos de login

**Como** administrador del sistema,
**quiero** que todos los intentos de login (exitosos y fallidos) queden registrados,
**para** tener trazabilidad de accesos y detectar patrones sospechosos.

**Criterios de aceptación (BDD):**

```
Dado que un login es exitoso
Cuando se completa el flujo
Entonces se registra logger.audit con:
  - actor: username del usuario
  - acción: "LOGIN"
  - servicio: "auth-api"
  - resultado: "SUCCESS"
  - metadata: { ip: req.ip }

Dado que un login falla por credenciales incorrectas
Entonces se registra logger.audit con:
  - actor: username (o "unknown" si no se proporcionó)
  - resultado: "FAILURE"
  - metadata: { reason: "Invalid credentials" }
```

**Estimación:** S

---

### EP-AUTH-02 — Gestión del ciclo de vida de sesiones

---

#### US-AUTH-007 — Renovación de access token con refresh token válido

**Como** cliente autenticado con access token próximo a expirar,
**quiero** obtener un nuevo access token usando mi refresh token,
**para** mantener mi sesión activa sin necesidad de volver a introducir credenciales.

**Criterios de aceptación (BDD):**

```
Dado que tengo un refresh token válido y la sesión asociada tiene isActive: true en MongoDB
Cuando envío POST /api/auth/refresh con { refreshToken: "<token>" }
Entonces recibo HTTP 200
Y el cuerpo contiene { token: <nuevo-access-token> }
Y el nuevo access token expira en 1 hora
Y el payload del nuevo token contiene { userId, sessionToken } idéntico al refresh token
```

**Estimación:** M

---

#### US-AUTH-008 — Rechazo de refresh token ausente

**Como** sistema de validación,
**quiero** rechazar peticiones de refresh sin token,
**para** evitar errores internos y dar mensajes claros.

**Criterios de aceptación (BDD):**

```
Dado que envío POST /api/auth/refresh con body vacío {}
Entonces recibo HTTP 400
Y el cuerpo contiene { error: "Refresh token requerido" }
```

**Estimación:** S

---

#### US-AUTH-009 — Rechazo de refresh token inválido o expirado

**Como** sistema de seguridad,
**quiero** rechazar refresh tokens con firma inválida o vencidos,
**para** impedir renovaciones fraudulentas de sesión.

**Criterios de aceptación (BDD):**

```
Dado que envío POST /api/auth/refresh con un token con firma inválida
Entonces recibo HTTP 401
Y el cuerpo contiene { error: "Refresh token inválido o expirado" }

Dado que el refresh token es válido pero la sesión en MongoDB tiene isActive: false
Cuando envío POST /api/auth/refresh con ese token
Entonces recibo HTTP 401
Y el cuerpo contiene { error: "Refresh token inválido o sesión expirada" }

Dado que el refresh token es válido pero no existe sesión en MongoDB
Entonces recibo HTTP 401
```

**Estimación:** S

---

#### US-AUTH-010 — Cierre de sesión (logout)

**Como** usuario autenticado,
**quiero** cerrar mi sesión explícitamente,
**para** que mi token quede invalidado inmediatamente aunque no haya expirado.

**Criterios de aceptación (BDD):**

```
Dado que tengo una sesión activa (isActive: true) en MongoDB
Cuando envío POST /api/auth/logout con { refreshToken: "<token-válido>" }
Entonces recibo HTTP 200
Y el cuerpo contiene { message: "Sesión cerrada correctamente" }
Y la sesión en MongoDB tiene isActive: false
Y una llamada posterior a /api/auth/verify con el access token asociado devuelve HTTP 401
```

**Estimación:** M

---

#### US-AUTH-011 — Rechazo de logout con token ya invalidado

**Como** sistema de seguridad,
**quiero** rechazar intentos de logout sobre sesiones ya cerradas,
**para** evitar operaciones duplicadas y dar trazabilidad correcta.

**Criterios de aceptación (BDD):**

```
Dado que una sesión ya tiene isActive: false en MongoDB
Cuando envío POST /api/auth/logout con el refresh token correspondiente
Entonces recibo HTTP 401
Y el cuerpo contiene { error: "Refresh token inválido o sesión ya cerrada" }
```

**Estimación:** S

---

#### US-AUTH-012 — Rechazo de logout con token de formato inválido

**Como** sistema de validación,
**quiero** rechazar refresh tokens que no tengan formato JWT válido (tres partes separadas por punto),
**para** evitar intentos de verificación con cadenas arbitrarias.

**Criterios de aceptación (BDD):**

```
Dado que envío POST /api/auth/logout con { refreshToken: "no-es-un-jwt" }
Entonces recibo HTTP 400
Y el cuerpo contiene { error: "Refresh token con formato inválido" }

Dado que envío POST /api/auth/logout sin el campo refreshToken
Entonces recibo HTTP 400
Y el cuerpo contiene { error: "Refresh token requerido" }
```

**Estimación:** S

---

#### US-AUTH-013 — Verificación de token para Nginx (auth_request)

**Como** API Gateway (Nginx),
**quiero** verificar la validez de un access token antes de enrutar cada petición,
**para** garantizar que solo peticiones autenticadas lleguen a los microservicios internos.

**Criterios de aceptación (BDD):**

```
Dado que envío GET /api/auth/verify con cabecera Authorization: Bearer <token-válido>
Y la sesión asociada tiene isActive: true en MongoDB
Entonces recibo HTTP 200
Y el cuerpo contiene { message: "Token valid", userId: "<id>" }

Dado que el token tiene firma inválida o expiró
Entonces recibo HTTP 401
Y el cuerpo contiene { error: "Invalid token" }

Dado que el token es válido pero la sesión fue revocada (isActive: false)
Entonces recibo HTTP 401
Y el cuerpo contiene { error: "Session revoked" }

Dado que la cabecera Authorization está ausente
Entonces recibo HTTP 401
Y el cuerpo contiene { error: "No token provided" }
```

**Estimación:** M

---

### EP-AUTH-03 — Seguridad y cumplimiento

---

#### US-AUTH-014 — Carga segura de secretos en arranque

**Como** operador del sistema,
**quiero** que JWT_SECRET y MONGO_URI se carguen desde el gestor de secretos de `@dev-laoz/core`,
**para** que nunca estén hardcodeados en el código fuente ni en variables de entorno del contenedor.

**Criterios de aceptación (BDD):**

```
Dado que el servicio arranca en NODE_ENV != "test"
Cuando `config.loadRemoteSecrets('authentication-api', ['JWT_SECRET', 'MONGO_URI'])` falla
Entonces el proceso no debe arrancar correctamente
Y debe emitir un log de error

Dado que NODE_ENV === "test"
Cuando el servicio arranca
Entonces no se llama a loadRemoteSecrets ni a connectDB
```

**Estimación:** S

---

### EP-AUTH-04 — Operabilidad

---

#### US-AUTH-015 — Healthcheck del servicio

**Como** orquestador (Docker/Kubernetes),
**quiero** consultar el estado de salud del servicio sin autenticación,
**para** detectar instancias caídas y reiniciarlas automáticamente.

**Criterios de aceptación (BDD):**

```
Dado que el servicio está en ejecución
Cuando envío GET /api/auth/health sin cabeceras de autenticación
Entonces recibo HTTP 200
Y el cuerpo es { status: "healthy", service: "authentication-api" }
Y el tiempo de respuesta es < 200 ms
```

**Estimación:** S

---

## Resumen de estimaciones

| Story | Épica | Estimación |
|---|---|---|
| US-AUTH-001 | EP-AUTH-01 | M |
| US-AUTH-002 | EP-AUTH-01 | S |
| US-AUTH-003 | EP-AUTH-01 | S |
| US-AUTH-004 | EP-AUTH-01 | S |
| US-AUTH-005 | EP-AUTH-01 | M |
| US-AUTH-006 | EP-AUTH-01 | S |
| US-AUTH-007 | EP-AUTH-02 | M |
| US-AUTH-008 | EP-AUTH-02 | S |
| US-AUTH-009 | EP-AUTH-02 | S |
| US-AUTH-010 | EP-AUTH-02 | M |
| US-AUTH-011 | EP-AUTH-02 | S |
| US-AUTH-012 | EP-AUTH-02 | S |
| US-AUTH-013 | EP-AUTH-02 | M |
| US-AUTH-014 | EP-AUTH-03 | S |
| US-AUTH-015 | EP-AUTH-04 | S |

**Leyenda:** S = Small (< 0.5 día) · M = Medium (0.5–1 día) · L = Large (> 1 día)
