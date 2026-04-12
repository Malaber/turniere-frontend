FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

# Install dependencies first for layer caching
COPY package.json ./
COPY package-lock.json ./
RUN npm ci

# Copy test sources
COPY . .

CMD ["npx", "playwright", "test"]
