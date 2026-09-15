variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "tags" {
  type = map(string)
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "jwt_expires_in" {
  type    = string
  default = "1d"
}

variable "new_relic_account_id" {
  description = "Account ID do New Relic. Vazio desabilita a instrumentacao."
  type        = string
  default     = ""
}

variable "new_relic_license_key" {
  description = "Ingest license key usada pela extensao do New Relic."
  type        = string
  sensitive   = true
  default     = ""
}

variable "new_relic_layer_arn" {
  description = "Layer oficial do agente New Relic para Node.js 20."
  type        = string
  default     = "arn:aws:lambda:us-east-1:451483290750:layer:NewRelicNodeJS20X:73"
}

variable "new_relic_app_name" {
  description = "Nome da funcao no New Relic."
  type        = string
  default     = "tech-challenge-lambda-auth"
}
