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

/** Metadados da resposta de pergunta */
export interface AskMetadata {
  /** Modelo usado */
  model: string;
  /** Tempo total em ms */
  latencyMs: number;
  /** Tempo de busca em ms */
  retrievalMs?: number;
  /** Tempo de geração em ms */
  generationMs?: number;
  /** Chunks usados */
  chunksUsed: number;
  /** Tokens usados */
  tokens?: number;
  /** Hash da query (para feedback) */
  queryHash?: string;
}

/** Resposta de uma pergunta */
export interface AskResponse {
  /** Resposta gerada */
  answer: string;
  /** Citações */
  citations: Citation[];
  /** Confiança (0-1) */
  confidence: number;
  /** Metadados */
  metadata: AskMetadata;
}

/** Opções para perguntar */
export interface AskOptions extends SearchOptions {
  /** Usar cache semântico */
  useCache?: boolean;
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
