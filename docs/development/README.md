# LeadForge OS - Developer Guides

This guide covers coding standards, software patterns, and step-by-step procedures for extending LeadForge OS.

---

## 🔌 Adding a Worker Plugin

All long-running, CPU-heavy tasks must run inside forked Node.js child processes. The scheduler routes tasks using the worker plugin registry.

To add a new worker plugin:

1. **Create the Plugin File**: Create a new file under `apps/desktop/src/main/workers/plugins/` (e.g. `slack-notifier.ts`).
2. **Implement the Plugin Interface**:
   ```typescript
   import { Job } from '@leadforge/schema';
   import { BasePlugin } from '../base-plugin';

   export class SlackNotifierPlugin extends BasePlugin {
     async run(job: Job): Promise<void> {
       const { channel, message } = JSON.parse(job.payload);

       // Update progress periodically
       this.updateProgress(30);

       // Perform the operation
       await sendSlackMessage(channel, message);

       this.updateProgress(100);
     }

     async cleanup(): Promise<void> {
       // Perform cleanup on cancellation (e.g. close connections)
     }
   }
   ```
3. **Register the Plugin**: Register your plugin in `apps/desktop/src/main/workers/plugin-registry.ts`:
   ```typescript
   import { SlackNotifierPlugin } from './plugins/slack-notifier';

   pluginRegistry.register('notify:slack', new SlackNotifierPlugin());
   ```

---

## 🛠️ Adding an LLM Tool

Tools are executable actions exposed to agents.

To register a tool:

1. **Define the Schema**: Create a schema in `packages/agent-core/src/tools/schemas.ts`:
   ```typescript
   import { z } from 'zod';

   export const SendSlackSchema = z.object({
     channel: z.string().describe('Target slack channel name'),
     message: z.string().describe('Message text to post')
   });
   ```
2. **Implement the Tool Executor**: Create the executor class under `packages/agent-runtime/src/tools/` implementing the `ToolExecutor` interface:
   ```typescript
   import { SendSlackSchema } from '@leadforge/agent-core';

   export class SendSlackTool {
     name = 'send_slack_notification';
     description = 'Send a slack message to a channel';
     schema = SendSlackSchema;

     async execute(params: z.infer<typeof SendSlackSchema>): Promise<string> {
       // Trigger the background scheduler job or perform direct execution
       return `Message sent to ${params.channel}`;
     }
   }
   ```

---

## 🤖 Creating an Agent

Agents orchestrate tools to complete a user task.

1. **Create the Prompt**: Register prompt templates under `packages/ai/src/prompts/templates/`.
2. **Create the Agent Class**: Define the class under `packages/agent-runtime/src/research-agent.ts`:
   ```typescript
   import { BaseAgent } from './base-agent';

   export class SlackAgent extends BaseAgent {
     async run(taskDescription: string): Promise<AgentResponse> {
       // Agent reasoning loop invoking tools
       const toolResult = await this.invokeTool('send_slack_notification', { ... });
       return this.assembleResponse(toolResult);
     }
   }
   ```

---

## 💾 Creating a Repository

We use the Repository pattern to wrap local SQLite database queries.

1. **Create the Repository Class**: Place it under `apps/desktop/src/main/database/repositories/` (e.g. `campaign-repo.ts`):
   ```typescript
   import { Database } from 'better-sqlite3';
   import { Campaign } from '@leadforge/schema';

   export class CampaignRepository {
     constructor(private db: Database) {}

     findById(id: string): Campaign | null {
       const row = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
       return row ? (row as Campaign) : null;
     }

     save(campaign: Campaign): void {
       this.db
         .prepare(
           `
         INSERT INTO campaigns (id, name, status)
         VALUES ($id, $name, $status)
         ON CONFLICT(id) DO UPDATE SET name = $name, status = $status
       `
         )
         .run(campaign);
     }
   }
   ```

---

## 🔄 Adding Database Migrations

Database schema migrations are applied sequentially and idempotently on application boot by `runner.ts`.

To add a new migration:

1. **Locate Migration Definitions**: Open `apps/desktop/src/main/database/runner.ts`.
2. **Add Your SQL Migration**: Append a new SQL string to the `MIGRATIONS` array:
   ```typescript
   const MIGRATIONS = [
     // ... existing migrations (do not edit these as they are already run)
     `
     -- Migration 024: Create Slack Campaigns table
     CREATE TABLE IF NOT EXISTS slack_campaigns (
       id TEXT PRIMARY KEY,
       channel TEXT NOT NULL,
       createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
     );
     `
   ];
   ```
3. **Run Diagnostics**: Verify that tests pass using `pnpm test`. The smoke test automatically runs these migrations on an in-memory database to check for syntax errors.

---

## 📡 Adding IPC Handlers

IPC handlers expose main-process Node capabilities (database queries, network triggers, settings updates) to the React frontend.

1. **Register the Channel Contract**: Add your channel name to `packages/schema/src/ipc/channels.ts`:
   ```typescript
   export const SLACK_CHANNELS = {
     SEND_MESSAGE: 'slack:send-message'
   } as const;
   ```
2. **Implement Main Listener**: Add the handler in `apps/desktop/src/main/ipc/`:
   ```typescript
   import { ipcMain } from 'electron';
   import { SLACK_CHANNELS } from '@leadforge/schema';

   ipcMain.handle(SLACK_CHANNELS.SEND_MESSAGE, async (event, payload) => {
     // Perform operation
     return { success: true };
   });
   ```
3. **Expose in Preload**: Expose the channel in `apps/desktop/src/preload/index.ts`.
4. **Call from UI**: Call the channel in your React components:
   ```typescript
   const response = await window.ipc.invoke('slack:send-message', { ... });
   ```
