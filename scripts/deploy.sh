#!/bin/bash

# Deployment script
set -e

echo "Starting deployment..."

# Build images
docker-compose build

# Run database migrations
docker-compose run --rm backend alembic upgrade head

# Deploy to Kubernetes (example)
# kubectl apply -f k8s/

echo "Deployment complete!"
