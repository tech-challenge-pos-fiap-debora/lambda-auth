# lambda-auth

Function serverless de autenticação por CPF para o Tech Challenge — ambiente **prod** na AWS.

## Propósito

Expõe `POST /auth/login` via API Gateway HTTP. Valida CPF, consulta cliente no DocumentDB e retorna JWT compatível com a API NestJS.

## Tecnologias

- Node.js 20 + TypeScript
- AWS Lambda + API Gateway HTTP
- Amazon DocumentDB (MongoDB)
- Terraform >= 1.5

## Pré-requisitos

1. `infra-kubernetes` aplicado (VPC + EKS)
2. `infra-database` aplicado (DocumentDB)
3. Bucket S3 `tech-challenge-terraform-state-607843055499`
4. GitHub Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `MONGO_URL`, `JWT_SECRET`

## Deploy local

```bash
npm ci
npm run build
cd terraform/environments/prod
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
TF_VAR_mongo_url="..." TF_VAR_jwt_secret="..." terraform apply
```

## Ordem de deploy

1. infra-kubernetes
2. infra-database
3. lambda-auth

## Teste

```bash
curl -X POST https://<api_gateway_url>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cpf":"52998224725"}'
```

Resposta: `{ "access_token": "..." }`
