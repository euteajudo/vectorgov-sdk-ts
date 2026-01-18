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

```bash
npm install vectorgov
# ou
yarn add vectorgov
# ou
pnpm add vectorgov
```

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
  model: 'gpt-4',
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
  model: 'claude-sonnet-4-20250514',
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
  model: 'gemini-2.0-flash',
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

## Filtros

```typescript
// Filtrar por tipo de documento
const results = await vg.search('dispensa de licitação', {
  tipoDocumento: 'lei',
  ano: 2021
});
```

## Perguntas com Resposta

```typescript
// Usa o LLM do VectorGov para gerar resposta
const response = await vg.ask('O que é ETP?');

console.log(response.answer);
console.log(`Confiança: ${(response.confidence * 100).toFixed(1)}%`);

for (const citation of response.citations) {
  console.log(`  - ${citation.short}`);
}
```

## Feedback

```typescript
const results = await vg.search('O que é ETP?');

// Enviar feedback positivo
await vg.feedback(results.metadata.queryId, true);

// Ou negativo
await vg.feedback(results.metadata.queryId, false);
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
| `ask(query, options?)` | Pergunta com resposta IA |
| `feedback(queryId, like)` | Envia feedback |

### SearchOptions

| Campo | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `topK` | number | 5 | Número de resultados |
| `mode` | 'fast' \| 'balanced' \| 'precise' | 'balanced' | Modo de busca |
| `tipoDocumento` | string | - | Filtro por tipo |
| `ano` | number | - | Filtro por ano |

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
