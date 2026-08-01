# Deployment & Production Hosting

This document covers deployment models, environment configurations, and production hosting for both the cloud Hono API server (`apps/api`) and the desktop application installers.

---

## ☁️ Hono REST API Server Deployment

The REST API server is a Node.js Hono application that connects to MongoDB. It can be deployed to any Node-compatible host (e.g. AWS EC2, Heroku, Render) or run in a Docker container.

### 1. Production Environment Variables (`.env`)
Create a `.env` file in the API server root directory (`apps/api/.env`):

```env
PORT=3000
DATABASE_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/leadforge?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
BETTER_AUTH_SECRET=your_better_auth_secret_here
BETTER_AUTH_URL=http://localhost:3000
```

### 2. PM2 Process Manager Deployment
For hosting on virtual servers (e.g. Ubuntu EC2), use PM2 to manage processes:

```bash
# Build the TypeScript files
pnpm -F api build

# Start the server with PM2
pm2 start dist/index.js --name "leadforge-api" --update-env
```

### 3. Docker Deployment
A standard Dockerfile is used to package the API server:

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

LeadForge OS desktop builds are packaged as standalone installers that require no server infrastructure.

### Distribution Platforms
1. **Windows Setup Exe**: Built via `pnpm package`. The installer setup `.exe` installs the app under AppData, registers desktop shortcuts, and registers uninstall registry hooks.
2. **macOS & Linux Builds (Roadmap)**: Planned packaging using `.dmg` and `.AppImage` files.

### Deploying Workspace Sync
- When launching LeadForge OS for the first time, users can connect their workspace to a custom hosted API endpoint by updating the **Sync Server URL** under Settings.
- By default, the client points to `http://localhost:3000` (for local development).
