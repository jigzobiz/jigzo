# JIGZO — Full-Stack Monorepo Production Foundation

Turn a photo and a hidden message into a puzzle surprise someone has to solve before they can read your words.

This project is structured as a full-stack monorepo featuring a **Vite + React** frontend and a secure **Express + Node.js + MongoDB** backend. It replaces the prototype static files while maintaining identical visual designs and puzzle solving mechanics.

---

## Project Directory Map

- `/frontend` — React Single Page Application utilizing Vite, React Router, Axios, and public static assets.
- `/backend` — Express API utilizing Mongoose, CORS, Helmet security headers, rate-limiting, and local storage fallback modes.
- `/.env.example` — Project configuration variables template.
- `/package.json` — Monorepo coordinator script file.

---

## Getting Started

### 1. Installation

Install all node dependencies across both the frontend and backend applications from the root directory:

```bash
npm run install:all
```

### 2. Configuration

Copy the root `.env.example` template to `.env` inside `/backend`:

```bash
cp .env.example backend/.env
```

Review your environment variables:
- `MONGODB_URI` — Connection URI for your local or cloud MongoDB server.
- `VITE_ENABLE_LOCAL_TEST` — Set to `true` to enable local storage mockup routing in development (no database required).

### 3. Launch Development Mode

Start both the frontend client and the backend server concurrently:

```bash
npm run dev
```

The application launches on:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

---

## API Documentation

### Puzzle Endpoints
- `POST /api/puzzles` — Registers a new draft puzzle from base64 crop image data. Returns a unique secure `publicId`.
- `GET /api/puzzles/:publicId` — Retrieves safe puzzle parameters for the receiver. Strips sensitive sender and recipient phone numbers.
- `PATCH /api/puzzles/:publicId` — Updates properties of a draft puzzle prior to payment.
- `POST /api/puzzles/:publicId/open` — Logs first open timestamp details for a recipient.
- `POST /api/puzzles/:publicId/complete` — Logs solved duration statistics and fires WhatsApp notifications to senders who purchased "Reveal Alert".

### Order Endpoints
- `POST /api/orders` — Computes pricing rules server-side and creates an unpaid order. Returns payment checkout links.
- `GET /api/orders/:orderId` — Returns payment status of an order.

### Webhook Endpoints
- `POST /api/webhooks/payment` — Verifies webhook callback signatures and triggers delivery of puzzle links to recipient phone numbers.
