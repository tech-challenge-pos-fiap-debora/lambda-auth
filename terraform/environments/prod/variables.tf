variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project_name" {
  type    = string
  default = "tech-challenge"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "jwt_expires_in" {
  type    = string
  default = "1d"
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
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
