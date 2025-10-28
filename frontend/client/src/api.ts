import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Use environment variable if provided, otherwise use default
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vendor-11.onrender.com/api';

export class ApiClient {
    private readonly axiosInstance: AxiosInstance;

    constructor(getToken: () => string | null) {
        this.axiosInstance = axios.create({
            baseURL: API_BASE_URL,
            withCredentials: false,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this.axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
            const token = getToken();
            if (token) {
                // Axios v1 uses AxiosHeaders which provides a set method
                if (typeof (config.headers as any)?.set === 'function') {
                    (config.headers as any).set('Authorization', `Bearer ${token}`);
                } else {
                    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
                }
            }
            return config;
        });
    }

    public post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.axiosInstance.post<T>(url, data, config);
    }

    public get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.axiosInstance.get<T>(url, config);
    }

    public put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.axiosInstance.put<T>(url, data, config);
    }

    public delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return this.axiosInstance.delete<T>(url, config);
    }
}

export type LoginResponse = {
    success: boolean;
    message?: string;
    data?: {
        token: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: string;
            lastLogin?: string;
        };
    };
};


