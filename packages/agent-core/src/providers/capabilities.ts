export interface ProviderCapabilities {
  readonly supportsVision: boolean;
  readonly supportsImages: boolean;
  readonly supportsAudio: boolean;
  readonly supportsEmbeddings: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsTools: boolean;
  readonly supportsStructuredOutputs: boolean;
  readonly supportsThinking: boolean;
  readonly supportsReasoning: boolean;
  readonly supportsContextCaching: boolean;
  readonly supportsLargeContext: boolean;
  readonly supportsJSON: boolean;
  readonly supportsFunctionCalling: boolean;
  readonly supportsMCP: boolean;
}
