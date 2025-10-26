import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

type Supplier = {
    _id: string;
    name: string;
    contactPerson?: string;
    address?: string;
};

type SuppliersResponse = {
    success: boolean;
    data: Supplier[];
    total: number;
};

const SuppliersPage: React.FC = () => {
    const { api } = useAuth();
    const [items, setItems] = useState<Supplier[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [search, setSearch] = useState('');

    const query = useMemo(() => {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(limit));
        if (search) params.set('search', search);
        return params.toString();
    }, [page, limit, search]);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get<SuppliersResponse>(`/suppliers?${query}`);
            if (res.data?.success) {
                setItems(res.data.data || []);
                setTotal(res.data.total || 0);
            } else {
                setError('Failed to load suppliers');
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load suppliers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);

    const [formOpen, setFormOpen] = useState(false);
    const [editItem, setEditItem] = useState<Supplier | null>(null);
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [address, setAddress] = useState('');

    const openCreate = () => {
        setEditItem(null);
        setName(''); setContactPerson(''); setAddress('');
        setFormOpen(true);
    };

    const openEdit = (it: Supplier) => {
        setEditItem(it);
        setName(it.name);
        setContactPerson(it.contactPerson || '');
        setAddress(it.address || '');
        setFormOpen(true);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: Record<string, any> = { name };
            if (contactPerson) payload.contactPerson = contactPerson;
            if (address) payload.address = address;
            if (editItem) {
                await api.post(`/suppliers/${editItem._id}?_method=PUT`, payload);
            } else {
                await api.post('/suppliers', payload);
            }
            setFormOpen(false);
            await load();
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Save failed');
        }
    };

    const remove = async (id: string) => {
        if (!window.confirm('Delete this supplier?')) return;
        try {
            await api.post(`/suppliers/${id}?_method=DELETE`);
            await load();
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Delete failed');
        }
    };

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            <h2>Suppliers</h2>
            <div className="filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <input placeholder="Search" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} style={{ flex: window.innerWidth < 768 ? '1 1 100%' : '1', boxSizing: 'border-box' }} />
                <button onClick={openCreate} style={{ marginLeft: window.innerWidth < 768 ? '0' : 'auto', flex: window.innerWidth < 768 ? '1 1 100%' : 'initial' }}>Add Supplier</button>
            </div>
            {loading ? (
                <div>Loading...</div>
            ) : error ? (
                <div style={{ color: '#d33' }}>{error}</div>
            ) : (
                <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #eee', borderRadius: 8, WebkitOverflowScrolling: 'touch' }}>
                    <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>Name</th>
                                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', padding: 8 }}>Contact</th>
                                
                                <th style={{ borderBottom: '1px solid #eee', padding: 8 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(it => (
                                <tr key={it._id}>
                                    <td style={{ padding: 8 }}>{it.name}</td>
                                    <td style={{ padding: 8 }}>{it.contactPerson || '-'}</td>
                                    
                                    <td style={{ padding: 8 }}>
                                        <button onClick={() => openEdit(it)} style={{ marginRight: 8 }}>Edit</button>
                                        <button onClick={() => remove(it._id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr><td colSpan={3} style={{ padding: 12, textAlign: 'center' }}>No suppliers</td></tr>
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
                    <div className="modal-content" style={{ background: '#fff', padding: window.innerWidth < 768 ? 20 : 24, borderRadius: 12, width: 'min(100% - 24px, 520px)', maxHeight: window.innerWidth < 768 ? 'calc(100vh - 32px)' : '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <h3 style={{ marginBottom: 16, fontSize: window.innerWidth < 768 ? 18 : 20 }}>{editItem ? 'Edit Supplier' : 'Add Supplier'}</h3>
                        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Name</label>
                                <input value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Contact Person</label>
                                <input value={contactPerson} onChange={e => setContactPerson(e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Address</label>
                                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
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

export default SuppliersPage;


