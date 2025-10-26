import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../utils/dateUtils';

interface ActivityLog {
    _id: string;
    action: string;
    entity: string;
    entityId?: string;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    user: {
        _id: string;
        name: string;
        email: string;
    };
    createdAt: string;
    updatedAt: string;
}

const LogsPage: React.FC = () => {
    const { api } = useAuth();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingLog, setEditingLog] = useState<ActivityLog | null>(null);
    const [editForm, setEditForm] = useState({ description: '', action: '', entity: '' });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        action: '',
        entity: '',
        userId: ''
    });

    const loadLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...(filters.startDate && { startDate: filters.startDate }),
                ...(filters.endDate && { endDate: filters.endDate }),
                ...(filters.action && { action: filters.action }),
                ...(filters.entity && { entity: filters.entity }),
                ...(filters.userId && { userId: filters.userId })
            });

            const response = await api.get(`/logs?${queryParams}`);
            if (response.data?.success) {
                setLogs(response.data.data);
                setTotalPages(response.data.pagination?.pages || 1);
            } else {
                setError('Failed to load logs');
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [page, filters]);

    const handleDelete = async (logId: string) => {
        if (!confirm('Are you sure you want to delete this log entry?')) return;
        
        try {
            await api.delete(`/logs/${logId}`);
            setLogs(logs.filter(log => log._id !== logId));
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Failed to delete log');
        }
    };

    const handleEdit = (log: ActivityLog) => {
        setEditingLog(log);
        setEditForm({
            description: log.description,
            action: log.action,
            entity: log.entity
        });
    };

    const handleSaveEdit = async () => {
        if (!editingLog) return;
        
        try {
            const response = await api.put(`/logs/${editingLog._id}`, editForm);
            if (response.data?.success) {
                setLogs(logs.map(log => 
                    log._id === editingLog._id ? response.data.data : log
                ));
                setEditingLog(null);
                setEditForm({ description: '', action: '', entity: '' });
            } else {
                alert('Failed to update log');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Failed to update log');
        }
    };

    const handleCancelEdit = () => {
        setEditingLog(null);
        setEditForm({ description: '', action: '', entity: '' });
    };

    const getActionColor = (action: string) => {
        if (action.includes('CREATE')) return '#28a745';
        if (action.includes('UPDATE')) return '#ffc107';
        if (action.includes('DELETE')) return '#dc3545';
        if (action.includes('LOGIN')) return '#17a2b8';
        return '#6c757d';
    };

    return (
        <div className="mobile-padding" style={{ padding: 24 }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ margin: 0 }}>Activity Logs</h2>
                    <div style={{ color: '#666' }}>View and manage system activity logs</div>
                </div>

                {/* Filters */}
                <div style={{ 
                    background: '#fff', 
                    border: '1px solid #eee', 
                    borderRadius: 12, 
                    padding: 16, 
                    marginBottom: 16,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12
                }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Start Date</label>
                        <input 
                            type="date" 
                            value={filters.startDate} 
                            onChange={e => setFilters({...filters, startDate: e.target.value})}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>End Date</label>
                        <input 
                            type="date" 
                            value={filters.endDate} 
                            onChange={e => setFilters({...filters, endDate: e.target.value})}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Action</label>
                        <select 
                            value={filters.action} 
                            onChange={e => setFilters({...filters, action: e.target.value})}
                            style={{ width: '100%' }}
                        >
                            <option value="">All Actions</option>
                            <option value="CREATE">Create</option>
                            <option value="UPDATE">Update</option>
                            <option value="DELETE">Delete</option>
                            <option value="LOGIN">Login</option>
                            <option value="LOGOUT">Logout</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Entity</label>
                        <select 
                            value={filters.entity} 
                            onChange={e => setFilters({...filters, entity: e.target.value})}
                            style={{ width: '100%' }}
                        >
                            <option value="">All Entities</option>
                            <option value="User">User</option>
                            <option value="Item">Item</option>
                            <option value="Supplier">Supplier</option>
                            <option value="Customer">Customer</option>
                            <option value="InwardStock">Inward Stock</option>
                            <option value="OutwardStock">Outward Stock</option>
                        </select>
                    </div>
                </div>

                {error && (
                    <div style={{ 
                        color: '#842029', 
                        background: '#f8d7da', 
                        border: '1px solid #f5c2c7', 
                        padding: 10, 
                        borderRadius: 8, 
                        marginBottom: 12 
                    }}>
                        {error}
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>Loading logs...</div>
                ) : (
                    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12 }}>
                        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', fontWeight: 600 }}>
                            Activity Logs ({logs.length} entries)
                        </div>
                        
                        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#fafafa' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Date</th>
                                        <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>User</th>
                                        <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Action</th>
                                        <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Entity</th>
                                        <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #eee' }}>Description</th>
                                        <th style={{ textAlign: 'center', padding: 12, borderBottom: '1px solid #eee' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                            <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                {formatDate(log.createdAt)}
                                            </td>
                                            <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{log.user.name}</div>
                                                    <div style={{ fontSize: 12, color: '#666' }}>{log.user.email}</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                <span style={{ 
                                                    color: getActionColor(log.action),
                                                    fontWeight: 600,
                                                    fontSize: 12,
                                                    padding: '4px 8px',
                                                    borderRadius: 4,
                                                    background: `${getActionColor(log.action)}20`
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
                                                {log.entity}
                                            </td>
                                            <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', maxWidth: 300 }}>
                                                {editingLog?._id === log._id ? (
                                                    <textarea
                                                        value={editForm.description}
                                                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                                                        style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                                                        placeholder="Enter description"
                                                    />
                                                ) : (
                                                    <div style={{ wordBreak: 'break-word' }}>
                                                        {log.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: 12, borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                                                {editingLog?._id === log._id ? (
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                                        <button 
                                                            onClick={handleSaveEdit}
                                                            style={{ 
                                                                background: '#28a745', 
                                                                color: 'white', 
                                                                border: 'none', 
                                                                padding: '6px 12px', 
                                                                borderRadius: 4,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Save
                                                        </button>
                                                        <button 
                                                            onClick={handleCancelEdit}
                                                            style={{ 
                                                                background: '#6c757d', 
                                                                color: 'white', 
                                                                border: 'none', 
                                                                padding: '6px 12px', 
                                                                borderRadius: 4,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                                        <button 
                                                            onClick={() => handleEdit(log)}
                                                            style={{ 
                                                                background: '#ffc107', 
                                                                color: 'black', 
                                                                border: 'none', 
                                                                padding: '6px 12px', 
                                                                borderRadius: 4,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(log._id)}
                                                            style={{ 
                                                                background: '#dc3545', 
                                                                color: 'white', 
                                                                border: 'none', 
                                                                padding: '6px 12px', 
                                                                borderRadius: 4,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                                                No activity logs found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ 
                                padding: 16, 
                                borderTop: '1px solid #f0f0f0', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center' 
                            }}>
                                <div style={{ color: '#666' }}>
                                    Page {page} of {totalPages}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button 
                                        onClick={() => setPage(Math.max(1, page - 1))}
                                        disabled={page === 1}
                                        style={{ 
                                            padding: '8px 16px', 
                                            border: '1px solid #ddd', 
                                            background: page === 1 ? '#f5f5f5' : 'white',
                                            cursor: page === 1 ? 'not-allowed' : 'pointer',
                                            borderRadius: 4
                                        }}
                                    >
                                        Previous
                                    </button>
                                    <button 
                                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                                        disabled={page === totalPages}
                                        style={{ 
                                            padding: '8px 16px', 
                                            border: '1px solid #ddd', 
                                            background: page === totalPages ? '#f5f5f5' : 'white',
                                            cursor: page === totalPages ? 'not-allowed' : 'pointer',
                                            borderRadius: 4
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LogsPage;
