# Stage 1: Build Stage
FROM node:20 AS base

# Set the working directory inside the container to /usr/src/app.
WORKDIR /usr/src/app

# Globally install the package manager pnpm.
RUN npm i -g pnpm

# Copy the package.json and pnpm-lock.yaml files to the working directory.
COPY package.json pnpm-lock.yaml ./

# Install project dependencies using pnpm.
RUN pnpm install

# Copy all files from the context directory (where the Dockerfile is located) to the working directory.
COPY . .

# Build the Next.js app
RUN pnpm build

# Stage 2: Release Stage
FROM node:20-alpine3.19 as release

# Set the working directory inside the container to /usr/src/app.
WORKDIR /usr/src/app

# Globally install the package manager pnpm.
RUN npm i -g pnpm

# Copy the node_modules, package.json, and other necessary files from the build stage.
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY --from=base /usr/src/app/package.json ./package.json
COPY --from=base /usr/src/app/public ./public
COPY --from=base /usr/src/app/.next ./.next

# Expose port 3000 for the Next.js application.
EXPOSE 2001

# Set up ownership and run as non-root user
RUN chown -R node:node /usr/src/app
USER node

# Define the default command to run the Next.js app using pnpm start.
CMD ["pnpm", "start"]
