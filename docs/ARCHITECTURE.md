# Arquitectura Técnica — Community Skill Exchange

Este documento resume la arquitectura aprobada del producto, el modelo de datos relacional, las reglas de integridad del sistema de créditos de tiempo comunitarios, el ciclo de vida de sesiones, la experiencia de usuario y la estrategia de seguridad.

---

## 1. Módulos y separación de entidades

El modelo distingue estrictamente cuatro conceptos que no deben confundirse:

1. **Habilidad (`skills` y `skill_categories`):** Catálogo organizado en **7 categorías** (`languages`, `music`, `academic`, `tech`, `sports`, `arts_crafts`, `practical`) con más de 30 habilidades base bilingües y soporte para **habilidades personalizadas** (`is_custom`, `created_by`, `description`) creadas mediante `create_custom_skill` y buscables desde el descubrimiento.
2. **Habilidad de usuario (`user_skills`):** Relación entre una persona y una habilidad, con `kind ∈ ('offers', 'wants')` (selección múltiple separada para enseñar vs. aprender). Un mismo usuario puede enseñar y aprender simultáneamente.
3. **Actividad (`activities` + `payment_arrangements`):** Una publicación concreta ofrecida por un instructor (título, duración, formato, punto de encuentro público, requisitos y costo entero en créditos no canjeables: `credit_amount integer >= 1`, `is_non_cashable = true`). Un usuario puede publicar múltiples actividades.
4. **Sesión (`sessions`):** Una reserva concreta entre un aprendiz y un instructor para una actividad en una fecha/hora determinada (`America/Argentina/Buenos_Aires`, almacenada en UTC), con una copia inmutable (*snapshot*) del costo entero (`price_credit_amount integer >= 1`) vigente al momento de reservar.

---

## 2. Sistema económico: Créditos de tiempo enteros y no canjeables

### 2.1 Regla económica única (`1 h = 1 crédito`)

- Todos los intercambios funcionan exclusivamente mediante **créditos de tiempo/habilidad estrictamente enteros y no canjeables** (`1 hora enseñando = 1 crédito`, `1 hora aprendiendo = 1 crédito`, enteros `>= 1`).
- No existen modalidades en dinero real, montos decimales ni conversiones monetarias. Las columnas y tablas heredadas de cobros externos fueron eliminadas definitivamente en `20261125000005_integer_only_credits.sql`.

### 2.2 Libro mayor cerrado por partida doble e integridad transaccional

- **`credit_accounts` y `credit_transactions`:** Libro mayor cerrado e inmutable para créditos comunitarios (`amount integer >= 1`).
  - Los clientes móviles **nunca** tienen permiso de escritura directa (`INSERT`/`UPDATE`/`DELETE` denegado por RLS).
  - Todo movimiento ocurre mediante funciones PostgreSQL `SECURITY DEFINER` (`ledger_transfer`) que bloquean las cuentas involucradas en orden determinístico (`SELECT ... FOR UPDATE`), verifican saldo no negativo y exigen `idempotency_key UNIQUE`.
- **Tope sugerido de circulación (`MAX_BALANCE = 20`) e incentivo único:** Los usuarios comienzan con saldo `0`. Al publicar su primera actividad se otorga por única vez el incentivo de participación (`2` créditos, clave `incentive:<user_id>`).
- **Auditoría en vivo (`verify_ledger_invariants()`):** Verifica 5 invariantes contables en tiempo real: saldo no negativo, conservación por partida doble, paridad entre custodia (`escrow`) y sesiones vigentes/en revisión, unicidad de idempotencia/incentivo único y validación de créditos enteros no canjeables sin montos decimales ni tablas monetarias.

---

## 3. Ciclo de vida de la sesión y custodia (`escrow`)

Estados de `sessions.state`:

- `requested`: El aprendiz solicita la sesión; los créditos enteros pasan de la cuenta del aprendiz a la cuenta de **custodia (`escrow`)** para evitar doble gasto.
- `confirmed`: El instructor acepta la solicitud.
- `declined` / `expired`: Solicitud rechazada o vencida; los créditos en custodia se reintegran íntegramente al aprendiz.
- `cancelled`: Cancelación con `>= 24 h` de anticipación (`timely`) → reintegro del 100 % al aprendiz; cancelación con `< 24 h` (`late_review_window`) → apertura de la ventana de revisión de 48 h sin penalidades automáticas irreversibles.
- `in_progress`: Verificación QR de inicio (`check_in`) completada.
- `no_show_pending`: Sin `check_in` pasados 30 minutos del inicio; los créditos permanecen en custodia hasta su revisión o resolución.
- `completed`: Verificación QR de cierre (`check_out`) completada; los créditos en custodia se liberan atómicamente al instructor (`release`, con clave idempotente `release:<session_id>`). Habilita la publicación de reseñas verificadas (`reviews`).
- `disputed` → `resolved`: Solo las sesiones canceladas en `late_review_window` dentro de las 48 h (sin disputa abierta previa) admiten objeción (`submit_cancellation_objection`). La moderación resuelve exclusivamente con reintegro del 100 % (`resolved_refund`) o liberación del 100 % (`resolved_release`) mediante `resolve_dispute`; las sesiones ya finalizadas (`completed`, `resolved`, `declined`, `expired`) no pueden reabrirse.

---

## 4. Verificación presencial por código QR en dos etapas

1. **Emisión (`issue_session_token`):** Un participante solicita un token para `check_in` o `check_out`. El backend valida estado y participación, genera un nonce aleatorio, guarda su hash SHA-256 con vencimiento a **90 segundos** y lo devuelve para mostrar en pantalla mediante `VisualQrMatrix` (matriz QR pura en React Native 100 % compatible con Expo Go, sin dependencia nativa de cámara) y un código manual de 6 caracteres.
2. **Canje (`redeem_session_token`):** La contraparte ingresa o valida el código. Tanto Supabase como `mockRepository` exigen que el token exista, no esté usado (`used_at IS NULL`), no haya expirado (`90 s`), corresponda al estado válido de la sesión y que quien lo canjea sea **el otro participante** (`issuer_id <> actor`). En una sola operación marca el token como usado (solo tras validar estado), avanza el estado de la sesión y, en `check_out`, ejecuta la liberación atómica de créditos.

---

## 5. Seguridad, privacidad, foto de perfil, puerta barrial y UI transversal

- **Autenticación:** Supabase Auth mediante código OTP de 6 dígitos por email (compatible con Expo Go sin deep links personalizados).
- **Puerta barrial verificada (`Santo Tomás`):** Solo **Santo Tomás** está habilitado en el piloto (`neighborhoods.is_active = true`); `Pilar Centro` y `Presidente Derqui` figuran inactivos. Los códigos de acceso se validan del lado servidor/hash (`private_neighborhood_codes` + `pgcrypto` `verify_neighborhood_access` RPC en SQL y verificación SHA-256 con sal en `mockRepository`), sin códigos en texto plano en la UI. Un trigger (`guard_profiles_neighborhood_fields` en `000007`) bloquea escrituras directas del cliente sobre `profiles.neighborhood_verified_at` y `profiles.neighborhood_id`.
- **Privacidad geográfica y puntos de encuentro públicos:** Solo se expone el barrio o zona general y puntos de encuentro públicos por actividad. Tanto `mockRepository.upsertActivity` como el `CHECK` constraint `activities_public_meeting_area_check` + `publish_activity_with_arrangement` (`000007`) rechazan direcciones particulares (`mi casa`, `domicilio particular`, `depto`, `departamento`).
- **Elegibilidad `+18`:** Fecha de nacimiento resguardada en `private_profiles` (RLS estricto al titular). La función `submit_eligibility` (`000007`) y `mockRepository.submitEligibility` aplican el corte `+18` del piloto y mantienen en estado `restricted` a menores de 18 años.
- **Foto de perfil (`avatars`):** Selección, previsualización, reemplazo y eliminación con `expo-image-picker` y validación de tipo/tamaño (`5 MB`, JPG/PNG/WebP/HEIC/HEIF), respaldado por el bucket `avatars` y políticas RLS por propietario en `storage.objects` (`000006`).
- **Internacionalización, temas y configuración unificada:** Soporte bilingüe completo (`es-AR` / `en`) y selector de tema (`light` / `dark` / `system`) + paleta de 4 acentos persistidos en `AsyncStorage` (`ThemeProvider` + `i18n`), centralizados junto con el perfil, foto, habilidades y disponibilidad en la pantalla unificada **`/settings`**.
- **Moderación:** Reportes (`reports`), bloqueos mutuos (`blocks`, aplicados en RLS y en descubrimiento) y cola de disputas (`disputes`, índice único parcial `disputes_one_open_per_session_uidx` para evitar disputas abiertas duplicadas por sesión).
