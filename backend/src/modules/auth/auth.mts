/**
 * Autenticación y autorización de I-1 (REL-04).
 * Fuentes: API_CONTRACT.md §1 y §6, RNF-04/05, RN-07/08/11/125, PS-01..12.
 * JWT HS256 con `node:crypto` (sin dependencias nuevas); el hash Argon2id se
 * inyecta como puerto porque el stack aún no está instalado (BASE-01).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type Role = 'OPERADOR' | 'ANALISTA_CALIDAD';

export interface JwtClaims {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
  iss: 'tracechain';
  aud: 'tracechain-web';
}

export class AuthError extends Error {
  readonly code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED' | 'FORBIDDEN' | 'RATE_LIMITED';
  readonly status: 401 | 403 | 429;

  constructor(
    code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED' | 'FORBIDDEN' | 'RATE_LIMITED',
    status: 401 | 403 | 429,
    mensaje: string,
  ) {
    super(mensaje);
    this.code = code;
    this.status = status;
    this.name = 'AuthError';
  }
}

const EMISOR = 'tracechain' as const;
const AUDIENCIA = 'tracechain-web' as const;

function codificar(parte: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(parte)).toString('base64url');
}

function decodificar(valor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(valor, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function firma(token: string, secreto: string): Buffer {
  return createHmac('sha256', secreto).update(token).digest();
}

/** seconds: TTL en segundos (28800 por defecto según PROJECT §5). */
export function signJwt(
  entrada: { sub: string; role: Role },
  secreto: string,
  ahora: number,
  seconds = 28800,
): string {
  const cabecera = codificar({ alg: 'HS256', typ: 'JWT' });
  const payload = codificar({
    sub: entrada.sub,
    role: entrada.role,
    iat: ahora,
    exp: ahora + seconds,
    iss: EMISOR,
    aud: AUDIENCIA,
  } satisfies JwtClaims);
  const contenido = `${cabecera}.${payload}`;
  return `${contenido}.${firma(contenido, secreto).toString('base64url')}`;
}

export function verifyJwt(token: string, secreto: string, ahora: number): JwtClaims {
  const partes = token.split('.');
  if (partes.length !== 3) throw new AuthError('UNAUTHORIZED', 401, 'Token malformado');

  const esperada = firma(`${partes[0]}.${partes[1]}`, secreto);
  const recibida = Buffer.from(partes[2]!, 'base64url');
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
    throw new AuthError('UNAUTHORIZED', 401, 'Firma inválida');
  }

  const claims = decodificar(partes[1]!) as unknown as JwtClaims;
  if (claims.iss !== EMISOR || claims.aud !== AUDIENCIA ||
      claims.role !== 'OPERADOR' && claims.role !== 'ANALISTA_CALIDAD' ||
      typeof claims.sub !== 'string' || typeof claims.iat !== 'number' || typeof claims.exp !== 'number') {
    throw new AuthError('UNAUTHORIZED', 401, 'Claims inválidos');
  }
  if (claims.exp <= ahora) throw new AuthError('TOKEN_EXPIRED', 401, 'Token expirado');
  return claims;
}

/** Autorización efectiva en backend: la UI solo oculta acciones, no decide. */
export function requireRole(claims: Pick<JwtClaims, 'role'>, roles: Role[]): void {
  if (!roles.includes(claims.role)) {
    throw new AuthError('FORBIDDEN', 403, 'Rol no autorizado');
  }
}

export interface LoginLimiter {
  register(ip: string, ahora: number): void;
}

/** Cinco intentos por IP en 60 s; 429 con Retry-After en el error. */
export function createLoginLimiter(limite = 5, ventanaMs = 60_000): LoginLimiter {
  const intentos = new Map<string, number[]>();
  return {
    register(ip, ahora) {
      const recientes = (intentos.get(ip) ?? []).filter((instante) => ahora - instante < ventanaMs);
      if (recientes.length >= limite) {
        throw new AuthError('RATE_LIMITED', 429, 'Demasiados intentos de inicio de sesión');
      }
      recientes.push(ahora);
      intentos.set(ip, recientes);
    },
  };
}

/** Argon2id se inyecta; nunca se guarda la contraseña en texto plano (RNF-04, AI-16). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export function verificarCredenciales(
  hasher: PasswordHasher,
  hash: string,
  plain: string,
  activo: boolean,
): Promise<boolean> {
  if (!activo) return Promise.resolve(false);
  return hasher.verify(hash, plain);
}
