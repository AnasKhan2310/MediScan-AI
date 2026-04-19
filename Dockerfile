# Base image
FROM node:20-slim

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Set production environment
ENV NODE_ENV=production

# Expose the port (Cloud Run defaults to 8080)
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
