export interface BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly tools: string[]; // List of registered tool names
  readonly workflowId?: string; // Maps agent to a registered Workflow definition
}
