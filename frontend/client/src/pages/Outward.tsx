import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getTodayDateString, formatDate } from '../utils/dateUtils';
import DateInput from '../components/DateInput';

type Option = { _id: string; name: string };

interface OutwardEntry {
    _id: string;
    date: string;
    challanNo: string;
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
    const [customer, setCustomer] = useState('');
    const [item, setItem] = useState('');
    const [okQty, setOkQty] = useState<number | ''>('');
    const [crQty, setCrQty] = useState<number | ''>('');
    const [mrQty, setMrQty] = useState<number | ''>('');
    const [asCastQty, setAsCastQty] = useState<number | ''>('');
    // unit removed
    // rate removed
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [customers, setCustomers] = useState<Option[]>([]);
    const [items, setItems] = useState<Option[]>([]);
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
            setItems((its.data?.data || []).map((i: any) => ({ _id: i._id, name: i.name })));
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

    const totalQty = (okQty === '' ? 0 : Number(okQty)) + (crQty === '' ? 0 : Number(crQty)) + (mrQty === '' ? 0 : Number(mrQty)) + (asCastQty === '' ? 0 : Number(asCastQty));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!customer || !item) { setError('Customer and Item are required'); return; }
        const ok = okQty === '' ? 0 : Number(okQty);
        const cr = crQty === '' ? 0 : Number(crQty);
        const mr = mrQty === '' ? 0 : Number(mrQty);
        const asCast = asCastQty === '' ? 0 : Number(asCastQty);
        if (ok + cr + mr + asCast <= 0) { setError('Total quantity must be > 0'); return; }
        setLoading(true);
        try {
            await api.post('/outward', {
                date,
                challanNo: challan,
                customer,
                item,
                okQty: ok,
                crQty: cr,
                mrQty: mr,
                asCastQty: asCast,
                
            });
            setChallan(''); setCustomer(''); setItem(''); setOkQty(''); setCrQty(''); setMrQty(''); setAsCastQty('');
            alert('Outward entry added');
            loadEntries(); // Reload entries after successful submission
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Save failed');
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
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Failed to delete entry');
        }
    };

    const handleEdit = (entry: OutwardEntry) => {
        setEditingEntry(entry);
        setDate(entry.date.split('T')[0]);
        setChallan(entry.challanNo);
        setCustomer(entry.customer._id);
        setItem(entry.item._id);
        setOkQty(entry.okQty);
        setCrQty(entry.crQty);
        setMrQty(entry.mrQty);
        setAsCastQty(entry.asCastQty);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEntry) return;
        
        setError(null);
        if (!customer || !item) { setError('Customer and Item are required'); return; }
        const ok = okQty === '' ? 0 : Number(okQty);
        const cr = crQty === '' ? 0 : Number(crQty);
        const mr = mrQty === '' ? 0 : Number(mrQty);
        const asCast = asCastQty === '' ? 0 : Number(asCastQty);
        if (ok + cr + mr + asCast <= 0) { setError('Total quantity must be > 0'); return; }
        setLoading(true);
        try {
            await api.put(`/outward/${editingEntry._id}`, {
                date,
                challanNo: challan,
                customer,
                item,
                okQty: ok,
                crQty: cr,
                mrQty: mr,
                asCastQty: asCast,
            });
            setChallan(''); setCustomer(''); setItem(''); setOkQty(''); setCrQty(''); setMrQty(''); setAsCastQty('');
            setEditingEntry(null);
            alert('Outward entry updated successfully');
            loadEntries();
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setChallan(''); setCustomer(''); setItem(''); setOkQty(''); setCrQty(''); setMrQty(''); setAsCastQty('');
        setDate(getTodayDateString());
    };

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            <div style={{ maxWidth: 920, margin: '0 auto' }}>
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>Outward Issue</h2>
                    <div style={{ color: '#666' }}>Issue stock to customers and track rejections</div>
                </div>

                {error && <div style={{ color: '#842029', background: '#f8d7da', border: '1px solid #f5c2c7', padding: 10, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

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
                                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Customer</label>
                                    <select value={customer} onChange={e => setCustomer(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <option value="">Select customer</option>
                                        {customers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
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

                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Quantities</div>
                                <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>OK Qty</label>
                                        <input type="number" min={0} step={0.01} value={okQty} onChange={e => setOkQty(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={{ width: '100%', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>CR Qty</label>
                                        <input type="number" min={0} step={0.01} value={crQty} onChange={e => setCrQty(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={{ width: '100%', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>MR Qty</label>
                                        <input type="number" min={0} step={0.01} value={mrQty} onChange={e => setMrQty(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={{ width: '100%', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>As Cast</label>
                                        <input type="number" min={0} step={0.01} value={asCastQty} onChange={e => setAsCastQty(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={{ width: '100%', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                    <div style={{ fontWeight: 600 }}>Total Quantity:</div>
                                    <div style={{ padding: '6px 10px', borderRadius: 8, background: '#f3f4f6', fontWeight: 600 }}>{totalQty.toFixed(2)}</div>
                                </div>
                                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>System prevents issuing more than available stock; CR/MR tracked for quality.</div>
                            </div>
                        </div>

                        <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', justifyContent: 'space-between', alignItems: window.innerWidth < 768 ? 'stretch' : 'center', gap: 12, background: '#fafafa', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ color: '#555', fontSize: window.innerWidth < 768 ? 14 : 16 }}>Total Qty: <strong>{totalQty.toFixed(2)}</strong></div>
                                {editingEntry && (
                                    <button type="button" onClick={handleCancelEdit} style={{ background: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', flex: window.innerWidth < 768 ? '1' : 'initial' }}>
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                            <button type="submit" disabled={loading || totalQty <= 0} style={{ width: window.innerWidth < 768 ? '100%' : 'auto' }}>
                                {loading ? 'Saving...' : editingEntry ? 'Update Issue' : 'Save Issue'}
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
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Customer</th>
                                            <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Item</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>OK</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>CR</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>MR</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>As Cast</th>
                                            <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #eee' }}>Total</th>
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
                                                    {entry.customer.name}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                    {entry.item.name}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {entry.okQty}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {entry.crQty}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {entry.mrQty}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                                                    {entry.asCastQty}
                                                </td>
                                                <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'right', fontWeight: 600 }}>
                                                    {entry.totalQty}
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


