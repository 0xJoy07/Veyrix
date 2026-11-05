import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || "default_jwt_secret",
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000",
  sqliteDbPath: process.env.SQLITE_DB_PATH || "../../shopping agent/store.db",
};
