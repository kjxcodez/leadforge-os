export interface FrameworkCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsPlanning: boolean;
  readonly supportsCheckpointing: boolean;
  readonly supportsInterrupts: boolean;
  readonly supportsCancellation: boolean;
  readonly supportsMultiAgent: boolean;
  readonly supportsHumanApproval: boolean;
  readonly supportsStructuredOutputs: boolean;
  readonly supportsRetries: boolean;
  readonly supportsTracing: boolean;
  readonly supportsMCP: boolean;
  readonly supportsBackgroundExecution: boolean;
  readonly supportsPersistence: boolean;
  readonly supportsBranching: boolean;
  readonly supportsReflection: boolean;
  readonly supportsGuardrails: boolean;
}
