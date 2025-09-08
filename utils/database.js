import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Connections from '../models/Connections.js';
import pkg from 'crypto-js';
const { AES, enc } = pkg;
let isConnected = false;

// Initialize logs directory function
function initializeLogsDirectory() {
  const logsDir = path.join(process.cwd(), 'logs');
  const LOG_FILE = path.join(logsDir, 'multi-mcp-debug.log');
  
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch (error) {
    console.error('❌ Cannot create logs directory:', error.message);
  }
  
  return LOG_FILE;
}

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [DATABASE] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;
  
  try {
    console.log(`[DATABASE] ${message}`, data || '');
    const LOG_FILE = initializeLogsDirectory();
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (error) {
    console.error(`[LOG-ERROR] Failed to write to log file: ${error.message}`);
  }
}

export async function initDatabase() {
  if (isConnected) {
    log('Database already connected');
    return;
  }

  try {
    const uri = process.env.MONGO_URL;
    if (!uri) {
      throw new Error('MONGO_URL environment variable is required');
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = true;
    log('Connected to MongoDB successfully');

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      log('MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      log('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      log('MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    log('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
}

export async function closeDatabase() {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      isConnected = false;
      log('Database connection closed');
    }
  } catch (error) {
    log('Error closing database connection', { error: error.message });
    throw error;
  }
}

export function isDatabaseConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}
export const getEncryptionKey = async () => {
    const encryptKey = process.env.ENCRYPTION_KEY ?? 'ddsf%@#%#dfdfdfvbvdf546456dfcxgvdfgvfdg'
    return encryptKey
}
export const decryptCredentialData = async (encryptedData) => {
    const encryptKey = await getEncryptionKey()
    const decryptedData = AES.decrypt(encryptedData, encryptKey)
    try {
        const plainDataObj = JSON.parse(decryptedData.toString(enc.Utf8))
        return plainDataObj
    } catch (e) {
        console.error(e)
        throw new Error('Credentials could not be decrypted.')
    }
}
export async function getSystemConnection(pieceNames, userId) {
    try {
        let obj = {}
        let where = { pieceName: { $in: pieceNames }, isSystem: true }
        if (userId) {
            where = { pieceName: { $in: pieceNames }, userId }
        }
        const connections = await Connections.find(where).sort({ updatedAt: -1 })
        if (connections) {
            for (const connection of connections) {
                if (connection && connection.data) {
                    try {
                        const value = await decryptCredentialData(connection.data)
                        obj[connection.pieceName] = value
                    } catch (error) {
                        obj[connection.pieceName] = ''
                    }
                } else {
                    obj[connection.pieceName] = ''
                }
            }
        }
        return obj
    } catch (error) {
        console.log('getConnectionValue', error)
        return {}
    }
}