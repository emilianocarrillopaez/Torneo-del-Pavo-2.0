# Security Specification: Torneo del Pavo 2026

## 1. Data Invariants
- `participantes`:
  - Each registration document must contain: `nombre`, `fechaNacimiento`, `whatsapp`, `correo`, `categoria`, `estatusPago`, and `fechaRegistro`.
  - Public anonymous or regular users can only create new participant documents where `estatusPago == 'pendiente'`.
  - Honeypot `website` field must be empty or missing.
  - Public cannot list or read other participants to safeguard personal information (phones, emails, birthdates of youth and adult players).
  - Only authenticated admin users (`emilianocarrillopaez@gmail.com` or UIDs in `admins` collection) can read, update (payment toggle, corrections), or delete participant records.
- `configuracion`:
  - Public read-only access to view event details (dates, fees, venue, rules, bank account).
  - Only administrators can edit or update tournament parameters.
- `patrocinadores`:
  - Public read-only access to view active sponsor logos and links.
  - Only administrators can create, update, or remove sponsors.
- `admins`:
  - Only admins can read/write administrator credentials.

## 2. Dirty Dozen Test Vectors Guarded
1. Attacker attempts to read `/participantes` without admin credentials -> REJECTED.
2. Attacker attempts to register a participant with `estatusPago: 'pagado'` to bypass fee -> REJECTED.
3. Attacker attempts to inject malicious script or extra unauthorized fields (`isAdmin: true`, etc.) -> REJECTED.
4. Attacker attempts to update a participant record without being an admin -> REJECTED.
5. Attacker attempts to delete a participant without admin credentials -> REJECTED.
6. Attacker attempts to modify tournament configuration (`configuracion/general`) -> REJECTED.
7. Attacker attempts to overwrite sponsors (`patrocinadores`) -> REJECTED.
8. Bot submits automated spam filling the honeypot `website` field -> REJECTED.
9. Attacker attempts to send invalid phone length (not 10 digits) -> REJECTED.
10. Attacker attempts to register invalid category outside allowlist -> REJECTED.
11. Attacker attempts to inject oversized payload in participant name (> 150 chars) -> REJECTED.
12. Attacker attempts to overwrite `/admins` collection -> REJECTED.
