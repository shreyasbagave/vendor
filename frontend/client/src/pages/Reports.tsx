import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../utils/dateUtils';

const ReportsPage: React.FC = () => {
    const { api } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dashboard, setDashboard] = useState<any>(null);
    const [monthly, setMonthly] = useState<any>(null);

    const [month, setMonth] = useState<string>('');
    const [year, setYear] = useState<string>('');

    const monthOptions = useMemo(() => [
        { v: '1', l: 'January' }, { v: '2', l: 'February' }, { v: '3', l: 'March' },
        { v: '4', l: 'April' }, { v: '5', l: 'May' }, { v: '6', l: 'June' },
        { v: '7', l: 'July' }, { v: '8', l: 'August' }, { v: '9', l: 'September' },
        { v: '10', l: 'October' }, { v: '11', l: 'November' }, { v: '12', l: 'December' }
    ], []);
    const yearOptions = useMemo(() => {
        const current = new Date().getFullYear();
        const years: Array<string> = [];
        for (let y = current; y >= current - 10; y--) years.push(String(y));
        return years;
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await api.get<any>('/dashboard/overview');
                if (res.data?.success) {
                    const d = res.data.data;
                    const mapped = {
                        inwardMonthlyTotal: d?.inward?.totalQuantity ?? 0,
                        outwardMonthlyTotal: d?.outward?.totalQuantity ?? 0,
                        rejectSummary: d?.crMrSummary?.totalRejects ?? 0,
                        currentStockBalance: d?.currentStock?.totalStock ?? 0,
                    };
                    setDashboard(mapped);
                } else {
                    setError('Failed to load dashboard');
                }
            } catch (e: any) {
                setError(e?.message || 'Failed to load dashboard');
            } finally { setLoading(false); }
        })();
    }, [api]);

    const exportExcel = async () => {
        if (!month || !year) { alert('Please select month and year'); return; }
        try {
            const res = await api.get(`/reports/export/excel?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`, { responseType: 'blob' } as any);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'report.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (e: any) { alert(e?.message || 'Export failed'); }
    };

    const loadMonthly = async () => {
        if (!month || !year) { alert('Please select month and year'); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await api.get<any>(`/reports/monthly?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}&includeDetails=true`);
            if (res.data?.success) {
                setMonthly(res.data.data);
            } else {
                setError('Failed to load monthly report');
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load monthly report');
        } finally {
            setLoading(false);
        }
    };

    const exportPdf = async () => {
        if (!month || !year) { alert('Please select month and year'); return; }
        try {
            const res = await api.get(`/reports/export/pdf?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`, { responseType: 'blob' } as any);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'report.pdf');
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (e: any) { alert(e?.message || 'Export failed'); }
    };

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            <h2>Reports</h2>
            {loading ? <div>Loading...</div> : error ? <div style={{ color: '#d33' }}>{error}</div> : (
                <div>
                    <div className="filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <select value={month} onChange={e => setMonth(e.target.value)} style={{ flex: window.innerWidth < 768 ? '1 1 100%' : '1 1 150px', boxSizing: 'border-box' }}>
                            <option value="">Select Month</option>
                            {monthOptions.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                        <select value={year} onChange={e => setYear(e.target.value)} style={{ flex: window.innerWidth < 768 ? '1 1 100%' : '1 1 120px', boxSizing: 'border-box' }}>
                            <option value="">Select Year</option>
                            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={loadMonthly} style={{ flex: window.innerWidth < 768 ? '1 1 100%' : 'initial' }}>Load Logs</button>
                    </div>
                    <div className="card-grid">
                        <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                            <div style={{ fontSize: 12, color: '#666' }}>Total Inward Qty (monthly)</div>
                            <div style={{ fontSize: 24, fontWeight: 600 }}>{dashboard?.inwardMonthlyTotal ?? '-'}</div>
                        </div>
                        <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                            <div style={{ fontSize: 12, color: '#666' }}>Total Outward Qty (monthly)</div>
                            <div style={{ fontSize: 24, fontWeight: 600 }}>{dashboard?.outwardMonthlyTotal ?? '-'}</div>
                        </div>
                        <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                            <div style={{ fontSize: 12, color: '#666' }}>CR & MR summary</div>
                            <div style={{ fontSize: 24, fontWeight: 600 }}>{dashboard?.rejectSummary ?? '-'}</div>
                        </div>
                        <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                            <div style={{ fontSize: 12, color: '#666' }}>Current Stock Balance</div>
                            <div style={{ fontSize: 24, fontWeight: 600 }}>{dashboard?.currentStockBalance ?? '-'}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                        <button onClick={exportExcel} style={{ flex: window.innerWidth < 768 ? '1 1 calc(50% - 4px)' : 'initial' }}>Export Excel</button>
                        <button onClick={exportPdf} style={{ flex: window.innerWidth < 768 ? '1 1 calc(50% - 4px)' : 'initial' }}>Export PDF</button>
                    </div>

                    {/* Logs Section */}
                    {monthly && (
                        <div style={{ marginTop: 24 }}>
                            <h3 style={{ margin: '8px 0' }}>Stock Statement Logs ({monthly?.period?.monthName} {monthly?.period?.year})</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                <style>{`
                                    @media (min-width: 768px) {
                                        .logs-grid { grid-template-columns: 1fr 1fr !important; }
                                    }
                                `}</style>
                                <div className="logs-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                    {/* Inward Table */}
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Inward</div>
                                        <div style={{ overflow: 'auto', border: '1px solid #eee', borderRadius: 6, WebkitOverflowScrolling: 'touch' }}>
                                            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#fafafa' }}>
                                                        <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Date</th>
                                                        <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Ch.No</th>
                                                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>Quantity</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(monthly?.detailedInward || []).map((row: any, idx: number) => {
                                                        const isAdjustment = row.isAdjustment === true;
                                                        const isOpeningStock = row.isOpeningStock === true;
                                                        const adjustmentQty = row.adjustmentQuantity || row.quantityReceived || 0;
                                                        return (
                                                            <tr key={idx}>
                                                                <td style={{ 
                                                                    padding: 8, 
                                                                    borderBottom: '1px solid #f0f0f0',
                                                                    textAlign: 'left',
                                                                    fontWeight: isOpeningStock ? 500 : 'normal',
                                                                    color: isOpeningStock ? '#6c757d' : 'inherit'
                                                                }}>
                                                                    {isOpeningStock ? (
                                                                        formatDate(row.date) // Show first day of month
                                                                    ) : isAdjustment ? (
                                                                        <span>Adjusted Quantity</span>
                                                                    ) : (
                                                                        formatDate(row.date)
                                                                    )}
                                                                </td>
                                                                <td style={{ 
                                                                    padding: 8, 
                                                                    borderBottom: '1px solid #f0f0f0',
                                                                    fontWeight: isOpeningStock ? 600 : 'normal',
                                                                    color: isOpeningStock ? '#495057' : 'inherit'
                                                                }}>
                                                                    {row.challanNo || 'ADJ'}
                                                                </td>
                                                                <td style={{ 
                                                                    padding: 8, 
                                                                    borderBottom: '1px solid #f0f0f0', 
                                                                    textAlign: 'right',
                                                                    fontWeight: isAdjustment || isOpeningStock ? 600 : 'normal',
                                                                    color: isAdjustment ? (adjustmentQty >= 0 ? '#28a745' : '#dc3545') : 'inherit'
                                                                }}>
                                                                    {isOpeningStock ? (
                                                                        row.quantityReceived || row.openingStock || 0
                                                                    ) : isAdjustment ? (
                                                                        <span>{adjustmentQty >= 0 ? '+' : ''}{adjustmentQty}</span>
                                                                    ) : (
                                                                        row.quantityReceived
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {(!monthly?.detailedInward || monthly.detailedInward.length === 0) && (
                                                        <tr><td colSpan={3} style={{ padding: 12, textAlign: 'center', color: '#888' }}>No inward entries</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Outward Table */}
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Outward</div>
                                        <div style={{ overflow: 'auto', border: '1px solid #eee', borderRadius: 6, WebkitOverflowScrolling: 'touch' }}>
                                            <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#fafafa' }}>
                                                        <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Date</th>
                                                        <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Ch.No</th>
                                                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>OK Qty</th>
                                                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>CR</th>
                                                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>MR</th>
                                                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>As Cast</th>
                                                        <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #eee' }}>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(monthly?.detailedOutward || []).map((row: any, idx: number) => (
                                                        <tr key={idx}>
                                                            <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{formatDate(row.date)}</td>
                                                            <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{row.challanNo}</td>
                                                            <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{row.okQty}</td>
                                                            <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{row.crQty}</td>
                                                            <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{row.mrQty}</td>
                                                            <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{row.asCastQty}</td>
                                                            <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>{row.totalQty}</td>
                                                        </tr>
                                                    ))}
                                                    {(!monthly?.detailedOutward || monthly.detailedOutward.length === 0) && (
                                                        <tr><td colSpan={7} style={{ padding: 12, textAlign: 'center', color: '#888' }}>No outward entries</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default ReportsPage;


