import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocation } from 'react-router-dom';

type Transaction = {
    _id: string;
    entryType: 'INWARD' | 'OUTWARD';
    date: string;
    dateTime: string;
    challanNo: string;
    quantity: number;
    party: string;
    partyType: string;
    vehicleNumber?: string;
    note: string;
    balanceAfter: number;
    details: any;
};

type ItemInfo = {
    _id: string;
    name: string;
    currentStock: number;
    unit: string;
};

type Summary = {
    totalInward: number;
    totalOutward: number;
    currentStock: number;
};

const TransactionHistory: React.FC = () => {
    const { api } = useAuth();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const itemId = searchParams.get('itemId');
    const itemName = searchParams.get('itemName') || 'Item';

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [item, setItem] = useState<ItemInfo | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (itemId) {
            loadTransactions();
        }
    }, [itemId]);

    const loadTransactions = async () => {
        if (!itemId) return;
        
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/transactions/item/${itemId}`);
            if (response.data?.success) {
                setTransactions(response.data.data.transactions || []);
                setItem(response.data.data.item);
                setSummary(response.data.data.summary);
            } else {
                setError('Failed to load transactions');
            }
        } catch (err: any) {
            console.error('Failed to load transactions:', err);
            setError(err?.response?.data?.message || 'Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ marginBottom: 8 }}>Transaction History</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#374151' }}>
                        {item?.name || itemName}
                    </div>
                    {item && (
                        <div style={{ 
                            padding: '4px 12px', 
                            background: '#10b981', 
                            color: 'white', 
                            borderRadius: 6, 
                            fontSize: 14, 
                            fontWeight: 600 
                        }}>
                            Current Stock: {item.currentStock.toFixed(2)} {item.unit}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(3, 1fr)', 
                    gap: 16, 
                    marginBottom: 24 
                }}>
                    <div style={{ 
                        padding: 20, 
                        background: '#ecfdf5', 
                        border: '2px solid #10b981', 
                        borderRadius: 12 
                    }}>
                        <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600, marginBottom: 4 }}>
                            Total Inward
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#047857' }}>
                            {summary.totalInward.toFixed(2)}
                        </div>
                    </div>
                    <div style={{ 
                        padding: 20, 
                        background: '#fef3c7', 
                        border: '2px solid #f59e0b', 
                        borderRadius: 12 
                    }}>
                        <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>
                            Total Outward
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#b45309' }}>
                            {summary.totalOutward.toFixed(2)}
                        </div>
                    </div>
                    <div style={{ 
                        padding: 20, 
                        background: '#dbeafe', 
                        border: '2px solid #3b82f6', 
                        borderRadius: 12 
                    }}>
                        <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600, marginBottom: 4 }}>
                            Available Stock
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#1d4ed8' }}>
                            {summary.currentStock.toFixed(2)}
                        </div>
                    </div>
                </div>
            )}

            {/* Loading/Error States */}
            {loading && <div style={{ textAlign: 'center', padding: 40 }}>Loading transactions...</div>}
            {error && <div style={{ color: '#dc2626', padding: 16, background: '#fee2e2', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

            {/* Transactions Table */}
            {!loading && !error && (
                <div style={{ 
                    overflowX: 'auto', 
                    background: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: 12,
                    WebkitOverflowScrolling: 'touch' 
                }}>
                    <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#374151' }}>Date & Time</th>
                                <th style={{ padding: 16, textAlign: 'center', fontWeight: 600, color: '#374151' }}>Type</th>
                                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#374151' }}>Challan No</th>
                                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#374151' }}>Party</th>
                                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#374151' }}>Vehicle No</th>
                                <th style={{ padding: 16, textAlign: 'right', fontWeight: 600, color: '#374151' }}>Quantity</th>
                                <th style={{ padding: 16, textAlign: 'right', fontWeight: 600, color: '#374151' }}>Balance After</th>
                                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#374151' }}>Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                                        No transactions found for this item
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(tx => (
                                    <tr key={tx._id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ padding: 16, fontSize: 14, color: '#374151' }}>
                                            {formatDate(tx.dateTime)}
                                        </td>
                                        <td style={{ padding: 16, textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: 6,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: tx.entryType === 'INWARD' ? '#d1fae5' : '#fed7aa',
                                                color: tx.entryType === 'INWARD' ? '#065f46' : '#92400e'
                                            }}>
                                                {tx.entryType}
                                            </span>
                                        </td>
                                        <td style={{ padding: 16, fontSize: 14, color: '#374151', fontWeight: 500 }}>
                                            {tx.challanNo}
                                        </td>
                                        <td style={{ padding: 16, fontSize: 14, color: '#374151' }}>
                                            {tx.party}
                                            <div style={{ fontSize: 11, color: '#6b7280' }}>{tx.partyType}</div>
                                        </td>
                                        <td style={{ padding: 16, fontSize: 14, color: '#374151' }}>
                                            {tx.vehicleNumber || '-'}
                                        </td>
                                        <td style={{ 
                                            padding: 16, 
                                            textAlign: 'right', 
                                            fontSize: 16, 
                                            fontWeight: 600,
                                            color: tx.entryType === 'INWARD' ? '#059669' : '#dc2626'
                                        }}>
                                            {tx.entryType === 'INWARD' ? '+' : '-'}{tx.quantity.toFixed(2)}
                                        </td>
                                        <td style={{ 
                                            padding: 16, 
                                            textAlign: 'right', 
                                            fontSize: 16, 
                                            fontWeight: 700,
                                            color: '#1d4ed8'
                                        }}>
                                            {tx.balanceAfter.toFixed(2)}
                                        </td>
                                        <td style={{ padding: 16, fontSize: 13, color: '#6b7280', maxWidth: 200 }}>
                                            {tx.note || '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Info Box */}
            {!loading && transactions.length > 0 && (
                <div style={{ 
                    marginTop: 24, 
                    padding: 16, 
                    background: '#eff6ff', 
                    border: '1px solid #93c5fd', 
                    borderRadius: 8 
                }}>
                    <div style={{ fontSize: 14, color: '#1e40af', lineHeight: 1.6 }}>
                        <strong>📊 How it works:</strong><br/>
                        • <strong>INWARD</strong> entries <span style={{ color: '#059669' }}>add (+)</span> to your stock<br/>
                        • <strong>OUTWARD</strong> entries <span style={{ color: '#dc2626' }}>subtract (-)</span> from your stock<br/>
                        • <strong>Balance After</strong> shows the available stock after each transaction<br/>
                        • Current stock is automatically calculated from all transactions
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionHistory;

