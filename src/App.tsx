import React, { useState, useEffect } from 'react';
import { Shield, User, Mail, Phone, Calendar, FileText, Check, X, Eye, LogOut, AlertCircle, Loader2 } from 'lucide-react';

interface KYCRecord {
  id: number;
  user_id: number;
  customer_email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  id_type?: string;
  id_number?: string;
  country?: string;
  city?: string;
  state_province?: string;
  zip_code?: string;
  line1?: string;
  house_name?: string;
  date_of_birth?: string;
  id_front_image?: string;
  selfie_image?: string;
  status?: string;
}

interface AdminCredentials {
  username: string;
  password: string;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AdminLoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState<AdminCredentials>({ username: '', password: '' });
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [selectedKyc, setSelectedKyc] = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('admin_access_token'));

  const API_BASE: string = (import.meta as any).env?.VITE_API_BASE_URL || '';
  const apiUrl = (path: string) => `${API_BASE}${path}`;

  const getStatusBadgeClasses = (status?: string) => {
    const normalized = (status ?? 'pending').toLowerCase();
    if (normalized === 'approved') return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20';
    if (normalized === 'rejected') return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20';
    return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20';
  };

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  const getAuthHeader = () => {
    return `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Perform real admin login to get JWT (kept for future admin features)
      const response = await fetch(apiUrl('/admin/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
      });

      if (response.status === 401) {
        showToast('error', 'Invalid admin credentials.');
        return;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || 'Authentication failed');
      }

      const data: AdminLoginResponse = await response.json();
      if (!data?.access_token) {
        throw new Error('Missing access token in response');
      }
      // Store JWT for later features (note: KYC endpoints use Basic Auth)
      localStorage.setItem('admin_access_token', data.access_token);
      setAccessToken(data.access_token);

      setIsAuthenticated(true);
      showToast('success', 'Login successful');
      fetchPendingKYCs();
    } catch (error) {
      showToast('error', 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingKYCs = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/admin/kyc/pending'), {
        headers: {
          'Authorization': getAuthHeader(),
        },
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        showToast('error', 'Session expired. Please login again.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch KYC records');
      }

      const data = await response.json();
      setKycRecords(data);
    } catch (error) {
      showToast('error', 'Failed to load KYC records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openKYCDetails = (record: KYCRecord) => {
    setSelectedKyc(record);
  };

  const approveKYC = async (kycId: number) => {
    setProcessingId(kycId);
    try {
      const response = await fetch(apiUrl(`/admin/kyc/${kycId}/approve`), {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
        },
      });

      if (response.status === 400) {
        showToast('error', 'KYC already processed. Refreshing list...');
        fetchPendingKYCs();
        return;
      }

      if (response.status === 404) {
        showToast('error', 'Record not found.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to approve KYC');
      }

      const data = await response.json();
      showToast('success', data.message || 'KYC approved successfully.');
      setKycRecords(prev => prev.filter(kyc => kyc.id !== kycId));
      setSelectedKyc(null);
    } catch (error) {
      showToast('error', 'Server error. Please retry.');
    } finally {
      setProcessingId(null);
    }
  };

  const rejectKYC = async (kycId: number, reason: string = '') => {
    setProcessingId(kycId);
    try {
      const formData = new FormData();
      if (reason.trim()) {
        formData.append('reason', reason.trim());
      }

      const response = await fetch(apiUrl(`/admin/kyc/${kycId}/reject`), {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
        },
        body: formData,
      });

      if (response.status === 400) {
        showToast('error', 'KYC already processed. Refreshing list...');
        fetchPendingKYCs();
        return;
      }

      if (response.status === 404) {
        showToast('error', 'Record not found.');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to reject KYC');
      }

      const data = await response.json();
      showToast('success', 'KYC rejected successfully.');
      setKycRecords(prev => prev.filter(kyc => kyc.id !== kycId));
      setSelectedKyc(null);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (error) {
      showToast('error', 'Server error. Please retry.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCredentials({ username: '', password: '' });
    setKycRecords([]);
    setSelectedKyc(null);
    localStorage.removeItem('admin_access_token');
    setAccessToken(null);
    showToast('info', 'Logged out successfully');
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchPendingKYCs();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">KYC Admin Panel</h1>
              <p className="text-gray-600">Sign in to manage KYC approvals</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  required
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter admin username"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  required
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="Enter admin password"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>
        
        {/* Toast Container */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-80 ${
                toast.type === 'success' ? 'bg-green-600 text-white' :
                toast.type === 'error' ? 'bg-red-600 text-white' :
                'bg-blue-600 text-white'
              }`}
            >
              {toast.type === 'success' ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : toast.type === 'error' ? (
                <X className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">KYC Admin Panel</h1>
                <p className="text-sm text-gray-500">Manage verification approvals</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{credentials.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pending KYC Applications</h2>
            <p className="text-gray-600 mt-1">{kycRecords.length} applications awaiting review</p>
          </div>
          
          <button
            onClick={fetchPendingKYCs}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <Loader2 className="animate-spin w-4 h-4 mr-2" />
            ) : (
              <AlertCircle className="w-4 h-4 mr-2" />
            )}
            Refresh
          </button>
        </div>

        {loading && kycRecords.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Loader2 className="animate-spin w-8 h-8 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading KYC applications...</p>
          </div>
        ) : kycRecords.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-600">No pending KYC applications to review.</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submission Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {kycRecords.map((kyc) => (
                    <tr key={kyc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                            {(() => {
                              const fullName = `${kyc.first_name ?? ''} ${kyc.last_name ?? ''}`.trim();
                              return fullName || 'N/A';
                            })()}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {kyc.customer_email}
                            </div>
                              {kyc.phone_number && (
                              <div className="text-sm text-gray-500 flex items-center mt-1">
                                <Phone className="w-3 h-3 mr-1" />
                                  {kyc.phone_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <FileText className="w-3 h-3 mr-1" />
                            ID: {kyc.id} | User: {kyc.user_id}
                          </div>
                          {kyc.id_type && (
                            <div className="text-xs text-gray-400">
                              ID Type: {kyc.id_type}
                            </div>
                          )}
                          {kyc.date_of_birth && (
                            <div className="flex items-center text-xs text-gray-400">
                              <Calendar className="w-3 h-3 mr-1" />
                              DOB: {new Date(kyc.date_of_birth).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => openKYCDetails(kyc)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </button>
                        
                        <button
                          onClick={() => approveKYC(kyc.id)}
                          disabled={processingId === kyc.id}
                          className="inline-flex items-center px-3 py-1 border border-transparent shadow-sm text-xs leading-4 font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {processingId === kyc.id ? (
                            <Loader2 className="animate-spin w-3 h-3 mr-1" />
                          ) : (
                            <Check className="w-3 h-3 mr-1" />
                          )}
                          Approve
                        </button>
                        
                        <button
                          onClick={() => {
                            setSelectedKyc(kyc);
                            setShowRejectModal(true);
                          }}
                          disabled={processingId === kyc.id}
                          className="inline-flex items-center px-3 py-1 border border-transparent shadow-sm text-xs leading-4 font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* KYC Details Modal */}
      {selectedKyc && !showRejectModal && (
        <div className="fixed inset-0 bg-gray-700/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50" onClick={() => setSelectedKyc(null)}>
          <div className="relative top-24 mx-auto w-full max-w-3xl bg-white rounded-xl shadow-2xl ring-1 ring-gray-950/5" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">KYC Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">ID: {selectedKyc.id}</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusBadgeClasses(selectedKyc.status)}`}>
                  {(selectedKyc.status ?? 'pending').toString().replace(/^./, c => c.toUpperCase())}
                </span>
                <button onClick={() => setSelectedKyc(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">User</h4>
                  <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                    <dt className="col-span-1 text-gray-500">Full name</dt>
                    <dd className="col-span-2 text-gray-900 font-medium">{`${selectedKyc.first_name ?? ''} ${selectedKyc.last_name ?? ''}`.trim() || 'N/A'}</dd>

                    <dt className="col-span-1 text-gray-500">Email</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.customer_email}</dd>

                    <dt className="col-span-1 text-gray-500">Phone</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.phone_number || 'N/A'}</dd>

                    <dt className="col-span-1 text-gray-500">User ID</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.user_id}</dd>

                    <dt className="col-span-1 text-gray-500">DOB</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.date_of_birth ? new Date(selectedKyc.date_of_birth).toLocaleDateString() : 'N/A'}</dd>
                  </dl>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Identity</h4>
                  <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                    <dt className="col-span-1 text-gray-500">ID Type</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.id_type || 'N/A'}</dd>

                    <dt className="col-span-1 text-gray-500">ID Number</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.id_number || 'N/A'}</dd>

                    <dt className="col-span-1 text-gray-500">Country</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.country || 'N/A'}</dd>

                    <dt className="col-span-1 text-gray-500">City</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.city || 'N/A'}</dd>

                    <dt className="col-span-1 text-gray-500">State/Province</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.state_province || 'N/A'}</dd>

                    <dt className="col-span-1 text-gray-500">Zip</dt>
                    <dd className="col-span-2 text-gray-900">{selectedKyc.zip_code || 'N/A'}</dd>

                    <dt className="col-span-1 text-gray-500">Address</dt>
                    <dd className="col-span-2 text-gray-900">
                      {[
                        selectedKyc.line1,
                        selectedKyc.house_name,
                        selectedKyc.city,
                        selectedKyc.state_province,
                        selectedKyc.zip_code,
                        selectedKyc.country,
                      ].filter(Boolean).join(', ') || 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>

              {(selectedKyc.id_front_image || selectedKyc.selfie_image) && (
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Documents</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedKyc.id_front_image ? (
                      <a href={selectedKyc.id_front_image} target="_blank" rel="noreferrer" className="group inline-block">
                        <div className="text-xs text-gray-500 mb-2">ID Front</div>
                        <img src={selectedKyc.id_front_image} alt="ID Front" className="h-64 w-full object-cover rounded-lg border shadow-sm group-hover:ring-2 group-hover:ring-blue-500 transition" />
                      </a>
                    ) : (
                      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-xs text-gray-400">No ID front</div>
                    )}
                    {selectedKyc.selfie_image ? (
                      <a href={selectedKyc.selfie_image} target="_blank" rel="noreferrer" className="group inline-block">
                        <div className="text-xs text-gray-500 mb-2">Selfie</div>
                        <img src={selectedKyc.selfie_image} alt="Selfie" className="h-64 w-full object-cover rounded-lg border shadow-sm group-hover:ring-2 group-hover:ring-blue-500 transition" />
                      </a>
                    ) : (
                      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-xs text-gray-400">No selfie</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                onClick={() => setSelectedKyc(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(true);
                }}
                disabled={processingId === selectedKyc.id}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {processingId === selectedKyc.id ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2 inline" />
                    Rejecting...
                  </>
                ) : (
                  'Reject'
                )}
              </button>
              <button
                onClick={() => approveKYC(selectedKyc.id)}
                disabled={processingId === selectedKyc.id}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {processingId === selectedKyc.id ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2 inline" />
                    Processing...
                  </>
                ) : (
                  'Approve'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
 

      {/* Reject Modal */}
      {showRejectModal && selectedKyc && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={() => setShowRejectModal(false)}>
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">Reject KYC Application</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              You are about to reject the KYC application for <strong>{selectedKyc.customer_email}</strong>.
            </p>
            
            <div className="mb-6">
              <label htmlFor="reject-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (Optional)
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
                placeholder="Enter reason for rejection..."
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectKYC(selectedKyc.id, rejectReason)}
                disabled={processingId === selectedKyc.id}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {processingId === selectedKyc.id ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4 mr-2 inline" />
                    Rejecting...
                  </>
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-80 ${
              toast.type === 'success' ? 'bg-green-600 text-white' :
              toast.type === 'error' ? 'bg-red-600 text-white' :
              'bg-blue-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <X className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;