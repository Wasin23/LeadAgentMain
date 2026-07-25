import axios from 'axios'
import Cookies from 'js-cookie'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token =
    (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null) ||
    Cookies.get('authToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken')
        localStorage.removeItem('currentUser')
        Cookies.remove('authToken')
        if (!window.location.pathname.includes('/signin')) {
          window.location.href = '/signin'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api

export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/api/auth/login', credentials),
  register: (userData: { username: string; email: string; password: string; termsAccepted: boolean }) =>
    api.post('/api/auth/register', userData),
}
