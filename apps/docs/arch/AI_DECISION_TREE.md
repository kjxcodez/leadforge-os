# AI Operational Decision Tree

This guide defines the decision flow for selecting the correct AI and execution subsystem within LeadForge OS. Following this tree prevents routing simple tasks through the complex agent layer.

---

## The Decision Flow

```text
                                 [ Need LLM? ]
                                   /       \
                                 (No)     (Yes)
                                 /           \
                 [ Use standard service ]  [ Need planning / reasoning? ]
                                             /                       \
                                           (No)                     (Yes)
                                           /                           \
                           [ Need external tools? ]             [ Use Agent SDK ]
                             /                \                   /         \
                           (No)              (Yes)              (No)       (Yes)
                           /                    \               /             \
            [ AI Runtime only ]       [ Submit Worker Job ]  [ AI Agent ]  [ Agent + Tool ]
```

---

## Subsystem Selection Matrix

Use the matrix below to route specific tasks to the correct architectural boundary:

| Task Characteristics | Target Subsystem | Example Use Case | Code reference |
| :--- | :--- | :--- | :--- |
| **Simple Extraction / Summarization**<br>• No tool calls needed<br>• Single-step prompt/response<br>• Static output validation | **AI Runtime (`@leadforge/ai-runtime`)** | Generating a company summary paragraph from raw scraped text. | `AIRuntime.execute()` |
| **Reasoning & Tool Selection**<br>• Needs planning / reflection<br>• Dynamic decisions<br>• Chat history context | **Agent Platform (`@leadforge/agent-framework`)** | Determining whether a company website matches a niche and deciding which contact to scrape. | `AgentExecutor.run()` |
| **Long-Running Web Operations**<br>• Takes >10 seconds<br>• Heavy network / disk I/O<br>• Needs browser automation | **Worker Plugins & Tool Registry** | Scraping Google Maps listings or crawling domains for email addresses. | `SchedulerJobTool` |
| **Automated Queue / Cron Tasks**<br>• Runs on recurring schedules<br>• Bulk offline execution<br>• Concurrency limits | **JobScheduler & Main Shell** | Running a nightly email reply check or dispatching queued drip templates. | `JobScheduler.tick()` |

---

## Architectural Guidelines

1. **Keep the Agent Layer Clean**: Do not instantiate an Agent or a Planner for static prompt rendering. Doing so wastes tokens, increases latency, and makes debugging difficult.
2. **Never Execute Scrapers Inside Agents**: Agents must never run Puppeteer or Cheerio directly. They must submit a job to the `JobScheduler` and wait for the result.
3. **No Direct UI-to-Model Calls**: All user interactions go through IPC handlers, which route tasks through the appropriate service or worker.
