# Community Skill Exchange

Plataforma comunitaria móvil (iOS y Android) para conectar vecinos a través del intercambio de conocimientos, habilidades, servicios y experiencias — concebida inicialmente en torno a la comunidad de **Santo Tomás (Buenos Aires)**, con proyección a **Pilar** y **Presidente Derqui**.

> **«Todos tienen algo para enseñar y todos tienen algo para aprender.»**

---

## Pilares del producto

1. **Aprendizaje:** Cualquier miembro puede actuar simultáneamente como instructor y aprendiz, sin una separación rígida entre «profesores» y «alumnos».
2. **Intercambio flexible:** Coexistencia de **créditos comunitarios** (1 hora enseñando = 1 crédito bajo la modalidad estándar) y **dinero real (ARS)**. Cada instructor elige por actividad una de tres modalidades:
   - **Solo créditos** (p. ej. 1 crédito)
   - **Solo dinero** (p. ej. \$ 8.000 ARS)
   - **Pago mixto** (p. ej. 1 crédito + \$ 2.000 ARS)
   - *Los créditos no tienen un valor monetario universal fijo.*
3. **Comunidad y confianza:** Coincidencias recíprocas e indirectas, puntos de encuentro públicos (nunca domicilios particulares), verificación presencial en dos etapas mediante **código QR dinámico** y reseñas exclusivas de sesiones verificadas.

---

## Stack técnico

- **Frontend:** React Native `0.88`, **Expo SDK 58** (compatible con la versión actual de **Expo Go** en App Store y Google Play), TypeScript estricto, **Expo Router** (`src/app/`), **TanStack React Query**.
- **Backend (Etapa 3+):** **Supabase** (PostgreSQL, Row-Level Security, funciones transaccionales `SECURITY DEFINER` para el libro mayor de créditos, Supabase Auth con OTP por email).
- **Zona horaria oficial:** `America/Argentina/Buenos_Aires` (almacenamiento en UTC, conversión en presentación y agenda).

---

## Inicio rápido (Vista previa en Expo Go)

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor de desarrollo de Expo
npm run start

# Si tu teléfono y tu computadora no están en la misma red Wi-Fi (o desde entorno remoto):
npm run start:tunnel
```

Escaneá el código QR con la cámara (iOS) o desde la app **Expo Go** (Android).

Consultá la guía completa de instalación, conexión con Expo Go, configuración de Supabase y resolución de problemas en **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** y el diseño técnico en **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run start` | Inicia el servidor de desarrollo de Expo (LAN) |
| `npm run start:tunnel` | Inicia Expo en modo túnel (cuando la red local bloquea conexiones) |
| `npm run start:clear` | Inicia Expo limpiando la caché de Metro |
| `npm run typecheck` | Verificación estática de tipos con TypeScript (`tsc --noEmit`) |
| `npm run lint` | Ejecuta el linter de Expo (`npx expo lint`) |
| `npm run doctor` | Diagnóstico de dependencias y configuración (`npx expo-doctor`) |
