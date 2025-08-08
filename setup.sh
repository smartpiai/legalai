#!/bin/bash

echo "Setting up Legal AI Platform..."

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install ML services dependencies
echo "Installing ML services dependencies..."
cd ml-services
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Set up pre-commit hooks
echo "Setting up pre-commit hooks..."
pip install pre-commit
pre-commit install

echo "Setup complete! Run 'docker-compose up' to start the application."
