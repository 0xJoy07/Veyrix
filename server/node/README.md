# Shopping Agent - Express Backend

A robust Express.js backend written in TypeScript with essential packages for security, logging, data validation, database connection, real-time messaging, and file handling.

## Installed Packages

### Production
- **`express`**: Fast, unopinionated web framework for Node.js.
- **`cors`**: Middleware to enable Cross-Origin Resource Sharing.
- **`helmet`**: Security middleware that sets secure HTTP headers.
- **`dotenv`**: Loads environment variables from `.env`.
- **`morgan`**: HTTP request logger middleware.
- **`cookie-parser`**: Parse and populate HTTP cookies.
- **`express-rate-limit`**: Rate limiting middleware to prevent brute force/DDoS.
- **`zod`**: TypeScript-first schema declaration and validation.
- **`multer`**: Multipart form-data handling for file and image uploads.
- **`axios`**: Promise-based HTTP client for external/Python service communication.
- **`jsonwebtoken`**: Authentication token creation and verification.
- **`bcryptjs`**: Password hashing utility.
- **`sqlite3`**: SQLite database driver.
- **`socket.io`**: Real-time event-based WebSocket communication.

### Development
- **`typescript`**: TypeScript language support.
- **`tsx`**: Lightning-fast TypeScript execution and watch mode for development.
- **`rimraf`**: Cross-platform directory cleaner.
- **`@types/*`**: Type definitions for Node, Express, CORS, Morgan, Cookie-Parser, Multer, JWT, Bcrypt, and SQLite3.

## Available Scripts

- `npm run dev`: Starts the server with live reload using `tsx watch src/index.ts`.
- `npm run build`: Compiles TypeScript files into `dist/`.
- `npm start`: Runs the compiled production build from `dist/index.js`.
- `npm run typecheck`: Runs TypeScript type checking without emitting files.

## Environment Variables

Configured in `.env` (sample in `.env.example`):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
JWT_SECRET=supersecretjwtkey_replace_in_production
PYTHON_SERVICE_URL=http://127.0.0.1:8000
SQLITE_DB_PATH=../../shopping agent/store.db
```
