/**
 * Validación explícita de configuración de I-1 (BASE-02).
 * Fuente: PROJECT.md §5. Configuración inválida falla explícitamente (RNF-07).
 * Los mensajes nunca incluyen valores secretos ni el valor inválido (AI-16).
 */

export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  FRONTEND_URL: string;
  NEXT_PUBLIC_API_URL: string;
  DATABASE_URL: string;
  MONGODB_URI: string;
  MONGODB_DATABASE: string;
  NEO4J_URI: string;
  NEO4J_USER: string;
  NEO4J_PASSWORD: string;
  NEO4J_DATABASE: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BUSINESS_TIMEZONE: string;
  OUTBOX_ENABLED: boolean;
  OUTBOX_POLL_INTERVAL_MS: number;
  OUTBOX_MAX_RETRY_DELAY_MS: number;
  GRAPH_DEFAULT_DEPTH: number;
  GRAPH_MAX_DEPTH: number;
  GRAPH_MAX_RESULTS: number;
  GRAPH_TIMEOUT_MS: number;
  SWAGGER_ENABLED: boolean;
}

type Entrada = Record<string, string | undefined>;

const OBLIGATORIAS = [
  'FRONTEND_URL', 'NEXT_PUBLIC_API_URL', 'DATABASE_URL', 'MONGODB_URI',
  'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'JWT_SECRET',
] as const;

const VALORES_POR_DEFECTO: Record<string, string> = {
  NODE_ENV: 'development',
  PORT: '3001',
  MONGODB_DATABASE: 'tracechain_quality',
  NEO4J_DATABASE: 'neo4j',
  JWT_EXPIRES_IN: '8h',
  BUSINESS_TIMEZONE: 'America/Mexico_City',
  OUTBOX_ENABLED: 'true',
  OUTBOX_POLL_INTERVAL_MS: '2000',
  OUTBOX_MAX_RETRY_DELAY_MS: '300000',
  GRAPH_DEFAULT_DEPTH: '10',
  GRAPH_MAX_DEPTH: '20',
  GRAPH_MAX_RESULTS: '10000',
  GRAPH_TIMEOUT_MS: '10000',
  SWAGGER_ENABLED: 'false',
};

function esUrlHttp(valor: string): boolean {
  try {
    const url = new URL(valor);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host.length > 0;
  } catch {
    return false;
  }
}

function esNumero(valor: string, minimo: number, maximo: number): boolean {
  if (!/^[0-9]+$/.test(valor)) return false;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= minimo && numero <= maximo;
}

/** Devuelve la configuración tipada o lanza un Error con nombres de variable, nunca valores. */
export function validateEnv(entrada: Entrada): AppEnv {
  const problemas: string[] = [];
  const valores: Record<string, string> = {};

  for (const clave of OBLIGATORIAS) {
    const valor = entrada[clave];
    if (typeof valor !== 'string' || valor.trim().length === 0) {
      problemas.push(`${clave} es obligatoria`);
    } else {
      valores[clave] = valor;
    }
  }
  for (const [clave, defecto] of Object.entries(VALORES_POR_DEFECTO)) {
    valores[clave] = entrada[clave] ?? defecto;
  }
  if (entrada.NODE_ENV !== undefined) valores.NODE_ENV = entrada.NODE_ENV;
  if (entrada.PORT !== undefined) valores.PORT = entrada.PORT;

  if (!['development', 'test', 'production'].includes(valores.NODE_ENV!)) {
    problemas.push('NODE_ENV debe ser development, test o production');
  }
  if (!esNumero(valores.PORT!, 1, 65535)) problemas.push('PORT debe estar entre 1 y 65535');
  if (!esUrlHttp(valores.FRONTEND_URL ?? '')) problemas.push('FRONTEND_URL debe ser una URL http(s) válida');
  if (!esUrlHttp(valores.NEXT_PUBLIC_API_URL ?? '')) problemas.push('NEXT_PUBLIC_API_URL debe ser una URL http(s) válida con /api/v1');
  else if (!valores.NEXT_PUBLIC_API_URL!.includes('/api/v1')) problemas.push('NEXT_PUBLIC_API_URL debe incluir /api/v1');
  if (!/^postgresql:\/\/.+/.test(valores.DATABASE_URL ?? '')) problemas.push('DATABASE_URL debe ser una URI postgresql');
  if (!/^mongodb(\+srv)?:\/\/.+/.test(valores.MONGODB_URI ?? '')) problemas.push('MONGODB_URI debe ser una URI mongodb');
  if (!/^(bolt|neo4j):\/\/.+/.test(valores.NEO4J_URI ?? '')) problemas.push('NEO4J_URI debe ser una URI bolt o neo4j');
  if ((valores.JWT_SECRET ?? '').length < 32) problemas.push('JWT_SECRET debe tener al menos 32 caracteres');
  if (!/^[0-9]+[smhd]$/.test(valores.JWT_EXPIRES_IN ?? '')) problemas.push('JWT_EXPIRES_IN debe usar formato 8h, 30m, etc.');
  if (valores.BUSINESS_TIMEZONE !== 'America/Mexico_City') {
    problemas.push('BUSINESS_TIMEZONE debe ser America/Mexico_City');
  }

  const booleanos = ['OUTBOX_ENABLED', 'SWAGGER_ENABLED'] as const;
  for (const clave of booleanos) {
    if (!['true', 'false'].includes(valores[clave]!)) problemas.push(`${clave} debe ser true o false`);
  }

  const enteros: [string, number, number][] = [
    ['OUTBOX_POLL_INTERVAL_MS', 1, 300000],
    ['OUTBOX_MAX_RETRY_DELAY_MS', 1, 3600000],
    ['GRAPH_DEFAULT_DEPTH', 1, 20],
    ['GRAPH_MAX_DEPTH', 1, 20],
    ['GRAPH_MAX_RESULTS', 1, 100000],
    ['GRAPH_TIMEOUT_MS', 1, 60000],
  ];
  for (const [clave, minimo, maximo] of enteros) {
    if (!esNumero(valores[clave]!, minimo, maximo)) {
      problemas.push(`${clave} debe ser un entero entre ${minimo} y ${maximo}`);
    }
  }
  if (Number(valores.GRAPH_DEFAULT_DEPTH) > Number(valores.GRAPH_MAX_DEPTH)) {
    problemas.push('GRAPH_DEFAULT_DEPTH no puede exceder GRAPH_MAX_DEPTH');
  }

  if (problemas.length > 0) throw new Error(`Configuración inválida: ${problemas.join('; ')}`);

  return {
    NODE_ENV: valores.NODE_ENV as AppEnv['NODE_ENV'],
    PORT: Number(valores.PORT),
    FRONTEND_URL: valores.FRONTEND_URL!,
    NEXT_PUBLIC_API_URL: valores.NEXT_PUBLIC_API_URL!,
    DATABASE_URL: valores.DATABASE_URL!,
    MONGODB_URI: valores.MONGODB_URI!,
    MONGODB_DATABASE: valores.MONGODB_DATABASE!,
    NEO4J_URI: valores.NEO4J_URI!,
    NEO4J_USER: valores.NEO4J_USER!,
    NEO4J_PASSWORD: valores.NEO4J_PASSWORD!,
    NEO4J_DATABASE: valores.NEO4J_DATABASE!,
    JWT_SECRET: valores.JWT_SECRET!,
    JWT_EXPIRES_IN: valores.JWT_EXPIRES_IN!,
    BUSINESS_TIMEZONE: valores.BUSINESS_TIMEZONE!,
    OUTBOX_ENABLED: valores.OUTBOX_ENABLED === 'true',
    OUTBOX_POLL_INTERVAL_MS: Number(valores.OUTBOX_POLL_INTERVAL_MS),
    OUTBOX_MAX_RETRY_DELAY_MS: Number(valores.OUTBOX_MAX_RETRY_DELAY_MS),
    GRAPH_DEFAULT_DEPTH: Number(valores.GRAPH_DEFAULT_DEPTH),
    GRAPH_MAX_DEPTH: Number(valores.GRAPH_MAX_DEPTH),
    GRAPH_MAX_RESULTS: Number(valores.GRAPH_MAX_RESULTS),
    GRAPH_TIMEOUT_MS: Number(valores.GRAPH_TIMEOUT_MS),
    SWAGGER_ENABLED: valores.SWAGGER_ENABLED === 'true',
  };
}
