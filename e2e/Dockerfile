ARG PLAYWRIGHT_IMAGE
# Match GitLab even when Compose uses the legacy builder on Apple Silicon.
FROM --platform=linux/amd64 ${PLAYWRIGHT_IMAGE}

WORKDIR /app

# Install dependencies first for layer caching
COPY package.json ./
COPY package-lock.json ./
RUN npm ci

# Copy test sources
COPY . .

CMD ["bash", "run-ci.sh"]
