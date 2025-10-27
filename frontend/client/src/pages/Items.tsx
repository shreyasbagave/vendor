import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

type Item = {
    _id: string;
    name: string;
    description?: string;
    category: string;
    unit: string;
    minimumStock?: number;
    currentStock?: number;
};

type ItemsResponse = {
    success: boolean;
    data: Item[];
    total: number;
};

const defaultUnit = 'pcs';

const ItemsPage: React.FC = () => {
    const { api } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState<Item[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');

    const query = useMemo(() => {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(limit));
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        return params.toString();
    }, [page, limit, search, category]);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get<ItemsResponse>(`/items?${query}`);
            if (res.data?.success) {
                setItems(res.data.data || []);
                setTotal(res.data.total || 0);
            } else {
                setError('Failed to load items');
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load items');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);

    const [formOpen, setFormOpen] = useState(false);
    const [editItem, setEditItem] = useState<Item | null>(null);
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [cat, setCat] = useState('');
    // unit removed
    const [minStock, setMinStock] = useState<number | ''>('');

    const openCreate = () => {
        setEditItem(null);
        setName('');
        setDesc('');
        setCat('');
        // unit removed
        setMinStock('');
        setFormOpen(true);
    };

    const openEdit = (it: Item) => {
        setEditItem(it);
        setName(it.name);
        setDesc(it.description || '');
        setCat(it.category || '');
        // unit removed
        setMinStock(typeof it.minimumStock === 'number' ? it.minimumStock : '');
        setFormOpen(true);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: Record<string, any> = { name, category: cat };
            if (desc) payload.description = desc;
            if (minStock !== '') payload.minimumStock = Number(minStock);
            if (editItem) {
                await api.post(`/items/${editItem._id}?_method=PUT`, payload);
            } else {
                await api.post('/items', payload);
            }
            setFormOpen(false);
            await load();
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Save failed');
        }
    };

    const remove = async (id: string) => {
        if (!window.confirm('Delete this item?')) return;
        try {
            await api.post(`/items/${id}?_method=DELETE`);
            await load();
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Delete failed');
        }
    };

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            <h2>Items</h2>
            <div className="filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <input placeholder="Search" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} style={{ flex: window.innerWidth < 768 ? '1 1 100%' : '1 1 200px', boxSizing: 'border-box' }} />
                <input placeholder="Category" value={category} onChange={e => { setPage(1); setCategory(e.target.value); }} style={{ flex: window.innerWidth < 768 ? '1 1 100%' : '1 1 150px', boxSizing: 'border-box' }} />
                <button onClick={openCreate} style={{ marginLeft: window.innerWidth < 768 ? '0' : 'auto', flex: window.innerWidth < 768 ? '1 1 100%' : 'initial' }}>Add Item</button>
            </div>
            {loading ? (
                <div>Loading...</div>
            ) : error ? (
                <div style={{ color: '#d33' }}>{error}</div>
            ) : (
                <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: 8, WebkitOverflowScrolling: 'touch' }}>
                    <table className="responsive-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 12 }}>Name</th>
                                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 12 }}>Category</th>
                                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', padding: 12 }}>Min Stock</th>
                                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', padding: 12, background: '#ecfdf5' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                        <span>📦</span>
                                        <span style={{ fontWeight: 700 }}>Remaining Stock</span>
                                    </div>
                                </th>
                                <th style={{ borderBottom: '1px solid #eee', padding: 12 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(it => {
                                const currentStock = it.currentStock ?? 0;
                                const minStock = it.minimumStock ?? 0;
                                const isLowStock = minStock > 0 && currentStock <= minStock;
                                const isOutOfStock = currentStock === 0;
                                
                                return (
                                <tr key={it._id} style={{ background: isOutOfStock ? '#fef2f2' : isLowStock ? '#fff7ed' : 'transparent' }}>
                                    <td style={{ padding: 12 }}>{it.name}</td>
                                    <td style={{ padding: 12 }}>{it.category}</td>
                                    <td style={{ padding: 12, textAlign: 'right' }}>{it.minimumStock ?? '-'}</td>
                                    <td style={{ 
                                        padding: 12, 
                                        textAlign: 'right',
                                        background: isOutOfStock ? '#fee2e2' : isLowStock ? '#fed7aa' : '#d1fae5',
                                        fontWeight: 700,
                                        fontSize: 16,
                                        color: isOutOfStock ? '#991b1b' : isLowStock ? '#9a3412' : '#065f46'
                                    }}>
                                        {currentStock}
                                        {isOutOfStock && <span style={{ marginLeft: 6, fontSize: 12 }}>⚠️ Out</span>}
                                        {isLowStock && !isOutOfStock && <span style={{ marginLeft: 6, fontSize: 12 }}>⚠️ Low</span>}
                                    </td>
                                    <td style={{ padding: 12 }}>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button 
                                                onClick={() => navigate(`/transactions?itemId=${it._id}&itemName=${encodeURIComponent(it.name)}`)} 
                                                style={{ fontSize: '12px', padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                            >
                                                📊 History
                                            </button>
                                            <button onClick={() => openEdit(it)} style={{ fontSize: '12px', padding: '4px 8px' }}>Edit</button>
                                            <button onClick={() => remove(it._id)} style={{ fontSize: '12px', padding: '4px 8px' }}>Delete</button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                            {items.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center' }}>No items</td></tr>
                            )}
                        </tbody>
                    </table>
                    <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16, padding: window.innerWidth < 768 ? '12px' : '0', flexWrap: 'wrap' }}>
                        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ flex: window.innerWidth < 768 ? '1 1 100px' : 'initial' }}>Prev</button>
                        <span style={{ fontSize: window.innerWidth < 768 ? 14 : 16 }}>Page {page} of {Math.max(1, Math.ceil(total / limit))}</span>
                        <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} style={{ flex: window.innerWidth < 768 ? '1 1 100px' : 'initial' }}>Next</button>
                    </div>
                </div>
            )}

            {formOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: window.innerWidth < 768 ? 16 : 0 }}>
                    <div className="modal-content" style={{ background: '#fff', padding: window.innerWidth < 768 ? 20 : 24, borderRadius: 12, maxHeight: window.innerWidth < 768 ? 'calc(100vh - 32px)' : '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <h3 style={{ marginBottom: 16, fontSize: window.innerWidth < 768 ? 18 : 20 }}>{editItem ? 'Edit Item' : 'Add Item'}</h3>
                        <form onSubmit={submit} className="responsive-form" style={{ display: 'grid', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Name</label>
                                <input value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Description</label>
                                <input value={desc} onChange={e => setDesc(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Category</label>
                                <input value={cat} onChange={e => setCat(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                                    Minimum Stock <span style={{ fontSize: '11px', color: '#666', fontWeight: 400 }}>(Optional - leave empty if not needed)</span>
                                </label>
                                <input type="number" min={0} step={1} value={minStock} onChange={e => setMinStock(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Leave empty if not tracking" style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button type="button" onClick={() => setFormOpen(false)} style={{ flex: window.innerWidth < 768 ? '1 1 120px' : 'initial' }}>Cancel</button>
                                <button type="submit" style={{ flex: window.innerWidth < 768 ? '1 1 120px' : 'initial' }}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItemsPage;


