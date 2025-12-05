import { config as loadEnv } from "dotenv";
loadEnv();

export const env = {

  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS),

  deviceId: process.env.DEVICE_ID,

  backendBaseUrl: process.env.BACKEND_BASE_URL,

  apiKey: process.env.API_KEY,

  port: Number(process.env.PORT),

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL
  },

  classification: {
    model: process.env.CLASSIFICATION_MODEL,
    temperature: Number(process.env.CLASSIFICATION_MODEL_TEMPERATURE),
  },
  
  redis: {
    url: process.env.REDIS_URL
  },

  intentDetectionEnabled: (process.env.INTENT_DETECTION_ENABLED ?? 'false').toLowerCase() === 'true',

  metricsWindowMinutes: Number(process.env.METRICS_WINDOW_MINUTES),

  data: {
    sessionId: 'sessionId',
    chat: 'chat',
    metrics: {
      hr: 'vitals:hr',
      rr: 'vitals:rr',
      spo2: 'vitals:spo2',
      temp: 'vitals:temp',
      gluco: 'vitals:gluco',
      bpSys: 'vitals:bp_sys',
      bpDia: 'vitals:bp_dia'
    }
  },

  welcomeMessage: '**Hi!** I\'m your clinical assistant. I can help you to:\n\n- Formulate and clarify clinical problems\n- Analyze your vital data \n- Contextualize symptoms and measurements\n\n**Note:** You can use the **green button** with the chart icon to enable or disable the analysis of your biological data for each query.'
};
