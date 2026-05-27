import type { AxiosInstance } from "axios";
import axios from "axios";
import {
    createContext,
    useContext,
    useEffect,
    useState,
    useRef,
    type ReactNode,
} from "react";
 
interface User {
    id: string;
    name: string;
    email: string;
    plan: string;
    analysiscount?: number;
}
 
interface AppContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    api: AxiosInstance;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
}
 
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
 
const AppContext = createContext<AppContextType | undefined>(undefined);
 
export function AppProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);
 
    // FIX: api instance ONCE — never recreated, stable reference forever
    const api = useRef<AxiosInstance>(
        axios.create({ baseURL: BACKEND_URL })
    ).current;
 
    // FIX: Set auth header SYNCHRONOUSLY before any request
    // We use a ref for token too so interceptor always reads latest value
    const tokenRef = useRef(token);
    tokenRef.current = token;
 
    // One-time interceptor setup — runs once on mount
    useEffect(() => {
        const interceptor = api.interceptors.request.use((config) => {
            const t = tokenRef.current;
            if (t) {
                config.headers.Authorization = `Bearer ${t}`;
            } else {
                delete config.headers.Authorization;
            }
            return config;
        });
        return () => api.interceptors.request.eject(interceptor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty — api and tokenRef are stable refs
 
    // Load user once on mount
    useEffect(() => {
        const loadUser = async () => {
            const savedToken = localStorage.getItem("token");
            if (!savedToken) {
                setLoading(false);
                return;
            }
            try {
                const { data } = await api.get("/api/auth/user");
                if (data.success) {
                    setUser(data.user);
                }
            } catch {
                localStorage.removeItem("token");
                setToken(null);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty — runs once on mount only
 
    const login = async (email: string, password: string) => {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
            if (res.data.success) {
                setToken(res.data.token);
                setUser(res.data.user);
                localStorage.setItem("token", res.data.token);
                return { success: true };
            }
            return { success: false, message: res.data.message };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || "Login failed",
            };
        }
    };
 
    const register = async (name: string, email: string, password: string) => {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/register`, { name, email, password });
            if (res.data.success) {
                setToken(res.data.token);
                setUser(res.data.user);
                localStorage.setItem("token", res.data.token);
                return { success: true };
            }
            return { success: false, message: res.data.message };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || "Registration failed",
            };
        }
    };
 
    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
    };
 
    return (
        <AppContext.Provider value={{ user, token, loading, api, login, register, logout }}>
            {children}
        </AppContext.Provider>
    );
}
 
export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
}