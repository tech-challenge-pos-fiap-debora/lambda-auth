output "lambda_function_name" {
  value = aws_lambda_function.auth.function_name
}

output "lambda_function_arn" {
  value = aws_lambda_function.auth.arn
}

output "api_gateway_url" {
  value = aws_apigatewayv2_stage.prod.invoke_url
}

output "security_group_id" {
  value = aws_security_group.lambda.id
}
