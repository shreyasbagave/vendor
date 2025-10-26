import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../utils/dateUtils';

type DashboardData = {
    totals?: Record<string, number>;
    recentActivities?: Array<{ action: string; entityType?: string; createdAt?: string; }>
};

const Dashboard: React.FC = () => {
    const { api, user } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await api.get<{ success: boolean; data?: DashboardData; message?: string }>('/dashboard/overview');
                if (!mounted) return;
                if (res.data?.success) setData(res.data.data || null); else setError(res.data?.message || 'Failed to load dashboard');
            } catch (e: any) {
                if (!mounted) return;
                setError(e?.message || 'Failed to load dashboard');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [api]);

    if (loading) return <div style={{ padding: 24 }}>Loading dashboard...</div>;
    if (error) return <div style={{ padding: 24, color: '#d33' }}>{error}</div>;

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            <h2>Welcome{user ? `, ${user.name}` : ''}</h2>
            <div className="card-grid" style={{ marginTop: 16 }}>
                {data?.totals && Object.entries(data.totals).map(([key, value]) => (
                    <div key={key} style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                        <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase' }}>{key}</div>
                        <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: 24 }}>
                <h3>Recent Activity</h3>
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {data?.recentActivities?.map((a, idx) => (
                            <li key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                                {a.action} {a.entityType ? `on ${a.entityType}` : ''} {a.createdAt ? `at ${formatDateTime(a.createdAt)}` : ''}
                            </li>
                        )) || <li style={{ padding: '8px 0', color: '#666' }}>No recent activity</li>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;


