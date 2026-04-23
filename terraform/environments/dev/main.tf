terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "terraform-state-myproject123"
    key            = "dev/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "infra-as-code-pipeline"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

module "networking" {
  source = "../../modules/networking"

  env                  = "dev"
  vpc_cidr             = "10.0.0.0/16"
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
  azs                  = ["${var.region}a", "${var.region}b"]
}

module "security" {
  source = "../../modules/security"

  env            = "dev"
  vpc_id         = module.networking.vpc_id
  container_port = var.container_port
}

module "compute" {
  source = "../../modules/compute"

  env                     = "dev"
  region                  = var.region
  account_id              = data.aws_caller_identity.current.account_id
  vpc_id                  = module.networking.vpc_id
  public_subnet_ids       = module.networking.public_subnet_ids
  private_subnet_ids      = module.networking.private_subnet_ids
  alb_security_group_id   = module.security.alb_sg_id
  ecs_security_group_id   = module.security.ecs_sg_id
  task_execution_role_arn = module.security.task_execution_role_arn
  task_role_arn           = module.security.task_role_arn
  ecr_repo_url            = module.security.ecr_repo_url
  image_tag               = var.image_tag
  container_port          = var.container_port
  task_cpu                = 256
  task_memory             = 512
  desired_count           = 1
  min_tasks               = 1
  max_tasks               = 2
}

module "monitoring" {
  source = "../../modules/monitoring"

  env                     = "dev"
  alb_arn_suffix          = module.compute.alb_arn_suffix
  target_group_arn_suffix = module.compute.target_group_arn_suffix
  alert_email             = var.alert_email
  log_retention_days      = 7
}
