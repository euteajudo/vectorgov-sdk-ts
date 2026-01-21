# MAPA DO SDK VECTORGOV TYPESCRIPT

> **Versao**: 0.8.0
> **Data**: Janeiro 2025
> **Objetivo**: Documentacao completa da arquitetura e funcionamento do SDK TypeScript VectorGov

---

## Indice

1. [Visao Geral](#visao-geral)
2. [Arquitetura de Alto Nivel](#arquitetura-de-alto-nivel)
3. [Estrutura de Arquivos](#estrutura-de-arquivos)
4. [Modulos Principais](#modulos-principais)
5. [Fluxo de Dados](#fluxo-de-dados)
6. [Modelos de Dados](#modelos-de-dados)
7. [Tratamento de Erros](#tratamento-de-erros)
8. [Sistema de Alertas](#sistema-de-alertas)
9. [Exemplos de Uso](#exemplos-de-uso)

---

## Visao Geral

O VectorGov SDK TypeScript e uma biblioteca que permite integracao simples e eficiente com a API VectorGov para busca semantica em documentos juridicos brasileiros.

### Caracteristicas Principais

| Caracteristica | Descricao |
|----------------|-----------|
| **Zero Dependencias** | Cliente HTTP usando fetch nativo |
| **TypeScript Nativo** | Tipagem completa para melhor DX |
| **Tree-Shakeable** | Importa apenas o que usa |
| **Compativel** | Node.js, Deno, Bun, Edge |
| **Alertas em Tempo Real** | Sistema de webhooks para Slack/Discord |

### Modelo de Negocio

```
+-----------------------------------------------------------------------------+
|                           MODELO VECTORGOV                                   |
+-----------------------------------------------------------------------------+
|                                                                             |
|   Desenvolvedor                   VectorGov                  LLM Escolhido  |
|   +---------+                    +---------+                +-------------+ |
|   | Pergunta|-------------------►|  Busca  |                |  OpenAI     | |
|   |         |                    | Semantica|                |  Gemini     | |
|   +---------+                    | (Milvus) |                |  Claude     | |
|                                  +----+-----+                |  Llama      | |
|                                       |                      |  Qwen       | |
|                                       | Contexto             +------+------+ |
|                                       | Relevante                   |        |
|                                       |                             |        |
|   +---------+                    +----v-----+                +------v------+ |
|   |Resposta |◄-------------------|to_msgs() |----------------|    LLM      | |
|   | Final   |                    |toContext |                |  Inference  | |
|   +---------+                    +----------+                +-------------+ |
|                                                                             |
|   O SDK fornece CONTEXTO JURIDICO, o desenvolvedor escolhe o LLM.          |
+-----------------------------------------------------------------------------+
```

---

## Arquitetura de Alto Nivel

```
+-----------------------------------------------------------------------------+
|                         ARQUITETURA DO SDK                                   |
+-----------------------------------------------------------------------------+
|                                                                             |
|   +---------------------------------------------------------------------+   |
|   |                         CAMADA DE CLIENTE                           |   |
|   |                                                                     |   |
|   |   +-------------+    +--------------+    +---------------------+    |   |
|   |   |  VectorGov  |    |    fetch()   |    |   VectorGovConfig   |    |   |
|   |   |  (client.ts)|---►|   nativo     |    |                     |    |   |
|   |   |             |    |              |    |                     |    |   |
|   |   | - search()  |    |              |    | - baseUrl           |    |   |
|   |   | - ask()     |    |              |    | - timeout           |    |   |
|   |   | - feedback()|    |              |    | - apiKey            |    |   |
|   |   +-------------+    +--------------+    +---------------------+    |   |
|   +---------------------------------------------------------------------+   |
|                                       |                                     |
|                                       | HTTPS                               |
|                                       v                                     |
|   +---------------------------------------------------------------------+   |
|   |                         API VECTORGOV                               |   |
|   |                   https://vectorgov.io/api/v1                       |   |
|   |                                                                     |   |
|   | /sdk/search  /sdk/ask  /sdk/documents  /sdk/feedback  /sdk/audit   |   |
|   +---------------------------------------------------------------------+   |
|                                                                             |
|   +---------------------------------------------------------------------+   |
|   |                       CAMADA DE ALERTAS                             |   |
|   |                                                                     |   |
|   |   +-------------------+    +-------------------+                    |   |
|   |   |   AlertManager    |    |   Webhooks        |                    |   |
|   |   |   (alerts.ts)     |    |   Slack/Discord   |                    |   |
|   |   |                   |    |                   |                    |   |
|   |   | - send()          |    | - toSlackFormat() |                    |   |
|   |   | - alertPii()      |    | - toDiscordFormat()|                   |   |
|   |   | - alertInjection()|    |                   |                    |   |
|   |   +-------------------+    +-------------------+                    |   |
|   +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Estrutura de Arquivos

```
vectorgov-ts/
├── src/
│   │
│   ├── index.ts                # Exports publicos do SDK
│   │   └── Exporta: VectorGov, AlertManager, tipos, excecoes
│   │
│   ├── client.ts               # Cliente principal (~450 linhas)
│   │   └── class VectorGov:
│   │       ├── search()        # Busca semantica
│   │       ├── ask()           # Pergunta com resposta IA
│   │       ├── askStream()     # Streaming de respostas
│   │       ├── feedback()      # Envio de feedback
│   │       ├── storeResponse() # Salva resposta LLM externo
│   │       ├── toOpenAITool()  # Function calling OpenAI
│   │       ├── toAnthropicTool()
│   │       ├── toGoogleTool()
│   │       ├── listDocuments() # Gestao de documentos
│   │       ├── getDocument()
│   │       ├── uploadDocument()
│   │       ├── deleteDocument()
│   │       ├── getAuditLogs()  # Logs de auditoria
│   │       └── getAuditStats() # Estatisticas de auditoria
│   │
│   ├── alerts.ts               # Sistema de alertas (~480 linhas)
│   │   └── class AlertManager:
│   │       ├── send()          # Envia alerta
│   │       ├── setLogHandler() # Handler customizado
│   │       ├── alertPiiDetected()
│   │       ├── alertInjectionDetected()
│   │       ├── alertCircuitBreakerOpen()
│   │       ├── alertRateLimitExceeded()
│   │       ├── alertSecurityIncident()
│   │       └── alertApiError()
│   │
│   └── types.ts                # Tipos TypeScript (~560 linhas)
│       ├── VectorGovConfig     # Configuracao do cliente
│       ├── SearchOptions       # Opcoes de busca
│       ├── SearchResult        # Resultado de busca
│       ├── SearchHit           # Hit individual
│       ├── AskResponse         # Resposta de pergunta
│       ├── Citation            # Citacao
│       ├── AuditLog            # Log de auditoria
│       ├── AlertConfig         # Configuracao de alertas
│       ├── Alert               # Estrutura de alerta
│       ├── SendAlertOptions    # Opcoes de envio
│       ├── AlertResult         # Resultado de envio
│       ├── SlackPayload        # Payload Slack
│       └── DiscordPayload      # Payload Discord
│
├── dist/                       # Build (gerado)
│   ├── index.js               # CommonJS
│   ├── index.mjs              # ESM
│   └── index.d.ts             # Tipos
│
├── package.json               # Configuracao npm
├── tsconfig.json              # Configuracao TypeScript
├── README.md                  # Documentacao principal
├── CHANGELOG.md               # Historico de versoes
└── MAPA_DO_SDK.md             # Este arquivo
```

---

## Modulos Principais

### 1. Cliente Principal (`client.ts`)

O `VectorGov` e a classe principal do SDK, responsavel por todas as interacoes com a API.

```
+-----------------------------------------------------------------------------+
|                            class VectorGov                                   |
+-----------------------------------------------------------------------------+
|                                                                             |
|  INICIALIZACAO                                                              |
|  +-----------------------------------------------------------------------+  |
|  | constructor(config: VectorGovConfig)                                  |  |
|  |                                                                       |  |
|  | Parametros (obrigatorios):                                            |  |
|  | - apiKey: string       # Chave API (ou env VECTORGOV_API_KEY)        |  |
|  |                                                                       |  |
|  | Parametros (opcionais):                                               |  |
|  | - baseUrl: string      # URL base (default: https://vectorgov.io)    |  |
|  | - timeout: number      # Timeout em ms (default: 30000)              |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  METODOS DE BUSCA                                                           |
|  +-----------------------------------------------------------------------+  |
|  | search(query: string, options?: SearchOptions): Promise<SearchResult> |  |
|  |                                                                       |  |
|  | Opcoes:                                                               |  |
|  | - topK: number         # 1-50 resultados (default: 5)                |  |
|  | - mode: SearchMode     # fast, balanced, precise                     |  |
|  | - tipoDocumento: str   # Filtro por tipo                             |  |
|  | - ano: number          # Filtro por ano                              |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  PERGUNTAS COM RESPOSTA                                                     |
|  +-----------------------------------------------------------------------+  |
|  | ask(query: string, options?: AskOptions): Promise<AskResponse>        |  |
|  | askStream(query: string, options?): AsyncIterable<StreamChunk>        |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  FUNCTION CALLING                                                           |
|  +-----------------------------------------------------------------------+  |
|  | toOpenAITool(): OpenAITool                                            |  |
|  | toAnthropicTool(): AnthropicTool                                      |  |
|  | toGoogleTool(): GoogleTool                                            |  |
|  | getSystemPrompt(style?: SystemPromptStyle): string                    |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  GESTAO DE DOCUMENTOS                                                       |
|  +-----------------------------------------------------------------------+  |
|  | listDocuments(options?: ListDocumentsOptions): DocumentsResponse      |  |
|  | getDocument(documentId: string): DocumentSummary                      |  |
|  | uploadDocument(file, metadata): UploadResponse                        |  |
|  | deleteDocument(documentId: string): DeleteResponse                    |  |
|  | getIngestStatus(taskId: string): IngestStatus                         |  |
|  | getEnrichStatus(taskId: string): EnrichStatus                         |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  FEEDBACK E BYOLLM                                                          |
|  +-----------------------------------------------------------------------+  |
|  | feedback(queryId: string, isLike: boolean): FeedbackResponse          |  |
|  | storeResponse(options: StoreResponseOptions): StoreResponseResult     |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  AUDITORIA                                                                  |
|  +-----------------------------------------------------------------------+  |
|  | getAuditLogs(options?: AuditLogsOptions): AuditLogsResponse           |  |
|  | getAuditStats(days?: number): AuditStats                              |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### 2. Sistema de Alertas (`alerts.ts`)

O `AlertManager` gerencia alertas em tempo real para eventos de seguranca.

```
+-----------------------------------------------------------------------------+
|                            class AlertManager                                |
+-----------------------------------------------------------------------------+
|                                                                             |
|  INICIALIZACAO                                                              |
|  +-----------------------------------------------------------------------+  |
|  | constructor(config?: AlertConfig)                                     |  |
|  |                                                                       |  |
|  | Parametros (opcionais):                                               |  |
|  | - minSeverity: AlertSeverity  # Severidade minima (default: warning) |  |
|  | - webhookUrl: string          # URL do webhook                       |  |
|  | - webhookEnabled: boolean     # Habilitar webhook                    |  |
|  | - webhookType: WebhookType    # slack, discord, generic              |  |
|  | - cooldownSeconds: number     # Intervalo entre alertas (default: 60)|  |
|  | - channels: AlertChannel[]    # Canais ativos (default: ['log'])     |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  METODO PRINCIPAL                                                           |
|  +-----------------------------------------------------------------------+  |
|  | send(options: SendAlertOptions): Promise<AlertResult>                 |  |
|  |                                                                       |  |
|  | Opcoes:                                                               |  |
|  | - title: string          # Titulo do alerta                          |  |
|  | - message: string        # Mensagem detalhada                        |  |
|  | - severity?: AlertSeverity  # info, warning, error, critical         |  |
|  | - source?: string        # Modulo origem                             |  |
|  | - details?: object       # Detalhes adicionais                       |  |
|  | - bypassCooldown?: bool  # Ignorar cooldown                          |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  METODOS DE CONVENIENCIA                                                    |
|  +-----------------------------------------------------------------------+  |
|  | alertPiiDetected(piiTypes: string[], action: string, details?)        |  |
|  | alertInjectionDetected(type: string, score: number, action, details?) |  |
|  | alertCircuitBreakerOpen(service: string, failures: number, details?)  |  |
|  | alertRateLimitExceeded(apiKey: string, limit: number, current, ...)   |  |
|  | alertSecurityIncident(type: string, description: string, details?)    |  |
|  | alertApiError(endpoint: string, error: string, statusCode?, details?) |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  CONFIGURACAO                                                               |
|  +-----------------------------------------------------------------------+  |
|  | setLogHandler(handler: (msg, severity) => void): void                 |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Fluxo de Dados

### Fluxo de Busca

```
+-----------------------------------------------------------------------------+
|                         FLUXO DE BUSCA                                       |
+-----------------------------------------------------------------------------+
|                                                                             |
|   CLIENTE                           SDK                          API        |
|   -------                          -----                        -----       |
|                                                                             |
|   vg.search("O que e ETP?")                                                 |
|           |                                                                 |
|           | 1. Validacao                                                    |
|           +------------------► Valida query                                 |
|           |                    Valida options                               |
|           |                                                                 |
|           | 2. Requisicao HTTP                                              |
|           +------------------► POST /sdk/search --------------------------►|
|           |                                                                 |
|           |                                     ◄------- JSON Response -----|
|           |                                                                 |
|           | 3. Parse da Resposta                                            |
|           +------------------► Cria SearchResult                            |
|           |                    com toMessages() e toContext()               |
|           |                                                                 |
|   ◄-------|  4. Retorno                                                     |
|           |    SearchResult com hits, total, metadata...                    |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Fluxo de Alertas

```
+-----------------------------------------------------------------------------+
|                         FLUXO DE ALERTAS                                     |
+-----------------------------------------------------------------------------+
|                                                                             |
|   APLICACAO                     ALERTMANAGER                  DESTINO       |
|   ----------                    ------------                  -------       |
|                                                                             |
|   alerts.alertPiiDetected(['cpf'], 'masked')                                |
|           |                                                                 |
|           | 1. Verificacao de Severidade                                    |
|           +------------------► severity >= minSeverity?                     |
|           |                                                                 |
|           | 2. Verificacao de Cooldown                                      |
|           +------------------► Mesmo alerta recente?                        |
|           |                                                                 |
|           | 3. Cria Objeto Alert                                            |
|           +------------------► { alertId, title, message, ... }             |
|           |                                                                 |
|           | 4. Envia para Canais                                            |
|           +------------------► sendToLog() -----------------► Console       |
|           |                    sendToWebhook() -------------► Slack/Discord |
|           |                                                                 |
|   ◄-------|  5. Retorno                                                     |
|           |    AlertResult { sent, alertId, channels }                      |
|                                                                             |
+-----------------------------------------------------------------------------+
```

---

## Modelos de Dados

### Tipos de Busca

```typescript
interface SearchResult {
  hits: SearchHit[];           // Lista de resultados
  total: number;               // Total encontrado
  metadata: SearchMetadata;    // Metadados
  toMessages(query: string): ChatMessage[];  // Para LLMs
  toContext(): string;         // Texto formatado
}

interface SearchHit {
  text: string;                // Texto do chunk
  articleNumber?: string;      // Numero do artigo
  documentId?: string;         // ID do documento
  documentType?: string;       // LEI, DECRETO, IN...
  documentNumber?: string;     // Numero do documento
  year?: number;               // Ano
  score: number;               // Relevancia (0-1)
  finalScore?: number;         // Apos reranking
  source?: string;             // Fonte formatada
}
```

### Tipos de Alertas

```typescript
type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
type AlertChannel = 'log' | 'webhook';
type WebhookType = 'slack' | 'discord' | 'generic';

interface AlertConfig {
  minSeverity?: AlertSeverity;     // Default: 'warning'
  webhookUrl?: string;             // URL do webhook
  webhookEnabled?: boolean;        // Default: false
  webhookType?: WebhookType;       // Default: 'slack'
  cooldownSeconds?: number;        // Default: 60
  channels?: AlertChannel[];       // Default: ['log']
}

interface Alert {
  alertId: string;                 // ID unico
  title: string;                   // Titulo
  message: string;                 // Mensagem detalhada
  severity: AlertSeverity;         // Severidade
  source: string;                  // Modulo origem
  details: Record<string, unknown>;// Detalhes extras
  timestamp: string;               // ISO 8601
}

interface AlertResult {
  sent: boolean;                   // Se foi enviado
  alertId?: string;                // ID (se enviado)
  channels: AlertChannel[];        // Canais que receberam
  error?: string;                  // Erro (se houver)
}
```

---

## Tratamento de Erros

### Hierarquia de Excecoes

```
                        VectorGovError (Base)
                               |
           +-------------------+-------------------+
           |                                       |
           v                                       v
    AuthenticationError                      RateLimitError
    (401)                                    (429)
    API key invalida                         Rate limit excedido
```

### Tabela de Excecoes

| Excecao | Codigo HTTP | Causa | Solucao |
|---------|-------------|-------|---------|
| `AuthenticationError` | 401 | API key invalida | Verificar API key |
| `RateLimitError` | 429 | Rate limit excedido | Aguardar retryAfter |
| `VectorGovError` | Outros | Erro generico | Verificar mensagem |

### Exemplo de Tratamento

```typescript
import { VectorGov, AuthenticationError, RateLimitError } from 'vectorgov';

const vg = new VectorGov({ apiKey: 'vg_xxx' });

try {
  const results = await vg.search('O que e ETP?');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('API key invalida');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limit. Aguarde ${error.retryAfter}s`);
  } else if (error instanceof VectorGovError) {
    console.error(`Erro: ${error.message}`);
  }
}
```

---

## Sistema de Alertas

### Cores por Severidade

| Severidade | Slack (Hex) | Discord (Dec) | Emoji Slack |
|------------|-------------|---------------|-------------|
| info | #36a64f | 3581519 | :information_source: |
| warning | #ff9800 | 16750592 | :warning: |
| error | #f44336 | 16007990 | :x: |
| critical | #9c27b0 | 10233520 | :rotating_light: |

### Formato Slack

```json
{
  "attachments": [{
    "color": "#ff9800",
    "title": ":warning: PII Detectado",
    "text": "Dados pessoais (cpf, email) detectados. Acao: masked",
    "fields": [
      { "title": "Severidade", "value": "WARNING", "short": true },
      { "title": "Fonte", "value": "pii_detector", "short": true },
      { "title": "Pii Types", "value": "cpf, email", "short": true }
    ],
    "footer": "VectorGov Security",
    "ts": 1705849200
  }]
}
```

### Formato Discord

```json
{
  "embeds": [{
    "title": "PII Detectado",
    "description": "Dados pessoais (cpf, email) detectados. Acao: masked",
    "color": 16750592,
    "fields": [
      { "name": "Severidade", "value": "WARNING", "inline": true },
      { "name": "Fonte", "value": "pii_detector", "inline": true }
    ],
    "footer": { "text": "VectorGov Security" },
    "timestamp": "2025-01-21T12:00:00.000Z"
  }]
}
```

---

## Exemplos de Uso

### Busca Basica

```typescript
import { VectorGov } from 'vectorgov';

const vg = new VectorGov({ apiKey: 'vg_xxx' });
const results = await vg.search('O que e ETP?');

console.log(`Total: ${results.total}`);
for (const hit of results.hits) {
  console.log(`[${hit.score.toFixed(2)}] ${hit.source}`);
}
```

### Com OpenAI

```typescript
import { VectorGov } from 'vectorgov';
import OpenAI from 'openai';

const vg = new VectorGov({ apiKey: 'vg_xxx' });
const openai = new OpenAI();

const results = await vg.search('Criterios de julgamento');
const messages = results.toMessages('Quais sao os criterios?');

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages
});

console.log(response.choices[0].message.content);
```

### Alertas para Slack

```typescript
import { AlertManager } from 'vectorgov';

const alerts = new AlertManager({
  webhookUrl: 'https://hooks.slack.com/services/xxx',
  webhookEnabled: true,
  webhookType: 'slack',
});

// Alerta de PII
await alerts.alertPiiDetected(['cpf', 'email'], 'masked');

// Alerta de injection
await alerts.alertInjectionDetected('prompt_injection', 0.95, 'blocked');

// Alerta customizado
await alerts.send({
  title: 'Evento Customizado',
  message: 'Descricao do evento',
  severity: 'warning',
  source: 'meu_modulo',
  details: { key: 'value' }
});
```

### Handler de Log Customizado

```typescript
import { AlertManager } from 'vectorgov';

const alerts = new AlertManager();

// Redireciona logs para um sistema externo
alerts.setLogHandler((message, severity) => {
  myLogger.log(severity, message);
});
```

---

## Metricas e Limites

### Limites da API

| Parametro | Minimo | Maximo | Padrao |
|-----------|--------|--------|--------|
| `query` (caracteres) | 3 | 1000 | - |
| `topK` | 1 | 50 | 5 |
| `timeout` | - | - | 30000ms |

### Cooldown de Alertas

| Configuracao | Padrao | Descricao |
|--------------|--------|-----------|
| `cooldownSeconds` | 60 | Intervalo minimo entre alertas do mesmo tipo |
| `bypassCooldown` | false | Ignora cooldown (para incidentes criticos) |

---

## Links Uteis

- **npm**: https://www.npmjs.com/package/vectorgov
- **GitHub**: https://github.com/euteajudo/vectorgov-sdk-ts
- **Documentacao API**: https://vectorgov.io/docs
- **Portal**: https://vectorgov.io

---

*Documentacao atualizada em Janeiro de 2025*
