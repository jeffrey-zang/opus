import { OpenAI } from "openai";

// Private variable to store the singleton instance
let _ai: OpenAI | null = null;

// Flag to track if OpenAI has been initialized
let _initialized = false;

/**
 * Loads the OpenAI API key from environment variables
 * @returns The OpenAI API key
 * @throws Error if the API key is not found
 */
export const loadOpusKey = (): string => {
  const apiKey = process.env.OPUS_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPUS_OPENAI_API_KEY is not set in environment variables");
  }
  
  return apiKey;
};

/**
 * Initializes the OpenAI configuration globally
 * This should be called once when the application starts
 */
export const initializeOpenAI = (): void => {
  if (!_initialized) {
    const apiKey = loadOpusKey();
    
    // Set the API key in the environment for the OpenAI SDK
    process.env.OPENAI_API_KEY = apiKey;
    
    _initialized = true;
    console.log("OpenAI API key configured globally");
  }
};

/**
 * Gets the singleton OpenAI instance, creating it on first access
 * @returns The OpenAI instance
 */
export const getAI = (): OpenAI => {
  if (!_ai) {
    // Ensure OpenAI is initialized
    initializeOpenAI();
    
    const apiKey = loadOpusKey();
    _ai = new OpenAI({ apiKey });
    console.log("OpenAI instance created with lazy initialization");
  }
  return _ai;
};

/**
 * Resets the singleton instance (useful for testing or key rotation)
 */
export const resetAI = (): void => {
  _ai = null;
  _initialized = false;
  console.log("OpenAI singleton instance reset");
};
