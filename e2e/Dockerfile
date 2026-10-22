ARG PLAYWRIGHT_IMAGE
FROM ${PLAYWRIGHT_IMAGE}

WORKDIR /app

# Install dependencies first for layer caching
COPY package.json ./
COPY package-lock.json ./
RUN npm ci

# Copy test sources
COPY . .

CMD ["bash", "run-ci.sh"]
