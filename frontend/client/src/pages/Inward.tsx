import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getTodayDateString, formatDate } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

type Option = { _id: string; name: string; currentStock?: number };

interface InwardEntry {
    _id: string;
    date: string;
    challanNo: string;
    vehicleNumber?: string;
    supplier: {
        _id: string;
        name: string;
    };
    item: {
        _id: string;
        name: string;
    };
    quantityReceived: number;
    createdBy: {
        _id: string;
        name: string;
        email: string;
    };
    createdAt: string;
}

const InwardPage: React.FC = () => {
    const { api } = useAuth();
    const [date, setDate] = useState<string>(() => getTodayDateString());
    const [challan, setChallan] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [item, setItem] = useState('');
    const [quantityReceived, setQty] = useState<number | ''>('');
    // unit removed
    // rate removed
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [suppliers, setSuppliers] = useState<Option[]>([]);
    const [items, setItems] = useState<Option[]>([]);
    const [entries, setEntries] = useState<InwardEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = useState(false);
    const [editingEntry, setEditingEntry] = useState<InwardEntry | null>(null);
    
    // Adjust Stock Modal State
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [adjustItemId, setAdjustItemId] = useState('');
    const [adjustmentAmount, setAdjustmentAmount] = useState<number | ''>('');
    const [adjustReason, setAdjustReason] = useState('');
    const [adjustLoading, setAdjustLoading] = useState(false);
    const [adjustError, setAdjustError] = useState<string | null>(null);

    const loadRefs = async () => {
        try {
            const [sup, its] = await Promise.all([
                api.get<any>('/suppliers?limit=100'),
                api.get<any>('/items?limit=100')
            ]);
            setSuppliers((sup.data?.data || []).map((s: any) => ({ _id: s._id, name: s.name })));
            // Include currentStock in items for display
            setItems((its.data?.data || []).map((i: any) => ({ 
                _id: i._id, 
                name: i.name,
                currentStock: i.currentStock || 0
            })));
        } catch {}
    };

    useEffect(() => { 
        loadRefs(); 
        loadEntries();
    }, []);

    const loadEntries = async () => {
        setEntriesLoading(true);
        try {
            const response = await api.get('/inward?limit=10');
            if (response.data?.success) {
                setEntries(response.data.data);
            }
        } catch (err) {
            console.error('Failed to load entries:', err);
        } finally {
            setEntriesLoading(false);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        // Frontend validation
        if (!date || date.trim() === '') {
            setError('Date is required');
            return;
        }
        if (!challan || challan.trim() === '') {
            setError('Challan number is required');
            return;
        }
        if (!supplier || supplier.trim() === '') {
            setError('Please select a supplier');
            return;
        }
        if (!item || item.trim() === '') {
            setError('Please select an item');
            return;
        }
        
        const qty = quantityReceived === '' ? 0 : Number(quantityReceived);
        if (qty <= 0) {
            setError('Quantity must be greater than 0');
            return;
        }
        
        setLoading(true);
        try {
            await api.post('/inward', {
                date,
                challanNo: challan.trim(),
                vehicleNumber: vehicleNumber.trim(),
                supplier: supplier.trim(),
                item: item.trim(),
                quantityReceived: qty
            });
            setChallan(''); 
            setVehicleNumber('');
            setSupplier(''); 
            setItem(''); 
            setQty('');
            alert('Inward entry added successfully');
            // Refresh both entries and items (to show updated stock)
            await loadRefs(); // Refresh items with updated stock
            loadEntries(); // Refresh inward entries list
        } catch (err: any) {
            console.error('Submit error:', err);
            // Display detailed error messages
            if (err?.response?.data?.errors && Array.isArray(err.response.data.errors)) {
                const errorMessages = err.response.data.errors
                    .map((e: any) => `${e.field}: ${e.message}`)
                    .join('\n');
                setError(errorMessages);
            } else {
                setError(err?.response?.data?.message || err?.message || 'Failed to save entry');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (entryId: string) => {
        if (!window.confirm('Are you sure you want to delete this inward entry?')) return;
        
        try {
            await api.delete(`/inward/${entryId}`);
            setEntries(entries.filter(entry => entry._id !== entryId));
            alert('Inward entry deleted successfully');
            // Refresh items to show updated stock after deletion
            await loadRefs();
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Failed to delete entry');
        }
    };

    const handleEdit = (entry: InwardEntry) => {
        setEditingEntry(entry);
        setDate(entry.date.split('T')[0]);
        setChallan(entry.challanNo);
        setVehicleNumber(entry.vehicleNumber || '');
        setSupplier(entry.supplier._id);
        setItem(entry.item._id);
        setQty(entry.quantityReceived);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEntry) return;
        
        setError(null);
        
        // Frontend validation
        if (!date || date.trim() === '') {
            setError('Date is required');
            return;
        }
        if (!challan || challan.trim() === '') {
            setError('Challan number is required');
            return;
        }
        if (!supplier || supplier.trim() === '') {
            setError('Please select a supplier');
            return;
        }
        if (!item || item.trim() === '') {
            setError('Please select an item');
            return;
        }
        
        const qty = quantityReceived === '' ? 0 : Number(quantityReceived);
        if (qty <= 0) {
            setError('Quantity must be greater than 0');
            return;
        }
        
        setLoading(true);
        try {
            await api.put(`/inward/${editingEntry._id}`, {
                date,
                challanNo: challan.trim(),
                vehicleNumber: vehicleNumber.trim(),
                supplier: supplier.trim(),
                item: item.trim(),
                quantityReceived: qty
            });
            setChallan(''); 
            setVehicleNumber('');
            setSupplier(''); 
            setItem(''); 
            setQty('');
            setEditingEntry(null);
            alert('Inward entry updated successfully');
            // Refresh both entries and items (to show updated stock)
            await loadRefs(); // Refresh items with updated stock
            loadEntries(); // Refresh inward entries list
        } catch (err: any) {
            console.error('Update error:', err);
            // Display detailed error messages
            if (err?.response?.data?.errors && Array.isArray(err.response.data.errors)) {
                const errorMessages = err.response.data.errors
                    .map((e: any) => `${e.field}: ${e.message}`)
                    .join('\n');
                setError(errorMessages);
            } else {
                setError(err?.response?.data?.message || err?.message || 'Failed to update entry');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setChallan(''); setVehicleNumber(''); setSupplier(''); setItem(''); setQty('');
        setDate(getTodayDateString());
    };

    const handleAdjustStock = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdjustError(null);
        
        if (!adjustItemId || adjustItemId.trim() === '') {
            setAdjustError('Please select an item');
            return;
        }
        
        if (adjustmentAmount === '' || Number(adjustmentAmount) === 0) {
            setAdjustError('Adjustment amount is required and cannot be 0');
            return;
        }
        
        setAdjustLoading(true);
        try {
            const adjustment = Number(adjustmentAmount);
            const response = await api.post(`/items/${adjustItemId}/adjust`, {
                adjustment,
                reason: adjustReason.trim() || undefined
            });
            
            if (response.data?.success) {
                alert(`Stock adjusted successfully! Previous: ${response.data.data.previousStock}, New: ${response.data.data.newStock}`);
                setShowAdjustModal(false);
                setAdjustItemId('');
                setAdjustmentAmount('');
                setAdjustReason('');
                // Refresh items to show updated stock
                await loadRefs();
            }
        } catch (err: any) {
            console.error('Adjust stock error:', err);
            setAdjustError(err?.response?.data?.message || err?.message || 'Failed to adjust stock');
        } finally {
            setAdjustLoading(false);
        }
    };

    const handleCancelAdjust = () => {
        setShowAdjustModal(false);
        setAdjustItemId('');
        setAdjustmentAmount('');
        setAdjustReason('');
        setAdjustError(null);
    };

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            <div style={{ maxWidth: 920, margin: '0 auto' }}>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Inward Entry</h2>
                        <div style={{ color: '#666' }}>Record received stock with challan and party details</div>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setShowAdjustModal(true)}
                        style={{
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 500,
                            fontSize: 14,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Adjust Stock
                    </button>
                </div>

                {error && (
                    <div style={{ color: '#842029', background: '#f8d7da', border: '1px solid #f5c2c7', padding: 12, borderRadius: 8, marginBottom: 12, whiteSpace: 'pre-line', fontSize: 14 }}>
                        <strong>Error:</strong><br />
                        {error}
                    </div>
                )}

                <form onSubmit={editingEntry ? handleUpdate : submit}>
                    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', fontWeight: 600 }}>Basic Details</div>
                        <div className="responsive-form" style={{ padding: 16 }}>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Date</label>
                                    <DateInput value={date} onChange={setDate} required style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Challan No</label>
                                    <input value={challan} onChange={e => setChallan(e.target.value)} required placeholder="e.g. CH/2025/001" style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                            </div>

                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Vehicle Number</label>
                                    <input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. MH-12-AB-1234" style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                            </div>

                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Supplier</label>
                                    <select value={supplier} onChange={e => setSupplier(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <option value="">Select supplier</option>
                                        {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Item</label>
                                    <select value={item} onChange={e => setItem(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <option value="">Select item</option>
                                        {items.map(i => <option key={i._id} value={i._id}>{i.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Quantity Received</label>
                                    <input type="number" min={0} step={0.01} value={quantityReceived} onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))} required placeholder="Enter quantity" style={{ width: '100%', boxSizing: 'border-box' }} />
                                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>No negative quantity allowed. System checks duplicate challans per supplier.</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', justifyContent: 'space-between', alignItems: window.innerWidth < 768 ? 'stretch' : 'center', gap: 12, background: '#fafafa', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                            <div style={{ width: window.innerWidth < 768 ? '100%' : 'auto' }}>
                                {editingEntry && (
                                    <button type="button" onClick={handleCancelEdit} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', width: window.innerWidth < 768 ? '100%' : 'auto' }}>
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                            <button type="submit" disabled={loading} style={{ width: window.innerWidth < 768 ? '100%' : 'auto' }}>
                                {loading ? 'Saving...' : editingEntry ? 'Update Entry' : 'Save Entry'}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Recent Entries Section */}
                <div style={{ marginTop: 24 }}>
                    <div style={{ marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>Recent Inward Stock Statements</h3>
                        <div style={{ color: '#666', fontSize: 14 }}>Latest inward stock entries</div>
                    </div>

                    {entriesLoading ? (
                        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>Loading entries...</div>
                    ) : (
                        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12 }}>
                            <div style={{ overflow: 'auto', maxHeight: '400px', WebkitOverflowScrolling: 'touch' }}>
                                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#fafafa' }}>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Date</th>
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Challan No</th>
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Vehicle No</th>
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Supplier</th>
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Item</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>Qty</th>
                                            <th style={{ textAlign: 'center', padding: 12, borderBottom: '1px solid #eee' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry) => (
                                            <tr key={entry._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                    {formatDate(entry.date)}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                    {entry.challanNo}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                    {entry.vehicleNumber || '-'}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                    {entry.supplier.name}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                    {entry.item.name}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {entry.quantityReceived}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                                        <button 
                                                            onClick={() => handleEdit(entry)}
                                                            style={{ 
                                                                background: '#ffc107', 
                                                                color: 'black', 
                                                                border: 'none', 
                                                                padding: '6px 12px', 
                                                                borderRadius: 4,
                                                                cursor: 'pointer',
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(entry._id)}
                                                            style={{ 
                                                                background: '#dc3545', 
                                                                color: 'white', 
                                                                border: 'none', 
                                                                padding: '6px 12px', 
                                                                borderRadius: 4,
                                                                cursor: 'pointer',
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {entries.length === 0 && (
                                            <tr>
                                                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                                                    No inward entries found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Adjust Stock Modal */}
                {showAdjustModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: 20
                    }} onClick={(e) => {
                        if ((e.target === e.currentTarget) && !adjustLoading) {
                            handleCancelAdjust();
                        }
                    }}>
                        <div style={{
                            background: '#fff',
                            borderRadius: 12,
                            padding: 24,
                            maxWidth: 500,
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ marginBottom: 20 }}>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Adjust Stock</h3>
                                <div style={{ color: '#666', fontSize: 14, marginTop: 4 }}>
                                    Manually adjust stock quantity for any item
                                </div>
                            </div>

                            {adjustError && (
                                <div style={{ 
                                    color: '#842029', 
                                    background: '#f8d7da', 
                                    border: '1px solid #f5c2c7', 
                                    padding: 12, 
                                    borderRadius: 6, 
                                    marginBottom: 16,
                                    fontSize: 14 
                                }}>
                                    {adjustError}
                                </div>
                            )}

                            <form onSubmit={handleAdjustStock}>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                                        Item <span style={{ color: '#dc3545' }}>*</span>
                                    </label>
                                    <select 
                                        value={adjustItemId} 
                                        onChange={e => setAdjustItemId(e.target.value)} 
                                        required 
                                        style={{ 
                                            width: '100%', 
                                            padding: 10, 
                                            border: '1px solid #ddd', 
                                            borderRadius: 6,
                                            fontSize: 14,
                                            boxSizing: 'border-box'
                                        }}
                                        disabled={adjustLoading}
                                    >
                                        <option value="">Select item</option>
                                        {items.map(i => <option key={i._id} value={i._id}>{i.name}</option>)}
                                    </select>
                                    {adjustItemId && (() => {
                                        const selectedItem = items.find(i => i._id === adjustItemId);
                                        return selectedItem && (
                                            <div style={{ fontSize: 12, color: '#666', marginTop: 4, padding: 8, background: '#f8f9fa', borderRadius: 4 }}>
                                                Current Stock: <strong>{selectedItem.currentStock || 0}</strong>
                                                {adjustmentAmount !== '' && adjustmentAmount !== 0 && (
                                                    <span style={{ marginLeft: 12 }}>
                                                        → New Stock: <strong>{((selectedItem.currentStock || 0) + Number(adjustmentAmount)).toFixed(2)}</strong>
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                                        Adjustment Amount <span style={{ color: '#dc3545' }}>*</span>
                                    </label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={adjustmentAmount} 
                                        onChange={e => setAdjustmentAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                                        required 
                                        placeholder="Enter positive or negative number (e.g., 10 or -5)"
                                        style={{ 
                                            width: '100%', 
                                            padding: 10, 
                                            border: '1px solid #ddd', 
                                            borderRadius: 6,
                                            fontSize: 14,
                                            boxSizing: 'border-box'
                                        }}
                                        disabled={adjustLoading}
                                    />
                                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                        Use positive number to increase stock, negative to decrease
                                    </div>
                                </div>

                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
                                        Reason (Optional)
                                    </label>
                                    <textarea 
                                        value={adjustReason} 
                                        onChange={e => setAdjustReason(e.target.value)} 
                                        placeholder="Enter reason for stock adjustment"
                                        rows={3}
                                        style={{ 
                                            width: '100%', 
                                            padding: 10, 
                                            border: '1px solid #ddd', 
                                            borderRadius: 6,
                                            fontSize: 14,
                                            boxSizing: 'border-box',
                                            resize: 'vertical',
                                            fontFamily: 'inherit'
                                        }}
                                        disabled={adjustLoading}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                    <button 
                                        type="button" 
                                        onClick={handleCancelAdjust}
                                        disabled={adjustLoading}
                                        style={{ 
                                            background: '#6c757d', 
                                            color: 'white', 
                                            border: 'none', 
                                            padding: '10px 20px', 
                                            borderRadius: 6,
                                            cursor: adjustLoading ? 'not-allowed' : 'pointer',
                                            fontSize: 14,
                                            fontWeight: 500,
                                            opacity: adjustLoading ? 0.6 : 1
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={adjustLoading}
                                        style={{ 
                                            background: adjustLoading ? '#ccc' : '#28a745', 
                                            color: 'white', 
                                            border: 'none', 
                                            padding: '10px 20px', 
                                            borderRadius: 6,
                                            cursor: adjustLoading ? 'not-allowed' : 'pointer',
                                            fontSize: 14,
                                            fontWeight: 500
                                        }}
                                    >
                                        {adjustLoading ? 'Adjusting...' : 'Adjust Stock'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InwardPage;


