output "api_gateway_url" {
  value = module.auth.api_gateway_url
}

output "lambda_function_name" {
  value = module.auth.lambda_function_name
}

output "lambda_security_group_id" {
  value = module.auth.security_group_id
}
