/**
 * VectorGov SDK for TypeScript/JavaScript
 *
 * SDK para busca semântica em legislação brasileira.
 *
 * @example
 * ```typescript
 * import { VectorGov, AlertManager } from 'vectorgov';
 *
 * const vg = new VectorGov({ apiKey: 'vg_sua_chave' });
 *
 * // Busca simples
 * const results = await vg.search('O que é ETP?');
 *
 * // Para usar com OpenAI
 * import OpenAI from 'openai';
 *
 * const openai = new OpenAI();
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: results.toMessages('O que é ETP?')
 * });
 *
 * // Alertas para Slack/Discord
 * const alerts = new AlertManager({
 *   webhookUrl: 'https://hooks.slack.com/services/xxx',
 *   webhookEnabled: true,
 *   webhookType: 'slack',
 * });
 *
 * await alerts.alertPiiDetected(['cpf', 'email'], 'masked');
 * ```
 *
 * @packageDocumentation
 */

export { VectorGov } from './client';
export { AlertManager } from './alerts';

export type {
  VectorGovConfig,
  SearchOptions,
  SearchResult,
  SearchHit,
  SearchMetadata,
  SearchMode,
  Citation,
  ChatMessage,
  FeedbackResponse,
  // Tipos de Auditoria
  AuditLog,
  AuditLogsResponse,
  AuditStats,
  AuditLogsOptions,
  // Tipos para BYOLLM (Bring Your Own LLM)
  StoreResponseOptions,
  StoreResponseResult,
  // Tipos para Gestão de Documentos
  DocumentSummary,
  DocumentsResponse,
  ListDocumentsOptions,
  UploadResponse,
  UploadPdfOptions,
  TipoDocumento,
  IngestStatus,
  EnrichStatus,
  DeleteResponse,
  // Tipos para Function Calling
  OpenAITool,
  AnthropicTool,
  GoogleTool,
  SystemPromptStyle,
  // Tipos para Contagem de Tokens
  TokenStats,
  EstimateTokensOptions,
  // Tipos para Alertas e Webhooks
  AlertConfig,
  Alert,
  AlertSeverity,
  AlertChannel,
  WebhookType,
  SendAlertOptions,
  AlertResult,
  SlackPayload,
  DiscordPayload,
} from './types';

export {
  VectorGovError,
  AuthenticationError,
  RateLimitError,
} from './types';
