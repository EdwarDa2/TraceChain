'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle, Bell, Boxes, ClipboardCheck, Factory, LayoutDashboard, LogOut,
  MapPin, Network, Package, Truck, Users,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useApiQuery } from '../../hooks/use-api';
import type { DashboardSummary } from '../../lib/types';
import { useAuth } from '../../providers/auth-provider';

const GROUPS = [
  { label: 'General', items: [
    { href: '/dashboard', label: 'Vista general', icon: LayoutDashboard },
  ] },
  { label: 'Operaciones', items: [
    { href: '/inventory', label: 'Inventario', icon: Boxes },
    { href: '/production', label: 'Producción', icon: Factory },
    { href: '/distribution', label: 'Distribución', icon: Truck },
  ] },
  { label: 'Calidad y análisis', items: [
    { href: '/inspections', label: 'Inspecciones', icon: ClipboardCheck },
    { href: '/incidents', label: 'Incidencias', icon: AlertTriangle },
    { href: '/traceability', label: 'Trazabilidad', icon: Network },
  ] },
  { label: 'Catálogos', items: [
    { href: '/suppliers', label: 'Proveedores', icon: Users },
    { href: '/products', label: 'Productos', icon: Package },
    { href: '/locations', label: 'Ubicaciones', icon: MapPin },
  ] },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { token, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const summary = useApiQuery<DashboardSummary>('/dashboard/summary');

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    router.push(`/inventory?search=${encodeURIComponent(search)}`);
  }

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [token, router]);

  if (!token) return null;

  const section = GROUPS.find((group) => group.items.some((item) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`)))?.label ?? 'General';
  const initials = (user?.name ?? 'TC').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <span className="brand-mark">T</span>
          <Link className="brand-name" href="/dashboard">TraceChain</Link>
        </div>
        <div className="nav-groups">
          {GROUPS.map((group) => (
            <nav className="nav-group" key={group.label} aria-label={group.label}>
              <p className="nav-group-label">{group.label}</p>
              <div className="nav">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return <Link key={item.href} href={item.href} data-active={active}>
                    <Icon aria-hidden /><span>{item.label}</span>
                  </Link>;
                })}
              </div>
            </nav>
          ))}
        </div>
        <div className="user-area">
          <button className="user-button" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}>
            <span className="user-avatar">{initials}</span>
            <span className="user-meta">
              <span className="user-name">{user?.name ?? 'Sesión'}</span>
              <span className="user-role">{user?.role.replaceAll('_', ' ') ?? ''}</span>
            </span>
          </button>
          {menuOpen ? (
            <div className="user-menu">
              <button onClick={() => { setMenuOpen(false); logout(); router.push('/login'); }}>
                <LogOut size={14} aria-hidden /> Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </aside>
      <div className="content">
        <div className="topbar">
          <div className="breadcrumb"><span>TraceChain</span><span>/</span><span>{section}</span></div>
          <div className="topbar-actions">
            <form onSubmit={submitSearch} role="search">
              <input className="search topbar-search" type="search" value={search}
                placeholder="Buscar lotes…" aria-label="Buscar lotes"
                onChange={(event) => setSearch(event.target.value)} />
            </form>
            <Link className="icon-button" href="/incidents"
              aria-label={`${Number(summary.data?.activeIncidents ?? 0)} incidencias activas`}>
              <Bell size={15} aria-hidden />
              {Number(summary.data?.activeIncidents ?? 0) > 0
                ? <em aria-hidden>{summary.data?.activeIncidents}</em> : null}
            </Link>
            <div className="topbar-user">
              <span className="user-avatar">{initials}</span>
              <span>{user?.name ?? 'Sesión'}</span>
            </div>
          </div>
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}
