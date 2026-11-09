# Guía de Desarrollo y Vista Previa en Expo Go

Esta guía explica paso a paso cómo instalar dependencias, iniciar el servidor de desarrollo, abrir **Community Skill Exchange** en un teléfono físico mediante **Expo Go**, conectar el backend de **Supabase** y resolver problemas frecuentes.

---

## 1. Requisitos previos

1. **Node.js 20+** (recomendado Node 22 o 24 LTS) y `npm`.
2. En tu smartphone físico (iPhone o Android):
   - Instalá **Expo Go** desde [App Store (iOS)](https://apps.apple.com/app/expo-go/id982107779) o [Google Play (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent).
   - El proyecto está fijado en **Expo SDK 58**, que coincide con la versión vigente de Expo Go en las tiendas.
3. *(Recomendado en iOS)* Creá una cuenta gratuita en [expo.dev](https://expo.dev) e iniciá sesión tanto en la app **Expo Go** del teléfono como en la terminal (`npx expo login`).

---

## 2. Instalación de dependencias

Desde la raíz del repositorio:

```bash
npm install
```

Para agregar cualquier dependencia nueva en el futuro, **usá siempre**:

```bash
npx expo install <paquete>
```

Esto garantiza que la versión instalada sea compatible con **Expo SDK 58** y con el binario precompilado de **Expo Go**. No instales módulos nativos personalizados que no estén incluidos en Expo Go sin aprobar antes el paso a un *Development Build*.

---

## 3. Cómo iniciar el servidor de desarrollo

### Opción A — En la misma red Wi-Fi (LAN, recomendada en tu computadora)

```bash
npm run start
# equivalente a: npx expo start
```

### Opción B — Modo Túnel (cuando hay restricciones de red o entorno en la nube)

Si tu teléfono y el servidor de desarrollo están en redes distintas, o si la red Wi-Fi tiene aislamiento de clientes (*AP isolation*):

```bash
npm run start:tunnel
# equivalente a: npx expo start --tunnel
```

---

## 4. Cómo conectar tu smartphone con Expo Go

1. Ejecutá `npm run start` (o `npm run start:tunnel`).
2. En la terminal aparecerá un **código QR** y una URL `exp://...`.
3. En tu teléfono:
   - **Android:** Abrí la app **Expo Go** y tocá **«Scan QR code»**.
   - **iPhone (iOS):** Abrí la app **Cámara** del sistema, apuntá al código QR y tocá la notificación para abrir en **Expo Go**.
4. Al modificar cualquier archivo dentro de `src/`, **Fast Refresh** actualizará la pantalla en tu teléfono automáticamente.

---

## 5. Cómo conectar la aplicación a Supabase

Durante las **Etapas 1 y 2**, la aplicación utiliza el repositorio de demostración (`src/services/mockRepository.ts`) e identifica claramente en pantalla que los datos son simulados (`DATOS DE DEMOSTRACIÓN`).

Para conectar tu proyecto de desarrollo de **Supabase**:

1. Copiá el archivo de ejemplo en la raíz del proyecto:
   ```bash
   cp .env.example .env
   ```
2. Completá en `.env` los valores públicos de tu proyecto Supabase (desde *Project Settings → API*):
   ```dotenv
   EXPO_PUBLIC_DATA_MODE=supabase
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-o-publishable-key
   ```
3. **Regla crítica de seguridad:** Nunca coloques la clave `service_role` ni secretos privados en `.env` ni dentro del código móvil. Todo lo que lleva el prefijo `EXPO_PUBLIC_` es visible en el paquete JS del cliente.
4. Reiniciá el servidor limpiando caché para que Metro tome las nuevas variables:
   ```bash
   npm run start:clear
   ```
5. En la app, abrí **Mi perfil → Abrir diagnóstico técnico** (`/dev`) y presioná **«Probar conexión ahora»** para verificar la latencia y el estado HTTP contra Supabase desde tu teléfono.

---

## 6. Resolución de problemas comunes

### «Project is incompatible with this version of Expo Go»
- **Causa:** La app Expo Go instalada en el teléfono no coincide con `expo` (~58.0.x) del proyecto.
- **Solución:** Actualizá Expo Go desde App Store / Google Play. En Android también podés descargar la versión exacta para SDK 58 desde [expo.dev/go](https://expo.dev/go). Ejecutá `npx expo-doctor` para comprobar que ningún paquete haya cambiado de versión.

### El código QR no abre o da «Uncaught Error: java.net.SocketTimeoutException / Could not connect to development server»
- **Causa:** El teléfono no alcanza la IP local del servidor (redes distintas, VPN activa, firewall o aislamiento Wi-Fi).
- **Solución:**
  1. Verificá que el teléfono y la computadora estén en la misma red Wi-Fi y desactivá VPNs.
  2. Si seguís sin conexión o corrés el servidor en una máquina remota, iniciá con `npm run start:tunnel`.

### Cambié `.env` o instalé un paquete y no se refleja
- **Solución:** Detené el servidor (`Ctrl + C`) y ejecutá:
  ```bash
  npm run start:clear
  ```

---

## 7. Cómo reiniciar o limpiar el entorno de desarrollo

```bash
# Limpiar caché de Metro y reiniciar Expo
npm run start:clear

# Verificar salud de dependencias y configuración Expo
npm run doctor

# Verificar tipos de TypeScript
npm run typecheck

# Ejecutar linter
npm run lint

# Ejecutar suite automatizada de pruebas (dominio, libro mayor por partida doble, QR 2 etapas y seguridad)
npm test
```

---

## 8. Migraciones SQL y Semilla de Supabase

Los esquemas versionados se encuentran en `supabase/migrations/` y deben aplicarse en orden en el SQL Editor de Supabase (o con `npx supabase db push`):

1. `supabase/migrations/20261108000001_core_schema.sql` — Tablas principales (`profiles`, `private_profiles`, `skills`, `user_skills`, `activities`, `payment_arrangements`, `sessions`, `credit_accounts`, `credit_transactions`, `monetary_payments`).
2. `supabase/migrations/20261108000002_rls_and_rpcs.sql` — Políticas Row-Level Security (RLS) y RPCs transaccionales (`ledger_transfer`, `grant_initial_incentive`, `request_session`, `respond_to_session`, `cancel_session`).
3. `supabase/migrations/20261108000003_exchange_economy.sql` — Separación contable de pagos en ARS (`report_monetary_payment`, `confirm_monetary_payment`), ventana de 48 h con descargo por fuerza mayor (`submit_cancellation_objection`) y auditoría de invariantes (`verify_wallet_invariants`).
4. `supabase/migrations/20261108000004_trust_and_community.sql` — Verificación QR en 2 etapas con nonces efímeros de 90 s (`issue_session_token`, `redeem_session_token`), reseñas verificadas (`submit_verified_review`), notificaciones y moderación de disputas (`resolve_dispute`).
5. `supabase/seed.sql` — Datos iniciales de barrios (`Santo Tomás`, `Pilar Centro`, `Presidente Derqui`), categorías, catálogo de habilidades y cuentas del sistema (`system_mint`, `escrow`).

