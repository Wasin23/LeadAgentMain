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
  successCount: number;
  failedCount: number;
  lastSuccessfulPayment?: Payment;
  lastFailedPayment?: Payment;
  nextBillingDate?: string;
}

export default function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');

  useEffect(() => {
    fetchPaymentData();
  }, []);

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
        return <DollarSign className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-blue-100 text-blue-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Paid This Month</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(stats.totalPaid)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-green-600 mt-1">
              {stats.nextBillingDate
                ? `Next charge: ${new Date(stats.nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : `${stats.successCount} successful payments`}
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
              <DollarSign className="w-8 h-8 text-blue-500" />
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

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({payments.length})
        </button>
        <button
          onClick={() => setFilter('success')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Successful ({payments.filter(p => p.status === 'success').length})
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'failed'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Failed ({payments.filter(p => p.status === 'failed').length})
        </button>
      </div>

      {/* Payment List */}
      {filteredPayments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No payment history found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.paymentId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(payment.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        <div>
                          <div>{payment.description}</div>
                          <div className="text-xs text-gray-500">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {payment.status === 'failed' && payment.errorMessage ? (
                        <div className="text-red-600 text-xs max-w-xs truncate" title={payment.errorMessage}>
                          {payment.errorMessage}
                        </div>
                      ) : payment.stripePaymentIntentId ? (
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
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
