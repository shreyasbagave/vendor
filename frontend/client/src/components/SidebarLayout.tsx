import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type NavItem = { path: string; label: string; icon: React.ReactNode };
const Icon = {
    Dashboard: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
    ),
    Items: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 16V8a2 2 0 0 0-1.106-1.789l-7-3.5a2 2 0 0 0-1.788 0l-7 3.5A2 2 0 0 0 3 8v8a2 2 0 0 0 1.106 1.789l7 3.5a2 2 0 0 0 1.788 0l7-3.5A2 2 0 0 0 21 16zM12 4.236 18.618 7.5 12 10.764 5.382 7.5 12 4.236zM5 9.618l6 3v7.146l-6-3V9.618zm8 10.146V12.618l6-3v7.146l-6 3z"/>
        </svg>
    ),
    Suppliers: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.96 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
    ),
    Customers: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V22h19.2v-2.8c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
    ),
    Inward: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v6h2V5h14v6h2V5c0-1.1-.9-2-2-2zM11 12 8 9l-1.41 1.41L12 15.83l5.41-5.42L16 9l-3 3V3h-2v9zM5 19h14v-6h2v8H3v-8h2v6z"/>
        </svg>
    ),
    Outward: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v6h2V5h14v6h2V5c0-1.1-.9-2-2-2zM13 12l3-3 1.41 1.41L12 15.83 6.59 10.41 8 9l3 3V3h2v9zM5 19h14v-6h2v8H3v-8h2v6z"/>
        </svg>
    ),
    Reports: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zM3 9h2V7H3v2zm4 8h14v-2H7v2zm0-4h14v-2H7v2zm0-6v2h14V7H7z"/>
        </svg>
    ),
};

const navItems: Array<NavItem> = [
    { path: '/', label: 'Dashboard', icon: Icon.Dashboard },
    { path: '/items', label: 'Items', icon: Icon.Items },
    { path: '/suppliers', label: 'Suppliers', icon: Icon.Suppliers },
    { path: '/customers', label: 'Customers', icon: Icon.Customers },
    { path: '/inward', label: 'Inward', icon: Icon.Inward },
    { path: '/outward', label: 'Outward', icon: Icon.Outward },
    { path: '/reports', label: 'Reports', icon: Icon.Reports },
];

const SidebarLayout: React.FC<{ children: React.ReactNode; onLogout?: () => void }>
    = ({ children, onLogout }) => {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const sidebarWidth = useMemo(() => collapsed ? 64 : 240, [collapsed]);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [pwdOpen, setPwdOpen] = useState(false);
    const [oldPwd, setOldPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [savingPwd, setSavingPwd] = useState(false);

    useEffect(() => {
        const onResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // Auto-collapse sidebar on mobile
            if (mobile) {
                setCollapsed(false); // Keep expanded when mobile menu is open
            }
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const onNavClick = () => {
        if (isMobile) setMobileOpen(false);
    };
    return (
        <>
        <div style={{ display: 'grid', gridTemplateRows: '56px 1fr', minHeight: '100vh', background: 'var(--app-bg)' }}>
            {/* Top Header */}
            <header style={{ display: 'grid', gridTemplateColumns: isMobile ? 'auto 1fr auto' : '1fr auto 1fr', alignItems: 'center', padding: isMobile ? '0 8px 0 4px' : '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--header-bg)', color: 'var(--header-fg)', position: 'relative', zIndex: 60 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {isMobile && (
                        <button aria-label="Open menu" onClick={() => setMobileOpen(true)} style={{ background: 'transparent', border: 'none', color: 'var(--header-fg)', cursor: 'pointer', padding: 8, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
                        </button>
                    )}
                </div>
                <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 18, letterSpacing: 0.5, justifySelf: 'center', textAlign: 'center', padding: isMobile ? '0 8px' : '0' }}>OM ENGINEERING WORKS</div>
                <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, position: 'relative' }}>
                    <button onClick={() => setProfileOpen(v => !v)} aria-label="Profile" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', padding: 6, borderRadius: '50%', cursor: 'pointer', width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 'auto' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8V22h19.2v-2.8c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                    </button>
                    {onLogout && !isMobile && (
                        <button onClick={onLogout} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', minHeight: 'auto' }}>Logout</button>
                    )}
                    {profileOpen && (
                        <div style={{ position: 'absolute', right: 0, top: 48, background: '#fff', color: '#111', border: '1px solid var(--border)', borderRadius: 8, minWidth: isMobile ? 180 : 220, boxShadow: '0 6px 20px rgba(0,0,0,.12)', overflow: 'hidden', zIndex: 70 }}>
                            <div style={{ padding: '10px 12px', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: isMobile ? 14 : 16 }}>{user?.name || 'Admin'}</div>
                            <button onClick={() => { setPwdOpen(true); setProfileOpen(false); }} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 12px', cursor: 'pointer', minHeight: isMobile ? 48 : 'auto', fontSize: isMobile ? 14 : 16, color: '#111' }}>Change Password</button>
                            {onLogout && <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 12px', cursor: 'pointer', minHeight: isMobile ? 48 : 'auto', fontSize: isMobile ? 14 : 16, color: '#111' }}>Logout</button>}
                        </div>
                    )}
                </div>
            </header>
            {/* Body with Sidebar + Content */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : sidebarWidth + 'px 1fr', minHeight: 0 }}>
                {/* Sidebar */}
                <aside style={{
                    borderRight: '1px solid var(--border)',
                    padding: isMobile ? 8 : 12,
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    background: 'var(--sidebar-bg)',
                    color: 'var(--sidebar-fg)',
                    position: isMobile ? 'fixed' : 'relative',
                    top: isMobile ? 56 : undefined,
                    left: 0,
                    height: isMobile ? 'calc(100vh - 56px)' : 'auto',
                    width: isMobile ? (collapsed ? 64 : 260) : undefined,
                    transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
                    transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 50,
                    boxShadow: isMobile && mobileOpen ? '2px 0 8px rgba(0,0,0,0.15)' : 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        {isMobile ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sidebar-fg)' }}>Menu</div>
                                <button aria-label="Close menu" onClick={() => setMobileOpen(false)} style={{ background: 'transparent', color: 'var(--sidebar-fg)', border: 'none', cursor: 'pointer', padding: 6, minHeight: 'auto' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
                                </button>
                            </div>
                        ) : (
                            <>
                                <button aria-label="More" title="Menu" onClick={() => setCollapsed(v => !v)} style={{ background: 'transparent', color: 'var(--sidebar-fg)', border: 'none', cursor: 'pointer', padding: 6, minHeight: 'auto' }}>
                                    <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--sidebar-fg)', marginRight: 3 }} />
                                    <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--sidebar-fg)', marginRight: 3 }} />
                                    <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--sidebar-fg)' }} />
                                </button>
                                {!collapsed && <div style={{ fontSize: 12, color: '#6b7280' }}>Menu</div>}
                            </>
                        )}
                    </div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 6 }}>
                        {navItems.map(item => (
                            <Link key={item.path} to={item.path} onClick={onNavClick} className="nav-link" style={{
                                padding: isMobile ? '14px 12px' : '10px 12px',
                                borderRadius: 8,
                                textDecoration: 'none',
                                color: pathname === item.path ? '#fff' : 'var(--sidebar-fg)',
                                background: pathname === item.path ? 'var(--primary)' : 'transparent',
                                fontWeight: pathname === item.path ? 600 : 500,
                                fontSize: isMobile ? 15 : 14,
                                display: 'grid',
                                gridTemplateColumns: (collapsed && !isMobile) ? '1fr' : '20px 1fr',
                                alignItems: 'center',
                                justifyContent: 'center',
                                columnGap: 10,
                                textAlign: (collapsed && !isMobile) ? 'center' : 'left',
                                minHeight: isMobile ? 48 : 'auto'
                            }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {item.icon}
                                </span>
                                <span style={{ display: (collapsed && !isMobile) ? 'none' : 'inline' }}>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                </aside>
                {/* Backdrop for mobile */}
                {isMobile && mobileOpen && (
                    <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, top: 56, background: 'rgba(0,0,0,.45)', zIndex: 40, transition: 'opacity 250ms ease' }} />
                )}
                <main style={{ padding: isMobile ? 12 : 16, overflow: 'auto', WebkitOverflowScrolling: 'touch', background: 'var(--content-bg)', minHeight: 'calc(100vh - 56px)' }}>{children}</main>
            </div>
        </div>
        {pwdOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: isMobile ? 16 : 0 }} onClick={() => !savingPwd && setPwdOpen(false)}>
                <div className="modal-content" style={{ background: '#fff', padding: isMobile ? 20 : 24, borderRadius: 12, width: 'min(100% - 24px, 420px)', maxHeight: isMobile ? 'calc(100vh - 32px)' : '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontWeight: 600, marginBottom: 16, fontSize: isMobile ? 18 : 20 }}>Change Password</div>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Current Password</label>
                            <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>New Password</label>
                            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => setPwdOpen(false)} disabled={savingPwd} style={{ flex: isMobile ? '1 1 120px' : 'initial' }}>Cancel</button>
                            <button type="button" onClick={() => setPwdOpen(false)} disabled={savingPwd} style={{ flex: isMobile ? '1 1 120px' : 'initial' }}>Save</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default SidebarLayout;


