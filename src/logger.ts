type LogLevel = 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

/**
 * Emite uma linha JSON por evento. A extensão do New Relic encaminha o stdout
 * da função, então o formato estruturado é o que permite filtrar por
 * correlationId e cruzar com os logs da API no mesmo painel.
 */
export function log(
  level: LogLevel,
  message: string,
  context: LogContext = {},
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    service: process.env.NEW_RELIC_APP_NAME ?? 'tech-challenge-lambda-auth',
    ...context,
  });

  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}
