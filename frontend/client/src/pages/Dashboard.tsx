import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../utils/dateUtils';

type DashboardData = {
    period?: { month: number; year: number; monthName: string };
    inward?: { totalQuantity: number; totalAmount: number; totalEntries: number };
    outward?: { totalQuantity: number; totalOkQty: number; totalCrQty: number; totalMrQty: number; totalAsCastQty: number; totalAmount: number; totalEntries: number };
    currentStock?: { totalItems: number; totalStock: number; lowStockItems: number };
    crMrSummary?: { totalCrQty: number; totalMrQty: number; totalRejects: number; rejectEntries: number };
    previousMonth?: {
        period: { month: number; year: number; monthName: string };
        inward: { totalQuantity: number; totalAmount: number; totalEntries: number };
        outward: { totalQuantity: number; totalOkQty: number; totalCrQty: number; totalMrQty: number; totalAsCastQty: number; totalAmount: number; totalEntries: number };
        crMrSummary: { totalCrQty: number; totalMrQty: number; totalRejects: number; rejectEntries: number };
    };
    topInwardItems?: Array<{ itemName: string; totalQuantity: number; totalAmount: number }>;
    topOutwardItems?: Array<{ itemName: string; totalOkQty: number; totalCrQty: number; totalMrQty: number }>;
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
            
            {/* Current Month Summary */}
            {data?.period && (
                <div style={{ marginTop: 24 }}>
                    <h3 style={{ marginBottom: 16 }}>Monthly Summary - {data.period.monthName} {data.period.year}</h3>
                    <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                        {/* Inward Card */}
                        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff', borderLeft: '4px solid #28a745' }}>
                            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Inward</div>
                            <div style={{ fontSize: 28, fontWeight: 600, color: '#28a745' }}>{data?.inward?.totalEntries || 0}</div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Entries</div>
                            <div style={{ fontSize: 16, fontWeight: 500, marginTop: 12, color: '#333' }}>
                                {data?.inward?.totalQuantity || 0} units
                            </div>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                                ₹{data?.inward?.totalAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        {/* Outward Card */}
                        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff', borderLeft: '4px solid #007bff' }}>
                            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Outward</div>
                            <div style={{ fontSize: 28, fontWeight: 600, color: '#007bff' }}>{data?.outward?.totalEntries || 0}</div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Entries</div>
                            <div style={{ fontSize: 16, fontWeight: 500, marginTop: 12, color: '#333' }}>
                                OK: {data?.outward?.totalOkQty || 0} | As Cast: {data?.outward?.totalAsCastQty || 0}
                            </div>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                                ₹{data?.outward?.totalAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        {/* Current Stock Card */}
                        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff', borderLeft: '4px solid #17a2b8' }}>
                            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Current Stock</div>
                            <div style={{ fontSize: 28, fontWeight: 600, color: '#17a2b8' }}>{data?.currentStock?.totalItems || 0}</div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Items</div>
                            <div style={{ fontSize: 16, fontWeight: 500, marginTop: 12, color: '#333' }}>
                                {data?.currentStock?.totalStock?.toFixed(2) || '0'} units
                            </div>
                            {data?.currentStock?.lowStockItems ? (
                                <div style={{ fontSize: 12, color: '#dc3545', marginTop: 8, fontWeight: 500 }}>
                                    ⚠️ {data.currentStock.lowStockItems} low stock
                                </div>
                            ) : null}
                        </div>

                        {/* CR/MR Card */}
                        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff', borderLeft: '4px solid #dc3545' }}>
                            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>CR/MR</div>
                            <div style={{ fontSize: 28, fontWeight: 600, color: '#dc3545' }}>{data?.crMrSummary?.totalRejects || 0}</div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Total Rejects</div>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 12 }}>
                                CR: {data?.crMrSummary?.totalCrQty || 0} | MR: {data?.crMrSummary?.totalMrQty || 0}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Previous Month Summary */}
            {data?.previousMonth && (
                <div style={{ marginTop: 32 }}>
                    <h3 style={{ marginBottom: 16, color: '#666' }}>Previous Month - {data.previousMonth.period.monthName} {data.previousMonth.period.year}</h3>
                    <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#f9f9f9', borderLeft: '4px solid #28a745', opacity: 0.9 }}>
                            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Inward</div>
                            <div style={{ fontSize: 28, fontWeight: 600, color: '#28a745' }}>{data.previousMonth.inward.totalEntries || 0}</div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Entries</div>
                            <div style={{ fontSize: 16, fontWeight: 500, marginTop: 12, color: '#333' }}>
                                {data.previousMonth.inward.totalQuantity || 0} units
                            </div>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                                ₹{data.previousMonth.inward.totalAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#f9f9f9', borderLeft: '4px solid #007bff', opacity: 0.9 }}>
                            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>Outward</div>
                            <div style={{ fontSize: 28, fontWeight: 600, color: '#007bff' }}>{data.previousMonth.outward.totalEntries || 0}</div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Entries</div>
                            <div style={{ fontSize: 16, fontWeight: 500, marginTop: 12, color: '#333' }}>
                                OK: {data.previousMonth.outward.totalOkQty || 0} | As Cast: {data.previousMonth.outward.totalAsCastQty || 0}
                            </div>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                                ₹{data.previousMonth.outward.totalAmount?.toLocaleString('en-IN') || '0'}
                            </div>
                        </div>

                        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#f9f9f9', borderLeft: '4px solid #dc3545', opacity: 0.9 }}>
                            <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>CR/MR</div>
                            <div style={{ fontSize: 28, fontWeight: 600, color: '#dc3545' }}>{data.previousMonth.crMrSummary.totalRejects || 0}</div>
                            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Total Rejects</div>
                            <div style={{ fontSize: 14, color: '#666', marginTop: 12 }}>
                                CR: {data.previousMonth.crMrSummary.totalCrQty || 0} | MR: {data.previousMonth.crMrSummary.totalMrQty || 0}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Items */}
            <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
                {data?.topInwardItems && data.topInwardItems.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
                        <h3 style={{ marginBottom: 16 }}>Top Inward Items</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #eee' }}>
                                        <th style={{ textAlign: 'left', padding: 8, fontSize: 12, color: '#666' }}>Item</th>
                                        <th style={{ textAlign: 'right', padding: 8, fontSize: 12, color: '#666' }}>Qty</th>
                                        <th style={{ textAlign: 'right', padding: 8, fontSize: 12, color: '#666' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.topInwardItems.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: 8 }}>{item.itemName}</td>
                                            <td style={{ textAlign: 'right', padding: 8 }}>{item.totalQuantity}</td>
                                            <td style={{ textAlign: 'right', padding: 8 }}>₹{item.totalAmount?.toLocaleString('en-IN') || '0'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {data?.topOutwardItems && data.topOutwardItems.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
                        <h3 style={{ marginBottom: 16 }}>Top Outward Items</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #eee' }}>
                                        <th style={{ textAlign: 'left', padding: 8, fontSize: 12, color: '#666' }}>Item</th>
                                        <th style={{ textAlign: 'right', padding: 8, fontSize: 12, color: '#666' }}>OK Qty</th>
                                        <th style={{ textAlign: 'right', padding: 8, fontSize: 12, color: '#666' }}>CR/MR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.topOutwardItems.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: 8 }}>{item.itemName}</td>
                                            <td style={{ textAlign: 'right', padding: 8 }}>{item.totalOkQty}</td>
                                            <td style={{ textAlign: 'right', padding: 8 }}>
                                                {(item.totalCrQty || 0) + (item.totalMrQty || 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            {data?.recentActivities && data.recentActivities.length > 0 && (
            <div style={{ marginTop: 24 }}>
                <h3>Recent Activity</h3>
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            {data.recentActivities.map((a, idx) => (
                            <li key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                                {a.action} {a.entityType ? `on ${a.entityType}` : ''} {a.createdAt ? `at ${formatDateTime(a.createdAt)}` : ''}
                            </li>
                            ))}
                    </ul>
                </div>
            </div>
            )}
        </div>
    );
};

export default Dashboard;


