# Deployment & Production Hosting

This document covers deployment models, environment configurations, and production hosting for both the cloud Hono API server (`apps/api`) and the desktop application installers.

---

## ☁️ Hono REST API Server Deployment

The REST API server is a Node.js Hono application that connects to MongoDB. It can be deployed to Vercel (Serverless/Edge), virtual servers (PM2), or run inside Docker containers.

### 1. Production Environment Variables

When deploying the API server, ensure the following environment variables are set in your hosting platform (e.g. Vercel dashboard or production `.env`):

- `NODE_ENV`: Set to `production`.
- `PORT`: Server port (defaults to `3000` on Node hosts).
- `MONGODB_URI`: Valid MongoDB connection string (e.g., `mongodb+srv://<user>:<password>@cluster.mongodb.net/leadforge`).
- `BETTER_AUTH_SECRET`: A secure, random 32+ character string for token security.
- `BETTER_AUTH_URL`: The callback URL matching your deployed domain (e.g., `https://api.leadforge.dev/api/v1/auth`).
- `CORS_ORIGIN`: Allowed origins. Defaults to `*` or a specific client domain.
- `LOG_LEVEL`: Set to `info` or `warn` for production logging.

---

## ⚡ Vercel Serverless Deployment (Recommended)

We provide a pre-configured Vercel wrapper inside `apps/api/` to run Hono completely serverless.

### Vercel Files Added

1. **`apps/api/vercel.json`**: Configures routing, redirecting all incoming paths directly to the serverless function.
2. **`apps/api/api/index.ts`**: The edge/serverless entrypoint exporting the Hono handler:
   ```typescript
   import { handle } from 'hono/vercel';
   import { app } from '../src/app.js';
   export default handle(app);
   ```

### Deploy Steps

1. Push your monorepo code to GitHub.
2. Import the repository in your **Vercel Dashboard**.
3. Configure the project:
   - **Root Directory**: `apps/api`
   - **Framework Preset**: `Other` (Vercel automatically detects the workspace pnpm settings).
4. Add the required production environment variables.
5. Click **Deploy**.

_Note: Since Vercel is a serverless environment, the background sequence loop (`SequenceWorker`) does not run on Vercel. All HTTP sync API routes, auth, and CRUD endpoints will work perfectly._

---

## 💻 PM2 Process Manager Deployment

For hosting on virtual servers (e.g., AWS EC2, DigitalOcean), use PM2 to manage Hono as a persistent background daemon:

```bash
# Compile packages & apps
pnpm -F api build

# Start Hono server using PM2
pm2 start dist/index.js --name "leadforge-api" --update-env
```

---

## 🐳 Docker Container Deployment

A standard Dockerfile is provided to package the Hono API server:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install
RUN pnpm -F api build
EXPOSE 3000
CMD ["pnpm", "-F", "api", "start"]
```

---

## 💻 Desktop Application Distribution

### 1. Desktop Configuration Architecture

No configuration change requires rebuilding the LeadForge OS desktop app. It resolves settings using a three-tier precedence model:

- **Tier 1 (Env overrides)**: Reads `API_URL` or `OPENROUTER_API_KEY` from the shell environment.
- **Tier 2 (config.json)**: Reads `apiUrl` or `openRouterKey` from the local JSON config file in `userData`.
- **Tier 3 (Build-time defaults)**: Falls back to `https://api.leadforge.kapiljangid.pro/api/v1` for the production backend API.

To override the default production API URL on a tester's machine without rebuilding the app:

1. Locate the app's `userData` folder.
2. Create/edit `config.json` and set the `apiUrl` property:
   ```json
   {
     "apiUrl": "https://your-custom-vercel-api.app/api/v1"
   }
   ```

### 2. Building Installers

To build the distribution executable for Windows:

```bash
pnpm package
```

This triggers `electron-builder` which compiles assets and produces `LeadForge OS-Setup-<version>.exe` inside `apps/desktop/dist/`.
