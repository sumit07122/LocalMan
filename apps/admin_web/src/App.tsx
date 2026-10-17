import { useState } from 'react';
import {
  ShieldCheck,
  Activity,
  Wrench,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Layers,
  Lock,
} from 'lucide-react';

interface Metrics {
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  totalCustomers: number;
  totalProviders: number;
  pendingKycReviews: number;
  totalRevenueInr: string;
}

interface KycDoc {
  id: string;
  documentType: string;
  documentNumber: string;
  fileUrl: string;
  status: string;
  provider: {
    businessName: string | null;
    user: {
      fullName: string | null;
      phoneNumber: string;
    };
  };
}

interface BookingItem {
  id: string;
  bookingNumber: string;
  currentStatus: string;
  pricingModel: string;
  scheduledTimeSlot: string;
  startOtp: string;
  totalAmountPaisa: number;
  service: {
    name: string;
    category: string;
  };
  customer: {
    fullName: string;
    phoneNumber: string;
  };
  provider?: {
    businessName: string;
    user: {
      fullName: string;
      phoneNumber: string;
    };
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState<'radar' | 'kyc' | 'catalog' | 'audit'>('radar');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock initial state representing real seeded database data
  const [metrics, setMetrics] = useState<Metrics>({
    totalBookings: 184,
    activeBookings: 28,
    completedBookings: 142,
    totalCustomers: 1250,
    totalProviders: 86,
    pendingKycReviews: 4,
    totalRevenueInr: '1,42,850.00',
  });

  const [kycDocs, setKycDocs] = useState<KycDoc[]>([
    {
      id: 'doc_01',
      documentType: 'AADHAAR_FRONT',
      documentNumber: 'XXXX-XXXX-4819',
      fileUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop',
      status: 'PENDING',
      provider: {
        businessName: 'Ramesh Electrical Works',
        user: { fullName: 'Ramesh Kumar', phoneNumber: '+91 9876543210' },
      },
    },
    {
      id: 'doc_02',
      documentType: 'PAN_CARD',
      documentNumber: 'ABCDE1234F',
      fileUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop',
      status: 'PENDING',
      provider: {
        businessName: 'Sharma Plumbing Co.',
        user: { fullName: 'Prakash Sharma', phoneNumber: '+91 9811223344' },
      },
    },
    {
      id: 'doc_03',
      documentType: 'TRADE_CERTIFICATE',
      documentNumber: 'TC-AC-2024-88',
      fileUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop',
      status: 'PENDING',
      provider: {
        businessName: 'CoolCare AC Solutions',
        user: { fullName: 'Amit Verma', phoneNumber: '+91 9722334455' },
      },
    },
  ]);

  const [activeBookings] = useState<BookingItem[]>([
    {
      id: 'bkg_001',
      bookingNumber: 'LM-20261017-X82A',
      currentStatus: 'JOB_STARTED',
      pricingModel: 'FIXED_PRICE',
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      startOtp: '482910',
      totalAmountPaisa: 49900,
      service: { name: 'Split AC Deep Jet Service', category: 'AC & Appliance' },
      customer: { fullName: 'Ananya Deshmukh', phoneNumber: '+91 9820011223' },
      provider: {
        businessName: 'CoolCare AC Solutions',
        user: { fullName: 'Amit Verma', phoneNumber: '+91 9722334455' },
      },
    },
    {
      id: 'bkg_002',
      bookingNumber: 'LM-20261017-P91K',
      currentStatus: 'PROVIDER_ON_THE_WAY',
      pricingModel: 'HOURLY',
      scheduledTimeSlot: '02:00 PM - 03:00 PM',
      startOtp: '817290',
      totalAmountPaisa: 29900,
      service: { name: 'General Plumber by the Hour', category: 'Plumbing' },
      customer: { fullName: 'Vikram Sengupta', phoneNumber: '+91 9830044556' },
      provider: {
        businessName: 'Sharma Plumbing Co.',
        user: { fullName: 'Prakash Sharma', phoneNumber: '+91 9811223344' },
      },
    },
    {
      id: 'bkg_003',
      bookingNumber: 'LM-20261017-M34F',
      currentStatus: 'JOB_EXTENDED',
      pricingModel: 'INSPECTION_QUOTE',
      scheduledTimeSlot: '11:30 AM - 01:00 PM',
      startOtp: '339182',
      totalAmountPaisa: 124000,
      service: { name: 'Complete House Wiring Inspection', category: 'Electrical' },
      customer: { fullName: 'Rajesh Nair', phoneNumber: '+91 9845011998' },
      provider: {
        businessName: 'Ramesh Electrical Works',
        user: { fullName: 'Ramesh Kumar', phoneNumber: '+91 9876543210' },
      },
    },
  ]);

  const handleApproveDoc = (docId: string) => {
    setKycDocs((prev) => prev.filter((d) => d.id !== docId));
    setMetrics((prev) => ({
      ...prev,
      pendingKycReviews: Math.max(0, prev.pendingKycReviews - 1),
      totalProviders: prev.totalProviders + 1,
    }));
  };

  const handleRejectDoc = (docId: string) => {
    setKycDocs((prev) => prev.filter((d) => d.id !== docId));
    setMetrics((prev) => ({
      ...prev,
      pendingKycReviews: Math.max(0, prev.pendingKycReviews - 1),
    }));
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return <span className="badge badge-requested">Requested</span>;
      case 'PROVIDER_ON_THE_WAY':
        return <span className="badge badge-ontheway">On The Way</span>;
      case 'JOB_STARTED':
        return <span className="badge badge-started">Job In Progress</span>;
      case 'JOB_EXTENDED':
        return <span className="badge badge-pending">Materials Added</span>;
      case 'JOB_COMPLETED':
      case 'PAYMENT_SETTLED':
        return <span className="badge badge-completed">Settled</span>;
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
            }}
          >
            <Wrench size={24} color="#0F172A" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                LOCALMAN
              </h1>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#FBBF24',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                OPS HUB v1.0
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Production Management Console • India Multi-City Cluster
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
            }}
          >
            <div className="pulse-indicator"></div>
            <span style={{ color: '#34D399', fontWeight: 600 }}>API v1 Active</span>
            <span style={{ color: 'var(--text-dim)' }}>|</span>
            <span style={{ color: 'var(--text-muted)' }}>Port 4000</span>
          </div>

          <button
            onClick={handleRefresh}
            className="btn-secondary"
            style={{ padding: '8px 14px' }}
          >
            <RefreshCw
              size={16}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            Refresh
          </button>
        </div>
      </header>

      {/* KPI Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>ACTIVE JOBS</span>
            <Activity size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FBBF24' }}>
            {metrics.activeBookings}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Live in transit or in progress
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>TOTAL BOOKINGS</span>
            <Layers size={18} color="#3B82F6" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{metrics.totalBookings}</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            All-time platform bookings
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>VERIFIED PROS</span>
            <ShieldCheck size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>
            {metrics.totalProviders}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Active verified partners
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>PENDING KYC</span>
            <AlertTriangle size={18} color="#F43F5E" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FB7185' }}>
            {metrics.pendingKycReviews}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Requires admin action
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>SETTLED GMV</span>
            <DollarSign size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F8FAFC' }}>
            ₹{metrics.totalRevenueInr}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Total service revenue
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
          paddingBottom: '4px',
        }}
      >
        <button
          onClick={() => setActiveTab('radar')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            color: activeTab === 'radar' ? '#F59E0B' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'radar' ? '2px solid #F59E0B' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Activity size={18} />
          Active Operations Radar
        </button>

        <button
          onClick={() => setActiveTab('kyc')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            color: activeTab === 'kyc' ? '#F59E0B' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'kyc' ? '2px solid #F59E0B' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldCheck size={18} />
          KYC Verification Queue ({kycDocs.length})
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            color: activeTab === 'catalog' ? '#F59E0B' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'catalog' ? '2px solid #F59E0B' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Layers size={18} />
          Service Catalog
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            color: activeTab === 'audit' ? '#F59E0B' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'audit' ? '2px solid #F59E0B' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Lock size={18} />
          Audit & Security Ledger
        </button>
      </div>

      {/* Tab Content: Operations Radar */}
      {activeTab === 'radar' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                Live Bookings Dispatch & Execution
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Real-time lifecycle tracking, customer Start OTP verification, and materials monitoring.
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-dim)',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Booking Number</th>
                  <th style={{ padding: '12px 16px' }}>Service</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Pro</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Start OTP</th>
                  <th style={{ padding: '12px 16px' }}>Total Amount</th>
                  <th style={{ padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeBookings.map((b) => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
                      transition: 'background 0.2s',
                    }}
                  >
                    <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {b.bookingNumber}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600 }}>{b.service.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {b.pricingModel} • {b.scheduledTimeSlot}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 500 }}>{b.customer.fullName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {b.customer.phoneNumber}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {b.provider ? (
                        <>
                          <div style={{ fontWeight: 500 }}>{b.provider.user.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {b.provider.businessName}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#FBBF24', fontSize: '0.85rem' }}>Auto-Dispatching...</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>{getStatusBadge(b.currentStatus)}</td>
                    <td style={{ padding: '16px' }}>
                      <span
                        style={{
                          background: 'rgba(245, 158, 11, 0.1)',
                          color: '#FBBF24',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                        }}
                      >
                        {b.startOtp}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontWeight: 700 }}>
                      ₹{(b.totalAmountPaisa / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: KYC Verification Queue */}
      {activeTab === 'kyc' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              Partner KYC Document Verification Queue
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Side-by-side Aadhaar, PAN card, and trade certificate verification before granting platform access.
            </p>
          </div>

          {kycDocs.length === 0 ? (
            <div
              className="glass-panel"
              style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}
            >
              <CheckCircle size={48} color="#10B981" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.2rem', color: '#F8FAFC', marginBottom: '8px' }}>
                All KYC Verifications Up to Date!
              </h3>
              <p>No pending partner documents require administrative review at this time.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {kycDocs.map((doc) => (
                <div key={doc.id} className="glass-panel" style={{ padding: '24px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <span className="badge badge-pending">{doc.documentType}</span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '8px' }}>
                        {doc.provider.businessName || doc.provider.user.fullName}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                        Phone: {doc.provider.user.phoneNumber}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-subtle)',
                      marginBottom: '16px',
                      height: '180px',
                      background: '#020617',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={doc.fileUrl}
                      alt={doc.documentType}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      marginBottom: '20px',
                    }}
                  >
                    Document No: <strong style={{ color: '#F8FAFC' }}>{doc.documentNumber}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => handleApproveDoc(doc.id)}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: '#FFFFFF',
                      }}
                    >
                      <CheckCircle size={16} />
                      Approve & Verify
                    </button>
                    <button
                      onClick={() => handleRejectDoc(doc.id)}
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        color: '#F87171',
                        borderColor: 'rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Service Catalog */}
      {activeTab === 'catalog' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Service Catalog & Commission Rates</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Configured multi-model pricing (Hourly, Fixed, Inspection Quote) and platform take-rates.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#FBBF24', marginBottom: '4px' }}>Plumbing Services</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Tap repair, drain clearing, hourly pipe alterations</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <span>Base: ₹199 - ₹349</span>
                <span style={{ color: '#34D399', fontWeight: 600 }}>15.0% Commission</span>
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#FBBF24', marginBottom: '4px' }}>Electrician & Wiring</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Switches, ceiling fans, complete house wiring quotes</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <span>Base: ₹149 - ₹199</span>
                <span style={{ color: '#34D399', fontWeight: 600 }}>15.0% Commission</span>
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#FBBF24', marginBottom: '4px' }}>AC & Appliance Repair</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Deep foam jet AC service, refrigerator & washing machine</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <span>Base: ₹499 (Jet Clean)</span>
                <span style={{ color: '#34D399', fontWeight: 600 }}>18.0% Commission</span>
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#FBBF24', marginBottom: '4px' }}>Home Deep Cleaning</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Bathroom scrub, kitchen degreasing, full 2BHK clean</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                <span>Base: ₹449 - ₹2,999</span>
                <span style={{ color: '#34D399', fontWeight: 600 }}>20.0% Commission</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Audit & Security Ledger */}
      {activeTab === 'audit' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>System Audit & Security Ledger</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Immutable append-only record of all administrative overrides, verification decisions, and financial triggers.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#34D399', fontWeight: 700 }}>KYC_DOCUMENT_APPROVED</span>
                <span style={{ color: 'var(--text-dim)' }}>•</span>
                <span>Provider Pro-01h8a... (Ramesh Electrical) Aadhaar verified</span>
              </div>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                2026-10-17 22:30:15 UTC
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#FBBF24', fontWeight: 700 }}>BOOKING_START_OTP_VERIFIED</span>
                <span style={{ color: 'var(--text-dim)' }}>•</span>
                <span>Booking LM-20261017-X82A Start OTP checked successfully</span>
              </div>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                2026-10-17 22:15:02 UTC
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#60A5FA', fontWeight: 700 }}>PAYMENT_SETTLED_GATEWAY</span>
                <span style={{ color: 'var(--text-dim)' }}>•</span>
                <span>Razorpay order pay_01h... captured for ₹499.00 (Booking LM-20261017-X82A)</span>
              </div>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                2026-10-17 22:10:48 UTC
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
