import { randomUUID } from 'node:crypto';
import { cpf } from 'cpf-cnpj-validator';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { MongoClient, type Document } from 'mongodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import { log } from './logger';

const CORRELATION_ID_HEADER = 'x-request-id';

type ClientDocument = Document & {
  _id: string;
  email: string;
  document: string;
};

type LoginBody = {
  cpf?: string;
};

let cachedClient: MongoClient | null = null;

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

async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('MONGO_URL is not set');
  }

  const caFile =
    process.env.DOCDB_CA_FILE ?? '/var/task/certs/rds-combined-ca-bundle.pem';

  cachedClient = new MongoClient(uri, {
    tls: true,
    tlsCAFile: caFile,
    serverSelectionTimeoutMS: 5000,
  });

  await cachedClient.connect();
  return cachedClient;
}

function getDatabaseName(): string {
  return process.env.DATABASE_NAME ?? 'techChallenge';
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

    const mongo = await getMongoClient();
    const clientDoc = await mongo
      .db(getDatabaseName())
      .collection<ClientDocument>('client')
      .findOne({ document: digits });

    if (!clientDoc) {
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

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN ??
      '1d') as SignOptions['expiresIn'];
    const access_token = jwt.sign(
      {
        sub: clientDoc._id,
        email: clientDoc.email,
        role: 'cliente',
      },
      secret,
      { expiresIn },
    );

    log('info', 'auth/login autorizado', {
      correlationId,
      clientId: clientDoc._id,
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
