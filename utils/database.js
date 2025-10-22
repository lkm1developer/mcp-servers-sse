import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import pkg from 'crypto-js';
const { AES, enc } = pkg;

let supabase = null;
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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
    }

    // Initialize Supabase client
    supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection
    const { data, error } = await supabase
      .from('mcp_servers')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Supabase connection test failed: ${error.message}`);
    }

    isConnected = true;
    log('Connected to Supabase successfully');

  } catch (error) {
    log('Failed to connect to Supabase', { error: error.message });
    throw error;
  }
}

export async function closeDatabase() {
  try {
    // Supabase doesn't require explicit connection closing
    // Just reset the connection state
    isConnected = false;
    supabase = null;
    log('Database connection closed');
  } catch (error) {
    log('Error closing database connection', { error: error.message });
    throw error;
  }
}

export function isDatabaseConnected() {
  return isConnected && supabase !== null;
}

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Call initDatabase() first.');
  }
  return supabase;
}

export const getEncryptionKey = async () => {
  const encryptKey = process.env.ENCRYPTION_KEY ?? '';
  return encryptKey;
};

export const decryptCredentialData = async (encryptedData) => {
  const encryptKey = await getEncryptionKey();
  const decryptedData = AES.decrypt(encryptedData, encryptKey);
  try {
    const plainDataObj = JSON.parse(decryptedData.toString(enc.Utf8));
    return plainDataObj;
  } catch (e) {
    console.error(e);
    throw new Error('Credentials could not be decrypted.');
  }
};

export async function getSystemConnection(pieceNames, userId) {
  try {
    if (!isDatabaseConnected()) {
      log('Database connection required for getSystemConnection');
      return {};
    }

    let obj = {};

    // Build query based on whether userId is provided
    let query = supabase
      .from('connections')
      .select('*')
      .in('name', pieceNames)
      .order('updated_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('is_system', true);
    }

    const { data: connections, error } = await query;

    if (error) {
      log('Error fetching connections', { error: error.message });
      return {};
    }

    if (connections) {
      for (const connection of connections) {
        if (connection && connection.data) {
          try {
            const value = await decryptCredentialData(connection.data);
            obj[connection.name] = value;
          } catch (error) {
            obj[connection.name] = '';
          }
        } else {
          obj[connection.name] = '';
        }
      }
    }
    return obj;
  } catch (error) {
    log('getSystemConnection error', { error: error.message });
    return {};
  }
}

export default {
  initDatabase,
  closeDatabase,
  isDatabaseConnected,
  getSupabaseClient,
  getEncryptionKey,
  decryptCredentialData,
  getSystemConnection
};