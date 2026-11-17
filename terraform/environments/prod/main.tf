locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

data "aws_vpc" "this" {
  filter {
    name   = "tag:Project"
    values = [var.project_name]
  }

  filter {
    name   = "tag:Environment"
    values = [var.environment]
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.this.id]
  }

  tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  lifecycle {
    postcondition {
      condition     = length(self.ids) > 0
      error_message = "Nenhuma subnet privada encontrada na VPC do lab. Rode o Deploy Prod do infra-kubernetes antes."
    }
  }
}

module "auth" {
  source = "../../modules/auth"

  project_name       = var.project_name
  environment        = var.environment
  tags               = local.common_tags
  vpc_id             = data.aws_vpc.this.id
  private_subnet_ids = data.aws_subnets.private.ids
  identity_base_url  = var.identity_base_url
  jwt_secret         = var.jwt_secret
  jwt_expires_in     = var.jwt_expires_in

  new_relic_account_id  = var.new_relic_account_id
  new_relic_license_key = var.new_relic_license_key
}
