# Backend Ledger

A double-entry ledger backend built with Node.js, Express, and MongoDB. Supports user authentication, multi-account management, and atomic money transfers with idempotency protection.

## Features

- **JWT authentication** with short-lived access tokens (15m) and rotating refresh tokens (7d)
- **Token blacklisting** on logout for immediate revocation
- **Double-entry ledger** — every transaction produces immutable DEBIT and CREDIT ledger entries
- **Idempotent transfers** — safe to retry a request with the same idempotency key without double-processing
- **Atomic transfers** via MongoDB sessions/transactions — a transfer either fully completes or fully rolls back
- **System user support** for minting initial funds into an account
- **Paginated transaction history** per account
- **Email notifications** on registration and successful transfers
- **CORS-enabled** with credentials support for cookie-based auth

## Tech Stack

- Node.js / Express
- MongoDB / Mongoose
- JWT (jsonwebtoken)
- bcryptjs for password hashing
- Nodemailer (Gmail OAuth2) for email
- cookie-parser, cors

## Project Structure

```
src/
├── config/
│   └── db.js                  # MongoDB connection
├── controllers/
│   ├── auth.controller.js     # Register, login, logout, refresh
│   ├── account.controller.js  # Create account, balance, history
│   └── transaction.controller.js # Transfers, initial funds
├── middleware/
│   └── auth.middleware.js     # authMiddleware, authSystemUserMiddleware
├── models/
│   ├── user.model.js
│   ├── account.model.js
│   ├── transaction.model.js
│   ├── ledger.model.js
│   ├── blackList.model.js
│   └── refreshToken.model.js
├── routes/
│   ├── auth.routes.js
│   ├── account.routes.js
│   └── transaction.routes.js
├── services/
│   └── email.service.js
├── utils/
│   ├── catchAsync.js
│   └── token.util.js
└── app.js
index.js
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- A MongoDB instance (local or Atlas)
- A Gmail account with OAuth2 credentials configured for sending email (see [Nodemailer OAuth2 setup](https://nodemailer.com/usage/using-gmail/))

### Installation

```bash
git clone <your-repo-url>
cd backend-ledger
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (must differ from `JWT_SECRET`) |
| `EMAIL_USER` | Gmail address used to send notification emails |
| `CLIENT_ID` | Google OAuth2 client ID |
| `CLIENT_SECRET` | Google OAuth2 client secret |
| `REFRESH_TOKEN` | Google OAuth2 refresh token for the email account |
| `CLIENT_URL` | Frontend origin allowed by CORS (e.g. `http://localhost:5173`) |

### Run

```bash
node index.js
```

The server starts on `http://localhost:3000`.

## API Reference

### Auth — `/api/auth`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/register` | Create a new user | Public |
| POST | `/login` | Log in and receive access + refresh tokens | Public |
| POST | `/refresh` | Rotate refresh token, issue new access token | Refresh cookie |
| POST | `/logout` | Blacklist access token, revoke refresh token | Public |

### Accounts — `/api/accounts`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/` | Create a new account for the logged-in user | Required |
| GET | `/` | List all accounts owned by the logged-in user | Required |
| GET | `/balance/:accountId` | Get an account's current balance | Required (owner only) |
| GET | `/:accountId/transactions` | Paginated transaction history (`?page=&limit=`) | Required (owner only) |

### Transactions — `/api/transaction`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/` | Transfer funds between two accounts | Required |
| POST | `/system/initial-funds` | Mint funds into an account from the system account | System user only |

**Transfer request body:**
```json
{
  "fromAccount": "<accountId>",
  "toAccount": "<accountId>",
  "amount": 1000,
  "idempotencyKey": "<unique-uuid>"
}
```

`idempotencyKey` should be a client-generated UUID, unique per logical transfer attempt. Retrying the same request with the same key will not create a duplicate transfer.

## How the Ledger Works

Every account's balance is **derived**, not stored directly. It's calculated on demand from the `ledger` collection:

```
balance = sum(CREDIT entries) - sum(DEBIT entries)
```

Ledger entries are immutable once written (enforced at the schema level) — nothing can update or delete a ledger row, only new entries can be added. A transfer atomically creates:

1. A `transaction` document (audit trail of the transfer itself)
2. A `DEBIT` ledger entry on the sender's account
3. A `CREDIT` ledger entry on the receiver's account

All three writes happen inside a single MongoDB session — if any step fails, the entire transaction is rolled back and nothing is left in a partial state.

## Roadmap

- [ ] Transaction reversal endpoint
- [ ] Rate limiting on `/login` and `/register`
- [ ] Automated tests for the transfer flow

## License

ISC
