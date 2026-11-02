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
  Star,
  Flag,
  MessageSquare,
  Camera,
  Image as ImageIcon,
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
  media?: {
    beforeWorkPhotos?: { id: string; fileUrl: string; caption?: string; createdAt?: string }[];
    afterWorkPhotos?: { id: string; fileUrl: string; caption?: string; createdAt?: string }[];
    problemPhotos?: { id: string; fileUrl: string; caption?: string; createdAt?: string }[];
  };
}

interface ReviewItemAdmin {
  id: string;
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  providerName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED' | 'FLAGGED';
  reportCount: number;
  providerResponse?: string | null;
  moderationReason?: string | null;
  photos?: string[];
  createdAt: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState<'radar' | 'kyc' | 'reviews' | 'catalog' | 'audit'>('radar');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'FLAGGED' | 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED'>('ALL');
  const [selectedReviewForMod, setSelectedReviewForMod] = useState<ReviewItemAdmin | null>(null);
  const [selectedBookingForMedia, setSelectedBookingForMedia] = useState<BookingItem | null>(null);
  const [modReason, setModReason] = useState('');
  const [reviews, setReviews] = useState<ReviewItemAdmin[]>([
    {
      id: 'rev_01',
      bookingId: 'bk_01h8a...',
      bookingNumber: 'LM-20261017-X82A',
      customerName: 'Ananya Roy',
      providerName: 'Ramesh Electrical Works',
      rating: 5,
      title: 'Prompt and highly professional',
      comment: 'Arrived exactly within the 10-minute window and fixed the tripping MCB without fuss. Cleaned up afterwards.',
      status: 'PUBLISHED',
      reportCount: 0,
      photos: [
        'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600',
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600',
      ],
      createdAt: '2026-10-18 10:30 UTC',
    },
    {
      id: 'rev_02',
      bookingId: 'bk_01h8b...',
      bookingNumber: 'LM-20261017-B91K',
      customerName: 'Vikram Mehta',
      providerName: 'Sharma Plumbing Co.',
      rating: 1,
      title: 'Suspicious abusive language in comment',
      comment: 'This service provider was completely rude and used vulgar language when requesting extra parts payment.',
      status: 'FLAGGED',
      reportCount: 2,
      createdAt: '2026-10-19 14:15 UTC',
    },
    {
      id: 'rev_03',
      bookingId: 'bk_01h8c...',
      bookingNumber: 'LM-20261017-C44P',
      customerName: 'Sunita Rao',
      providerName: 'Apex Appliance Care',
      rating: 4,
      title: 'Good AC cleaning',
      comment: 'Deep foam jet clean made the cooling much better. Provider was 15 mins late due to rain.',
      status: 'PUBLISHED',
      providerResponse: 'Thank you Sunita ji! We apologise for the rain delay and appreciate your feedback.',
      reportCount: 0,
      createdAt: '2026-10-19 16:45 UTC',
    },
    {
      id: 'rev_04',
      bookingId: 'bk_01h8d...',
      bookingNumber: 'LM-20261018-D72Z',
      customerName: 'Rajesh G.',
      providerName: 'Urban Clean Express',
      rating: 2,
      title: 'Pending review queue check',
      comment: 'Contains competitor phone numbers and spam links to outside service.',
      status: 'PENDING',
      reportCount: 1,
      createdAt: '2026-10-20 09:12 UTC',
    },
  ]);

  const handleApplyModeration = (newStatus: 'PUBLISHED' | 'HIDDEN' | 'REMOVED' | 'FLAGGED') => {
    if (!selectedReviewForMod) return;
    if (!modReason.trim()) {
      alert('A moderation reason is mandatory for all admin review decisions.');
      return;
    }

    setReviews(prev =>
      prev.map(r =>
        r.id === selectedReviewForMod.id
          ? { ...r, status: newStatus, moderationReason: modReason.trim() }
          : r
      )
    );
    setSelectedReviewForMod(null);
    setModReason('');
  };

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
      media: {
        beforeWorkPhotos: [
          {
            id: 'med_01',
            fileUrl: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600',
            caption: 'AC indoor unit coil and filter before jet cleaning',
            createdAt: '10:05 AM',
          },
        ],
        afterWorkPhotos: [
          {
            id: 'med_02',
            fileUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600',
            caption: 'Sanitized blower fan & outdoor unit high-pressure jet washed',
            createdAt: '11:45 AM',
          },
        ],
        problemPhotos: [
          {
            id: 'med_03',
            fileUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600',
            caption: 'Customer initial complaint: Water leaking from right drain pipe',
            createdAt: '09:30 AM',
          },
        ],
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
      media: {
        problemPhotos: [
          {
            id: 'med_04',
            fileUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600',
            caption: 'Kitchen sink pipe joint fracture and dripping water',
            createdAt: '01:45 PM',
          },
        ],
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
      media: {
        beforeWorkPhotos: [
          {
            id: 'med_05',
            fileUrl: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600',
            caption: 'Burnt insulation on 32A main distribution board switch',
            createdAt: '11:35 AM',
          },
        ],
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
          onClick={() => setActiveTab('reviews')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            color: activeTab === 'reviews' ? '#F59E0B' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderBottom: activeTab === 'reviews' ? '2px solid #F59E0B' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Star size={18} />
          Review Moderation ({reviews.filter(r => r.status === 'FLAGGED' || r.status === 'PENDING').length})
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
                        onClick={() => setSelectedBookingForMedia(b)}
                        className="btn-secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <Camera size={14} color="#38BDF8" />
                        Photos & Evidence
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

      {/* Tab Content: Review Moderation Queue (Phase 3J) */}
      {activeTab === 'reviews' && (
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Customer Reviews Moderation Queue</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Auditable moderation for completed booking reviews, flagged content, and provider responses.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['ALL', 'FLAGGED', 'PENDING', 'PUBLISHED', 'HIDDEN', 'REMOVED'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setReviewFilter(filter)}
                  style={{
                    background: reviewFilter === filter ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid ${reviewFilter === filter ? '#F59E0B' : 'var(--border-subtle)'}`,
                    color: reviewFilter === filter ? '#FBBF24' : 'var(--text-muted)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {reviews
              .filter(r => reviewFilter === 'ALL' || r.status === reviewFilter)
              .map(r => (
                <div
                  key={r.id}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    borderLeft: `4px solid ${
                      r.status === 'FLAGGED'
                        ? '#EF4444'
                        : r.status === 'PENDING'
                        ? '#F59E0B'
                        : r.status === 'PUBLISHED'
                        ? '#10B981'
                        : '#64748B'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '2px', color: '#F59E0B' }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={16}
                              fill={i < r.rating ? '#F59E0B' : 'none'}
                              color="#F59E0B"
                            />
                          ))}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.title || 'Untitled Review'}</span>
                        <span
                          className={`badge ${
                            r.status === 'PUBLISHED'
                              ? 'badge-completed'
                              : r.status === 'FLAGGED'
                              ? 'badge-cancelled'
                              : 'badge-pending'
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.reportCount > 0 && (
                          <span
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#F87171',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Flag size={12} />
                            {r.reportCount} {r.reportCount === 1 ? 'Report' : 'Reports'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Booking #{r.bookingNumber} • Customer: <strong style={{ color: '#F8FAFC' }}>{r.customerName}</strong> • Provider: <strong style={{ color: '#F8FAFC' }}>{r.providerName}</strong>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedReviewForMod(r);
                        setModReason(r.moderationReason || '');
                      }}
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      Moderate Review
                    </button>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: '10px 0', lineHeight: 1.5 }}>
                    "{r.comment}"
                  </p>

                  {r.photos && r.photos.length > 0 && (
                    <div style={{ margin: '12px 0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ImageIcon size={12} />
                        Customer Attached Photos ({r.photos.length})
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {r.photos.map((photoUrl, pIdx) => (
                          <a
                            key={pIdx}
                            href={photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}
                          >
                            <img
                              src={photoUrl}
                              alt={`Customer photo ${pIdx + 1}`}
                              style={{ width: '72px', height: '72px', objectFit: 'cover', display: 'block' }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.providerResponse && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        marginTop: '10px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FBBF24', fontWeight: 600, marginBottom: '4px' }}>
                        <MessageSquare size={14} />
                        Provider Response
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>{r.providerResponse}</div>
                    </div>
                  )}

                  {r.moderationReason && (
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '8px', fontStyle: 'italic' }}>
                      Audit Note: {r.moderationReason}
                    </div>
                  )}
                </div>
              ))}
          </div>

          {/* Moderation Action Modal */}
          {selectedReviewForMod && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)',
              }}
            >
              <div
                className="glass-panel"
                style={{
                  width: '520px',
                  maxWidth: '90vw',
                  padding: '24px',
                  background: '#0F172A',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Review Moderation Decision</h3>
                  <button
                    onClick={() => setSelectedReviewForMod(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ marginBottom: '16px', background: 'rgba(30, 41, 59, 0.6)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Booking: #{selectedReviewForMod.bookingNumber}</div>
                  <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{selectedReviewForMod.customerName} ({selectedReviewForMod.rating} ★)</div>
                  <div style={{ color: 'var(--text-dim)', marginTop: '4px', fontStyle: 'italic' }}>"{selectedReviewForMod.comment}"</div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#F8FAFC', marginBottom: '6px' }}>
                    Mandatory Moderation Reason (Audited) *
                  </label>
                  <textarea
                    value={modReason}
                    onChange={e => setModReason(e.target.value)}
                    placeholder="Specify exact policy rationale (e.g., Verified authentic customer feedback, Abusive language violation under Sec 4.2, Spam link removal)..."
                    rows={3}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px',
                      color: '#F8FAFC',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <button
                    onClick={() => handleApplyModeration('PUBLISHED')}
                    style={{
                      padding: '10px',
                      background: '#065F46',
                      color: '#34D399',
                      border: '1px solid #10B981',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Publish / Keep Active
                  </button>
                  <button
                    onClick={() => handleApplyModeration('HIDDEN')}
                    style={{
                      padding: '10px',
                      background: '#78350F',
                      color: '#FBBF24',
                      border: '1px solid #D97706',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    👁 Hide from Profile
                  </button>
                  <button
                    onClick={() => handleApplyModeration('FLAGGED')}
                    style={{
                      padding: '10px',
                      background: '#831843',
                      color: '#F472B6',
                      border: '1px solid #DB2777',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ⚑ Flag for Investigation
                  </button>
                  <button
                    onClick={() => handleApplyModeration('REMOVED')}
                    style={{
                      padding: '10px',
                      background: '#7F1D1D',
                      color: '#F87171',
                      border: '1px solid #EF4444',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Remove Permanently
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Job Photos & Evidence Inspector (Phase 3L) */}
          {selectedBookingForMedia && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
              }}
            >
              <div
                className="glass-panel"
                style={{
                  maxWidth: '820px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  padding: '28px',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                  background: '#0F172A',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '14px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Camera size={20} color="#38BDF8" />
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC' }}>
                        Job Photos & Field Evidence
                      </h3>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Booking #{selectedBookingForMedia.bookingNumber} • {selectedBookingForMedia.service.name}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBookingForMedia(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-dim)',
                      fontSize: '1.4rem',
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Booking Summary Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '12px',
                    background: 'rgba(30, 41, 59, 0.5)',
                    padding: '14px',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>CUSTOMER</div>
                    <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{selectedBookingForMedia.customer.fullName}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{selectedBookingForMedia.customer.phoneNumber}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>ASSIGNED PRO</div>
                    <div style={{ fontWeight: 600, color: '#F8FAFC' }}>
                      {selectedBookingForMedia.provider?.user.fullName || 'Unassigned'}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      {selectedBookingForMedia.provider?.businessName || ''}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>CURRENT STATUS</div>
                    <div style={{ marginTop: '2px' }}>{getStatusBadge(selectedBookingForMedia.currentStatus)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>START OTP</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#FBBF24', letterSpacing: '0.05em' }}>
                      {selectedBookingForMedia.startOtp}
                    </div>
                  </div>
                </div>

                {/* Categorized Media Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 1. Customer Problem / Inspection Photos */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                        Customer Problem Photos ({selectedBookingForMedia.media?.problemPhotos?.length || 0})
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Captured at request</span>
                    </div>
                    {(!selectedBookingForMedia.media?.problemPhotos || selectedBookingForMedia.media.problemPhotos.length === 0) ? (
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic', padding: '8px 0' }}>
                        No problem photos submitted by customer for this booking.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                        {selectedBookingForMedia.media.problemPhotos.map((photo) => (
                          <div key={photo.id} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#1E293B' }}>
                            <a href={photo.fileUrl} target="_blank" rel="noreferrer">
                              <img src={photo.fileUrl} alt="Problem Photo" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                            </a>
                            <div style={{ padding: '8px 10px', fontSize: '0.75rem' }}>
                              <div style={{ color: '#F8FAFC', fontWeight: 500 }}>{photo.caption || 'Customer issue report'}</div>
                              {photo.createdAt && <div style={{ color: 'var(--text-dim)', marginTop: '2px' }}>{photo.createdAt}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. Before-Work vs After-Work Side-by-Side Proof */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                    {/* Before-Work */}
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8' }} />
                          Before-Work Photos ({selectedBookingForMedia.media?.beforeWorkPhotos?.length || 0})
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#38BDF8' }}>Provider Arrival Proof</span>
                      </div>
                      {(!selectedBookingForMedia.media?.beforeWorkPhotos || selectedBookingForMedia.media.beforeWorkPhotos.length === 0) ? (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic', padding: '8px 0' }}>
                          No before-work photos uploaded yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {selectedBookingForMedia.media.beforeWorkPhotos.map((photo) => (
                            <div key={photo.id} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#1E293B' }}>
                              <a href={photo.fileUrl} target="_blank" rel="noreferrer">
                                <img src={photo.fileUrl} alt="Before Work" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                              </a>
                              <div style={{ padding: '8px 10px', fontSize: '0.75rem' }}>
                                <div style={{ color: '#F8FAFC', fontWeight: 500 }}>{photo.caption || 'Pre-work inspection proof'}</div>
                                {photo.createdAt && <div style={{ color: 'var(--text-dim)', marginTop: '2px' }}>{photo.createdAt}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* After-Work */}
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                          After-Work Photos ({selectedBookingForMedia.media?.afterWorkPhotos?.length || 0})
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#10B981' }}>Work Completed Proof</span>
                      </div>
                      {(!selectedBookingForMedia.media?.afterWorkPhotos || selectedBookingForMedia.media.afterWorkPhotos.length === 0) ? (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic', padding: '8px 0' }}>
                          No after-work photos uploaded yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {selectedBookingForMedia.media.afterWorkPhotos.map((photo) => (
                            <div key={photo.id} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: '#1E293B' }}>
                              <a href={photo.fileUrl} target="_blank" rel="noreferrer">
                                <img src={photo.fileUrl} alt="After Work" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                              </a>
                              <div style={{ padding: '8px 10px', fontSize: '0.75rem' }}>
                                <div style={{ color: '#F8FAFC', fontWeight: 500 }}>{photo.caption || 'Completed job execution verification'}</div>
                                {photo.createdAt && <div style={{ color: 'var(--text-dim)', marginTop: '2px' }}>{photo.createdAt}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setSelectedBookingForMedia(null)}
                    className="btn-secondary"
                    style={{ padding: '8px 20px', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Close Inspector
                  </button>
                </div>
              </div>
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
                <span style={{ color: '#F472B6', fontWeight: 700 }}>REVIEW_MODERATED</span>
                <span style={{ color: 'var(--text-dim)' }}>•</span>
                <span>Review rev_02 flagged by moderator (Vikram Mehta vs Sharma Plumbing Co.)</span>
              </div>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                2026-10-20 11:45:00 UTC
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
