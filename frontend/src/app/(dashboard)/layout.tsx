'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../providers/auth-provider';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inventory', label: 'Inventario' },
  { href: '/production', label: 'Producción' },
  { href: '/distribution', label: 'Distribución' },
  { href: '/inspections', label: 'Inspecciones' },
  { href: '/incidents', label: 'Incidencias' },
  { href: '/traceability', label: 'Trazabilidad' },
  { href: '/suppliers', label: 'Proveedores' },
  { href: '/products', label: 'Productos' },
  { href: '/locations', label: 'Ubicaciones' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { token, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">TraceChain</Link>
        <nav className="nav" aria-label="Navegación principal">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}
              data-active={pathname === item.href || pathname.startsWith(`${item.href}/`)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div>
          <p data-muted>{user?.name ?? 'Sesión'}</p>
          <button className="button" onClick={() => { logout(); router.push('/login'); }}>Salir</button>
        </div>
      </aside>
      <div className="content">
        <div className="topbar"><span className="badge">{user?.role ?? ''}</span></div>
        {children}
      </div>
    </div>
  );
}
