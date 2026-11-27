import {
  Body, CanActivate, Controller, ExecutionContext, Get, HttpCode, Injectable,
  Post, Req, UseGuards,
} from '@nestjs/common';
import argon2 from 'argon2';
import { AuthError, createLoginLimiter, signJwt, verifyJwt, type Role } from './auth.mts';
import { SqlService } from '../../database/postgres/sql.service';
import { validateEnv } from '../../config/env.validation.mts';

interface RequestUser {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  actor?: { id: string; name: string; email: string; role: Role };
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly secret = validateEnv(process.env).JWT_SECRET;
  constructor(private readonly sql: SqlService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestUser>();
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new Error('UNAUTHORIZED');
    }
    let claims;
    try {
      claims = verifyJwt(authorization.slice(7), this.secret, Math.floor(Date.now() / 1000));
    } catch (error) {
      if (error instanceof AuthError && error.code === 'TOKEN_EXPIRED') throw new Error('TOKEN_EXPIRED');
      throw new Error('UNAUTHORIZED');
    }
    const result = await this.sql.pool.query<{ id: string; nombre: string; correo: string; rol: Role }>(
      'SELECT id,nombre,correo,rol FROM usuarios WHERE id=$1 AND activo=true', [claims.sub]);
    const user = result.rows[0];
    if (!user || user.rol !== claims.role) throw new Error('UNAUTHORIZED');
    request.actor = { id: user.id, name: user.nombre, email: user.correo, role: user.rol };
    return true;
  }
}

@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly auth: AuthGuard) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.auth.canActivate(context);
    const request = context.switchToHttp().getRequest<RequestUser>();
    if (request.actor?.role !== 'OPERADOR') throw new Error('FORBIDDEN');
    return true;
  }
}

@Injectable()
export class AnalystGuard implements CanActivate {
  constructor(private readonly auth: AuthGuard) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.auth.canActivate(context);
    const request = context.switchToHttp().getRequest<RequestUser>();
    if (request.actor?.role !== 'ANALISTA_CALIDAD') throw new Error('FORBIDDEN');
    return true;
  }
}

@Controller('api/v1/auth')
export class AuthController {
  private readonly config = validateEnv(process.env);
  private readonly limiter = createLoginLimiter();
  constructor(private readonly sql: SqlService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() value: unknown, @Req() request: RequestUser) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('VALIDATION_ERROR');
    }
    const body = value as Record<string, unknown>;
    if (Object.keys(body).some((key) => !['email', 'password'].includes(key)) ||
        typeof body.email !== 'string' || typeof body.password !== 'string' ||
        body.email.length > 254 || body.password.length === 0) throw new Error('VALIDATION_ERROR');
    this.limiter.register(request.ip ?? 'local', Date.now());
    const result = await this.sql.pool.query<{ id: string; nombre: string; correo: string;
      password_hash: string; rol: Role; activo: boolean }>(
      'SELECT id,nombre,correo,password_hash,rol,activo FROM usuarios WHERE lower(correo)=lower($1)', [body.email]);
    const user = result.rows[0];
    const valid = user?.activo && await argon2.verify(user.password_hash, body.password);
    if (!valid) throw new Error('INVALID_CREDENTIALS');
    return { data: {
      accessToken: signJwt({ sub: user.id, role: user.rol }, this.config.JWT_SECRET,
        Math.floor(Date.now() / 1000)),
      tokenType: 'Bearer', expiresIn: 28800,
      user: { id: user.id, name: user.nombre, email: user.correo, role: user.rol },
    } };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: RequestUser) {
    return { data: request.actor };
  }
}
