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

variable "database_name" {
  type    = string
  default = "techChallenge"
}

variable "jwt_expires_in" {
  type    = string
  default = "1d"
}

variable "mongo_url" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}
