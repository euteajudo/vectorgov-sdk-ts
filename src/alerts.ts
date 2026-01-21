/**
 * VectorGov SDK - Alert Manager
 *
 * Sistema de alertas em tempo real para eventos críticos de segurança.
 * Suporta envio para Slack, Discord e webhooks genéricos.
 *
 * @example
 * ```typescript
 * import { AlertManager } from 'vectorgov';
 *
 * const alerts = new AlertManager({
 *   webhookUrl: 'https://hooks.slack.com/services/xxx',
 *   webhookEnabled: true,
 *   webhookType: 'slack',
 * });
 *
 * // Envia alerta
 * await alerts.send({
 *   title: 'PII Detectado',
 *   message: 'CPF encontrado na query',
 *   severity: 'warning',
 *   source: 'pii_detector',
 * });
 *
 * // Métodos de conveniência
 * await alerts.alertPiiDetected(['cpf', 'email'], 'masked');
 * await alerts.alertInjectionDetected('prompt_injection', 0.95, 'blocked');
 * ```
 */

import {
  AlertConfig,
  Alert,
  AlertSeverity,
  AlertChannel,
  SendAlertOptions,
  AlertResult,
  SlackPayload,
  DiscordPayload,
} from './types';

/** Cores para severidades (Slack) */
const SLACK_COLORS: Record<AlertSeverity, string> = {
  info: '#36a64f', // Verde
  warning: '#ff9800', // Laranja
  error: '#f44336', // Vermelho
  critical: '#9c27b0', // Roxo
};

/** Cores para severidades (Discord - decimal) */
const DISCORD_COLORS: Record<AlertSeverity, number> = {
  info: 0x36a64f,
  warning: 0xff9800,
  error: 0xf44336,
  critical: 0x9c27b0,
};

/** Emojis para severidades (Slack) */
const SLACK_EMOJIS: Record<AlertSeverity, string> = {
  info: ':information_source:',
  warning: ':warning:',
  error: ':x:',
  critical: ':rotating_light:',
};

/** Ordem de severidade para comparação */
const SEVERITY_ORDER: AlertSeverity[] = ['info', 'warning', 'error', 'critical'];

/**
 * Alert Manager - Gerenciador de alertas em tempo real
 *
 * Envia alertas por múltiplos canais quando eventos críticos são detectados.
 */
export class AlertManager {
  private config: Required<AlertConfig>;
  private cooldownCache: Map<string, number> = new Map();
  private logHandler: ((message: string, severity: AlertSeverity) => void) | null = null;

  constructor(config: AlertConfig = {}) {
    this.config = {
      minSeverity: config.minSeverity ?? 'warning',
      webhookUrl: config.webhookUrl ?? '',
      webhookEnabled: config.webhookEnabled ?? false,
      webhookType: config.webhookType ?? 'slack',
      cooldownSeconds: config.cooldownSeconds ?? 60,
      channels: config.channels ?? ['log'],
    };

    // Adiciona webhook aos canais se habilitado
    if (this.config.webhookEnabled && this.config.webhookUrl && !this.config.channels.includes('webhook')) {
      this.config.channels.push('webhook');
    }
  }

  /**
   * Define um handler customizado para logs
   * Por padrão, usa console.log/warn/error
   */
  setLogHandler(handler: (message: string, severity: AlertSeverity) => void): void {
    this.logHandler = handler;
  }

  /**
   * Verifica se deve enviar alerta baseado na severidade
   */
  private shouldSend(severity: AlertSeverity): boolean {
    return SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(this.config.minSeverity);
  }

  /**
   * Verifica se o tipo de alerta está em cooldown
   */
  private isInCooldown(alertType: string): boolean {
    const lastSent = this.cooldownCache.get(alertType);
    if (!lastSent) return false;
    return (Date.now() - lastSent) < this.config.cooldownSeconds * 1000;
  }

  /**
   * Atualiza timestamp de cooldown
   */
  private updateCooldown(alertType: string): void {
    this.cooldownCache.set(alertType, Date.now());
  }

  /**
   * Gera ID único para alerta
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cria objeto Alert
   */
  private createAlert(options: SendAlertOptions): Alert {
    return {
      alertId: this.generateAlertId(),
      title: options.title,
      message: options.message,
      severity: options.severity ?? 'warning',
      source: options.source ?? 'unknown',
      details: options.details ?? {},
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Formata alerta para Slack
   */
  private toSlackFormat(alert: Alert): SlackPayload {
    const color = SLACK_COLORS[alert.severity];
    const emoji = SLACK_EMOJIS[alert.severity];

    const fields: SlackPayload['attachments'][0]['fields'] = [
      { title: 'Severidade', value: alert.severity.toUpperCase(), short: true },
      { title: 'Fonte', value: alert.source, short: true },
    ];

    for (const [key, value] of Object.entries(alert.details)) {
      fields.push({
        title: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: String(value).substring(0, 100),
        short: true,
      });
    }

    return {
      attachments: [
        {
          color,
          title: `${emoji} ${alert.title}`,
          text: alert.message,
          fields,
          footer: 'VectorGov Security',
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
        },
      ],
    };
  }

  /**
   * Formata alerta para Discord
   */
  private toDiscordFormat(alert: Alert): DiscordPayload {
    const color = DISCORD_COLORS[alert.severity];

    const fields: DiscordPayload['embeds'][0]['fields'] = [
      { name: 'Severidade', value: alert.severity.toUpperCase(), inline: true },
      { name: 'Fonte', value: alert.source, inline: true },
    ];

    for (const [key, value] of Object.entries(alert.details)) {
      fields.push({
        name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: String(value).substring(0, 100),
        inline: true,
      });
    }

    return {
      embeds: [
        {
          title: alert.title,
          description: alert.message,
          color,
          fields,
          footer: { text: 'VectorGov Security' },
          timestamp: alert.timestamp,
        },
      ],
    };
  }

  /**
   * Envia alerta para log local
   */
  private sendToLog(alert: Alert): boolean {
    const logMessage = `[ALERT] ${alert.title} | ${alert.message} | severity=${alert.severity} | source=${alert.source} | details=${JSON.stringify(alert.details)}`;

    if (this.logHandler) {
      this.logHandler(logMessage, alert.severity);
    } else {
      // Log padrão baseado na severidade
      switch (alert.severity) {
        case 'info':
          console.info(logMessage);
          break;
        case 'warning':
          console.warn(logMessage);
          break;
        case 'error':
        case 'critical':
          console.error(logMessage);
          break;
      }
    }

    return true;
  }

  /**
   * Envia alerta para webhook
   */
  private async sendToWebhook(alert: Alert): Promise<boolean> {
    if (!this.config.webhookUrl) {
      return false;
    }

    try {
      let payload: SlackPayload | DiscordPayload | Alert;

      switch (this.config.webhookType) {
        case 'slack':
          payload = this.toSlackFormat(alert);
          break;
        case 'discord':
          payload = this.toDiscordFormat(alert);
          break;
        default:
          payload = alert;
      }

      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error(`Erro ao enviar alerta para webhook: ${error}`);
      return false;
    }
  }

  /**
   * Envia um alerta por todos os canais configurados
   *
   * @param options - Opções do alerta
   * @returns Resultado do envio
   */
  async send(options: SendAlertOptions): Promise<AlertResult> {
    const result: AlertResult = {
      sent: false,
      channels: [],
    };

    // Verifica severidade mínima
    const severity = options.severity ?? 'warning';
    if (!this.shouldSend(severity)) {
      return result;
    }

    // Verifica cooldown
    const alertType = `${options.source ?? 'unknown'}:${options.title}`;
    if (!options.bypassCooldown && this.isInCooldown(alertType)) {
      return result;
    }

    // Cria alerta
    const alert = this.createAlert(options);
    result.alertId = alert.alertId;

    // Envia por todos os canais
    for (const channel of this.config.channels) {
      try {
        let sent = false;

        if (channel === 'log') {
          sent = this.sendToLog(alert);
        } else if (channel === 'webhook') {
          sent = await this.sendToWebhook(alert);
        }

        if (sent) {
          result.channels.push(channel);
          result.sent = true;
        }
      } catch (error) {
        result.error = String(error);
      }
    }

    // Atualiza cooldown
    if (result.sent) {
      this.updateCooldown(alertType);
    }

    return result;
  }

  // ===========================================================================
  // MÉTODOS DE CONVENIÊNCIA
  // ===========================================================================

  /**
   * Alerta de PII (dados pessoais) detectado
   *
   * @param piiTypes - Tipos de PII detectados (ex: ['cpf', 'email'])
   * @param action - Ação tomada (ex: 'masked', 'blocked', 'logged')
   * @param details - Detalhes adicionais
   */
  async alertPiiDetected(
    piiTypes: string[],
    action: string,
    details?: Record<string, unknown>
  ): Promise<AlertResult> {
    return this.send({
      title: 'PII Detectado',
      message: `Dados pessoais (${piiTypes.join(', ')}) detectados. Ação: ${action}`,
      severity: 'warning',
      source: 'pii_detector',
      details: { pii_types: piiTypes, action, ...details },
    });
  }

  /**
   * Alerta de prompt injection detectado
   *
   * @param injectionType - Tipo de injection (ex: 'prompt_injection', 'jailbreak')
   * @param riskScore - Score de risco (0.0 a 1.0)
   * @param action - Ação tomada
   * @param details - Detalhes adicionais
   */
  async alertInjectionDetected(
    injectionType: string,
    riskScore: number,
    action: string,
    details?: Record<string, unknown>
  ): Promise<AlertResult> {
    const severity: AlertSeverity =
      riskScore >= 0.8 ? 'critical' : riskScore >= 0.5 ? 'error' : 'warning';

    return this.send({
      title: 'Prompt Injection Detectado',
      message: `Tentativa de injection tipo '${injectionType}' com score ${riskScore.toFixed(2)}. Ação: ${action}`,
      severity,
      source: 'prompt_injection_detector',
      details: { injection_type: injectionType, risk_score: riskScore, action, ...details },
    });
  }

  /**
   * Alerta de circuit breaker aberto
   *
   * @param serviceName - Nome do serviço afetado
   * @param failureCount - Número de falhas
   * @param details - Detalhes adicionais
   */
  async alertCircuitBreakerOpen(
    serviceName: string,
    failureCount: number,
    details?: Record<string, unknown>
  ): Promise<AlertResult> {
    return this.send({
      title: 'Circuit Breaker Aberto',
      message: `Serviço '${serviceName}' indisponível após ${failureCount} falhas.`,
      severity: 'error',
      source: 'circuit_breaker',
      details: { service_name: serviceName, failure_count: failureCount, ...details },
    });
  }

  /**
   * Alerta de rate limit excedido
   *
   * @param apiKey - API key (será truncada)
   * @param limit - Limite configurado
   * @param current - Valor atual
   * @param details - Detalhes adicionais
   */
  async alertRateLimitExceeded(
    apiKey: string,
    limit: number,
    current: number,
    details?: Record<string, unknown>
  ): Promise<AlertResult> {
    return this.send({
      title: 'Rate Limit Excedido',
      message: `API key ${apiKey.substring(0, 10)}... excedeu limite (${current}/${limit}).`,
      severity: 'warning',
      source: 'rate_limiter',
      details: { api_key_prefix: apiKey.substring(0, 10), limit, current, ...details },
    });
  }

  /**
   * Alerta genérico de incidente de segurança
   *
   * @param incidentType - Tipo do incidente
   * @param description - Descrição do incidente
   * @param details - Detalhes adicionais
   */
  async alertSecurityIncident(
    incidentType: string,
    description: string,
    details?: Record<string, unknown>
  ): Promise<AlertResult> {
    return this.send({
      title: `Incidente de Segurança: ${incidentType}`,
      message: description,
      severity: 'critical',
      source: 'security',
      details: { incident_type: incidentType, ...details },
      bypassCooldown: true, // Incidentes críticos ignoram cooldown
    });
  }

  /**
   * Alerta de erro na API
   *
   * @param endpoint - Endpoint que falhou
   * @param errorMessage - Mensagem de erro
   * @param statusCode - Código HTTP (opcional)
   * @param details - Detalhes adicionais
   */
  async alertApiError(
    endpoint: string,
    errorMessage: string,
    statusCode?: number,
    details?: Record<string, unknown>
  ): Promise<AlertResult> {
    return this.send({
      title: 'Erro na API',
      message: `Endpoint ${endpoint} retornou erro: ${errorMessage}`,
      severity: statusCode && statusCode >= 500 ? 'error' : 'warning',
      source: 'api',
      details: { endpoint, error_message: errorMessage, status_code: statusCode, ...details },
    });
  }
}
