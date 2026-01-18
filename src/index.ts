/**
 * VectorGov SDK for TypeScript/JavaScript
 *
 * SDK para busca semântica em legislação brasileira.
 *
 * @example
 * ```typescript
 * import { VectorGov } from 'vectorgov';
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
 * ```
 *
 * @packageDocumentation
 */

export { VectorGov } from './client';

export type {
  VectorGovConfig,
  SearchOptions,
  SearchResult,
  SearchHit,
  SearchMetadata,
  SearchMode,
  AskOptions,
  AskResponse,
  AskMetadata,
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
  // Tipos para Streaming
  StreamChunk,
  // Tipos para Gestão de Documentos
  DocumentSummary,
  DocumentsResponse,
  ListDocumentsOptions,
  UploadResponse,
  IngestStatus,
  EnrichStatus,
  DeleteResponse,
  // Tipos para Function Calling
  OpenAITool,
  AnthropicTool,
  GoogleTool,
  SystemPromptStyle,
} from './types';

export {
  VectorGovError,
  AuthenticationError,
  RateLimitError,
} from './types';
