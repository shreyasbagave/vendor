import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getTodayDateString, formatDate } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

type Option = { _id: string; name: string };
type ItemOption = { _id: string; name: string; currentStock: number };

interface OutwardEntry {
    _id: string;
    date: string;
    challanNo: string;
    vehicleNumber?: string;
    customer: {
        _id: string;
        name: string;
    };
    item: {
        _id: string;
        name: string;
    };
    okQty: number;
    crQty: number;
    mrQty: number;
    asCastQty: number;
    totalQty: number;
    createdBy: {
        _id: string;
        name: string;
        email: string;
    };
    createdAt: string;
}

const OutwardPage: React.FC = () => {
    const { api } = useAuth();
    const [date, setDate] = useState<string>(() => getTodayDateString());
    const [challan, setChallan] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [customer, setCustomer] = useState('');
    const [item, setItem] = useState('');
    const [okQty, setOkQty] = useState<number | ''>('');
    const [crQty, setCrQty] = useState<number | ''>('');
    const [mrQty, setMrQty] = useState<number | ''>('');
    const [asCastQty, setAsCastQty] = useState<number | ''>('');
    const [totalQtyInput, setTotalQtyInput] = useState<number | ''>('');
    // unit removed
    // rate removed
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [customers, setCustomers] = useState<Option[]>([]);
    const [items, setItems] = useState<ItemOption[]>([]);
    const [selectedItemStock, setSelectedItemStock] = useState<number>(0);
    const [entries, setEntries] = useState<OutwardEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = useState(false);
    const [editingEntry, setEditingEntry] = useState<OutwardEntry | null>(null);

    const loadRefs = async () => {
        try {
            const [cus, its] = await Promise.all([
                api.get<any>('/customers?limit=100'),
                api.get<any>('/items?limit=100')
            ]);
            setCustomers((cus.data?.data || []).map((s: any) => ({ _id: s._id, name: s.name })));
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
            const response = await api.get('/outward?limit=10');
            if (response.data?.success) {
                setEntries(response.data.data);
            }
        } catch (err) {
            console.error('Failed to load entries:', err);
        } finally {
            setEntriesLoading(false);
        }
    };

    // Calculate net good quantity (OK minus rejections)
    const cr = crQty === '' ? 0 : Number(crQty);
    const mr = mrQty === '' ? 0 : Number(mrQty);
    const ok = okQty === '' ? 0 : Number(okQty);
    const netGoodQty = ok - cr - mr;
    
    // Auto-calculate As Cast from item stock: As Cast = Item Stock - OK Dispatched
    const calculatedAsCast = selectedItemStock - ok;
    
    // Calculate total quantity: Total = OK + As Cast
    const calculatedTotalQty = ok + (calculatedAsCast >= 0 ? calculatedAsCast : 0);

    // Handler for when Total Quantity is manually entered (not needed anymore, but kept for compatibility)
    const handleTotalQtyChange = (value: number | '') => {
        setTotalQtyInput(value);
        // Note: As Cast is now auto-calculated from item stock, not from total input
    };
    
    // Handler for item selection - updates stock and auto-calculates As Cast
    const handleItemChange = (itemId: string) => {
        setItem(itemId);
        const selectedItem = items.find(i => i._id === itemId);
        if (selectedItem) {
            setSelectedItemStock(selectedItem.currentStock);
            // As Cast will auto-calculate based on new stock and current OK qty
        } else {
            setSelectedItemStock(0);
        }
        setTotalQtyInput(''); // Clear manual total input
    };

    // Handler for individual quantity fields with validation
    const handleOkQtyChange = (value: number | '') => {
        if (value === '' || Number(value) >= 0) {
            setOkQty(value);
            setTotalQtyInput(''); // Clear manual total when editing individual fields
        }
    };

    const handleCrQtyChange = (value: number | '') => {
        if (value === '' || Number(value) >= 0) {
            setCrQty(value);
            setTotalQtyInput(''); // Clear manual total when editing individual fields
        }
    };

    const handleMrQtyChange = (value: number | '') => {
        if (value === '' || Number(value) >= 0) {
            setMrQty(value);
            setTotalQtyInput(''); // Clear manual total when editing individual fields
        }
    };

    const handleAsCastQtyChange = (value: number | '') => {
        if (value === '' || Number(value) >= 0) {
            setAsCastQty(value);
            setTotalQtyInput(''); // Clear manual total when editing individual fields
        }
    };

    // Use manual total if entered, otherwise use calculated total
    const totalQty = totalQtyInput !== '' ? Number(totalQtyInput) : calculatedTotalQty;

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
        if (!customer || customer.trim() === '') {
            setError('Please select a customer');
            return;
        }
        if (!item || item.trim() === '') {
            setError('Please select an item');
            return;
        }
        
        const ok = okQty === '' ? 0 : Number(okQty);
        const cr = crQty === '' ? 0 : Number(crQty);
        const mr = mrQty === '' ? 0 : Number(mrQty);
        
        // Validate CR + MR don't exceed OK (since they're part of OK)
        if (cr + mr > ok) {
            setError('CR + MR quantities cannot exceed OK quantity (they are part of OK)');
            return;
        }
        
        // Validate OK doesn't exceed available stock
        if (ok > selectedItemStock) {
            setError(`OK quantity (${ok}) cannot exceed available item stock (${selectedItemStock})`);
            return;
        }
        
        if (ok <= 0) {
            setError('OK quantity must be greater than 0');
            return;
        }
        
        setLoading(true);
        try {
            // Backend will auto-calculate As Cast as remaining stock
            await api.post('/outward', {
                date,
                challanNo: challan.trim(),
                vehicleNumber: vehicleNumber.trim(),
                customer: customer.trim(),
                item: item.trim(),
                okQty: ok,
                crQty: cr,
                mrQty: mr
            });
            setChallan(''); 
            setVehicleNumber('');
            setCustomer(''); 
            setItem(''); 
            setSelectedItemStock(0);
            setOkQty(''); 
            setCrQty(''); 
            setMrQty(''); 
            setAsCastQty('');
            setTotalQtyInput('');
            alert('Outward entry added successfully');
            // Refresh both entries and items (to show updated stock)
            await loadRefs(); // Refresh items with updated stock
            loadEntries(); // Refresh outward entries list
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
        if (!window.confirm('Are you sure you want to delete this outward entry?')) return;
        
        try {
            await api.delete(`/outward/${entryId}`);
            setEntries(entries.filter(entry => entry._id !== entryId));
            alert('Outward entry deleted successfully');
            // Refresh items to show updated stock after deletion
            await loadRefs();
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Failed to delete entry');
        }
    };

    const handleEdit = (entry: OutwardEntry) => {
        setEditingEntry(entry);
        setDate(entry.date.split('T')[0]);
        setChallan(entry.challanNo);
        setVehicleNumber(entry.vehicleNumber || '');
        setCustomer(entry.customer._id);
        setItem(entry.item._id);
        
        // Set selected item stock
        const selectedItem = items.find(i => i._id === entry.item._id);
        if (selectedItem) {
            setSelectedItemStock(selectedItem.currentStock);
        }
        
        setOkQty(entry.okQty);
        setCrQty(entry.crQty);
        setMrQty(entry.mrQty);
        setAsCastQty(entry.asCastQty);
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
        if (!customer || customer.trim() === '') {
            setError('Please select a customer');
            return;
        }
        if (!item || item.trim() === '') {
            setError('Please select an item');
            return;
        }
        
        const ok = okQty === '' ? 0 : Number(okQty);
        const cr = crQty === '' ? 0 : Number(crQty);
        const mr = mrQty === '' ? 0 : Number(mrQty);
        
        // Validate CR + MR don't exceed OK (since they're part of OK)
        if (cr + mr > ok) {
            setError('CR + MR quantities cannot exceed OK quantity (they are part of OK)');
            return;
        }
        
        // Validate OK doesn't exceed available stock (account for the current entry being updated)
        const availableStockForUpdate = selectedItemStock + editingEntry.okQty;
        if (ok > availableStockForUpdate) {
            setError(`OK quantity (${ok}) cannot exceed available item stock (${availableStockForUpdate})`);
            return;
        }
        
        if (ok <= 0) {
            setError('OK quantity must be greater than 0');
            return;
        }
        
        setLoading(true);
        try {
            // Backend will auto-calculate As Cast as remaining stock
            await api.put(`/outward/${editingEntry._id}`, {
                date,
                challanNo: challan.trim(),
                vehicleNumber: vehicleNumber.trim(),
                customer: customer.trim(),
                item: item.trim(),
                okQty: ok,
                crQty: cr,
                mrQty: mr
            });
            setChallan(''); 
            setVehicleNumber('');
            setCustomer(''); 
            setItem(''); 
            setSelectedItemStock(0);
            setOkQty(''); 
            setCrQty(''); 
            setMrQty(''); 
            setAsCastQty('');
            setTotalQtyInput('');
            setEditingEntry(null);
            alert('Outward entry updated successfully');
            // Refresh both entries and items (to show updated stock)
            await loadRefs(); // Refresh items with updated stock
            loadEntries(); // Refresh outward entries list
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
        setChallan(''); setVehicleNumber(''); setCustomer(''); setItem(''); setSelectedItemStock(0); setOkQty(''); setCrQty(''); setMrQty(''); setAsCastQty(''); setTotalQtyInput('');
        setDate(getTodayDateString());
    };

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            <div style={{ maxWidth: 920, margin: '0 auto' }}>
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>Outward Stock</h2>
                    <div style={{ color: '#666' }}>Dispatch stock to customers and track rejections</div>
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
                        <div className="responsive-form" style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Date</label>
                                    <DateInput value={date} onChange={setDate} required style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Challan No</label>
                                    <input value={challan} onChange={e => setChallan(e.target.value)} required placeholder="e.g. CH/2025/101" style={{ width: '100%', boxSizing: 'border-box' }} />
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
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Customer</label>
                                    <select value={customer} onChange={e => setCustomer(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <option value="">Select customer</option>
                                        {customers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Item</label>
                                    <select value={item} onChange={e => handleItemChange(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <option value="">Select item</option>
                                        {items.map(i => <option key={i._id} value={i._id}>{i.name} (Stock: {i.currentStock})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Production Dispatch Quantities</div>

                                {/* Item Stock Display */}
                                {item && (
                                    <div style={{ marginBottom: 16, padding: 12, background: '#ecfdf5', border: '2px solid #10b981', borderRadius: 8 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#065f46', marginBottom: 4 }}>
                                            📦 Current Item Stock in Workshop
                                        </div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#047857' }}>
                                            {Math.round(selectedItemStock)} units
                                        </div>
                                        <div style={{ fontSize: 11, color: '#065f46', marginTop: 4 }}>
                                            💡 As Cast (remaining after dispatch) = {Math.round(selectedItemStock)} - OK Qty
                                        </div>
                                    </div>
                                )}

                                {/* Individual Quantity Fields */}
                                <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                                    <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 8, padding: 10 }}>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#166534' }}>
                                            OK Qty 📦
                                        </label>
                                        <input 
                                            type="number" 
                                            min={0} 
                                            step={1} 
                                            value={okQty} 
                                            onChange={e => handleOkQtyChange(e.target.value === '' ? '' : Number(e.target.value))} 
                                            placeholder="0" 
                                            style={{ 
                                                width: '100%', 
                                                boxSizing: 'border-box',
                                                border: '1px solid #86efac',
                                                padding: '8px',
                                                borderRadius: 4
                                            }} 
                                        />
                                        <div style={{ fontSize: 10, color: '#166534', marginTop: 4, fontWeight: 600 }}>
                                            Total dispatched<br/>(includes CR & MR)
                                        </div>
                                    </div>
                                    <div style={{ background: '#fff7ed', border: '2px solid #fdba74', borderRadius: 8, padding: 10 }}>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#9a3412' }}>
                                            CR Qty ↩
                                        </label>
                                        <input 
                                            type="number" 
                                            min={0} 
                                            step={1} 
                                            value={crQty} 
                                            onChange={e => handleCrQtyChange(e.target.value === '' ? '' : Number(e.target.value))} 
                                            placeholder="0" 
                                            style={{ 
                                                width: '100%', 
                                                boxSizing: 'border-box',
                                                border: '1px solid #fdba74',
                                                padding: '8px',
                                                borderRadius: 4
                                            }} 
                                        />
                                        <div style={{ fontSize: 10, color: '#9a3412', marginTop: 4, fontWeight: 600 }}>
                                            Part of OK<br/>(Customer return)
                                        </div>
                                    </div>
                                    <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: 8, padding: 10 }}>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#991b1b' }}>
                                            MR Qty ✗
                                        </label>
                                        <input 
                                            type="number" 
                                            min={0} 
                                            step={1} 
                                            value={mrQty} 
                                            onChange={e => handleMrQtyChange(e.target.value === '' ? '' : Number(e.target.value))} 
                                            placeholder="0" 
                                            style={{ 
                                                width: '100%', 
                                                boxSizing: 'border-box',
                                                border: '1px solid #fca5a5',
                                                padding: '8px',
                                                borderRadius: 4
                                            }} 
                                        />
                                        <div style={{ fontSize: 10, color: '#991b1b', marginTop: 4, fontWeight: 600 }}>
                                            Part of OK<br/>(Material defect)
                                        </div>
                                    </div>
                                    <div style={{ background: '#faf5ff', border: '3px solid #fbbf24', borderRadius: 8, padding: 10 }}>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#6b21a8' }}>
                                            As Cast 🏭 (Auto)
                                        </label>
                                        <div
                                            style={{ 
                                                width: '100%', 
                                                boxSizing: 'border-box',
                                                background: '#fef3c7',
                                                border: '2px solid #fbbf24',
                                                padding: '8px',
                                                borderRadius: 4,
                                                fontWeight: 700,
                                                fontSize: 18,
                                                textAlign: 'center',
                                                color: calculatedAsCast >= 0 ? '#047857' : '#dc2626'
                                            }} 
                                        >
                                            {calculatedAsCast >= 0 ? Math.round(calculatedAsCast) : '0'}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#6b21a8', marginTop: 4, fontWeight: 600 }}>
                                            ⚡ Auto: {Math.round(selectedItemStock)} - {Math.round(ok)}
                                        </div>
                                    </div>
                                </div>

                                {/* Calculation Display */}
                                <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Dispatched (OK):</div>
                                            <div style={{ padding: '6px 12px', borderRadius: 6, background: ok > 0 ? '#16a34a' : '#e5e7eb', color: ok > 0 ? 'white' : '#6b7280', fontWeight: 700, fontSize: 16, display: 'inline-block' }}>
                                                {Math.round(ok)}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                                Leaves workshop
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Remaining (As Cast):</div>
                                            <div style={{ padding: '6px 12px', borderRadius: 6, background: calculatedAsCast >= 0 ? '#7c3aed' : '#e5e7eb', color: calculatedAsCast >= 0 ? 'white' : '#6b7280', fontWeight: 700, fontSize: 16, display: 'inline-block' }}>
                                                {Math.round(calculatedAsCast >= 0 ? calculatedAsCast : 0)}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                                Stays in workshop
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Net Good (Approved):</div>
                                            <div style={{ padding: '6px 12px', borderRadius: 6, background: netGoodQty >= 0 ? '#3b82f6' : '#ef4444', color: 'white', fontWeight: 700, fontSize: 16, display: 'inline-block' }}>
                                                {Math.round(netGoodQty)}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                                OK - CR - MR
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', justifyContent: 'space-between', alignItems: window.innerWidth < 768 ? 'stretch' : 'center', gap: 12, background: '#fafafa', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ color: '#555', fontSize: window.innerWidth < 768 ? 14 : 16 }}>
                                    Dispatch: <strong style={{ color: '#16a34a' }}>{Math.round(ok)}</strong> | 
                                    Remaining: <strong style={{ color: '#7c3aed' }}>{Math.round(calculatedAsCast >= 0 ? calculatedAsCast : 0)}</strong> | 
                                    Net Good: <strong style={{ color: '#3b82f6' }}>{Math.round(netGoodQty)}</strong>
                                </div>
                                {editingEntry && (
                                    <button type="button" onClick={handleCancelEdit} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', flex: window.innerWidth < 768 ? '1' : 'initial' }}>
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                            <button type="submit" disabled={loading || ok <= 0} style={{ width: window.innerWidth < 768 ? '100%' : 'auto' }}>
                                {loading ? 'Saving...' : editingEntry ? 'Update Entry' : 'Save Entry'}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Recent Entries Section */}
                <div style={{ marginTop: 24 }}>
                    <div style={{ marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>Recent Outward Stock Statements</h3>
                        <div style={{ color: '#666', fontSize: 14 }}>Latest outward stock entries</div>
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
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Customer</th>
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Item</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>OK</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>CR</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>MR</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>As Cast</th>
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
                                                    {entry.customer.name}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                    {entry.item.name}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {Math.round(entry.okQty)}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {Math.round(entry.crQty)}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {Math.round(entry.mrQty)}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {Math.round(entry.asCastQty)}
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
                                                <td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                                                    No outward entries found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {entries.length > 0 && (
                                        <tfoot style={{ position: 'sticky', bottom: 0, background: '#1f2937', color: 'white', fontWeight: 700 }}>
                                            <tr>
                                                <td colSpan={5} style={{ padding: 12, borderTop: '2px solid #374151', textAlign: 'right' }}>
                                                    <strong>TOTAL SUMMARY:</strong>
                                                </td>
                                                <td style={{ padding: 12, borderTop: '2px solid #374151', textAlign: 'right' }}>
                                                    {Math.round(entries.reduce((sum, entry) => sum + entry.okQty, 0))}
                                                </td>
                                                <td style={{ padding: 12, borderTop: '2px solid #374151', textAlign: 'right' }}>
                                                    {Math.round(entries.reduce((sum, entry) => sum + entry.crQty, 0))}
                                                </td>
                                                <td style={{ padding: 12, borderTop: '2px solid #374151', textAlign: 'right' }}>
                                                    {Math.round(entries.reduce((sum, entry) => sum + entry.mrQty, 0))}
                                                </td>
                                                <td style={{ padding: 12, borderTop: '2px solid #374151', textAlign: 'center', fontStyle: 'italic', fontSize: 12 }}>
                                                    Remaining Stock
                                                </td>
                                                <td style={{ padding: 12, borderTop: '2px solid #374151', textAlign: 'center' }}>
                                                    {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OutwardPage;


