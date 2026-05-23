# Security Specification: عزيز | Aziz Personal Finance

This document defines the Firestore security specifications, data invariants, and 12 high-risk attack payloads ("The Dirty Dozen") mapped to zero-trust rules for data isolation, schemas, and integrity.

## 1. Data Invariants

- **User Isolation**: A user can only read, write, update, or delete records where `userId == request.auth.uid` (or document ID matches `request.auth.uid` for `/users/{userId}`).
- **Currency Field Lock**: Every monetary transaction (Income, Expense, Future Purchase, savings group) must declare standard currencies: `LYD` or `USD`.
- **Relational Coherence**: Income or Expense transactions cannot reference nonexistent Categories. A Future Purchase cannot be converted into an Expense with mismatched metadata.
- **Timestamp Integrity**: `createdAt` and `updatedAt` timestamps must match `request.time` exactly upon creation/updating. They cannot be set to arbitrary client values.
- **Preemptive ID Poisoning Prevention**: Document ID path variables must be alphanumeric and bound at at most 128 characters to prevent denial-of-wallet string injection attacks.

---

## 2. "The Dirty Dozen" Attack Payloads

The following negative payloads are designed to test the access limits and must be strictly blocked by security rules with `PERMISSION_DENIED`.

### Payload 1: Write Profile with Spoofed UID (Identity Spoofing)
- **Target**: `/users/legit_user_123`
- **Context**: Authenticated as `hacker_user_456`
- **Payload**:
  ```json
  {
    "uid": "legit_user_123",
    "name": "Hacker Spoof",
    "email": "hacker@evil.com",
    "preferredLanguage": "en",
    "preferredCurrency": "LYD",
    "exchangeRateUSD_LYD": 6.15,
    "createdAt": "2026-05-21T23:09:41Z",
    "updatedAt": "2026-05-21T23:09:41Z"
  }
  ```
- **Reason for Deny**: Hacker attempts to write a profile document for a different user ID.

### Payload 2: Self-Assigned Privileges
- **Target**: `/users/hacker_456`
- **Context**: Authenticated as `hacker_user_456`
- **Payload**:
  ```json
  {
    "uid": "hacker_456",
    "name": "Hacker Admin",
    "email": "hacker@evil.com",
    "preferredLanguage": "en",
    "preferredCurrency": "LYD",
    "exchangeRateUSD_LYD": 6.15,
    "isAdmin": true, // GHOST FIELD
    "createdAt": "2026-05-21T23:09:41Z",
    "updatedAt": "2026-05-21T23:09:41Z"
  }
  ```
- **Reason for Deny**: Enforces key-size and exact map schema structure on creation to prevent ghost fields (`isAdmin`).

### Payload 3: Create Transaction for Another User
- **Target**: `/expenses/exp_001`
- **Context**: Authenticated as `hacker_user_456`
- **Payload**:
  ```json
  {
    "id": "exp_001",
    "userId": "victim_user_789", // Theft attempt
    "amount": 9999.00,
    "currency": "LYD",
    "title": "Malicious Transfer",
    "date": "2026-05-21",
    "categoryId": "food_id",
    "createdAt": "2026-05-21T23:09:41Z",
    "updatedAt": "2026-05-21T23:09:41Z"
  }
  ```
- **Reason for Deny**: Incoming `userId` field must match `request.auth.uid`.

### Payload 4: Invalid Currency Injection
- **Target**: `/expenses/exp_002`
- **Context**: Authenticated as `hacker_user_456`
- **Payload**:
  ```json
  {
    "id": "exp_002",
    "userId": "hacker_user_456",
    "amount": 150.00,
    "currency": "EUR", // UNSUPPORTED CURRENCY
    "title": "Gas",
    "date": "2026-05-21",
    "categoryId": "cars_id",
    "createdAt": "2026-05-21T23:09:41Z",
    "updatedAt": "2026-05-21T23:09:41Z"
  }
  ```
- **Reason for Deny**: Reject transactions with currencies not in the defined `enum` (`LYD`, `USD`).

### Payload 5: Inject Gigantic Document ID (Denial of Wallet Attack)
- **Target**: `/expenses/EXP_VERY_LONG_STRING_REPEATED_1000_TIMES_...`
- **Context**: Authenticated as `user_123`
- **Reason for Deny**: The document ID must pass alpha-numeric character checks and be bounded in size (`<= 128` chars).

### Payload 6: Negative Transaction Amount
- **Target**: `/incomes/inc_002`
- **Context**: Authenticated as `user_123`
- **Payload**:
  ```json
  {
    "id": "inc_002",
    "userId": "user_123",
    "amount": -500.00, // MALICIOUS AMOUNT
    "currency": "LYD",
    "title": "Fake Refund",
    "date": "2026-05-21",
    "categoryId": "refund_id",
    "createdAt": "2026-05-21T23:09:41Z",
    "updatedAt": "2026-05-21T23:09:41Z"
  }
  ```
- **Reason for Deny**: Verification schema blocks `amount < 0`.

### Payload 7: Update Immutable CreatedAt Timestamp
- **Target**: `/expenses/exp_003` (having existing state in Firestore)
- **Context**: Authenticated as `user_123` (owner)
- **Payload**:
  ```json
  {
    "amount": 150.00,
    "currency": "LYD",
    "title": "Altered Gas Utility",
    "date": "2026-05-21",
    "categoryId": "cars_id",
    "createdAt": "2010-01-01T00:00:00Z", // Changing immutable timestamp
    "updatedAt": "2026-05-21T23:09:41Z"
  }
  ```
- **Reason for Deny**: Blocks changing the `createdAt` value during update actions.

### Payload 8: Read Unowned Savings Groups (Blanket Read Bypass)
- **Target**: `/savingsGroups/group_owner_is_victim`
- **Context**: Authenticated as `hacker_user_456`
- **Reason for Deny**: Hacker attempts to execute a single `get` read or lists groups belonging to `victim_user_789`. Denied because rules enforce query alignment against the document's relational `userId`.

### Payload 9: Hijack Savings Group Members List (Size Poisoning)
- **Target**: `/savingsGroups/jamiya_01`
- **Context**: Authenticated as `user_123` (group owner but passing malicious unbounded members)
- **Payload**: Adding 1,000 blank member maps to spike storage and crash the view.
- **Reason for Deny**: Enforce bounds on list size: `incoming().members.size() <= 20` to guarantee system stability and prevent wallet exploitation.

### Payload 10: Ghost Fields in Transaction Creation
- **Target**: `/expenses/exp_rich`
- **Context**: Authenticated as `user_123`
- **Payload**:
  ```json
  {
    "id": "exp_rich",
    "userId": "user_123",
    "amount": 40.00,
    "currency": "LYD",
    "title": "Subway Lunch",
    "date": "2026-05-21",
    "categoryId": "food_id",
    "extraData": { "isPaidForByCompany": true }, // SHADOW FIELD
    "createdAt": "2026-05-21T23:09:41Z",
    "updatedAt": "2026-05-21T23:09:41Z"
  }
  ```
- **Reason for Deny**: Map key size checks enforce that no unauthorized client fields can be written to the database schema.

### Payload 11: Modify Unowned Preloaded Categories
- **Target**: `/categories/preloaded_cat_food`
- **Context**: Authenticated as `user_123` trying to update a system base or another user's custom category.
- **Reason for Deny**: Cannot update any category if `userId != request.auth.uid`.

### Payload 12: Bypassing Verified Email Check
- **Context**: Authenticated under non-verified account `email_verified = false`.
- **Reason for Deny**: All mutations are blocked unless `request.auth.token.email_verified == true` to prevent bot-spam profile creations. (If email-verification is required, we ensure security matches).

---

## 3. Conceptual Test Runner
Conceptually, our testing pipeline checks each of these endpoints against the authorized user versus a non-authorized attacker, confirming `true` for valid commands and `PERMISSION_DENIED` for any compromised attempts.
