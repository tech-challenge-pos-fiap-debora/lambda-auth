import { randomUUID } from 'node:crypto';
import { cpf } from 'cpf-cnpj-validator';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import { getPool } from './db';
import { log } from './logger';

const CORRELATION_ID_HEADER = 'x-request-id';

type ClientRow = {
  id: string;
  email: string;
  document: string;
  status: string;
};

type LoginBody = {
  cpf?: string;
};

function jsonResponse(
  statusCode: number,
  body: unknown,
  correlationId?: string,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      ...(correlationId ? { [CORRELATION_ID_HEADER]: correlationId } : {}),
    },
    body: JSON.stringify(body),
  };
}

function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, '');
}

export async function handler(
  event: APIGatewayProxyEventV2,
  context?: Context,
): Promise<APIGatewayProxyResultV2> {
  // Reaproveita o id enviado pelo cliente quando existir, para que o login e as
  // chamadas seguintes à API compartilhem o mesmo identificador de correlação.
  const correlationId =
    event.headers?.[CORRELATION_ID_HEADER] ??
    context?.awsRequestId ??
    randomUUID();

  const startedAt = Date.now();

  if (event.requestContext.http.method !== 'POST') {
    return jsonResponse(405, { message: 'Method not allowed' }, correlationId);
  }

  try {
    const body = JSON.parse(event.body ?? '{}') as LoginBody;
    const digits = normalizeCpf(body.cpf ?? '');

    if (!digits) {
      log('warn', 'auth/login recusado', { correlationId, reason: 'cpf_ausente' });
      return jsonResponse(400, { message: 'CPF é obrigatório' }, correlationId);
    }

    if (!cpf.isValid(digits)) {
      log('warn', 'auth/login recusado', { correlationId, reason: 'cpf_invalido' });
      return jsonResponse(400, { message: 'CPF inválido' }, correlationId);
    }

    const result = await getPool().query<ClientRow>(
      `SELECT id, email, document, status
       FROM client
       WHERE document = $1
       LIMIT 1`,
      [digits],
    );

    const clientRow = result.rows[0];

    if (!clientRow) {
      log('warn', 'auth/login recusado', {
        correlationId,
        reason: 'cliente_nao_encontrado',
      });
      return jsonResponse(
        401,
        { message: 'Cliente não encontrado' },
        correlationId,
      );
    }

    if (clientRow.status !== 'ACTIVE') {
      log('warn', 'auth/login recusado', {
        correlationId,
        reason: 'cliente_inativo',
      });
      return jsonResponse(403, { message: 'Cliente inativo' }, correlationId);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN ??
      '1d') as SignOptions['expiresIn'];
    const access_token = jwt.sign(
      {
        sub: clientRow.id,
        email: clientRow.email,
        role: 'cliente',
      },
      secret,
      { expiresIn },
    );

    log('info', 'auth/login autorizado', {
      correlationId,
      clientId: clientRow.id,
      durationMs: Date.now() - startedAt,
    });

    return jsonResponse(200, { access_token }, correlationId);
  } catch (error) {
    log('error', 'auth/login falhou', {
      correlationId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return jsonResponse(500, { message: 'Erro interno' }, correlationId);
  }
}
