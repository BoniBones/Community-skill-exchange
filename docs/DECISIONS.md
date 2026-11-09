# Registro de Decisiones de Arquitectura (ADR) — Community Skill Exchange

Este documento registra las decisiones arquitectónicas, económicas, de seguridad y de compatibilidad móvil tomadas durante el diseño e implementación de las 6 etapas del MVP de **Community Skill Exchange**.

---

## ADR-01: Separación estricta de 4 entidades del dominio

- **Contexto:** En plataformas de intercambio suele confundirse una habilidad general con la oferta de un usuario o con una clase concreta.
- **Decisión:** Separar estrictamente en esquema SQL (`supabase/migrations/`) y en tipos TypeScript (`src/domain/types.ts`):
  1. `Skill`: Habilidad del catálogo (`s-piano`, `s-karate`, etc.).
  2. `UserSkill`: Relación usuario-habilidad con `kind ∈ ('offers', 'wants')`. Todo miembro puede enseñar y aprender simultáneamente.
  3. `Activity` + `PaymentArrangement`: Publicación concreta ofrecida por un instructor (un instructor puede publicar múltiples actividades).
  4. `Session`: Reserva con horario en UTC y copia inmutable (*snapshot*) del acuerdo de pago vigente al momento de reservar.

---

## ADR-02: Coexistencia de tres modalidades de pago sin valor monetario fijo por crédito

- **Contexto:** La misión social busca democratizar el acceso al aprendizaje mediante créditos comunitarios (1 h enseñando = 1 crédito estándar) sin impedir que los instructores cobren en pesos argentinos (`ARS`) o combinen ambos.
- **Decisión:**
  - Soportar por actividad `mode ∈ ('credits', 'money', 'mixed')` gobernado por un `CHECK` constraint en PostgreSQL y validación en cliente.
  - **Prohibir** cualquier tasa de conversión fija universal entre 1 crédito y `ARS` o `USD`.
  - Mantener circuitos contables separados: `credit_transactions` (libro mayor cerrado de créditos) y `monetary_payments` (registro auditado de pagos en `ARS`).

---

## ADR-03: Libro mayor cerrado por partida doble, custodia (Escrow) e incentivo único

- **Contexto:** Un saldo numérico editable desde el cliente móvil sería vulnerable a condiciones de carrera, doble gasto o manipulación.
- **Decisión:**
  - Los clientes móviles tienen denegado `INSERT`/`UPDATE`/`DELETE` directo sobre `credit_accounts` y `credit_transactions` mediante RLS.
  - Toda transferencia ocurre en funciones `SECURITY DEFINER` (`ledger_transfer`) que ordenan los bloqueos `SELECT ... FOR UPDATE`, exigen `idempotency_key UNIQUE` y verifican saldo no negativo.
  - El saldo inicial es `0`. Al completar el perfil y publicar la primera actividad se otorga por única vez el incentivo de participación (`2 créditos`, clave `incentive:<user_id>`).
  - Al solicitar una sesión, los créditos pasan a la cuenta de custodia (`escrow`, clave `hold:<session_id>`).

---

## ADR-04: Cancelaciones, ventana de 48 h por fuerza mayor y prohibición de penalidades automáticas irreversibles

- **Contexto:** Las penalidades automáticas irreversibles dañan la confianza comunitaria ante imprevistos reales (cortes de luz, tormentas, emergencias médicas).
- **Decisión:**
  - Cancelación con `≥ 24 h` de anticipación: reintegro inmediato del 100 % desde custodia (`refund:<session_id>`).
  - Cancelación con `< 24 h` o inasistencia reportada: apertura de una **ventana de revisión de 48 h** durante la cual los créditos permanecen protegidos en custodia y cualquiera de las partes puede presentar un descargo por fuerza mayor (`submit_cancellation_objection`), derivando el caso a la cola de moderación (`resolve_dispute`).

---

## ADR-05: Verificación presencial en 2 etapas con QR dinámico (90 s) y reseñas verificadas

- **Contexto:** Un código QR estático permitiría marcar sesiones como completadas sin haberse reunido o reutilizar capturas de pantalla.
- **Decisión:**
  - Exigir dos verificaciones separadas: `check_in` (inicio → estado `in_progress`) y `check_out` (cierre → estado `completed` + liberación atómica de créditos `release:<session_id>`).
  - Cada QR codifica un nonce efímero con validez de **90 segundos** cuyo hash SHA-256 se almacena en `session_verification_tokens`.
  - Solo los participantes de una sesión en estado `completed` pueden publicar una reseña (`submit_verified_review`), recalculando automáticamente el promedio del destinatario.

---

## ADR-06: Compatibilidad con Expo Go (SDK 58), privacidad barrial y elegibilidad +18

- **Contexto:** El proyecto debe poder previsualizarse en un smartphone físico con **Expo Go** durante todo el desarrollo del MVP y proteger la seguridad física y legal de los vecinos.
- **Decisión:**
  - Fijar **Expo SDK 58** (`expo@~58.0.23`, React Native `0.88.1`) y usar un generador visual de matriz QR en componentes puros de React Native junto con bandeja de notificaciones in-app (`/notifications`) y autenticación OTP de 6 dígitos por email.
  - Mostrar únicamente el barrio o zona general (`Santo Tomás`, `Pilar Centro`, `Presidente Derqui`) y puntos de encuentro públicos, nunca domicilios particulares.
  - Requerir elegibilidad `+18` en el piloto inicial (`private_profiles`), dejando preparado el esquema para consentimiento parental auditable (`13–17`) tras revisión legal.
