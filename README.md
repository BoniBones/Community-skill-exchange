# Community Skill Exchange

Plataforma comunitaria móvil (iOS y Android) para conectar vecinos a través del intercambio de conocimientos, habilidades, servicios y experiencias — concebida inicialmente en torno a la comunidad de **Santo Tomás (Buenos Aires)**, con proyección a **Pilar Centro** y **Presidente Derqui**.

> **«Todos tenemos algo para enseñar y algo para aprender.»**

---

## Estado del proyecto (Etapas 1 a 6 + Refinamientos de Producción R1–R4)

- **Etapa 1 — Fundación y Vista Previa en Expo Go:** Proyecto **Expo SDK 58** con TypeScript estricto, **Expo Router**, sistema de diseño cálido y accesible, navegación por pestañas y diagnóstico en vivo (`/dev`).
- **Etapa 2 — Experiencia de Usuario y Onboarding:** Acceso con código OTP de 6 dígitos, flujo de bienvenida en **4 pasos** (elegibilidad `+18`, verificación barrial de **Santo Tomás** mediante código de acceso con hash SHA-256/`pgcrypto`, perfil con foto y sin domicilio privado, y selección múltiple separada de habilidades para enseñar y aprender), reserva de sesiones y reportes/bloqueos de seguridad.
- **Etapa 3 — Funcionalidad Central y Esquema Supabase:** Publicación y edición de múltiples actividades por instructor (`/my-activities`, `/activity-form`), configuración de franjas horarias semanales (`/availability`), motor de descubrimiento con filtro de intercambio mutuo y migraciones SQL base (`supabase/migrations/20261108000001_initial_schema.sql` y `20261108000002_core_rpcs.sql`).
- **Etapa 4 — Economía de Intercambio por Tiempo:** Libro mayor cerrado por partida doble (`credit_transactions`), auditoría en tiempo real de las **5 invariantes contables** (`verify_ledger_invariants()`), barra de circulación (tope sugerido de 20 créditos) y ventana de revisión de 48 h con descargo por fuerza mayor sin penalidades automáticas (`20261108000003_exchange_economy.sql`).
- **Etapa 5 — Confianza y Comunidad:** Verificación presencial en **2 etapas con QR dinámico de 90 s** (`check_in` + `check_out`) con liberación atómica de créditos en custodia, reseñas verificadas post-sesión, bandeja de notificaciones (`/notifications`) y panel de moderación y resolución de disputas (`/admin`) (`20261108000004_trust_and_community.sql`).
- **Etapa 6 y Refinamientos R1–R4 — Créditos Enteros, Catálogo Ampliado, Temas, i18n y Endurecimiento de Seguridad:**
  - **Créditos estrictamente enteros y no canjeables (`20261125000005_integer_only_credits.sql`):** `1 hora enseñando = 1 crédito`, `1 hora aprendiendo = 1 crédito` (enteros `>= 1`, sin decimales ni dinero real).
  - **Catálogo de 7 categorías, habilidades personalizadas, foto de perfil y puerta barrial (`20261125000006_catalog_storage_neighborhood_access.sql`):** Categorías ampliadas (Idiomas, Música, Apoyo escolar, Tecnología, Deportes, Artes y manualidades, Habilidades prácticas), creación de habilidades personalizadas buscables, subida/reemplazo/eliminación de foto de perfil con `expo-image-picker` (bucket `avatars`) y validación barrial hash-verificada para **Santo Tomás**.
  - **i18n completo (`es-AR` / `en`), Temas (`Claro` / `Oscuro` / `Sistema`) + acentos y Configuración unificada (`/settings`):** Persistencia en `AsyncStorage` con cambio en vivo sin reinicio.
  - **Endurecimiento de invariantes de seguridad (`20261125000007_safety_invariants_hardening.sql`):** RPC `submit_eligibility` (+18), protección por trigger de `profiles.neighborhood_verified_at` y `neighborhood_id`, restricción de puntos de encuentro públicos en `activities`, paridad de validación QR en repositorio de demostración y guardas de estado/ventana en objeciones y disputas.

---

## Pilares del producto

1. **Aprendizaje mutuo:** Cualquier miembro puede actuar simultáneamente como instructor y aprendiz, con selección múltiple independiente para «Habilidades que enseño» y «Habilidades que quiero aprender».
2. **Créditos de tiempo y habilidades estrictamente enteros:** Economía comunitaria cerrada sin dinero real (`1 hora enseñando = 1 crédito`, `1 hora aprendiendo = 1 crédito`, valores enteros `>= 1`). Los créditos son **no canjeables por dinero**, se protegen en custodia (`escrow`) durante cada reserva y mantienen un tope de circulación saludable (`20` créditos).
3. **Comunidad y confianza:** Coincidencias recíprocas e indirectas, acceso barrial verificado (**Santo Tomás** activo en el piloto), puntos de encuentro públicos (nunca domicilios particulares), verificación presencial en dos etapas mediante **código QR dinámico (90 s)** y reseñas exclusivas de sesiones completadas y verificadas.

---

## Stack técnico

- **Frontend:** React Native `0.88.1`, **Expo SDK 58** (compatible con **Expo Go** en App Store y Google Play), TypeScript estricto, **Expo Router** (`src/app/`), **TanStack React Query**, **`expo-image-picker`** (foto de perfil), **`expo-localization`** + **`AsyncStorage`** (idioma `es-AR`/`en` y tema Claro/Oscuro/Sistema + paleta de acento), pantalla unificada **`/settings`**.
- **Backend:** **Supabase** (PostgreSQL, Row-Level Security, `pgcrypto`, Storage bucket `avatars`, funciones transaccionales `SECURITY DEFINER` para el libro mayor de créditos, custodia, verificación QR, elegibilidad `+18` y acceso barrial, y Supabase Auth con OTP por email).
- **Zona horaria oficial:** `America/Argentina/Buenos_Aires` (almacenamiento en UTC, conversión en presentación y agenda).

---

## Inicio rápido (Vista previa en Expo Go)

```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar verificaciones de tipos, linter y pruebas automatizadas
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
| `npm test` | Ejecuta las suites automatizadas de economía, i18n/temas, catálogo/acceso e invariantes de seguridad |
| `npm run typecheck` | Verificación estática de tipos con TypeScript (`tsc --noEmit`) |
| `npm run lint` | Ejecuta el linter de Expo (`npx expo lint`) |
| `npm run doctor` | Diagnóstico de dependencias y configuración (`npx expo-doctor`) |
