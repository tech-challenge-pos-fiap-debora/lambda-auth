locals {
  name = "${var.project_name}-${var.environment}-auth"

  new_relic_enabled = var.new_relic_license_key != ""

  # A layer assume o entrypoint: ela inicializa o agente e em seguida invoca o
  # handler original, informado em NEW_RELIC_LAMBDA_HANDLER.
  lambda_handler = local.new_relic_enabled ? "newrelic-lambda-wrapper.handler" : "handler.handler"

  base_environment = {
    MONGO_URL      = var.mongo_url
    JWT_SECRET     = var.jwt_secret
    JWT_EXPIRES_IN = var.jwt_expires_in
    DATABASE_NAME  = var.database_name
    DOCDB_CA_FILE  = "/var/task/certs/rds-combined-ca-bundle.pem"
  }

  new_relic_environment = local.new_relic_enabled ? {
    NEW_RELIC_LAMBDA_HANDLER               = "handler.handler"
    NEW_RELIC_ACCOUNT_ID                   = var.new_relic_account_id
    NEW_RELIC_TRUSTED_ACCOUNT_KEY          = var.new_relic_account_id
    NEW_RELIC_LICENSE_KEY                  = var.new_relic_license_key
    NEW_RELIC_APP_NAME                     = var.new_relic_app_name
    NEW_RELIC_DISTRIBUTED_TRACING_ENABLED  = "true"
    NEW_RELIC_EXTENSION_SEND_FUNCTION_LOGS = "true"
  } : {}
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = abspath("${path.module}/../../../dist")
  output_path = abspath("${path.module}/../../../dist/lambda.zip")
}

# O AWS Academy Learner Lab nega iam:CreateRole. A LabRole pre-existente confia em
# lambda.amazonaws.com e ja carrega as permissoes de CloudWatch Logs e de ENI em VPC
# que os policies AWSLambdaBasicExecutionRole e AWSLambdaVPCAccessExecutionRole davam.
data "aws_iam_role" "lab" {
  name = "LabRole"
}

resource "aws_security_group" "lambda" {
  name        = "${local.name}-sg"
  description = "Lambda auth access to DocumentDB"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${local.name}-sg" })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_lambda_function" "auth" {
  function_name = local.name
  role          = data.aws_iam_role.lab.arn
  handler       = local.lambda_handler
  runtime       = "nodejs20.x"
  timeout       = 15
  memory_size   = 256

  layers = local.new_relic_enabled ? [var.new_relic_layer_arn] : []

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = merge(local.base_environment, local.new_relic_environment)
  }

  depends_on = [aws_cloudwatch_log_group.lambda]

  tags = var.tags
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${local.name}-api"
  protocol_type = "HTTP"
  tags          = var.tags
}

resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "login" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "POST /auth/login"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "prod"
  auto_deploy = true
  tags        = var.tags
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
