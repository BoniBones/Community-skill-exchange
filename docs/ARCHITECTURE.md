# Arquitectura Técnica — Community Skill Exchange

Este documento resume la arquitectura aprobada del producto, el modelo de datos relacional, las reglas de integridad del sistema de créditos comunitarios, el ciclo de vida de sesiones y la estrategia de seguridad.

---

## 1. Módulos y separación de entidades

El modelo distingue estrictamente cuatro conceptos que no deben confundirse:

1. **Habilidad (`skills`):** Una disciplina del catálogo (p. ej. *Piano*, *Karate*, *Matemática*, *Python*).
2. **Habilidad de usuario (`user_skills`):** Relación entre una persona y una habilidad, con `kind ∈ ('offers', 'wants')` (lo que puede enseñar vs. lo que quiere aprender). Un mismo usuario puede enseñar y aprender simultáneamente.
3. **Actividad (`activities` + `payment_arrangements`):** Una publicación concreta ofrecida por un instructor (título, duración, formato, punto de encuentro público, requisitos y acuerdo de pago). Un usuario puede publicar múltiples actividades.
4. **Sesión (`sessions`):** Una reserva concreta entre un aprendiz y un instructor para una actividad en una fecha/hora determinada (`America/Argentina/Buenos_Aires`, almacenada en UTC), con una copia inmutable (*snapshot*) del acuerdo de pago vigente al momento de reservar.

---

## 2. Sistema económico: Créditos comunitarios y pagos monetarios

### 2.1 Tres acuerdos de pago configurables por el instructor

En `payment_arrangements`:
- `credits`: Solo créditos comunitarios (`credit_amount > 0`, `money_amount_cents IS NULL`).
- `money`: Solo dinero (`money_amount_cents > 0`, `credit_amount IS NULL`).
- `mixed`: Combinación de créditos y dinero (`credit_amount > 0 AND money_amount_cents > 0`).

No existe una tasa de conversión universal fija entre 1 crédito y pesos/dólares.

### 2.2 Separación contable e integridad transaccional

- **`credit_accounts` y `credit_transactions`:** Libro mayor cerrado e inmutable para créditos comunitarios.
  - Los clientes móviles **nunca** tienen permiso de escritura directa (`INSERT`/`UPDATE`/`DELETE` denegado por RLS).
  - Todo movimiento ocurre mediante funciones PostgreSQL `SECURITY DEFINER` (`ledger_transfer`) que bloquean las cuentas involucradas en orden determinístico (`SELECT ... FOR UPDATE`), verifican saldo no negativo y exigen `idempotency_key UNIQUE`.
- **`monetary_payments`:** Tabla independiente para registrar pagos en dinero real (`ARS`), separada del libro mayor de créditos para auditoría, reembolsos y futura integración con pasarelas de pago.
- **Incentivo inicial de participación:** Los usuarios comienzan con saldo `0`. Se otorga un incentivo configurable por única vez (`idempotency_key = 'incentive:' || user_id`) cuando el usuario completa su perfil y publica su primera actividad.

---

## 3. Ciclo de vida de la sesión y custodia (Escrow)

Estados de `sessions.state`:

- `requested`: El aprendiz solicita la sesión; los créditos aplicables pasan de la cuenta del aprendiz a la cuenta de **custodia (`escrow`)** para evitar doble gasto.
- `confirmed`: El instructor acepta la solicitud.
- `declined` / `expired`: Solicitud rechazada o vencida; los créditos en custodia se reintegran íntegramente al aprendiz.
- `cancelled`: Cancelación antes del plazo permitido → reintegro al aprendiz; cancelación tardía → ventana de objeción de 48 h antes de aplicar cualquier penalidad parcial.
- `in_progress`: Verificación QR de inicio (`check_in`) completada por ambos participantes.
- `no_show_pending`: Sin `check_in` pasados 30 minutos del inicio; los créditos permanecen en custodia hasta su revisión o resolución.
- `completed`: Verificación QR de cierre (`check_out`) completada; los créditos en custodia se liberan al instructor (`release`, con clave idempotente `release:<session_id>`). Habilita la publicación de reseñas verificadas (`reviews`).
- `disputed` → `resolved`: Cualquier reclamo o fuerza mayor congela la transferencia en custodia hasta la revisión de moderación. Nunca se ejecutan penalidades automáticas irreversibles.

---

## 4. Verificación presencial por código QR en dos etapas

1. **Emisión (`issue_session_token`):** Un participante solicita un token para `check_in` o `check_out`. El backend valida estado y ventana horaria, genera un nonce aleatorio de 128 bits, guarda solo su hash SHA-256 con vencimiento a **90 segundos** y lo devuelve para mostrar en el QR.
2. **Canje (`redeem_session_token`):** La contraparte escanea el QR con `expo-camera`. El backend verifica que el token exista, no haya expirado, no haya sido usado (`used_at IS NULL`) y que quien lo canjea sea **el otro participante** de la sesión. En una sola transacción marca el token como usado, avanza el estado de la sesión y, en `check_out`, ejecuta la liberación de créditos.

---

## 5. Seguridad, privacidad y elegibilidad por edad

- **Autenticación:** Supabase Auth mediante código OTP de 6 dígitos por email (compatible con Expo Go sin depender de deep links personalizados).
- **Privacidad geográfica:** Solo se expone el barrio o zona general (`neighborhoods`) y puntos de encuentro públicos por actividad. Nunca se almacenan ni publican domicilios particulares en perfiles públicos.
- **Elegibilidad y protección de menores:** Fecha de nacimiento resguardada en `private_profiles` (acceso restringido por RLS al titular y administradores). Piloto inicial habilitado para mayores de 18 años, con soporte arquitectónico para cuentas restringidas y consentimiento parental auditable.
- **Moderación:** Reportes (`reports`), bloqueos mutuos (`blocks`, aplicados en las políticas RLS y en el motor de descubrimiento) y cola de disputas (`disputes`).
