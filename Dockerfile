# Use Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Install system and build dependencies
RUN apt-get update && apt-get install -y \
    libgtk2.0-0 \
    libgconf-2-4 \
    libasound2 \
    libxtst6 \
    libxss1 \
    libnss3 \
    xvfb \
    build-essential \
    libxtst-dev \
    libpng++-dev \
    libx11-dev \
    x11-xserver-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and Prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Clean install and rebuild with correct flags, generate Prisma client
RUN npm cache clean --force && \
    npm install --build-from-source && \
    npm rebuild --build-from-source=robotjs && \
    npx prisma generate

# Copy app source (excluding node_modules)
COPY . .

# Create certs directory
RUN mkdir -p /app/certs

# Copy SSL certificates
COPY certs/private.key /app/certs/
COPY certs/certificate.crt /app/certs/

# Environment variables
ENV NODE_ENV=production \
    KURENTO_WS_URI=ws://kurento:8888/kurento \
    NODE_PORT=3096 \
    HTTPS_PORT=3097 \
    DATABASE_URL="postgresql://user:Lawm2471@host.docker.internal:5432/dbname" \
    DISPLAY=:99

# Expose both HTTP and HTTPS ports
EXPOSE 3096 3097 8888

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Create startup script
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

# Start the application using the startup script
CMD ["/startup.sh"]
