import { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, XCircle, RefreshCw, Calendar } from 'lucide-react';
import api from '@/lib/api';

interface Payment {
  paymentId: string;
  timestamp: string;
  amount: number;
  status: 'success' | 'failed' | 'refunded';
  currency: string;
  stripePaymentIntentId?: string;
  billingPeriod: string;
  description: string;
  errorMessage?: string;
}

interface PaymentStats {
  totalPaid: number;
  totalFailed: number;
  outstanding: number;
  successCount: number;
  failedCount: number;
  lastSuccessfulPayment?: Payment;
  lastFailedPayment?: Payment;
  nextBillingDate?: string;
}

interface HistoricalData {
  date: string;
  tokens: number;
  cost: number;
  label: string;
}

type TimeFilter = 'hour' | 'day' | 'month';

export default function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [hoveredBar, setHoveredBar] = useState<{ index: number; cost: number; x: number; y: number } | null>(null);

  useEffect(() => {
    fetchPaymentData();
    fetchHistoricalData(timeFilter);
  }, []);

  useEffect(() => {
    fetchHistoricalData(timeFilter);
  }, [timeFilter]);

  const fetchHistoricalData = async (filter: TimeFilter) => {
    try {
      let days = 30;
      let interval = 'day';
      
      if (filter === 'hour') {
        days = 1;
        interval = 'hour';
      } else if (filter === 'day') {
        days = 365;
        interval = 'day';
      } else if (filter === 'month') {
        days = 365;
        interval = 'month';
      }

      const response = await api.get('/api/lead-agent/api-usage/timeseries', {
        params: { days, interval }
      });

      if (response.data.success && response.data.series) {
        const formattedData: HistoricalData[] = response.data.series.map((item: any) => {
          // Use the sortKey directly and split to get the date parts
          // sortKey format is typically "2025-12-29T12:00:00.000Z"
          const dateString = item.sortKey.split('T')[0]; // Gets "2025-12-29"
          const dateParts = dateString.split('-');
          const day = dateParts[2];
          
          // For day view, show just the day number
          let displayLabel = item.date;
          if (filter === 'day') {
            displayLabel = day;
          }
          
          return {
            date: dateString,
            label: displayLabel,
            tokens: item.totalCalls || 0,
            cost: item.total?.cost || 0
          };
        });

        setHistoricalData(formattedData);
      } else {
        setHistoricalData([]);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      setHistoricalData([]);
    }
  };

  const fetchPaymentData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch payment history
      const historyResponse = await api.get('/api/billing/payment-history?limit=50');
      setPayments(historyResponse.data.payments || []);
      
      // Fetch payment stats
      const statsResponse = await api.get('/api/billing/payment-stats');
      setStats(statsResponse.data.stats);
      
    } catch (err: any) {
      console.error('Error fetching payment data:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'refunded':
        return <RefreshCw className="w-5 h-5 text-blue-500" />;
      default:
        return <DollarSign className="w-5 h-5 text-white/70" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-white/10 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const filteredPayments = payments.filter(payment => {
    if (filter === 'all') return true;
    return payment.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchPaymentData}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Paid</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(stats.totalPaid)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-green-600 mt-1">
              {stats.successCount} successful payments
            </p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Outstanding Balance</p>
                <p className="text-2xl font-bold text-orange-700">{formatCurrency(stats.outstanding || 0)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-xs text-orange-600 mt-1">
              {stats.nextBillingDate
                ? `Next charge: ${new Date(stats.nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Unpaid usage'}
            </p>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Failed Amount</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(stats.totalFailed)}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-xs text-red-600 mt-1">{stats.failedCount} failed attempts</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Success Rate</p>
                <p className="text-2xl font-bold text-blue-700">
                  {stats.successCount + stats.failedCount > 0
                    ? Math.round((stats.successCount / (stats.successCount + stats.failedCount)) * 100)
                    : 0}%
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <p className="text-xs text-blue-600 mt-1">Payment reliability</p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Last Payment</p>
                <p className="text-lg font-bold text-purple-700">
                  {stats.lastSuccessfulPayment
                    ? formatCurrency(stats.lastSuccessfulPayment.amount)
                    : 'N/A'}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-xs text-purple-600 mt-1">
              {stats.lastSuccessfulPayment
                ? new Date(stats.lastSuccessfulPayment.timestamp).toLocaleDateString()
                : 'No payments yet'}
            </p>
          </div>
        </div>
      )}

      {/* Cost Over Time Chart */}
      {historicalData.length > 0 && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Cost Over Time</h3>
            <div className="flex gap-3">
              {timeFilter === 'day' && (
                <input
                  type="month"
                  value={selectedMonth}
                  min="2025-01"
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition-colors cursor-pointer"
                />
              )}
              <div className="flex gap-2">
              <button
                onClick={() => setTimeFilter('hour')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  timeFilter === 'hour'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/90 hover:bg-white/20'
                }`}
              >
                Hour
              </button>
              <button
                onClick={() => setTimeFilter('day')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  timeFilter === 'day'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/90 hover:bg-white/20'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  timeFilter === 'month'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/90 hover:bg-white/20'
                }`}
              >
                Month
              </button>
              </div>
            </div>
          </div>
          {timeFilter === 'day' && (
            <div className="text-center mb-2">
              <span className="text-sm font-semibold text-white">
                {(() => {
                  const [year, month] = selectedMonth.split('-');
                  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                  return `${monthNames[parseInt(month) - 1]} ${year}`;
                })()}
              </span>
            </div>
          )}
          <div className="relative h-64">
            <svg className="w-full h-full" viewBox="0 0 1400 256">
              {(() => {
                const filteredData = historicalData.filter(d => timeFilter !== 'day' || d.date.startsWith(selectedMonth));
                const maxCost = Math.max(...filteredData.map(item => item.cost)) || 1;
                const yAxisMax = Math.ceil(maxCost / 5) * 5;
                const yAxisStep = yAxisMax / 4;
                
                return (
                  <>
                    {/* Y-axis labels */}
                    {[0, 1, 2, 3, 4].map(i => (
                      <text key={i} x="10" y={240 - (i * 50)} className="text-xs fill-white/70">
                        ${(i * yAxisStep).toFixed(0)}
                      </text>
                    ))}
                    
                    {/* Bar chart */}
                    {filteredData.map((d, i) => {
                      const barWidth = 1340 / filteredData.length;
                      const x = 50 + (i * barWidth);
                      const barHeight = (d.cost / yAxisMax) * 200;
                      const y = 220 - barHeight;
                      
                      return (
                        <g key={i}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth * 0.8}
                            height={barHeight}
                            className="fill-purple-400 hover:fill-purple-500 transition-colors cursor-pointer"
                            rx="2"
                            onMouseEnter={() => {
                              setHoveredBar({ index: i, cost: d.cost, x: x + barWidth * 0.4, y: y });
                            }}
                            onMouseLeave={() => setHoveredBar(null)}
                          />
                          <text
                            x={x + barWidth * 0.4}
                            y="245"
                            className="text-xs fill-white/70"
                            textAnchor="middle"
                          >
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
            {hoveredBar && (
              <div
                className="absolute bg-slate-900 text-white px-2 py-1 rounded text-xs font-semibold pointer-events-none z-50 whitespace-nowrap"
                style={{
                  left: `${(hoveredBar.x / 1400) * 100}%`,
                  top: `${(hoveredBar.y / 256) * 100}%`,
                  transform: 'translate(-50%, -120%)'
                }}
              >
                ${hoveredBar.cost.toFixed(2)}
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">Total</span>
              <span className="text-white font-semibold">${historicalData.reduce((sum, d) => sum + d.cost, 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-white/80 hover:bg-gray-200'
          }`}
        >
          All ({payments.length})
        </button>
        <button
          onClick={() => setFilter('success')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-white/10 text-white/80 hover:bg-gray-200'
          }`}
        >
          Successful ({payments.filter(p => p.status === 'success').length})
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'failed'
              ? 'bg-red-600 text-white'
              : 'bg-white/10 text-white/80 hover:bg-gray-200'
          }`}
        >
          Failed ({payments.filter(p => p.status === 'failed').length})
        </button>
      </div>

      {/* Payment List */}
      {filteredPayments.length === 0 ? (
        <div className="text-center py-12 bg-white/5 rounded-lg">
          <DollarSign className="w-12 h-12 text-white/70 mx-auto mb-3" />
          <p className="text-white/70">No payment history found</p>
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/20">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/5 divide-y divide-white/20">
                {filteredPayments.map((payment) => (
                  <tr key={payment.paymentId} className="hover:bg-white/10">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/90">
                      {formatDate(payment.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/90">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        <div>
                          <div>{payment.description}</div>
                          <div className="text-xs text-white/70">
                            {new Date(payment.billingPeriod).toLocaleDateString('en-US', {
                              month: 'long',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white/90">
                      {formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-white/70">
                      {payment.status === 'failed' && payment.errorMessage ? (
                        <div className="text-red-600 text-xs max-w-xs truncate" title={payment.errorMessage}>
                          {payment.errorMessage}
                        </div>
                      ) : payment.stripePaymentIntentId ? (
                        <code className="text-xs bg-white/10 px-2 py-1 rounded">
                          {payment.stripePaymentIntentId.substring(0, 20)}...
                        </code>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
