output "alb_dns_name" {
  description = "ALB DNS — access your app at this URL"
  value       = "http://${module.compute.alb_dns_name}"
}

output "ecr_repo_url" {
  description = "ECR repository URL for Docker pushes"
  value       = module.security.ecr_repo_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.compute.cluster_name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = module.compute.service_name
}
