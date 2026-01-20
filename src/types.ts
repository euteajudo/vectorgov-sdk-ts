/**
 * VectorGov SDK Types
 */

/** Modos de busca disponíveis */
export type SearchMode = 'fast' | 'balanced' | 'precise';

/** Configuração do cliente VectorGov */
export interface VectorGovConfig {
  /** API key para autenticação */
  apiKey: string;
  /** URL base da API (padrão: https://vectorgov.io/api/v1) */
  baseUrl?: string;
  /** Timeout em milissegundos (padrão: 30000) */
  timeout?: number;
}

/** Opções de busca */
export interface SearchOptions {
  /** Número de resultados (padrão: 5) */
  topK?: number;
  /** Modo de busca (padrão: 'balanced') */
  mode?: SearchMode;
  /** Tipo de documento para filtrar */
  tipoDocumento?: string;
  /** Ano do documento para filtrar */
  ano?: number;
  /**
   * Habilita HyDE (Hypothetical Document Embeddings) para query expansion.
   * Gera documentos hipotéticos via LLM para melhorar recall em queries ambíguas.
   * Se não informado, usa o padrão do modo: fast=false, balanced=false, precise=true
   */
  useHyde?: boolean;
  /**
   * Habilita reranking com cross-encoder (BGE-Reranker-v2-m3).
   * Reordena resultados por relevância usando modelo de reranking.
   * Se não informado, usa o padrão do modo: fast=false, balanced=true, precise=true
   */
  useReranker?: boolean;
}

/** Hit individual de busca */
export interface SearchHit {
  /** Texto do trecho encontrado */
  text: string;
  /** Número do artigo */
  articleNumber?: string;
  /** ID do documento */
  documentId?: string;
  /** Tipo do documento (LEI, DECRETO, IN, etc) */
  documentType?: string;
  /** Número do documento */
  documentNumber?: string;
  /** Ano do documento */
  year?: number;
  /** Score de relevância */
  score: number;
  /** Score final após reranking */
  finalScore?: number;
  /** Fonte formatada */
  source?: string;
}

/** Metadados da busca */
export interface SearchMetadata {
  /** Tempo total em milissegundos */
  latencyMs: number;
  /** Se a resposta veio do cache */
  cached: boolean;
  /** ID único da query (para feedback) */
  queryId: string;
}

/** Resultado da busca */
export interface SearchResult {
  /** Lista de resultados */
  hits: SearchHit[];
  /** Total de resultados encontrados */
  total: number;
  /** Metadados da busca */
  metadata: SearchMetadata;
  /** Converte para formato de mensagens (OpenAI, Claude, etc) */
  toMessages(query: string): ChatMessage[];
  /** Converte para contexto de texto */
  toContext(): string;
}

/** Mensagem de chat (formato OpenAI) */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Citação em uma resposta */
export interface Citation {
  /** Texto completo da citação */
  text: string;
  /** Versão curta (ex: "Art. 5, I") */
  short: string;
  /** Tipo do documento */
  documentType?: string;
  /** Número do documento */
  documentNumber?: string;
  /** Ano */
  year?: number;
  /** Número do artigo */
  article?: string;
}

/** Resposta de feedback */
export interface FeedbackResponse {
  success: boolean;
  message: string;
  newLikes?: number;
  newDislikes?: number;
}

/** Erros da API */
export class VectorGovError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'VectorGovError';
  }
}

export class AuthenticationError extends VectorGovError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends VectorGovError {
  constructor(
    message = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

// =============================================================================
// TIPOS DE AUDITORIA
// =============================================================================

/** Registro de evento de auditoria */
export interface AuditLog {
  /** ID único do evento */
  id: string;
  /** Tipo do evento (pii_detected, injection_detected, etc.) */
  eventType: string;
  /** Categoria do evento (security, performance, validation) */
  eventCategory: string;
  /** Severidade do evento (info, warning, critical) */
  severity: string;
  /** Texto da query que gerou o evento (se aplicável) */
  queryText?: string;
  /** Tipos de detecção ativados (para eventos de segurança) */
  detectionTypes: string[];
  /** Score de risco (0.0 a 1.0) */
  riskScore?: number;
  /** Ação tomada pelo sistema (logged, blocked, warned) */
  actionTaken?: string;
  /** Endpoint que gerou o evento */
  endpoint?: string;
  /** IP do cliente (anonimizado) */
  clientIp?: string;
  /** Data/hora do evento (ISO 8601) */
  createdAt?: string;
  /** Detalhes adicionais do evento */
  details: Record<string, unknown>;
}

/** Resposta da listagem de logs de auditoria */
export interface AuditLogsResponse {
  /** Lista de logs de auditoria */
  logs: AuditLog[];
  /** Total de logs encontrados */
  total: number;
  /** Página atual */
  page: number;
  /** Total de páginas */
  pages: number;
  /** Limite por página */
  limit: number;
}

/** Estatísticas agregadas de auditoria */
export interface AuditStats {
  /** Total de eventos no período */
  totalEvents: number;
  /** Contagem de eventos por tipo */
  eventsByType: Record<string, number>;
  /** Contagem de eventos por severidade */
  eventsBySeverity: Record<string, number>;
  /** Contagem de eventos por categoria */
  eventsByCategory: Record<string, number>;
  /** Quantidade de eventos bloqueados */
  blockedCount: number;
  /** Quantidade de avisos */
  warningCount: number;
  /** Período em dias das estatísticas */
  periodDays: number;
}

/** Opções para consulta de logs de auditoria */
export interface AuditLogsOptions {
  /** Número máximo de resultados por página (padrão: 50) */
  limit?: number;
  /** Número da página (padrão: 1) */
  page?: number;
  /** Filtrar por severidade (info, warning, critical) */
  severity?: string;
  /** Filtrar por tipo de evento */
  eventType?: string;
  /** Filtrar por categoria de evento */
  eventCategory?: string;
  /** Data inicial (ISO 8601) */
  startDate?: string;
  /** Data final (ISO 8601) */
  endDate?: string;
}

// =============================================================================
// TIPOS PARA BYOLLM (Bring Your Own LLM)
// =============================================================================

/** Opções para armazenar resposta de LLM externo */
export interface StoreResponseOptions {
  /** Pergunta original */
  query: string;
  /** Resposta gerada pelo LLM */
  answer: string;
  /** Provedor do LLM (ex: "OpenAI", "Google", "Anthropic") */
  provider: string;
  /** Modelo usado (ex: "gpt-4o", "gemini-2.0-flash") */
  model: string;
  /** Quantidade de chunks usados como contexto */
  chunksUsed?: number;
  /** Latência total em ms */
  latencyMs?: number;
  /** Tempo de busca em ms */
  retrievalMs?: number;
  /** Tempo de geração em ms */
  generationMs?: number;
}

/** Resultado do armazenamento de resposta */
export interface StoreResponseResult {
  /** Se foi armazenado com sucesso */
  success: boolean;
  /** Hash da query para uso em feedback */
  queryHash: string;
  /** Mensagem de status */
  message: string;
}

// =============================================================================
// TIPOS PARA GESTÃO DE DOCUMENTOS
// =============================================================================

/** Resumo de um documento */
export interface DocumentSummary {
  /** ID único do documento */
  documentId: string;
  /** Tipo do documento (LEI, DECRETO, IN, etc) */
  tipoDocumento: string;
  /** Número do documento */
  numero: string;
  /** Ano do documento */
  ano: number;
  /** Título do documento */
  titulo?: string;
  /** Descrição/ementa */
  descricao?: string;
  /** Quantidade de chunks */
  chunksCount: number;
  /** Quantidade de chunks enriquecidos */
  enrichedCount: number;
}

/** Resposta da listagem de documentos */
export interface DocumentsResponse {
  /** Lista de documentos */
  documents: DocumentSummary[];
  /** Total de documentos */
  total: number;
  /** Página atual */
  page: number;
  /** Total de páginas */
  pages: number;
}

/** Opções para listagem de documentos */
export interface ListDocumentsOptions {
  /** Página (padrão: 1) */
  page?: number;
  /** Limite por página (padrão: 20) */
  limit?: number;
}

/** Tipos de documento válidos para upload */
export type TipoDocumento = 'LEI' | 'DECRETO' | 'IN' | 'PORTARIA' | 'RESOLUCAO';

/** Opções para upload de PDF (apenas admins) */
export interface UploadPdfOptions {
  /** Tipo do documento */
  tipoDocumento: TipoDocumento;
  /** Número do documento */
  numero: string;
  /** Ano do documento (1900-2100) */
  ano: number;
}

/** Resposta de upload */
export interface UploadResponse {
  /** Se foi iniciado com sucesso */
  success: boolean;
  /** Mensagem de status */
  message: string;
  /** ID do documento criado */
  documentId: string;
  /** ID da task de ingestão */
  taskId: string;
}

/** Status de ingestão */
export interface IngestStatus {
  /** ID da task */
  taskId: string;
  /** Status (pending, processing, completed, failed) */
  status: string;
  /** Progresso (0-100) */
  progress: number;
  /** Mensagem de status */
  message: string;
  /** ID do documento */
  documentId?: string;
  /** Chunks criados */
  chunksCreated: number;
}

/** Status de enriquecimento */
export interface EnrichStatus {
  /** ID da task */
  taskId: string;
  /** Status (pending, processing, completed, failed) */
  status: string;
  /** Progresso (0-100) */
  progress: number;
  /** Chunks enriquecidos */
  chunksEnriched: number;
  /** Chunks pendentes */
  chunksPending: number;
  /** Chunks com erro */
  chunksFailed: number;
  /** Lista de erros */
  errors: string[];
}

/** Resposta de deleção */
export interface DeleteResponse {
  /** Se foi deletado com sucesso */
  success: boolean;
  /** Mensagem de status */
  message: string;
}

// =============================================================================
// TIPOS PARA FUNCTION CALLING
// =============================================================================

/** Definição de ferramenta para OpenAI */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

/** Definição de ferramenta para Anthropic */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/** Definição de ferramenta para Google Gemini */
export interface GoogleTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/** Estilos de system prompt disponíveis */
export type SystemPromptStyle = 'default' | 'concise' | 'detailed' | 'chatbot';

// =============================================================================
// TIPOS PARA CONTAGEM DE TOKENS
// =============================================================================

/** Estatísticas de tokens para planejamento de contexto LLM */
export interface TokenStats {
  /** Tokens do contexto (hits formatados) */
  contextTokens: number;
  /** Tokens do system prompt */
  systemTokens: number;
  /** Tokens da query do usuário */
  queryTokens: number;
  /** Total de tokens (context + system + query) */
  totalTokens: number;
  /** Quantidade de hits no contexto */
  hitsCount: number;
  /** Número total de caracteres */
  charCount: number;
  /** Encoding utilizado (cl100k_base compatível com GPT-4/Claude) */
  encoding: string;
}

/** Opções para estimativa de tokens */
export interface EstimateTokensOptions {
  /** System prompt customizado (opcional) */
  systemPrompt?: string;
  /** Query do usuário (obrigatório quando content é string) */
  query?: string;
}
