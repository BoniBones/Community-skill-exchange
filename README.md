# Community Skill Exchange

Plataforma comunitaria móvil (iOS y Android) para conectar vecinos a través del intercambio de conocimientos, habilidades, servicios y experiencias — concebida inicialmente en torno a la comunidad de **Santo Tomás (Buenos Aires)**, con proyección a **Pilar Centro** y **Presidente Derqui**.

> **«Todos tenemos algo para enseñar y algo para aprender.»**

---

## Estado del proyecto (Etapas 1 a 6 completadas — Listo para Piloto)

- **Etapa 1 — Fundación y Vista Previa en Expo Go:** Proyecto Expo SDK 58 con TypeScript estricto, Expo Router, sistema de diseño cálido y accesible, navegación por pestañas y diagnóstico en vivo (`/dev`).
- **Etapa 2 — Experiencia de Usuario y Onboarding:** Acceso con código OTP de 6 dígitos, flujo de bienvenida en 3 pasos (elegibilidad `+18`, perfil barrial sin domicilio privado, habilidades que enseña/aprende), reserva de sesiones y reportes/bloqueos de seguridad.
- **Etapa 3 — Funcionalidad Central y Esquema Supabase:** Publicación y edición de múltiples actividades por instructor (`/my-activities`, `/activity-form`), configuración de franjas horarias semanales (`/availability`), motor de descubrimiento con filtro de intercambio mutuo y migraciones SQL base (`supabase/migrations/20261108000001_core_schema.sql` y `20261108000002_rls_and_rpcs.sql`).
- **Etapa 4 — Economía de Intercambio:** Separación estricta entre el libro mayor de créditos por partida doble (`credit_transactions`) y los pagos en pesos (`monetary_payments`), auditoría en tiempo real de las **5 invariantes contables**, barra de circulación (tope sugerido de 20 créditos) y ventana de revisión de 48 h con descargo por fuerza mayor sin penalidades automáticas (`20261108000003_exchange_economy.sql`).
- **Etapa 5 — Confianza y Comunidad:** Verificación presencial en **2 etapas con QR dinámico de 90 s** (`check_in` + `check_out`) con liberación atómica de créditos en custodia, reseñas verificadas post-sesión, bandeja de notificaciones (`/notifications`) y panel de moderación y resolución de disputas (`/admin`) (`20261108000004_trust_and_community.sql`).
- **Etapa 6 — Refinamiento, Pruebas E2E y Documentación Final:** Soporte bilingüe reactivo (`Español (Argentina)` / `English`), auditoría de lanzamiento piloto en vivo (`/dev`), semilla SQL (`supabase/seed.sql`), suite automatizada de pruebas (`npm test`) y registro de decisiones de arquitectura (`docs/DECISIONS.md`).

---

## Pilares del producto

1. **Aprendizaje:** Cualquier miembro puede actuar simultáneamente como instructor y aprendiz, sin una separación rígida entre «profesores» y «alumnos».
2. **Intercambio flexible:** Coexistencia de **créditos comunitarios** (1 hora enseñando = 1 crédito bajo la modalidad estándar) y **dinero real (ARS)**. Cada instructor elige por actividad una de tres modalidades:
   - **A. Solo créditos** (p. ej. 1 crédito)
   - **B. Solo dinero** (p. ej. \$ 8.000 ARS)
   - **C. Pago mixto** (p. ej. 1 crédito + \$ 2.000 ARS)
   - *Los créditos no tienen un valor monetario universal fijo.*
3. **Comunidad y confianza:** Coincidencias recíprocas e indirectas, puntos de encuentro públicos (nunca domicilios particulares), verificación presencial en dos etapas mediante **código QR dinámico (90 s)** y reseñas exclusivas de sesiones verificadas.

---

## Stack técnico

- **Frontend:** React Native `0.88`, **Expo SDK 58** (compatible con **Expo Go** en App Store y Google Play), TypeScript estricto, **Expo Router** (`src/app/`), **TanStack React Query**.
- **Backend:** **Supabase** (PostgreSQL, Row-Level Security, funciones transaccionales `SECURITY DEFINER` para el libro mayor de créditos, custodia y verificación QR, Supabase Auth con OTP por email).
- **Zona horaria oficial:** `America/Argentina/Buenos_Aires` (almacenamiento en UTC, conversión en presentación y agenda).

---

## Inicio rápido (Vista previa en Expo Go)

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar verificaciones de tipos, linter y pruebas E2E
npm run typecheck
npm run lint
npm test

# 3. Iniciar el servidor de desarrollo de Expo
npm run start

# Si tu teléfono y tu computadora están en redes distintas:
npm run start:tunnel
```

Escaneá el código QR con la cámara (iOS) o desde la app **Expo Go** (Android).

Consultá la guía completa de instalación, conexión con Expo Go, configuración de Supabase y resolución de problemas en **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**, el diseño técnico en **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** y las decisiones de arquitectura en **[docs/DECISIONS.md](docs/DECISIONS.md)**.

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run start` | Inicia el servidor de desarrollo de Expo (LAN) |
| `npm run start:tunnel` | Inicia Expo en modo túnel (cuando la red local bloquea conexiones) |
| `npm run start:clear` | Inicia Expo limpiando la caché de Metro |
| `npm test` | Ejecuta la suite automatizada de pruebas de dominio, economía, QR y seguridad |
| `npm run typecheck` | Verificación estática de tipos con TypeScript (`tsc --noEmit`) |
| `npm run lint` | Ejecuta el linter de Expo (`npx expo lint`) |
| `npm run doctor` | Diagnóstico de dependencias y configuración (`npx expo-doctor`) |
