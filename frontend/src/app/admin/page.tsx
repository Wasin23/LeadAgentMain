'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

interface PaymentBreakdown {
  month: string;
  amount: number;
  date: string;
}

interface Account {
  userId: string;
  email: string;
  username: string;
  paymentStatus: string;
  hasPaymentMethod: boolean;
  totalSpent: number;
  outstandingAmount: number;
  apiCallsThisMonth: number;
  lastChargeDate: string;
  paymentCount: number;
  paymentBreakdown: PaymentBreakdown[];
  createdAt: string;
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
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'spent' | 'recent' | 'outstanding'>('spent');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const API_URL = typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':8080') : 'http://localhost:8080';

  // Calculate revenue metrics
  const revenueMetrics = useMemo(() => {
    if (!dashboardData) return null;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7);
    
    const currentMonthRevenue = dashboardData.monthlyReports.find(m => m.month === currentMonth)?.total || 0;
    const lastMonthRevenue = dashboardData.monthlyReports.find(m => m.month === lastMonth)?.total || 0;
    
    const growthRate = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100)
      : 0;

    const payingAccounts = dashboardData.accounts.filter(a => a.totalSpent > 0).length;
    const averageRevenuePerAccount = payingAccounts > 0 
      ? parseFloat(dashboardData.summary.totalBilling) / payingAccounts 
      : 0;

    const totalOutstanding = dashboardData.accounts.reduce((sum, a) => sum + a.outstandingAmount, 0);

    return {
      currentMonthRevenue,
      lastMonthRevenue,
      growthRate,
      payingAccounts,
      averageRevenuePerAccount,
      totalOutstanding
    };
  }, [dashboardData]);

  // Filter and sort accounts
  const filteredAccounts = useMemo(() => {
    if (!dashboardData) return [];

    let accounts = [...dashboardData.accounts];

    // Filter by status
    if (filterStatus !== 'all') {
      if (filterStatus === 'paying') {
        accounts = accounts.filter(a => a.totalSpent > 0);
      } else if (filterStatus === 'outstanding') {
        accounts = accounts.filter(a => a.outstandingAmount > 0);
      } else {
        accounts = accounts.filter(a => a.paymentStatus === filterStatus);
      }
    }

    // Sort
    accounts.sort((a, b) => {
      if (sortBy === 'spent') {
        return b.totalSpent - a.totalSpent;
      } else if (sortBy === 'recent') {
        const dateA = a.lastChargeDate ? new Date(a.lastChargeDate).getTime() : 0;
        const dateB = b.lastChargeDate ? new Date(b.lastChargeDate).getTime() : 0;
        return dateB - dateA;
      } else if (sortBy === 'outstanding') {
        return b.outstandingAmount - a.outstandingAmount;
      }
      return 0;
    });

    return accounts;
  }, [dashboardData, sortBy, filterStatus]);

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
          <div>
            <h1 className="text-4xl font-bold text-[#4FD1FF]">💰 Revenue Dashboard</h1>
            <p className="text-[#8FA6C1] mt-2">Track payments and account revenue</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={triggerBilling}
              className="px-6 py-3 bg-[#4FD1FF] text-[#0A0E27] rounded-lg font-semibold hover:bg-[#3FB1DF] transition-colors"
            >
              Trigger Billing
            </button>
            <button
              onClick={logout}
              className="px-4 py-3 bg-[#2A3F5F] rounded-lg hover:bg-[#3A4F6F] transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Revenue Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-[#1A1F3A] to-[#2A3F5F] p-6 rounded-lg border border-[#4FD1FF]/30 shadow-lg">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Total Revenue</h3>
            <div className="text-4xl font-bold text-[#4FD1FF] mb-1">${dashboardData.summary.totalBilling}</div>
            <p className="text-xs text-[#8FA6C1]">From {dashboardData.summary.totalPayments} payments</p>
          </div>
          
          <div className="bg-gradient-to-br from-[#1A1F3A] to-[#2A3F5F] p-6 rounded-lg border border-green-500/30 shadow-lg">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">This Month</h3>
            <div className="text-4xl font-bold text-green-400 mb-1">
              ${revenueMetrics?.currentMonthRevenue.toFixed(2) || '0.00'}
            </div>
            <p className={`text-xs ${revenueMetrics && revenueMetrics.growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {revenueMetrics && revenueMetrics.growthRate >= 0 ? '↑' : '↓'} 
              {Math.abs(revenueMetrics?.growthRate || 0).toFixed(1)}% from last month
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-[#1A1F3A] to-[#2A3F5F] p-6 rounded-lg border border-yellow-500/30 shadow-lg">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Outstanding</h3>
            <div className="text-4xl font-bold text-yellow-400 mb-1">
              ${revenueMetrics?.totalOutstanding.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-[#8FA6C1]">Unpaid usage charges</p>
          </div>
        </div>

        {/* Account Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Total Users</h3>
            <div className="text-3xl font-bold text-white">{dashboardData.summary.totalUsers}</div>
          </div>
          
          <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Paying Accounts</h3>
            <div className="text-3xl font-bold text-[#4FD1FF]">{revenueMetrics?.payingAccounts || 0}</div>
          </div>
          
          <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Avg Revenue/User</h3>
            <div className="text-3xl font-bold text-white">
              ${revenueMetrics?.averageRevenuePerAccount.toFixed(2) || '0.00'}
            </div>
          </div>
          
          <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
            <h3 className="text-[#8FA6C1] text-sm uppercase tracking-wider mb-2">Active Accounts</h3>
            <div className="text-3xl font-bold text-green-400">{dashboardData.summary.activeAccounts}</div>
          </div>
        </div>

        {/* Monthly Revenue Chart */}
        <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F] mb-8">
          <h2 className="text-2xl font-bold text-[#4FD1FF] mb-4">Monthly Revenue Trend</h2>
          
          {dashboardData.monthlyReports.length === 0 ? (
            <p className="text-[#8FA6C1]">No billing data yet</p>
          ) : (
            <div className="space-y-3">
              {dashboardData.monthlyReports.slice(0, 6).map((month) => {
                const maxRevenue = Math.max(...dashboardData.monthlyReports.slice(0, 6).map(m => m.total));
                const barWidth = maxRevenue > 0 ? (month.total / maxRevenue * 100) : 0;
                
                return (
                  <div key={month.month} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-[#8FA6C1] w-24">{month.month}</span>
                      <span className="text-[#4FD1FF] font-bold">${month.total.toFixed(2)}</span>
                      <span className="text-[#6B7FA3] text-xs w-32 text-right">
                        {month.successful} payments, {month.failed} failed
                      </span>
                    </div>
                    <div className="w-full bg-[#0A0E27] rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#4FD1FF] to-[#2A9FDF] h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Accounts Table */}
        <div className="bg-[#1A1F3A] p-6 rounded-lg border border-[#2A3F5F]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#4FD1FF]">Account Revenue</h2>
            
            <div className="flex gap-3">
              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-[#0A0E27] border border-[#2A3F5F] rounded-lg text-white text-sm focus:outline-none focus:border-[#4FD1FF]"
              >
                <option value="all">All Accounts</option>
                <option value="paying">Paying Only</option>
                <option value="outstanding">Has Outstanding</option>
                <option value="active">Active</option>
                <option value="payment_failed">Payment Failed</option>
                <option value="no_payment">No Payment Method</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'spent' | 'recent' | 'outstanding')}
                className="px-4 py-2 bg-[#0A0E27] border border-[#2A3F5F] rounded-lg text-white text-sm focus:outline-none focus:border-[#4FD1FF]"
              >
                <option value="spent">Sort by Total Spent</option>
                <option value="recent">Sort by Recent Activity</option>
                <option value="outstanding">Sort by Outstanding</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#2A3F5F]">
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Account</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Total Revenue</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Outstanding</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Last Payment</th>
                  <th className="text-left py-3 px-4 text-[#8FA6C1] text-sm uppercase tracking-wider">Payments</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-[#8FA6C1]">
                      No accounts found
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => (
                    <React.Fragment key={account.userId}>
                      <tr
                        className="border-b border-[#2A3F5F] hover:bg-[#0A0E27] cursor-pointer transition-colors"
                        onClick={() => setExpandedAccount(expandedAccount === account.userId ? null : account.userId)}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[#4FD1FF] text-lg">
                              {expandedAccount === account.userId ? '▼' : '▶'}
                            </span>
                            <div>
                              <div className="font-medium text-white">{account.email}</div>
                              <div className="text-xs text-[#8FA6C1]">{account.username || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(account.paymentStatus)}`}>
                              {account.paymentStatus}
                            </span>
                            <span className="text-xs text-[#8FA6C1]">
                              {account.hasPaymentMethod ? '✓ Card' : '✗ No card'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-2xl font-bold text-green-400">
                            ${account.totalSpent.toFixed(2)}
                          </div>
                          <div className="text-xs text-[#8FA6C1]">
                            {account.paymentCount} payment{account.paymentCount !== 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className={`text-lg font-semibold ${account.outstandingAmount > 0 ? 'text-yellow-400' : 'text-[#8FA6C1]'}`}>
                            ${account.outstandingAmount.toFixed(2)}
                          </div>
                          {account.apiCallsThisMonth > 0 && (
                            <div className="text-xs text-[#8FA6C1]">
                              {account.apiCallsThisMonth} API calls
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-white">
                            {account.lastChargeDate
                              ? new Date(account.lastChargeDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })
                              : 'Never'}
                          </div>
                          {account.lastChargeDate && (
                            <div className="text-xs text-[#8FA6C1]">
                              {Math.floor((Date.now() - new Date(account.lastChargeDate).getTime()) / (1000 * 60 * 60 * 24))} days ago
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-center">
                            <div className="text-xl font-bold text-[#4FD1FF]">
                              {account.paymentCount}
                            </div>
                            <div className="text-xs text-[#8FA6C1]">total</div>
                          </div>
                        </td>
                      </tr>
                      {expandedAccount === account.userId && (
                        <tr className="bg-[#0F1A2A] border-b border-[#2A3F5F]">
                          <td colSpan={6} className="py-6 px-8">
                            <div className="space-y-4">
                              {/* Account Details */}
                              <div className="flex gap-6 text-sm mb-4">
                                <div>
                                  <span className="text-[#8FA6C1]">User ID: </span>
                                  <span className="text-white font-mono">{account.userId}</span>
                                </div>
                                <div>
                                  <span className="text-[#8FA6C1]">Created: </span>
                                  <span className="text-white">
                                    {account.createdAt 
                                      ? new Date(account.createdAt).toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric', 
                                          year: 'numeric' 
                                        })
                                      : 'Unknown'}
                                  </span>
                                </div>
                              </div>

                              {/* Payment History */}
                              {account.paymentBreakdown && account.paymentBreakdown.length > 0 ? (
                                <div>
                                  <h4 className="text-[#4FD1FF] font-semibold mb-3 flex items-center gap-2">
                                    <span className="text-xl">💳</span>
                                    Payment History
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {account.paymentBreakdown.map((payment, idx) => (
                                      <div 
                                        key={idx} 
                                        className="bg-[#1A1F3A] rounded-lg p-4 border border-[#2A3F5F] hover:border-[#4FD1FF]/50 transition-colors"
                                      >
                                        <div className="text-[#8FA6C1] text-xs font-medium mb-1">
                                          {payment.month}
                                        </div>
                                        <div className="text-green-400 font-bold text-2xl mb-2">
                                          ${payment.amount.toFixed(2)}
                                        </div>
                                        <div className="text-[#8FA6C1] text-xs">
                                          {new Date(payment.date).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-4 text-[#8FA6C1]">
                                  No payment history yet
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
