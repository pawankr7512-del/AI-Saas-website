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

    // Stable api instance — never recreated
    const api = useRef<AxiosInstance>(
        axios.create({ baseURL: BACKEND_URL })
    ).current;

    // tokenRef — interceptor hamesha latest token padhta hai
    const tokenRef = useRef(token);
    tokenRef.current = token; // har render pe sync hota hai

    // Interceptor — ek baar setup, hamesha latest token use karta hai
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
    }, []);

    // App load hone pe user fetch karo
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
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
            if (res.data.success) {
                const newToken = res.data.token;
                const newUser = res.data.user;

                // ✅ KEY FIX: tokenRef aur api header TURANT update karo
                // React setState async hota hai — isliye interceptor ko
                // naya token milne mein delay hota tha → 401 error aati thi
                tokenRef.current = newToken;
                api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

                setToken(newToken);
                setUser(newUser);
                localStorage.setItem("token", newToken);
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
                const newToken = res.data.token;
                const newUser = res.data.user;

                // ✅ Same fix register mein bhi
                tokenRef.current = newToken;
                api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

                setToken(newToken);
                setUser(newUser);
                localStorage.setItem("token", newToken);
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
        // ✅ Logout pe bhi turant header clear karo
        tokenRef.current = null;
        delete api.defaults.headers.common.Authorization;

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