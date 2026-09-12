import { cpf } from 'cpf-cnpj-validator';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { MongoClient, type Document } from 'mongodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

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
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
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
): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext.http.method !== 'POST') {
    return jsonResponse(405, { message: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body ?? '{}') as LoginBody;
    const digits = normalizeCpf(body.cpf ?? '');

    if (!digits) {
      return jsonResponse(400, { message: 'CPF é obrigatório' });
    }

    if (!cpf.isValid(digits)) {
      return jsonResponse(400, { message: 'CPF inválido' });
    }

    const mongo = await getMongoClient();
    const clientDoc = await mongo
      .db(getDatabaseName())
      .collection<ClientDocument>('client')
      .findOne({ document: digits });

    if (!clientDoc) {
      return jsonResponse(401, { message: 'Cliente não encontrado' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1d') as SignOptions['expiresIn'];
    const access_token = jwt.sign(
      {
        sub: clientDoc._id,
        email: clientDoc.email,
        role: 'cliente',
      },
      secret,
      { expiresIn },
    );

    return jsonResponse(200, { access_token });
  } catch (error) {
    console.error('auth/login failed', error);
    return jsonResponse(500, { message: 'Erro interno' });
  }
}
