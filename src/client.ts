/**
 * VectorGov SDK Client
 */

import {
  VectorGovConfig,
  SearchOptions,
  SearchResult,
  SearchHit,
  SearchMetadata,
  FeedbackResponse,
  ChatMessage,
  VectorGovError,
  AuthenticationError,
  RateLimitError,
  AuditLog,
  AuditLogsResponse,
  AuditStats,
  AuditLogsOptions,
  // Novos tipos
  StoreResponseOptions,
  StoreResponseResult,
  Citation,
  DocumentSummary,
  DocumentsResponse,
  ListDocumentsOptions,
  UploadResponse,
  UploadPdfOptions,
  TipoDocumento,
  IngestStatus,
  EnrichStatus,
  DeleteResponse,
  OpenAITool,
  AnthropicTool,
  GoogleTool,
  SystemPromptStyle,
  // Tokens
  TokenStats,
  EstimateTokensOptions,
} from './types';

const DEFAULT_BASE_URL = 'https://vectorgov.io/api/v1';
const DEFAULT_TIMEOUT = 30000;

/** System prompts disponíveis */
const SYSTEM_PROMPTS: Record<SystemPromptStyle, string> = {
  default: `Você é um assistente jurídico especializado em legislação brasileira de licitações e contratos administrativos.

Use APENAS as informações fornecidas no contexto para responder. Se a informação não estiver no contexto, diga que não encontrou.

Ao citar artigos, use o formato: [Art. X] ou [Art. X, §Y] ou [Art. X, inciso Y].

Responda de forma clara, objetiva e em português brasileiro.`,

  concise: `Você é um assistente jurídico objetivo. Responda de forma direta e breve usando APENAS o contexto fornecido. Cite artigos no formato [Art. X].`,

  detailed: `Você é um especialista em legislação brasileira de licitações e contratos.

Ao responder:
1. Use APENAS informações do contexto fornecido
2. Estruture a resposta com tópicos quando apropriado
3. Cite todos os artigos relevantes no formato [Art. X, §Y, inciso Z]
4. Explique os termos técnicos quando necessário
5. Indique se há lacunas no contexto para a pergunta

Responda em português brasileiro de forma clara e completa.`,

  chatbot: `Você é o VectorGov, um assistente amigável especializado em legislação de licitações.

Responda de forma conversacional mas precisa, usando o contexto fornecido. Cite artigos quando relevante [Art. X]. Se não souber, diga que não encontrou a informação.`,
};

/** Schema da ferramenta VectorGov para function calling */
const TOOL_SCHEMA = {
  name: 'vectorgov_search',
  description: 'Busca informações em legislação brasileira de licitações e contratos. Use para responder perguntas sobre leis, decretos, instruções normativas e portarias relacionadas a contratações públicas.',
  parameters: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Pergunta ou termo de busca sobre legislação de licitações',
      },
      tipo: {
        type: 'string',
        enum: ['lei', 'decreto', 'in', 'portaria'],
        description: 'Tipo de documento para filtrar (opcional)',
      },
      ano: {
        type: 'integer',
        description: 'Ano do documento para filtrar (opcional)',
      },
      top_k: {
        type: 'integer',
        description: 'Quantidade de resultados (1-20, padrão: 5)',
      },
    } as Record<string, unknown>,
    required: ['query'] as string[],
  },
};

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
          'Authorization': `Bearer ${this.apiKey}`,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as {
          detail?: string | { error?: string; message?: string };
        };

        // Extrai mensagem de erro do formato {detail: string} ou {detail: {error, message}}
        let errorMessage: string;
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.detail && typeof errorData.detail === 'object') {
          errorMessage = errorData.detail.message || errorData.detail.error || 'Unknown error';
        } else {
          errorMessage = `Request failed with status ${response.status}`;
        }

        if (response.status === 401) {
          throw new AuthenticationError(errorMessage);
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(
            errorMessage,
            retryAfter ? parseInt(retryAfter, 10) : undefined
          );
        }

        throw new VectorGovError(errorMessage, response.status);
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

  // ===========================================================================
  // BYOLLM - Bring Your Own LLM
  // ===========================================================================

  /**
   * Armazena resposta de LLM externo no cache do VectorGov
   *
   * Use quando você gera uma resposta com seu próprio LLM e quer:
   * 1. Habilitar o sistema de feedback (like/dislike)
   * 2. Contribuir para melhorias futuras
   *
   * @param options - Dados da resposta
   * @returns Resultado com queryHash para usar em feedback()
   *
   * @example
   * ```typescript
   * // 1. Busca no VectorGov
   * const results = await vg.search('O que é ETP?');
   *
   * // 2. Gera resposta com seu LLM
   * const answer = await openai.chat.completions.create({
   *   model: 'gpt-4o',
   *   messages: results.toMessages('O que é ETP?')
   * });
   *
   * // 3. Salva no VectorGov
   * const stored = await vg.storeResponse({
   *   query: 'O que é ETP?',
   *   answer: answer.choices[0].message.content,
   *   provider: 'OpenAI',
   *   model: 'gpt-4o',
   *   chunksUsed: results.hits.length
   * });
   *
   * // 4. Agora pode receber feedback
   * await vg.feedback(stored.queryHash, true);
   * ```
   */
  async storeResponse(options: StoreResponseOptions): Promise<StoreResponseResult> {
    const response = await this.request<{
      success: boolean;
      query_hash: string;
      message: string;
    }>('/cache/store', {
      method: 'POST',
      body: JSON.stringify({
        query: options.query,
        answer: options.answer,
        provider: options.provider,
        model: options.model,
        chunks_used: options.chunksUsed || 0,
        latency_ms: options.latencyMs || 0,
        retrieval_ms: options.retrievalMs || 0,
        generation_ms: options.generationMs || 0,
      }),
    });

    return {
      success: response.success,
      queryHash: response.query_hash,
      message: response.message,
    };
  }

  // ===========================================================================
  // SYSTEM PROMPTS
  // ===========================================================================

  /**
   * Retorna um system prompt pré-definido
   *
   * @param style - Estilo do prompt (default, concise, detailed, chatbot)
   * @returns String com o system prompt
   *
   * @example
   * ```typescript
   * const prompt = vg.getSystemPrompt('detailed');
   * const messages = results.toMessages('query');
   * messages[0].content = prompt; // Substitui o system prompt
   * ```
   */
  getSystemPrompt(style: SystemPromptStyle = 'default'): string {
    return SYSTEM_PROMPTS[style] || SYSTEM_PROMPTS.default;
  }

  /**
   * Lista os estilos de system prompt disponíveis
   */
  get availablePrompts(): SystemPromptStyle[] {
    return Object.keys(SYSTEM_PROMPTS) as SystemPromptStyle[];
  }

  // ===========================================================================
  // FUNCTION CALLING TOOLS
  // ===========================================================================

  /**
   * Retorna a ferramenta VectorGov no formato OpenAI Function Calling
   *
   * @example
   * ```typescript
   * const response = await openai.chat.completions.create({
   *   model: 'gpt-4o',
   *   messages: [...],
   *   tools: [vg.toOpenAITool()],
   * });
   * ```
   */
  toOpenAITool(): OpenAITool {
    return {
      type: 'function',
      function: {
        name: TOOL_SCHEMA.name,
        description: TOOL_SCHEMA.description,
        parameters: TOOL_SCHEMA.parameters,
      },
    };
  }

  /**
   * Retorna a ferramenta VectorGov no formato Anthropic Claude Tools
   *
   * @example
   * ```typescript
   * const response = await anthropic.messages.create({
   *   model: 'claude-sonnet-4-20250514',
   *   messages: [...],
   *   tools: [vg.toAnthropicTool()],
   * });
   * ```
   */
  toAnthropicTool(): AnthropicTool {
    return {
      name: TOOL_SCHEMA.name,
      description: TOOL_SCHEMA.description,
      input_schema: TOOL_SCHEMA.parameters,
    };
  }

  /**
   * Retorna a ferramenta VectorGov no formato Google Gemini
   *
   * @example
   * ```typescript
   * const model = genai.GenerativeModel({
   *   model: 'gemini-2.0-flash',
   *   tools: [vg.toGoogleTool()],
   * });
   * ```
   */
  toGoogleTool(): GoogleTool {
    return {
      name: TOOL_SCHEMA.name,
      description: TOOL_SCHEMA.description,
      parameters: TOOL_SCHEMA.parameters,
    };
  }

  /**
   * Executa uma chamada de ferramenta e retorna o resultado formatado
   *
   * @param toolCall - Objeto de tool_call do LLM (OpenAI, Anthropic ou dict)
   * @param mode - Modo de busca opcional
   * @returns String formatada com os resultados
   *
   * @example
   * ```typescript
   * // OpenAI
   * if (response.choices[0].message.tool_calls) {
   *   const toolCall = response.choices[0].message.tool_calls[0];
   *   const result = await vg.executeToolCall(toolCall);
   *   // Passa result de volta para o LLM
   * }
   *
   * // Anthropic
   * for (const block of response.content) {
   *   if (block.type === 'tool_use') {
   *     const result = await vg.executeToolCall(block);
   *   }
   * }
   * ```
   */
  async executeToolCall(
    toolCall: unknown,
    mode?: SearchOptions['mode']
  ): Promise<string> {
    const args = this.extractToolArguments(toolCall);

    const result = await this.search(args.query, {
      topK: args.top_k || 5,
      mode: mode || 'balanced',
      tipoDocumento: args.tipo,
      ano: args.ano,
    });

    return this.formatToolResponse(result);
  }

  /**
   * Extrai argumentos de diferentes formatos de tool_call
   */
  private extractToolArguments(toolCall: unknown): {
    query: string;
    tipo?: string;
    ano?: number;
    top_k?: number;
  } {
    let args: unknown;

    // OpenAI format
    if (
      typeof toolCall === 'object' &&
      toolCall !== null &&
      'function' in toolCall
    ) {
      const tc = toolCall as { function: { arguments: string | object } };
      const rawArgs = tc.function.arguments;
      args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    }
    // Anthropic format
    else if (
      typeof toolCall === 'object' &&
      toolCall !== null &&
      'input' in toolCall
    ) {
      args = (toolCall as { input: unknown }).input;
    }
    // Dict format
    else if (typeof toolCall === 'object' && toolCall !== null) {
      if ('args' in toolCall) {
        args = (toolCall as { args: unknown }).args;
      } else {
        args = toolCall;
      }
    } else {
      throw new VectorGovError('Formato de tool_call não reconhecido');
    }

    // Valida que args tem query
    if (
      typeof args !== 'object' ||
      args === null ||
      !('query' in args) ||
      typeof (args as { query: unknown }).query !== 'string'
    ) {
      throw new VectorGovError('tool_call deve conter campo "query" do tipo string');
    }

    return args as { query: string; tipo?: string; ano?: number; top_k?: number };
  }

  /**
   * Formata resultado da busca para retornar ao LLM
   */
  private formatToolResponse(result: SearchResult): string {
    if (result.hits.length === 0) {
      return 'Nenhum resultado encontrado para esta busca.';
    }

    const parts = result.hits.map((hit, i) => {
      const source = hit.source || `Resultado ${i + 1}`;
      return `[${source}]\n${hit.text}`;
    });

    return `Encontrados ${result.total} resultados:\n\n${parts.join('\n\n---\n\n')}`;
  }

  // ===========================================================================
  // GESTÃO DE DOCUMENTOS
  // ===========================================================================

  /**
   * Faz upload de um PDF para ingestão (APENAS ADMINS)
   *
   * Este método requer permissões de administrador. Usuários comuns
   * receberão erro 403 Forbidden.
   *
   * @param file - Arquivo PDF (File ou Blob)
   * @param filename - Nome do arquivo (deve terminar com .pdf)
   * @param options - Opções de upload (tipo, número, ano)
   * @returns Resposta com taskId para acompanhar a ingestão
   *
   * @example
   * ```typescript
   * // No browser (com input file)
   * const fileInput = document.querySelector('input[type="file"]');
   * const file = fileInput.files[0];
   *
   * const result = await vg.uploadPdf(file, file.name, {
   *   tipoDocumento: 'LEI',
   *   numero: '14133',
   *   ano: 2021,
   * });
   *
   * console.log(`Task ID: ${result.taskId}`);
   *
   * // Acompanhar progresso
   * const status = await vg.getIngestStatus(result.taskId);
   * ```
   *
   * @example
   * ```typescript
   * // No Node.js (com fs)
   * import { readFileSync } from 'fs';
   *
   * const buffer = readFileSync('documento.pdf');
   * const blob = new Blob([buffer], { type: 'application/pdf' });
   *
   * const result = await vg.uploadPdf(blob, 'documento.pdf', {
   *   tipoDocumento: 'IN',
   *   numero: '65',
   *   ano: 2021,
   * });
   * ```
   */
  async uploadPdf(
    file: File | Blob,
    filename: string,
    options: UploadPdfOptions
  ): Promise<UploadResponse> {
    // Validações
    if (!file) {
      throw new VectorGovError('Arquivo é obrigatório');
    }

    if (!filename || !filename.trim()) {
      throw new VectorGovError('Nome do arquivo é obrigatório');
    }

    if (!filename.toLowerCase().endsWith('.pdf')) {
      throw new VectorGovError('Apenas arquivos PDF são aceitos');
    }

    const validTypes: TipoDocumento[] = ['LEI', 'DECRETO', 'IN', 'PORTARIA', 'RESOLUCAO'];
    const tipoUpper = options.tipoDocumento.toUpperCase() as TipoDocumento;
    if (!validTypes.includes(tipoUpper)) {
      throw new VectorGovError(
        `Tipo de documento inválido: ${options.tipoDocumento}. Válidos: ${validTypes.join(', ')}`
      );
    }

    if (!options.numero || !options.numero.trim()) {
      throw new VectorGovError('Número do documento é obrigatório');
    }

    if (options.ano < 1900 || options.ano > 2100) {
      throw new VectorGovError('Ano deve estar entre 1900 e 2100');
    }

    // Prepara FormData
    const formData = new FormData();
    formData.append('file', file, filename);
    formData.append('tipo_documento', tipoUpper);
    formData.append('numero', options.numero.trim());
    formData.append('ano', options.ano.toString());

    // Faz requisição multipart
    const url = `${this.baseUrl}/sdk/documents/upload`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2); // Timeout maior para upload

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          // Não definir Content-Type - o browser define automaticamente com boundary
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as {
          detail?: string | { error?: string; message?: string };
        };

        let errorMessage: string;
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData.detail && typeof errorData.detail === 'object') {
          errorMessage = errorData.detail.message || errorData.detail.error || 'Unknown error';
        } else {
          errorMessage = `Upload failed with status ${response.status}`;
        }

        if (response.status === 401) {
          throw new AuthenticationError(errorMessage);
        }

        if (response.status === 403) {
          throw new VectorGovError('Acesso negado. Este método requer permissões de administrador.', 403);
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(
            errorMessage,
            retryAfter ? parseInt(retryAfter, 10) : undefined
          );
        }

        throw new VectorGovError(errorMessage, response.status);
      }

      const data = await response.json() as {
        success: boolean;
        message: string;
        document_id: string;
        task_id: string;
      };

      return {
        success: data.success,
        message: data.message,
        documentId: data.document_id,
        taskId: data.task_id,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof VectorGovError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new VectorGovError('Upload timeout', 408, 'TIMEOUT');
      }

      throw new VectorGovError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Lista os documentos disponíveis
   *
   * @param options - Opções de paginação
   * @returns Lista paginada de documentos
   */
  async listDocuments(options: ListDocumentsOptions = {}): Promise<DocumentsResponse> {
    const { page = 1, limit = 20 } = options;

    const response = await this.request<{
      documents: Array<{
        document_id: string;
        tipo_documento: string;
        numero: string;
        ano: number;
        titulo?: string;
        descricao?: string;
        chunks_count?: number;
        enriched_count?: number;
      }>;
      total: number;
      page: number;
      pages: number;
    }>(`/sdk/documents?page=${page}&limit=${limit}`);

    return {
      documents: response.documents.map(doc => ({
        documentId: doc.document_id,
        tipoDocumento: doc.tipo_documento,
        numero: doc.numero,
        ano: doc.ano,
        titulo: doc.titulo,
        descricao: doc.descricao,
        chunksCount: doc.chunks_count || 0,
        enrichedCount: doc.enriched_count || 0,
      })),
      total: response.total,
      page: response.page,
      pages: response.pages,
    };
  }

  /**
   * Obtém detalhes de um documento específico
   *
   * @param documentId - ID do documento
   * @returns Detalhes do documento
   */
  async getDocument(documentId: string): Promise<DocumentSummary> {
    const response = await this.request<{
      document_id: string;
      tipo_documento: string;
      numero: string;
      ano: number;
      titulo?: string;
      descricao?: string;
      chunks_count?: number;
      enriched_count?: number;
    }>(`/sdk/documents/${documentId}`);

    return {
      documentId: response.document_id,
      tipoDocumento: response.tipo_documento,
      numero: response.numero,
      ano: response.ano,
      titulo: response.titulo,
      descricao: response.descricao,
      chunksCount: response.chunks_count || 0,
      enrichedCount: response.enriched_count || 0,
    };
  }

  /**
   * Obtém o status de uma ingestão
   *
   * @param taskId - ID da task de ingestão
   * @returns Status da ingestão
   */
  async getIngestStatus(taskId: string): Promise<IngestStatus> {
    const response = await this.request<{
      task_id: string;
      status: string;
      progress: number;
      message: string;
      document_id?: string;
      chunks_created?: number;
    }>(`/sdk/ingest/status/${taskId}`);

    return {
      taskId: response.task_id,
      status: response.status,
      progress: response.progress,
      message: response.message,
      documentId: response.document_id,
      chunksCreated: response.chunks_created || 0,
    };
  }

  /**
   * Inicia o enriquecimento de um documento
   *
   * @param documentId - ID do documento
   * @returns ID da task de enriquecimento
   */
  async startEnrichment(documentId: string): Promise<{ taskId: string; message: string }> {
    const response = await this.request<{
      task_id: string;
      message: string;
    }>('/sdk/documents/enrich', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId }),
    });

    return {
      taskId: response.task_id,
      message: response.message,
    };
  }

  /**
   * Obtém o status de um enriquecimento
   *
   * @param taskId - ID da task de enriquecimento
   * @returns Status do enriquecimento
   */
  async getEnrichmentStatus(taskId: string): Promise<EnrichStatus> {
    const response = await this.request<{
      task_id: string;
      status: string;
      progress: number;
      chunks_enriched: number;
      chunks_pending: number;
      chunks_failed: number;
      errors: string[];
    }>(`/sdk/enrich/status/${taskId}`);

    return {
      taskId: response.task_id,
      status: response.status,
      progress: response.progress,
      chunksEnriched: response.chunks_enriched,
      chunksPending: response.chunks_pending,
      chunksFailed: response.chunks_failed,
      errors: response.errors || [],
    };
  }

  /**
   * Deleta um documento
   *
   * @param documentId - ID do documento
   * @returns Resultado da deleção
   */
  async deleteDocument(documentId: string): Promise<DeleteResponse> {
    const response = await this.request<{
      success: boolean;
      message: string;
    }>(`/sdk/documents/${documentId}`, {
      method: 'DELETE',
    });

    return {
      success: response.success,
      message: response.message,
    };
  }

  // ===========================================================================
  // AUDITORIA
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

  // ===========================================================================
  // CONTAGEM DE TOKENS
  // ===========================================================================

  /**
   * Estima a quantidade de tokens que serão usados com um LLM
   *
   * Use para planejar o contexto antes de enviar para seu LLM:
   * - Verificar se cabe no limite do modelo
   * - Calcular custos estimados
   * - Ajustar top_k se necessário
   *
   * @param content - SearchResult ou string de contexto
   * @param options - Opções (systemPrompt customizado, query)
   * @returns Estatísticas de tokens
   *
   * @example
   * ```typescript
   * // Com SearchResult
   * const results = await vg.search('O que é ETP?');
   * const stats = await vg.estimateTokens(results);
   * console.log(`Total de tokens: ${stats.totalTokens}`);
   *
   * if (stats.totalTokens > 4000) {
   *   // Reduzir contexto
   *   const smaller = await vg.search('O que é ETP?', { topK: 3 });
   * }
   *
   * // Com string direta
   * const stats2 = await vg.estimateTokens('Texto de contexto...');
   *
   * // Com system prompt customizado
   * const stats3 = await vg.estimateTokens(results, {
   *   systemPrompt: 'Você é um especialista jurídico...'
   * });
   * ```
   */
  async estimateTokens(
    content: SearchResult | string,
    options: EstimateTokensOptions = {}
  ): Promise<TokenStats> {
    // Extrai contexto e query
    let context: string;
    let query = options.query || '';
    let hitsCount = 0;

    if (typeof content === 'string') {
      context = content;
    } else {
      // É SearchResult - usa toContext()
      context = content.toContext();
      hitsCount = content.hits.length;
    }

    const systemPrompt = options.systemPrompt || SYSTEM_PROMPTS.default;

    const response = await this.request<{
      success: boolean;
      context_tokens: number;
      system_tokens: number;
      query_tokens: number;
      total_tokens: number;
      char_count: number;
      encoding: string;
    }>('/sdk/tokens', {
      method: 'POST',
      body: JSON.stringify({
        context,
        query,
        system_prompt: systemPrompt,
      }),
    });

    return {
      contextTokens: response.context_tokens,
      systemTokens: response.system_tokens,
      queryTokens: response.query_tokens,
      totalTokens: response.total_tokens,
      hitsCount,
      charCount: response.char_count,
      encoding: response.encoding,
    };
  }

  // ===========================================================================
  // MÉTODOS AUXILIARES
  // ===========================================================================

  /**
   * Converte hits para formato de mensagens de chat
   */
  private hitsToMessages(hits: SearchHit[], query: string): ChatMessage[] {
    const context = this.hitsToContext(hits);

    return [
      {
        role: 'system',
        content: SYSTEM_PROMPTS.default,
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
}
