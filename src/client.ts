/**
 * VectorGov SDK Client
 */

import {
  VectorGovConfig,
  SearchOptions,
  SearchResult,
  SearchHit,
  SearchMetadata,
  AskOptions,
  AskResponse,
  FeedbackResponse,
  ChatMessage,
  VectorGovError,
  AuthenticationError,
  RateLimitError,
  AuditLog,
  AuditLogsResponse,
  AuditStats,
  AuditLogsOptions,
} from './types';

const DEFAULT_BASE_URL = 'https://vectorgov.io/api/v1';
const DEFAULT_TIMEOUT = 30000;

/** System prompt padrão para geração de respostas */
const SYSTEM_PROMPT = `Você é um assistente jurídico especializado em legislação brasileira de licitações e contratos administrativos.

Use APENAS as informações fornecidas no contexto para responder. Se a informação não estiver no contexto, diga que não encontrou.

Ao citar artigos, use o formato: [Art. X] ou [Art. X, §Y] ou [Art. X, inciso Y].

Responda de forma clara, objetiva e em português brasileiro.`;

/**
 * Cliente para a API VectorGov
 *
 * @example
 * ```typescript
 * import { VectorGov } from 'vectorgov';
 *
 * const vg = new VectorGov({ apiKey: 'vg_sua_chave' });
 *
 * // Busca
 * const results = await vg.search('O que é ETP?');
 *
 * // Para usar com OpenAI
 * const messages = results.toMessages('O que é ETP?');
 * ```
 */
export class VectorGov {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: VectorGovConfig) {
    if (!config.apiKey) {
      throw new AuthenticationError('API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Faz uma requisição para a API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { detail?: string };

        if (response.status === 401) {
          throw new AuthenticationError(errorData.detail || 'Invalid API key');
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(
            errorData.detail || 'Rate limit exceeded',
            retryAfter ? parseInt(retryAfter, 10) : undefined
          );
        }

        throw new VectorGovError(
          errorData.detail || `Request failed with status ${response.status}`,
          response.status
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof VectorGovError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new VectorGovError('Request timeout', 408, 'TIMEOUT');
      }

      throw new VectorGovError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Busca semântica em documentos legais
   *
   * @param query - Pergunta ou texto para buscar
   * @param options - Opções de busca
   * @returns Resultado da busca com métodos auxiliares
   *
   * @example
   * ```typescript
   * const results = await vg.search('O que é ETP?', {
   *   topK: 5,
   *   mode: 'balanced'
   * });
   *
   * for (const hit of results.hits) {
   *   console.log(`${hit.source}: ${hit.text.slice(0, 100)}...`);
   * }
   * ```
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const {
      topK = 5,
      mode = 'balanced',
      tipoDocumento,
      ano,
    } = options;

    const response = await this.request<{
      hits: Array<{
        text: string;
        article_number?: string;
        document_id?: string;
        document_type?: string;
        document_number?: string;
        year?: number;
        score: number;
        final_score?: number;
      }>;
      total: number;
      latency_ms: number;
      cached: boolean;
      query_id: string;
    }>('/sdk/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        top_k: topK,
        mode,
        tipo_documento: tipoDocumento,
        ano,
      }),
    });

    const hits: SearchHit[] = response.hits.map(hit => ({
      text: hit.text,
      articleNumber: hit.article_number,
      documentId: hit.document_id,
      documentType: hit.document_type,
      documentNumber: hit.document_number,
      year: hit.year,
      score: hit.score,
      finalScore: hit.final_score,
      source: hit.document_type && hit.document_number && hit.year
        ? `${hit.document_type} ${hit.document_number}/${hit.year}, Art. ${hit.article_number || 'N/A'}`
        : undefined,
    }));

    const metadata: SearchMetadata = {
      latencyMs: response.latency_ms,
      cached: response.cached,
      queryId: response.query_id,
    };

    return {
      hits,
      total: response.total,
      metadata,
      toMessages: (q: string) => this.hitsToMessages(hits, q),
      toContext: () => this.hitsToContext(hits),
    };
  }

  /**
   * Faz uma pergunta e recebe uma resposta gerada por IA
   *
   * @param query - Pergunta
   * @param options - Opções
   * @returns Resposta com citações
   */
  async ask(query: string, options: AskOptions = {}): Promise<AskResponse> {
    const {
      topK = 5,
      mode = 'balanced',
      useCache = true,
      tipoDocumento,
      ano,
    } = options;

    const response = await this.request<{
      success: boolean;
      data: {
        answer: string;
        confidence: number;
        citations: Array<{
          text: string;
          short: string;
          document_type?: string;
          document_number?: string;
          year?: number;
          article?: string;
        }>;
      };
      metadata: {
        model: string;
        latency_ms: number;
        retrieval_ms?: number;
        generation_ms?: number;
        chunks_used: number;
        tokens?: number;
        query_hash?: string;
      };
    }>('/sdk/ask', {
      method: 'POST',
      body: JSON.stringify({
        query,
        top_k: topK,
        mode,
        use_cache: useCache,
        tipo_documento: tipoDocumento,
        ano,
      }),
    });

    return {
      answer: response.data.answer,
      citations: response.data.citations.map(c => ({
        text: c.text,
        short: c.short,
        documentType: c.document_type,
        documentNumber: c.document_number,
        year: c.year,
        article: c.article,
      })),
      confidence: response.data.confidence,
      metadata: {
        model: response.metadata.model,
        latencyMs: response.metadata.latency_ms,
        retrievalMs: response.metadata.retrieval_ms,
        generationMs: response.metadata.generation_ms,
        chunksUsed: response.metadata.chunks_used,
        tokens: response.metadata.tokens,
        queryHash: response.metadata.query_hash,
      },
    };
  }

  /**
   * Envia feedback (like/dislike) para uma resposta
   *
   * @param queryId - ID da query (de SearchMetadata ou AskMetadata)
   * @param like - true para like, false para dislike
   */
  async feedback(queryId: string, like: boolean): Promise<FeedbackResponse> {
    const response = await this.request<{
      success: boolean;
      message: string;
      new_likes?: number;
      new_dislikes?: number;
    }>('/cache/feedback', {
      method: 'POST',
      body: JSON.stringify({
        query_hash: queryId,
        is_like: like,
      }),
    });

    return {
      success: response.success,
      message: response.message,
      newLikes: response.new_likes,
      newDislikes: response.new_dislikes,
    };
  }

  /**
   * Converte hits para formato de mensagens de chat
   */
  private hitsToMessages(hits: SearchHit[], query: string): ChatMessage[] {
    const context = this.hitsToContext(hits);

    return [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `Contexto:\n${context}\n\nPergunta: ${query}`,
      },
    ];
  }

  /**
   * Converte hits para texto de contexto
   */
  private hitsToContext(hits: SearchHit[]): string {
    return hits
      .map((hit, i) => {
        const source = hit.source || `Resultado ${i + 1}`;
        return `[${source}]\n${hit.text}`;
      })
      .join('\n\n---\n\n');
  }

  // ===========================================================================
  // MÉTODOS DE AUDITORIA
  // ===========================================================================

  /**
   * Obtém os logs de auditoria da conta
   *
   * @param options - Opções de filtro e paginação
   * @returns Lista paginada de logs de auditoria
   *
   * @example
   * ```typescript
   * // Listar logs recentes
   * const logs = await vg.getAuditLogs({ limit: 10 });
   *
   * // Filtrar por severidade
   * const critical = await vg.getAuditLogs({
   *   severity: 'critical',
   *   limit: 50
   * });
   *
   * // Filtrar por período
   * const lastWeek = await vg.getAuditLogs({
   *   startDate: '2025-01-10T00:00:00Z',
   *   endDate: '2025-01-17T23:59:59Z'
   * });
   * ```
   */
  async getAuditLogs(options: AuditLogsOptions = {}): Promise<AuditLogsResponse> {
    const {
      limit = 50,
      page = 1,
      severity,
      eventType,
      eventCategory,
      startDate,
      endDate,
    } = options;

    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('page', page.toString());
    if (severity) params.append('severity', severity);
    if (eventType) params.append('event_type', eventType);
    if (eventCategory) params.append('event_category', eventCategory);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await this.request<{
      logs: Array<{
        id: string;
        event_type: string;
        event_category: string;
        severity: string;
        query_text?: string;
        detection_types: string[];
        risk_score?: number;
        action_taken?: string;
        endpoint?: string;
        client_ip?: string;
        created_at?: string;
        details: Record<string, unknown>;
      }>;
      total: number;
      page: number;
      pages: number;
      limit: number;
    }>(`/sdk/audit/logs?${params.toString()}`);

    return {
      logs: response.logs.map(log => ({
        id: log.id,
        eventType: log.event_type,
        eventCategory: log.event_category,
        severity: log.severity,
        queryText: log.query_text,
        detectionTypes: log.detection_types || [],
        riskScore: log.risk_score,
        actionTaken: log.action_taken,
        endpoint: log.endpoint,
        clientIp: log.client_ip,
        createdAt: log.created_at,
        details: log.details || {},
      })),
      total: response.total,
      page: response.page,
      pages: response.pages,
      limit: response.limit,
    };
  }

  /**
   * Obtém estatísticas agregadas de auditoria
   *
   * @param days - Número de dias para agregar (padrão: 30)
   * @returns Estatísticas de auditoria do período
   *
   * @example
   * ```typescript
   * // Estatísticas dos últimos 30 dias
   * const stats = await vg.getAuditStats();
   * console.log(`Total de eventos: ${stats.totalEvents}`);
   * console.log(`Bloqueados: ${stats.blockedCount}`);
   *
   * // Estatísticas da última semana
   * const weekly = await vg.getAuditStats(7);
   * ```
   */
  async getAuditStats(days: number = 30): Promise<AuditStats> {
    const response = await this.request<{
      total_events: number;
      events_by_type: Record<string, number>;
      events_by_severity: Record<string, number>;
      events_by_category: Record<string, number>;
      blocked_count: number;
      warning_count: number;
      period_days: number;
    }>(`/sdk/audit/stats?days=${days}`);

    return {
      totalEvents: response.total_events,
      eventsByType: response.events_by_type,
      eventsBySeverity: response.events_by_severity,
      eventsByCategory: response.events_by_category,
      blockedCount: response.blocked_count,
      warningCount: response.warning_count,
      periodDays: response.period_days,
    };
  }

  /**
   * Obtém a lista de tipos de eventos de auditoria disponíveis
   *
   * @returns Lista de tipos de eventos
   *
   * @example
   * ```typescript
   * const types = await vg.getAuditEventTypes();
   * console.log('Tipos disponíveis:', types);
   * // ['pii_detected', 'injection_detected', 'low_relevance_query', ...]
   * ```
   */
  async getAuditEventTypes(): Promise<string[]> {
    const response = await this.request<{
      event_types: string[];
    }>('/sdk/audit/event-types');

    return response.event_types;
  }
}
