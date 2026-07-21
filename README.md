# chaiGPT

AI Chat application powered by Next.js, TypeORM, PostgreSQL, Qdrant Vector DB, Redis, and LangChain.

---

## 🚀 Getting Started

Follow these steps to pull the latest changes and run the application locally:

### 1. Pull the Latest Code

```bash
git pull
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Ensure your `.env` has valid values for: (I have all the defaults setup just run development build)
- `CLERK_SECRET_KEY` & `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Clerk Auth)
- `OPENAI_API_KEY` (LLM completions)
- `DATABASE_URL` / PostgreSQL connection parameters
- `QDRANT_URL` (Vector Search, optional)
- `JINA_API_KEY` (Web Search, optional)

---

## 🛠 Running the Application

### Start Development Server & Infrastructure

To start both background services (Postgres, Qdrant, Redis via Docker) and the Next.js dev server:

```bash
npm run start:dev
```

Or start the infrastructure and dev server separately:

```bash
# 1. Start Docker services (Postgres, Qdrant, Redis)
npm run start:dev:infra

# 2. Start Next.js Development Server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

```bash
# Unit & Integration Tests
npm test

# E2E Tests (Playwright)
npm run test:e2e
```
