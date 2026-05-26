import type { AxiosInstance } from "axios";
import axios from "axios";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface User{
    id:string;
    name: string;
    email: string;
    plan: string;
    analysiscount?: number;
}

interface AppContextType{
    user: User | null;
    token: string | null;
    loading: boolean;
    api: AxiosInstance;
    login: (email: string, password: string)=> Promise<{success: boolean; message?: string}>;
    register: (name: string, email:string, password: string)=> Promise<{success: boolean; message?: string}>;
    logout: () => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({children}: {children: ReactNode}){

           const [user, setuser] = useState<User | null>(null);
           const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
           const [loading, setloading] = useState(true);

//Asiox instance with auth header

const api = axios.create({
    baseURL: BACKEND_URL,
});

const updateAuthHeader = (token: string | null) => {
    if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common.Authorization;
    }
};



// Created functions

// Loading function 
const loadUser = async () => {
    if(!token){
        setloading(false)
        return;
    }
    try {
        const {data} = await api.get('/api/auth/user')
        if(data.success){
            setuser(data.user)
        }
    }  catch (error) {
        localStorage.removeItem("token");
        setToken(null)
        setuser(null)
    }
    setloading(false)
}

useEffect(()=>{
    loadUser()
},[])

useEffect(() => {
    updateAuthHeader(token);
}, [token]);


// Login functions
const login = async (email: string, password: string) => {
   try {

      const res = await axios.post(
         `${BACKEND_URL}/api/auth/login`,
         { email, password }
      );

      console.log(res.data);

      if (res.data.success) {

         setToken(res.data.token);

         setuser(res.data.user);

         localStorage.setItem("token", res.data.token);

         return { success: true };

      } else {

         return {
            success: false,
            message: res.data.message
         };
      }

   } catch (error: any) {

      console.log(error.response?.data);

      return {
         success: false,
         message: error.response?.data?.message || "Login failed"
      };
   }
}



// Register functions
const register = async (name: string, email:string, password: string) => {
       try {
    const res = await axios.post(`${BACKEND_URL}/api/auth/register`, {name, email, password})
    if (res.data.success){
        setToken(res.data.token)
        setuser(res.data.user)
        localStorage.setItem("token", res.data.token)
        return {success: true}
    }
      return { success: false, message: res.data.message }
   } catch (error: any) {
    return {success: false, message: error.response?.data?.message || "Registration failed"}
   }
    
}



const logout = async () => {
    setToken(null)
    setuser(null)
    localStorage.removeItem("token")
}



const value = {user, token, loading, api, login, register, logout}

    return <AppContext.Provider value={value}>
        {children}
    </AppContext.Provider>
}

export function useApp(){
    const context = useContext(AppContext)
    if(!context) throw new Error("useApp must be used within AppProvider");
    return context;
}