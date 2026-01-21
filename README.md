# VectorGov SDK for TypeScript/JavaScript

SDK oficial para a API VectorGov - Busca semântica em legislação brasileira.

[![npm version](https://badge.fury.io/js/vectorgov.svg)](https://badge.fury.io/js/vectorgov)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## SDKs Disponíveis

| Linguagem | Pacote | Repositório |
|-----------|--------|-------------|
| **TypeScript/JavaScript** | [`npm install vectorgov`](https://www.npmjs.com/package/vectorgov) | Este repositório |
| **Python** | [`pip install vectorgov`](https://pypi.org/project/vectorgov/) | [vectorgov-sdk](https://github.com/euteajudo/vectorgov-sdk) |

> **Usando Python?** Veja a documentação completa do SDK Python em [github.com/euteajudo/vectorgov-sdk](https://github.com/euteajudo/vectorgov-sdk)

## Instalação

## Requisitos

- Node.js **>= 18.0.0**

```bash
npm install vectorgov
# ou
yarn add vectorgov
# ou
pnpm add vectorgov
```

## Gerar API key e testar no Playground (recomendado)

### 1) Criar uma API key (site)

1. Faça login no VectorGov.
2. Abra **API Keys**: `https://vectorgov.io/api-keys`
3. Clique em **Nova API Key**, informe um nome e confirme.
4. **Copie e salve a chave completa** (ela é exibida uma única vez).

### 2) Testar no Playground (interface web)

1. Abra o **Playground**: `https://vectorgov.io/playground`
2. Faça uma pergunta e ajuste o modo/topK/cache.
3. Copie um exemplo em **Código equivalente** e substitua `vg_sua_chave` pela sua API key.

### 3) Ver limite e acompanhar uso

- Em `https://vectorgov.io/api-keys` você consegue ver:
  - **Rate limit** (req/min)
  - **Total de requests**
  - **Status** (ativa/revogada)
- Para detalhes do minuto atual, abra a configuração da chave e veja **Uso no minuto atual** e **Restantes**.
- Para logs detalhados de chamadas, use **Uso da API** (quando disponível no seu menu).

## Uso Rápido

```typescript
import { VectorGov } from 'vectorgov';

const vg = new VectorGov({ apiKey: 'vg_sua_chave' });

// Busca simples
const results = await vg.search('O que é ETP?');

for (const hit of results.hits) {
  console.log(`${hit.source}: ${hit.text.slice(0, 100)}...`);
}
```

## Integração com LLMs

### LangChain.js (TypeScript) - RAG com fontes

Use o VectorGov como **retriever** no LangChain.js. O fluxo recomendado e:

- `vg.search()` para buscar trechos com fontes
- o LLM responde **apenas** com base nesses trechos

Instale:

```bash
npm install vectorgov langchain @langchain/openai
```

Exemplo completo:

```typescript
import { VectorGov } from "vectorgov";
import { Document } from "langchain/document";
import { BaseRetriever } from "@langchain/core/retrievers";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";

class VectorGovRetriever extends BaseRetriever {
  lc_namespace = ["vectorgov", "retriever"] as const;

  constructor(private vg: VectorGov) {
    super();
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const results = await this.vg.search(query, { topK: 5, mode: "balanced" });

    return results.hits.map(
      (h) =>
        new Document({
          pageContent: h.text,
          metadata: {
            source: h.source,
            score: h.score,
          },
        })
    );
  }
}

async function main() {
  const vg = new VectorGov({ apiKey: process.env.VECTORGOV_API_KEY! });
  const retriever = new VectorGovRetriever(vg);

  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
    temperature: 0,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      [
        "Voce e um assistente juridico. Responda APENAS com base nos trechos fornecidos.",
        "Se nao estiver nos trechos, diga que nao encontrou.",
        "Sempre cite as fontes em uma lista ao final.",
      ].join("\\n"),
    ],
    ["human", "Pergunta: {question}\\n\\nTrechos:\\n{context}"],
  ]);

  const chain = await createStuffDocumentsChain({ llm, prompt });

  const question = "Quando o ETP pode ser dispensado?";
  const docs = await retriever.getRelevantDocuments(question);

  const answer = await chain.invoke({
    question,
    context: docs
      .map((d) => `${d.pageContent}\\n[Fonte: ${String(d.metadata.source)}]`)
      .join("\\n\\n---\\n\\n"),
  });

  console.log(String(answer));
  console.log("\\nFontes:");
  for (const d of docs) console.log("-", d.metadata.source);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### OpenAI

```typescript
import { VectorGov } from 'vectorgov';
import OpenAI from 'openai';

const vg = new VectorGov({ apiKey: 'vg_sua_chave' });
const openai = new OpenAI();

// Busca contexto relevante
const results = await vg.search('Quais os critérios de julgamento?');

// Gera resposta com GPT-4
const response = await openai.chat.completions.create({
  // Use o modelo que preferir
  model: 'SEU_MODELO',
  messages: results.toMessages('Quais os critérios de julgamento?')
});

console.log(response.choices[0].message.content);
```

### Anthropic Claude

```typescript
import { VectorGov } from 'vectorgov';
import Anthropic from '@anthropic-ai/sdk';

const vg = new VectorGov({ apiKey: 'vg_sua_chave' });
const anthropic = new Anthropic();

const results = await vg.search('Quando o ETP pode ser dispensado?');
const messages = results.toMessages('Quando o ETP pode ser dispensado?');

const response = await anthropic.messages.create({
  // Use o modelo que preferir
  model: 'SEU_MODELO',
  max_tokens: 1024,
  system: messages[0].content,
  messages: [{ role: 'user', content: messages[1].content }]
});

console.log(response.content[0].text);
```

### Google Gemini

```typescript
import { VectorGov } from 'vectorgov';
import { GoogleGenerativeAI } from '@google/generative-ai';

const vg = new VectorGov({ apiKey: 'vg_sua_chave' });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const results = await vg.search('O que é pesquisa de preços?');
const messages = results.toMessages('O que é pesquisa de preços?');

const model = genAI.getGenerativeModel({
  // Use o modelo que preferir
  model: 'SEU_MODELO',
  systemInstruction: messages[0].content
});

const response = await model.generateContent(messages[1].content);
console.log(response.response.text());
```

## Modos de Busca

```typescript
// Fast (~2s) - Busca direta, sem reranking
const fast = await vg.search('O que é ETP?', { mode: 'fast' });

// Balanced (~5s) - Com reranking (padrão)
const balanced = await vg.search('O que é ETP?', { mode: 'balanced' });

// Precise (~15s) - HyDE + reranking para máxima precisão
const precise = await vg.search('O que é ETP?', { mode: 'precise' });
```

### Controle Fino com useHyde e useReranker

Você pode fazer override das configurações padrão do modo:

```typescript
// Modo fast MAS com reranker (personalizado)
const custom1 = await vg.search('O que é ETP?', {
  mode: 'fast',
  useReranker: true,  // Override: ativa reranker mesmo no modo fast
});

// Modo precise SEM hyde (economiza latência)
const custom2 = await vg.search('O que é ETP?', {
  mode: 'precise',
  useHyde: false,     // Override: desativa HyDE
  useReranker: true,  // Mantém reranker
});
```

| Modo | useHyde (padrão) | useReranker (padrão) | Latência |
|------|------------------|----------------------|----------|
| `fast` | false | false | ~2s |
| `balanced` | false | true | ~5s |
| `precise` | true | true | ~15s |

> **Importante:** O modo de busca **não afeta** a quantidade de tokens enviados ao seu LLM. Todos os modos retornam o mesmo número de resultados (controlado por `topK`). A diferença está na **qualidade** dos resultados:
> - **HyDE** (modo `precise`): Gera documentos hipotéticos para melhorar a busca - processamento extra no backend VectorGov
> - **Reranker** (modos `balanced` e `precise`): Reordena resultados por relevância - processamento extra no backend VectorGov
>
> Ou seja: você recebe resultados **mais relevantes**, não **mais resultados**.

## Estimativa de Tokens

Planeje o uso de contexto com estimativa de tokens antes de enviar para seu LLM:

```typescript
const results = await vg.search('O que é ETP?', { topK: 5 });

// Estima tokens do contexto
const stats = await vg.estimateTokens(results);

console.log(`Tokens de contexto: ${stats.contextTokens}`);
console.log(`Tokens de sistema: ${stats.systemTokens}`);
console.log(`Total: ${stats.totalTokens}`);
console.log(`Caracteres: ${stats.charCount}`);
console.log(`Encoding: ${stats.encoding}`);

// Verificar se cabe no limite do modelo
if (stats.totalTokens > 4000) {
  // Reduzir contexto
  const smaller = await vg.search('O que é ETP?', { topK: 3 });
  const smallerStats = await vg.estimateTokens(smaller);
  console.log(`Novo total: ${smallerStats.totalTokens}`);
}

// Com system prompt customizado
const customStats = await vg.estimateTokens(results, {
  systemPrompt: 'Você é um especialista jurídico...'
});
```

## Filtros

```typescript
// Filtrar por tipo de documento
const results = await vg.search('dispensa de licitação', {
  tipoDocumento: 'lei',
  ano: 2021
});
```

## Feedback

```typescript
const results = await vg.search('O que é ETP?');

// Enviar feedback positivo
await vg.feedback(results.metadata.queryId, true);

// Ou negativo
await vg.feedback(results.metadata.queryId, false);
```

## System Prompts

```typescript
// Ver prompts disponíveis
console.log(vg.availablePrompts); // ['default', 'concise', 'detailed', 'chatbot']

// Obter prompt específico
const prompt = vg.getSystemPrompt('detailed');

// Usar com seu LLM
const results = await vg.search('O que é ETP?');
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: prompt + '\n\n' + results.toContext() },
    { role: 'user', content: 'O que é ETP?' }
  ]
});
```

## Function Calling (Agentes)

Use VectorGov como ferramenta em agentes de IA:

### OpenAI Function Calling

```typescript
const tools = [vg.toOpenAITool()];

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Pesquise sobre ETP' }],
  tools,
  tool_choice: 'auto'
});

// Se o modelo chamou a ferramenta
const toolCall = response.choices[0].message.tool_calls?.[0];
if (toolCall) {
  const result = await vg.executeToolCall(toolCall);
  console.log(result);
}
```

### Anthropic Claude Tools

```typescript
const tools = [vg.toAnthropicTool()];

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  tools,
  messages: [{ role: 'user', content: 'Pesquise sobre ETP' }]
});
```

### Google Gemini Tools

```typescript
const tools = [vg.toGoogleTool()];
// Use com a API do Gemini
```

## BYOLLM (Bring Your Own LLM)

Armazene respostas geradas pelo seu próprio LLM para analytics:

```typescript
const results = await vg.search('O que é ETP?');

// Gere resposta com seu LLM
const myResponse = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: results.toMessages('O que é ETP?')
});

// Armazene para analytics
await vg.storeResponse({
  query: 'O que é ETP?',
  answer: myResponse.choices[0].message.content!,
  provider: 'OpenAI',
  model: 'gpt-4',
  chunksUsed: results.hits.length,
  latencyMs: 1500
});
```

## Gestão de Documentos

```typescript
// Listar documentos disponíveis
const docs = await vg.listDocuments();
for (const doc of docs.documents) {
  console.log(`${doc.tipoDocumento} ${doc.numero}/${doc.ano}: ${doc.chunksCount} chunks`);
}

// Detalhes de um documento
const doc = await vg.getDocument('LEI-14133-2021');

// Verificar status de ingestão
const status = await vg.getIngestStatus('task-id-123');

// Iniciar enriquecimento
await vg.startEnrichment('LEI-14133-2021');

// Verificar status de enriquecimento
const enrichStatus = await vg.getEnrichmentStatus('LEI-14133-2021');

// Deletar documento
await vg.deleteDocument('LEI-14133-2021');
```

## Logs de Auditoria

```typescript
// Listar logs de auditoria
const logs = await vg.getAuditLogs({
  limit: 50,
  severity: 'warning',
  eventType: 'pii_detected'
});

for (const log of logs.logs) {
  console.log(`${log.createdAt}: ${log.eventType} - ${log.severity}`);
}

// Estatísticas de auditoria
const stats = await vg.getAuditStats(30); // últimos 30 dias
console.log(`Total eventos: ${stats.totalEvents}`);
console.log(`Bloqueados: ${stats.blockedCount}`);
```

## Alertas e Webhooks (Slack/Discord)

O SDK inclui um sistema de alertas em tempo real para eventos de segurança.
Suporta envio para Slack, Discord e webhooks genéricos.

### Configuração

```typescript
import { AlertManager } from 'vectorgov';

const alerts = new AlertManager({
  webhookUrl: 'https://hooks.slack.com/services/xxx/yyy/zzz',
  webhookEnabled: true,
  webhookType: 'slack', // 'slack' | 'discord' | 'generic'
  minSeverity: 'warning', // 'info' | 'warning' | 'error' | 'critical'
  cooldownSeconds: 60, // Evita spam de alertas repetidos
});
```

### Envio Manual

```typescript
// Alerta genérico
await alerts.send({
  title: 'Evento Importante',
  message: 'Descrição detalhada do evento',
  severity: 'warning',
  source: 'minha_aplicacao',
  details: { userId: '123', action: 'login' },
});
```

### Métodos de Conveniência

```typescript
// PII (dados pessoais) detectado
await alerts.alertPiiDetected(
  ['cpf', 'email'], // tipos detectados
  'masked', // ação tomada
  { userId: '123' } // detalhes extras
);

// Prompt injection detectado
await alerts.alertInjectionDetected(
  'prompt_injection', // tipo
  0.95, // score de risco (0-1)
  'blocked', // ação tomada
);

// Circuit breaker aberto
await alerts.alertCircuitBreakerOpen(
  'milvus', // serviço
  5, // quantidade de falhas
);

// Rate limit excedido
await alerts.alertRateLimitExceeded(
  'vg_abc123...', // API key
  100, // limite
  150, // valor atual
);

// Incidente de segurança (ignora cooldown)
await alerts.alertSecurityIncident(
  'unauthorized_access',
  'Tentativa de acesso não autorizado detectada',
);

// Erro na API
await alerts.alertApiError(
  '/api/search',
  'Connection timeout',
  503, // status code
);
```

### Configuração via Variáveis de Ambiente

```bash
export ALERT_WEBHOOK_URL="https://hooks.slack.com/services/xxx"
export ALERT_WEBHOOK_ENABLED="true"
export ALERT_WEBHOOK_TYPE="slack"
export ALERT_MIN_SEVERITY="warning"
export ALERT_COOLDOWN_SECONDS="60"
```

### Formato das Mensagens

**Slack:**
- Mensagens formatadas com attachments coloridos
- Cores por severidade (verde, laranja, vermelho, roxo)
- Emojis indicando severidade
- Campos estruturados para detalhes

**Discord:**
- Embeds com cores por severidade
- Campos inline para detalhes
- Footer com timestamp

### Handler de Log Customizado

```typescript
// Substitui console.log/warn/error por seu logger
alerts.setLogHandler((message, severity) => {
  myLogger.log(severity, message);
});
```

## Tratamento de Erros

```typescript
import { VectorGov, AuthenticationError, RateLimitError, VectorGovError } from 'vectorgov';

try {
  const results = await vg.search('query');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('API key inválida');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limit. Retry após ${error.retryAfter}s`);
  } else if (error instanceof VectorGovError) {
    console.error(`Erro: ${error.message} (${error.statusCode})`);
  }
}
```

## Configuração

```typescript
const vg = new VectorGov({
  apiKey: 'vg_sua_chave',
  baseUrl: 'https://vectorgov.io/api/v1', // opcional
  timeout: 30000 // opcional, em ms
});
```

## Variáveis de Ambiente

```bash
export VECTORGOV_API_KEY="vg_sua_chave"
```

```typescript
const vg = new VectorGov({
  apiKey: process.env.VECTORGOV_API_KEY!
});
```

## API Reference

### VectorGov

| Método | Descrição |
|--------|-----------|
| `search(query, options?)` | Busca semântica |
| `feedback(queryId, like)` | Envia feedback |
| `estimateTokens(content, options?)` | Estima tokens para LLM |
| `storeResponse(options)` | Armazena resposta do seu LLM |
| `getSystemPrompt(style)` | Obtém system prompt |
| `availablePrompts` | Lista prompts disponíveis |
| `toOpenAITool()` | Ferramenta para OpenAI |
| `toAnthropicTool()` | Ferramenta para Anthropic |
| `toGoogleTool()` | Ferramenta para Google |
| `executeToolCall(toolCall)` | Executa chamada de ferramenta |
| `listDocuments(options?)` | Lista documentos |
| `getDocument(documentId)` | Detalhes de documento |
| `getIngestStatus(taskId)` | Status de ingestão |
| `startEnrichment(documentId)` | Inicia enriquecimento |
| `getEnrichmentStatus(documentId)` | Status de enriquecimento |
| `deleteDocument(documentId)` | Remove documento |
| `getAuditLogs(options?)` | Logs de auditoria |
| `getAuditStats(days?)` | Estatísticas de auditoria |

### SearchOptions

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `topK` | number | 5 | Número de resultados |
| `mode` | 'fast' \| 'balanced' \| 'precise' | 'balanced' | Modo de busca |
| `tipoDocumento` | string | - | Filtro por tipo |
| `ano` | number | - | Filtro por ano |
| `useHyde` | boolean | (do modo) | Habilita HyDE (query expansion via LLM) |
| `useReranker` | boolean | (do modo) | Habilita reranking com cross-encoder |

### SearchResult

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `hits` | SearchHit[] | Resultados |
| `total` | number | Total encontrado |
| `metadata` | SearchMetadata | Metadados |
| `toMessages(query)` | ChatMessage[] | Formato para LLMs |
| `toContext()` | string | Contexto em texto |

## Links

- [Documentação](https://vectorgov.io/documentacao)
- [GitHub](https://github.com/euteajudo/vectorgov-sdk-ts)
- [npm](https://www.npmjs.com/package/vectorgov)

## Licença

MIT
