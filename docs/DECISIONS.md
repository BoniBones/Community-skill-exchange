# Registro de Decisiones de Arquitectura (ADR) — Community Skill Exchange

Este documento registra las decisiones arquitectónicas, económicas, de seguridad y de compatibilidad móvil de **Community Skill Exchange** (Etapas 1–6 y Refinamientos de Producción R1–R4).

---

## ADR-01: Separación estricta de 4 entidades del dominio

- **Contexto:** En plataformas de intercambio suele confundirse una habilidad general con la oferta de un usuario o con una clase concreta.
- **Decisión:** Separar estrictamente en esquema SQL (`supabase/migrations/`) y en tipos TypeScript (`src/domain/types.ts`):
  1. `Skill`: Habilidad del catálogo organizado en 7 categorías (`languages`, `music`, `academic`, `tech`, `sports`, `arts_crafts`, `practical`), incluyendo habilidades personalizadas (`isCustom`, `createdBy`, `description`).
  2. `UserSkill`: Relación usuario-habilidad con `kind ∈ ('offers', 'wants')` y selección múltiple separada. Todo miembro puede enseñar y aprender simultáneamente.
  3. `Activity`: Publicación concreta ofrecida por un instructor, vinculada en SQL a `payment_arrangements` con costo entero no canjeable (`credit_amount >= 1`, `is_non_cashable = true`).
  4. `Session`: Reserva con horario en UTC y copia inmutable (*snapshot*) del costo entero en créditos (`price_credit_amount >= 1`) vigente al momento de reservar.

---

## ADR-02: Créditos de tiempo estrictamente enteros y no canjeables (`1 h = 1 crédito`) sin dinero real

- **Contexto:** La misión comunitaria busca garantizar reciprocidad equitativa y simplicidad contable mediante intercambio de tiempo y habilidades, eliminando fricciones legales, fiscales y de pasarelas de pago.
- **Decisión:**
  - Enforzar **exclusivamente créditos de tiempo/habilidad enteros (`>= 1`)** bajo el principio **`1 hora enseñando = 1 crédito` / `1 hora aprendiendo = 1 crédito`** en tipos TypeScript, `mockRepository`, interfaz de usuario y `CHECK` constraints de PostgreSQL (`20261125000005_integer_only_credits.sql`).
  - Marcar los créditos como **estrictamente no canjeables por dinero** (`is_non_cashable = true`) y eliminar toda funcionalidad de pagos monetarios, modos mixtos, montos decimales y divisiones fraccionarias de disputas (las disputas se resuelven únicamente como `resolved_refund` o `resolved_release`).

---

## ADR-03: Libro mayor cerrado por partida doble, custodia (Escrow) e incentivo único

- **Contexto:** Un saldo numérico editable desde el cliente móvil sería vulnerable a condiciones de carrera, doble gasto o manipulación.
- **Decisión:**
  - Los clientes móviles tienen denegado `INSERT`/`UPDATE`/`DELETE` directo sobre `credit_accounts` y `credit_transactions` mediante RLS.
  - Toda transferencia ocurre en funciones `SECURITY DEFINER` (`ledger_transfer`) que ordenan los bloqueos `SELECT ... FOR UPDATE`, exigen `idempotency_key UNIQUE` y verifican saldo no negativo.
  - El saldo inicial es `0`. Al publicar la primera actividad se otorga por única vez el incentivo de participación (`2 créditos`, clave `incentive:<user_id>`).
  - Al solicitar una sesión, los créditos enteros pasan a la cuenta de custodia (`escrow`, clave `hold:<session_id>`), respetando el tope saludable de circulación (`MAX_BALANCE = 20`).

---

## ADR-04: Cancelaciones, ventana de 48 h por fuerza mayor y prohibición de penalidades automáticas irreversibles

- **Contexto:** Las penalidades automáticas irreversibles dañan la confianza comunitaria ante imprevistos reales (cortes de luz, tormentas, emergencias médicas).
- **Decisión:**
  - Cancelación con `>= 24 h` de anticipación: reintegro inmediato del 100 % desde custodia (`refund:<session_id>`).
  - Cancelación con `< 24 h`: apertura de una **ventana de revisión de 48 h** durante la cual los créditos permanecen protegidos en custodia y cualquiera de las partes puede presentar un descargo por fuerza mayor (`submit_cancellation_objection`), derivando el caso a la cola de moderación (`resolve_dispute`).
  - Tanto en cliente como en SQL (`20261125000007`), solo sesiones en estado `cancelled` con `cancellation_timing = 'late_review_window'` dentro de la ventana vigente admiten objeciones, impidiendo reabrir sesiones ya finalizadas (`completed`, `resolved`, `declined`, `expired`) o duplicar disputas abiertas.

---

## ADR-05: Verificación presencial en 2 etapas con QR dinámico (90 s) y reseñas verificadas

- **Contexto:** Un código QR estático permitiría marcar sesiones como completadas sin haberse reunido o reutilizar capturas de pantalla.
- **Decisión:**
  - Exigir dos verificaciones separadas: `check_in` (inicio → estado `in_progress`) y `check_out` (cierre → estado `completed` + liberación atómica de créditos `release:<session_id>`).
  - Cada QR codifica un nonce efímero con validez de **90 segundos** cuyo hash SHA-256 se almacena en `session_verification_tokens`.
  - Tanto Supabase como `mockRepository` exigen token existente, no expirado, de un solo uso (`used_at IS NULL`) y canjeado exclusivamente por la **contraparte** (bloqueo de auto-canje), sin quemar tokens válidos ante llamadas en estado inválido.
  - Solo los participantes de una sesión en estado `completed` pueden publicar una única reseña verificada (`submit_verified_review`), recalculando automáticamente el promedio del destinatario.

---

## ADR-06: Compatibilidad con Expo Go (SDK 58), acceso barrial verificado, foto de perfil, i18n, temas y elegibilidad +18

- **Contexto:** El proyecto debe previsualizarse directamente en smartphones físicos con **Expo Go**, proteger la privacidad vecinal y ofrecer una experiencia moderna y consistente en español argentino e inglés.
- **Decisión:**
  - Fijar **Expo SDK 58** (`expo@~58.0.26`, React Native `0.88.1`), usando `VisualQrMatrix` en React Native puro (sin módulos nativos de cámara), `expo-image-picker@~58.0.10` para fotos de perfil (almacenadas en el bucket `avatars` de Supabase Storage), bandeja de notificaciones in-app (`/notifications`) y autenticación OTP de 6 dígitos por email.
  - Exigir verificación de barrio + código de acceso con hash SHA-256/`pgcrypto` (`verify_neighborhood_access`, actualmente solo **Santo Tomás** activo y cero códigos en texto plano en el código cliente) protegido por trigger en PostgreSQL (`guard_profiles_neighborhood_fields`), junto con puntos de encuentro públicos obligatorios (`activities_public_meeting_area_check`) y elegibilidad `+18` (`submit_eligibility` + `private_profiles`).
  - Centralizar idioma (`es-AR` / `en`), modo de tema (`light` / `dark` / `system`), acento visual, foto de perfil, edición personal, habilidades y acceso a `/dev` en una única pantalla **`/settings`** persistida en `AsyncStorage`.
