# Changelog

Todas as mudanças notáveis do SDK TypeScript VectorGov estão documentadas aqui.

## [0.7.0] - 2025-01-20

### Adicionado

- **Parâmetros `useHyde` e `useReranker`** - Controle fino sobre as opções de busca
  - `useHyde`: Habilita HyDE (Hypothetical Document Embeddings) para query expansion via LLM
  - `useReranker`: Habilita reranking com cross-encoder (BGE-Reranker-v2-m3)
  - Permite override das configurações padrão do modo de busca
  - Compatibilidade com SDK Python

```typescript
// Usar modo fast mas COM reranker (personalizado)
const results = await vg.search('O que é ETP?', {
  mode: 'fast',
  useReranker: true,  // Override: ativa reranker mesmo no modo fast
});

// Usar modo balanced SEM hyde (padrão do modo)
const results2 = await vg.search('Critérios de julgamento', {
  mode: 'balanced',
  // useHyde não informado = usa padrão do modo (false para balanced)
});

// Usar modo precise com configuração explícita
const results3 = await vg.search('Dispensa de licitação', {
  mode: 'precise',
  useHyde: true,      // Explícito: gera documentos hipotéticos
  useReranker: true,  // Explícito: reordena com cross-encoder
});
```

**Padrões por modo:**

| Modo | useHyde | useReranker | Latência típica |
|------|---------|-------------|-----------------|
| `fast` | false | false | ~2s |
| `balanced` | false | true | ~5s |
| `precise` | true | true | ~15s |

## [0.6.0] - 2025-01-20

### Adicionado

- **Método `uploadPdf()`** - Upload de PDF para ingestão (apenas admins)
  - Aceita `File` ou `Blob` para compatibilidade com browser e Node.js
  - Validação de tipo de documento (LEI, DECRETO, IN, PORTARIA, RESOLUCAO)
  - Retorna `UploadResponse` com `taskId` para acompanhar a ingestão
  - Timeout aumentado para uploads maiores

```typescript
// No browser
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

const result = await vg.uploadPdf(file, file.name, {
  tipoDocumento: 'LEI',
  numero: '14133',
  ano: 2021,
});

// Acompanhar progresso
const status = await vg.getIngestStatus(result.taskId);

// No Node.js
import { readFileSync } from 'fs';

const buffer = readFileSync('documento.pdf');
const blob = new Blob([buffer], { type: 'application/pdf' });

const result = await vg.uploadPdf(blob, 'documento.pdf', {
  tipoDocumento: 'IN',
  numero: '65',
  ano: 2021,
});
```

- Novos tipos: `UploadPdfOptions`, `TipoDocumento`

## [0.5.1] - 2025-01-20

### Corrigido

- **Header de autenticação**: Alterado de `X-API-Key` para `Authorization: Bearer` para compatibilidade com a API
- **Tratamento de erros**: Corrigido parsing de mensagens de erro da API (suporta formato `{detail: {error, message}}`)

## [0.5.0] - 2025-01-19

### Adicionado

- **Método `estimateTokens()`** - Estima a quantidade de tokens que serão usados com um LLM
  - Aceita `SearchResult` ou string de contexto
  - Retorna `TokenStats` com contagem detalhada (context, system, query, total)
  - Usa encoding `cl100k_base` (compatível com GPT-4 e Claude)
  - Útil para planejar contexto e calcular custos

```typescript
const results = await vg.search('O que é ETP?');
const stats = await vg.estimateTokens(results);

console.log(`Tokens de contexto: ${stats.contextTokens}`);
console.log(`Tokens de sistema: ${stats.systemTokens}`);
console.log(`Total: ${stats.totalTokens}`);

// Com system prompt customizado
const stats2 = await vg.estimateTokens(results, {
  systemPrompt: 'Você é um especialista...'
});
```

- Novos tipos: `TokenStats`, `EstimateTokensOptions`

## [0.4.0] - 2025-01-19

### Removido

- **Métodos `ask()` e `askStream()` removidos** - Os endpoints `/sdk/ask` e `/sdk/ask/stream` agora são restritos apenas para administradores.

### Migração

Os métodos `ask()` e `askStream()` foram removidos. Use `search()` + seu próprio LLM:

```typescript
// ANTES (v0.3.x) - ask()
const response = await vg.ask('O que é ETP?');
console.log(response.answer);

// DEPOIS - Use seu próprio LLM
import OpenAI from 'openai';

const vg = new VectorGov({ apiKey: 'vg_xxx' });
const openai = new OpenAI();

const results = await vg.search('O que é ETP?');
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: results.toMessages('O que é ETP?')
});
console.log(response.choices[0].message.content);
```

Opções de LLM:
- **OpenAI**: `openai` (GPT-4, GPT-4o, etc.)
- **Anthropic**: `@anthropic-ai/sdk` (Claude)
- **Google**: `@google/generative-ai` (Gemini)
- **Ollama**: Para modelos locais

## [0.3.1] - 2025-01-17

### Adicionado

- Métodos de auditoria: `getAuditLogs()`, `getAuditStats()`, `getAuditEventTypes()`
- Tipos de auditoria: `AuditLog`, `AuditLogsResponse`, `AuditStats`

## [0.3.0] - 2025-01-15

### Adicionado

- Function Calling: `toOpenAITool()`, `toAnthropicTool()`, `toGoogleTool()`, `executeToolCall()`
- BYOLLM: `storeResponse()` para armazenar respostas de LLMs externos
- System Prompts: `getSystemPrompt()`, `availablePrompts`
- Gestão de documentos: `listDocuments()`, `getDocument()`, `deleteDocument()`
- Status de ingestão/enriquecimento: `getIngestStatus()`, `startEnrichment()`, `getEnrichmentStatus()`

## [0.2.0] - 2025-01-10

### Adicionado

- Método `feedback()` para like/dislike
- Modos de busca: `fast`, `balanced`, `precise`
- Filtros por `tipoDocumento` e `ano`

## [0.1.0] - 2025-01-05

### Adicionado

- Cliente `VectorGov` com método `search()`
- Helpers `toMessages()` e `toContext()` no SearchResult
- Tratamento de erros: `VectorGovError`, `AuthenticationError`, `RateLimitError`
