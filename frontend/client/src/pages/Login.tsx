import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';

const Login: React.FC = () => {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (isAuthenticated) return <Navigate to="/" replace />;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (err: any) {
            setError('Username or password is wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ 
            maxWidth: 400, 
            margin: '0 auto',
            marginTop: 'min(10vh, 40px)',
            padding: window.innerWidth < 768 ? 20 : 32, 
            border: '1px solid #ddd', 
            borderRadius: 12,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            background: '#fff',
            width: window.innerWidth < 768 ? 'calc(100% - 32px)' : 'auto',
            boxSizing: 'border-box'
        }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: window.innerWidth < 768 ? 22 : 28, fontWeight: 600, color: '#333' }}>Welcome Back</h2>
                <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: window.innerWidth < 768 ? 14 : 16 }}>Sign in to your account</p>
            </div>
            
            {error && (
                <div style={{ 
                    color: '#721c24', 
                    background: '#f8d7da', 
                    border: '1px solid #f5c6cb', 
                    padding: 12, 
                    borderRadius: 6, 
                    marginBottom: 16,
                    fontSize: 14
                }}>
                    {error}
                </div>
            )}
            
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                    <label htmlFor="username" style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: '#333' }}>
                        Username
                    </label>
                    <input 
                        id="username" 
                        type="text" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        required 
                        placeholder="Enter your username"
                        style={{ 
                            width: '100%', 
                            padding: 12, 
                            border: '1px solid #ddd', 
                            borderRadius: 6,
                            fontSize: 16,
                            boxSizing: 'border-box'
                        }} 
                    />
                </div>
                
                <div style={{ marginBottom: 20 }}>
                    <label htmlFor="password" style={{ display: 'block', marginBottom: 6, fontWeight: 500, color: '#333' }}>
                        Password
                    </label>
                    <input 
                        id="password" 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                        placeholder="Enter your password"
                        style={{ 
                            width: '100%', 
                            padding: 12, 
                            border: '1px solid #ddd', 
                            borderRadius: 6,
                            fontSize: 16,
                            boxSizing: 'border-box'
                        }} 
                    />
                </div>
                
                <button 
                    type="submit" 
                    disabled={loading} 
                    style={{ 
                        width: '100%', 
                        padding: 12, 
                        background: loading ? '#ccc' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 16,
                        fontWeight: 500,
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
            </form>
            
            <div style={{ marginTop: 20, textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#666' }}>
                    Don't have an account?{' '}
                    <button 
                        type="button" 
                        onClick={() => navigate('/signup')} 
                        style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: '#007bff', 
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontSize: 14
                        }}
                    >
                        Create one
                    </button>
                </p>
            </div>
        </div>
    );
};

export default Login;


