# Use an official Node.js runtime as a parent image (Alpine for smaller size)
FROM node:lts-alpine AS builder

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
# This leverages Docker cache - dependencies are only reinstalled if these files change
COPY package*.json ./

# Install app dependencies using npm ci for faster, reproducible builds
# Use --only=production if you don't need devDependencies for the build step
# If build needs devDeps, remove --only=production here and add a production stage later
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the server and client code
RUN npm run build

# --- Production Stage ---
FROM node:lts-alpine

WORKDIR /usr/src/app

# Copy only necessary files from the builder stage
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/public ./public

# Make port 3000 available to the world outside this container
# IMPORTANT: Assumes your Node app will listen on HTTP 3000 inside the container
EXPOSE 3000

# Define the command to run your app
CMD [ "node", "dist/server/index.js" ]
