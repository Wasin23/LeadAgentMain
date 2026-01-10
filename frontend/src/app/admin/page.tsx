'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Summary {
  totalBilling: string;
  totalPayments: number;
  totalUsers: number;
  activeAccounts: number;
  statusSummary: {
    active: number;
    payment_failed: number;
    suspended: number;
    no_payment: number;
  };
}

interface MonthlyReport {
  month: string;
  total: number;
  count: number;
  successful: number;
  failed: number;
}

interface Account {
  userId: string;
  email: string;
  username: string;
  paymentStatus: string;
  hasPaymentMethod: boolean;
  totalSpent: number;
  outstandingAmount: number;
  failedPaymentCount: number;
  lastChargeDate: string;
  paymentCount: number;
}

interface DashboardData {
  success: boolean;
  summary: Summary;
  monthlyReports: MonthlyReport[];
  accounts: Account[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':8080') : 'http://localhost:8080';

  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      loadDashboard(token);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('adminToken', data.token);
        setIsAuthenticated(true);
        loadDashboard(data.token);
      } else {
        setLoginError('Invalid password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Login failed. Please try again.');
    }
  };

  const loadDashboard = async (token: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { 'X-Admin-Token': token }
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          return;
        }
        throw new Error('Failed to load dashboard');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setLoginError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const triggerBilling = async () => {
    if (!confirm('Are you sure you want to trigger monthly billing for all users?')) {
      return;
    }

    const token = sessionStorage.getItem('adminToken');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/trigger-billing`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token }
      });

      const data = await response.json();

      if (data.success) {
        alert(`Billing completed!\nSuccessful: ${data.results.successful}\nFailed: ${data.results.failed}`);
        loadDashboard(token);
      } else {
        alert('Billing failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error triggering billing:', error);
      alert('Failed to trigger billing');
    }
  };

  const logout = () => {
    sessionStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setPassword('');
    setDashboardData(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-[#4FD1FF]/20 text-[#4FD1FF]';
      case 'payment_failed': return 'bg-red-500/20 text-red-400';
      case 'suspended': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0E27] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#1A1F3A] p-8 rounded-lg border border-[#2A3F5F]">
          <h1 className="text-3xl font-bold text-[#4FD1FF] mb-6 text-center">
            🔐 Admin Login
          </h1>
          
          {loginError && (
            <div className="mb-4 text-red-400 text-center text-sm">
              {loginError}
            </div>
          )}
          
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-4 py-3 bg-[#0A0E27] border border-[#2A3F5F] rounded-lg text-white mb-4 focus:outline-none focus:border-[#4FD1FF]"
              required
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-[#4FD1FF] text-[#0A0E27] py-3 rounded-lg font-semibold hover:bg-[#3FB1DF] transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading || !dashboardData) {
    return (
      <div className="min-h-screen bg-[#0A0E27] text-white flex items-center justify-center">
        <div className="text-[#8FA6C1]">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E27] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-[#4FD1FF]">💰 Admin Billing Dashboard</h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-[#2A3F5F] rounded-lg hover:bg-[#3A4F6F] transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Trigger Billing Button */}
        <button
          onClick={triggerBilling}
          className="mb-6 px-6 py-3 bg-[#4FD1FF] text-[#0A0E27] rounded-lg font-semibold hover:bg-[#3FB1DF] transition-colors"
        >
          Trigger Monthly Billing Now
        </button>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Total Revenue</h3>
            <div className="text-4xl font-bold text-[#4FD1FF]">${dashboardData.summary.totalBilling}</div>
          </div>
          
          <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Total Payments</h3>
            <div className="text-4xl font-bold text-[#4FD1FF]">{dashboardData.summary.totalPayments}</div>
          </div>
          
          <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Total Users</h3>
            <div className="text-4xl font-bold text-[#4FD1FF]">{dashboardData.summary.totalUsers}</div>
          </div>
          
          <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Active Accounts</h3>
            <div className="text-4xl font-bold text-[#4FD1FF]">{dashboardData.summary.activeAccounts}</div>
          </div>
        </div>

        {/* Monthly Reports */}
        <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F] mb-8">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">Monthly Billing Reports</h2>
          
          {dashboardData.monthlyReports.length === 0 ? (
            <p className="text-[#8FA6C1]">No billing data yet</p>
          ) : (
            <div className="space-y-2">
              {dashboardData.monthlyReports.map((month) => (
                <div
                  key={month.month}
                  className="flex justify-between items-center p-3 bg-[#0A0E27] rounded border border-[#2A3F5F]"
                >
                  <div>
                    <span className="font-semibold text-[#8FA6C1]">{month.month}</span>
                    <span className="ml-4 text-sm text-[#6B7FA3]">
                      {month.successful} successful, {month.failed} failed
                    </span>
                  </div>
                  <span className="text-xl font-bold text-[#4FD1FF]">${month.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accounts Table */}
        <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">All Accounts</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#2A3F5F]">
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Username</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Payment Method</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Total Spent</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Outstanding</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Last Charge</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Payments</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.accounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-[#8FA6C1]">
                      No accounts found
                    </td>
                  </tr>
                ) : (
                  dashboardData.accounts.map((account) => (
                    <tr
                      key={account.userId}
                      className="border-b border-[#2A3F5F] hover:bg-[#0A0E27]"
                    >
                      <td className="py-3 px-4">{account.email}</td>
                      <td className="py-3 px-4">{account.username || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(account.paymentStatus)}`}>
                          {account.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {account.hasPaymentMethod ? '✓ Card on file' : '✗ No payment'}
                      </td>
                      <td className="py-3 px-4">${account.totalSpent.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={account.outstandingAmount > 0 ? 'text-red-400 font-semibold' : 'text-green-400'}>
                          ${account.outstandingAmount.toFixed(2)}
                          {account.failedPaymentCount > 0 && (
                            <span className="text-xs ml-2">({account.failedPaymentCount} failed)</span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {account.lastChargeDate
                          ? new Date(account.lastChargeDate).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="py-3 px-4">{account.paymentCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
