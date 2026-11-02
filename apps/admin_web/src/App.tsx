import { useState, useEffect } from 'react';
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
  Search,
  Sliders,
  Check,
  ArrowUpRight,
  TrendingUp,
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
  documentType: 'AADHAAR_FRONT' | 'PAN_CARD' | 'TRADE_CERTIFICATE';
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

type TabType = 'radar' | 'bookings' | 'kyc' | 'reviews' | 'catalog' | 'audit';

export function App() {
  const getInitialTab = (): TabType => {
    try {
      const param = new URLSearchParams(window.location.search).get('tab');
      if (param && ['radar', 'bookings', 'kyc', 'reviews', 'catalog', 'audit'].includes(param)) {
        return param as TabType;
      }
      const hash = window.location.hash.replace('#', '').replace('/', '');
      if (hash && ['radar', 'bookings', 'kyc', 'reviews', 'catalog', 'audit'].includes(hash)) {
        return hash as TabType;
      }
    } catch (_) {}
    return 'radar';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'FLAGGED' | 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED'>('ALL');
  const [selectedReviewForMod, setSelectedReviewForMod] = useState<ReviewItemAdmin | null>(null);
  const [selectedBookingForMedia, setSelectedBookingForMedia] = useState<BookingItem | null>(null);
  const [modReason, setModReason] = useState('');
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [catalogCommission, setCatalogCommission] = useState({
    plumbing: 15.0,
    electrical: 15.0,
    acAppliance: 18.0,
    cleaning: 20.0,
  });
  const [commissionSavedAlert, setCommissionSavedAlert] = useState(false);

  // Sync tab with URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url.toString());
    } catch (_) {}
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    {
      id: 'bkg_004',
      bookingNumber: 'LM-20261017-C88L',
      currentStatus: 'JOB_COMPLETED',
      pricingModel: 'FIXED_PRICE',
      scheduledTimeSlot: '04:00 PM - 06:00 PM',
      startOtp: '194820',
      totalAmountPaisa: 89900,
      service: { name: 'Intense Bathroom Scrub & Sanitization', category: 'Cleaning' },
      customer: { fullName: 'Sneha Kapoor', phoneNumber: '+91 9810234567' },
      provider: {
        businessName: 'Urban Clean Express',
        user: { fullName: 'Sanjay Rawat', phoneNumber: '+91 9899112233' },
      },
    },
  ]);

  const [reviews, setReviews] = useState<ReviewItemAdmin[]>([
    {
      id: 'rev_01',
      bookingId: 'bk_01h8a',
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
      bookingId: 'bk_01h8b',
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
      bookingId: 'bk_01h8c',
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
      bookingId: 'bk_01h8d',
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

  const handleApproveDoc = (docId: string) => {
    setKycDocs((prev) => prev.filter((d) => d.id !== docId));
    setMetrics((prev) => ({
      ...prev,
      pendingKycReviews: Math.max(0, prev.pendingKycReviews - 1),
      totalProviders: prev.totalProviders + 1,
    }));
  };

  const handleOpenRejectDoc = (docId: string) => {
    setRejectingDocId(docId);
    setRejectionReason('Document image is blurred or details do not match registration.');
  };

  const handleConfirmRejectDoc = () => {
    if (!rejectingDocId) return;
    setKycDocs((prev) => prev.filter((d) => d.id !== rejectingDocId));
    setMetrics((prev) => ({
      ...prev,
      pendingKycReviews: Math.max(0, prev.pendingKycReviews - 1),
    }));
    setRejectingDocId(null);
    setRejectionReason('');
  };

  const handleApplyModeration = (newStatus: 'PUBLISHED' | 'HIDDEN' | 'REMOVED' | 'FLAGGED') => {
    if (!selectedReviewForMod) return;
    if (!modReason.trim()) {
      alert('A moderation reason is mandatory for all admin review decisions.');
      return;
    }

    setReviews((prev) =>
      prev.map((r) =>
        r.id === selectedReviewForMod.id
          ? { ...r, status: newStatus, moderationReason: modReason.trim() }
          : r
      )
    );
    setSelectedReviewForMod(null);
    setModReason('');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const handleSaveCommission = () => {
    setCommissionSavedAlert(true);
    setTimeout(() => setCommissionSavedAlert(false), 3000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="badge badge-requested">
            <span className="badge-dot" /> Requested
          </span>
        );
      case 'PROVIDER_ON_THE_WAY':
        return (
          <span className="badge badge-ontheway">
            <span className="badge-dot" /> On The Way
          </span>
        );
      case 'JOB_STARTED':
        return (
          <span className="badge badge-started">
            <span className="badge-dot" /> In Progress
          </span>
        );
      case 'JOB_EXTENDED':
        return (
          <span className="badge badge-pending">
            <span className="badge-dot" /> Materials Added
          </span>
        );
      case 'JOB_COMPLETED':
      case 'PAYMENT_SETTLED':
        return (
          <span className="badge badge-completed">
            <span className="badge-dot" /> Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="badge badge-cancelled">
            <span className="badge-dot" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="badge badge-pending">
            <span className="badge-dot" /> {status}
          </span>
        );
    }
  };

  const filteredBookings = activeBookings.filter((b) => {
    const matchesQuery =
      searchQuery === '' ||
      b.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.provider && b.provider.user.fullName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      bookingStatusFilter === 'ALL' ||
      (bookingStatusFilter === 'ACTIVE' && ['JOB_STARTED', 'PROVIDER_ON_THE_WAY', 'JOB_EXTENDED'].includes(b.currentStatus)) ||
      (bookingStatusFilter === 'COMPLETED' && ['JOB_COMPLETED', 'PAYMENT_SETTLED'].includes(b.currentStatus));

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="admin-shell">
      {/* 1. PROFESSIONAL LEFT SIDEBAR */}
      <aside className="admin-sidebar">
        {/* Brand Header */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #315EFB 0%, #1E40AF 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(49, 94, 251, 0.35)',
              }}
            >
              <Wrench size={20} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  LOCALMAN
                </span>
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    background: 'rgba(49, 94, 251, 0.2)',
                    color: '#93C5FD',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  OPS
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#98A2B3', marginTop: '1px' }}>
                Marketplace Console
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Hierarchy */}
        <nav style={{ padding: '16px 0', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '0 20px 8px', fontSize: '0.6875rem', fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Core Operations
          </div>

          <div
            onClick={() => handleTabChange('radar')}
            className={`nav-item ${activeTab === 'radar' ? 'active' : ''}`}
          >
            <Activity size={18} />
            <span>Operations Radar</span>
          </div>

          <div
            onClick={() => handleTabChange('bookings')}
            className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
          >
            <Layers size={18} />
            <span>Live Bookings</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.7rem',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 7px',
                borderRadius: '12px',
                color: '#E0E7FF',
              }}
            >
              {metrics.activeBookings}
            </span>
          </div>

          <div
            onClick={() => handleTabChange('kyc')}
            className={`nav-item ${activeTab === 'kyc' ? 'active' : ''}`}
          >
            <ShieldCheck size={18} />
            <span>Partner KYC Queue</span>
            {kycDocs.length > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: '#E5484D',
                  color: '#FFFFFF',
                  padding: '2px 7px',
                  borderRadius: '12px',
                }}
              >
                {kycDocs.length}
              </span>
            )}
          </div>

          <div style={{ padding: '16px 20px 8px', fontSize: '0.6875rem', fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Management & Moderation
          </div>

          <div
            onClick={() => handleTabChange('catalog')}
            className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
          >
            <Sliders size={18} />
            <span>Service Catalog & Rates</span>
          </div>

          <div
            onClick={() => handleTabChange('reviews')}
            className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`}
          >
            <Star size={18} />
            <span>Review Moderation</span>
            {reviews.filter((r) => r.status === 'FLAGGED').length > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: '#F5A524',
                  color: '#101828',
                  padding: '2px 7px',
                  borderRadius: '12px',
                }}
              >
                {reviews.filter((r) => r.status === 'FLAGGED').length}
              </span>
            )}
          </div>

          <div
            onClick={() => handleTabChange('audit')}
            className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
          >
            <Lock size={18} />
            <span>Audit & Security Ledger</span>
          </div>
        </nav>

        {/* System Health Pulse Box */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--sidebar-border)' }}>
          <div
            style={{
              background: '#1D2939',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#98A2B3', fontWeight: 600 }}>System Status</span>
              <div className="pulse-indicator" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: '#D0D5DD' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fastify API:</span>
                <span style={{ color: '#12A879', fontWeight: 600 }}>Port 4000 (Live)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Postgres 18:</span>
                <span style={{ color: '#12A879', fontWeight: 600 }}>Port 5432 (Ready)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Administrator Profile Pill */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--sidebar-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#315EFB',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            AO
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Admin Operations
            </div>
            <div style={{ fontSize: '0.7rem', color: '#98A2B3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ops@localman.in
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN APPLICATION CONTENT WORKSPACE */}
      <main className="admin-main">
        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {activeTab === 'radar' && 'Operations Radar'}
              {activeTab === 'bookings' && 'Live Bookings & Dispatch'}
              {activeTab === 'kyc' && 'Partner KYC Verification Queue'}
              {activeTab === 'catalog' && 'Service Catalog & Commission Rates'}
              {activeTab === 'reviews' && 'Customer Reviews Moderation'}
              {activeTab === 'audit' && 'System Audit & Immutable Ledger'}
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {activeTab === 'radar' && 'Real-time platform dispatch telemetry, revenue performance, and active jobs.'}
              {activeTab === 'bookings' && 'Track ongoing bookings, assigned professionals, and customer Start OTP handovers.'}
              {activeTab === 'kyc' && 'Review government identity documents and trade certificates before onboarding.'}
              {activeTab === 'catalog' && 'Configure marketplace take-rates, service categories, and hourly pricing.'}
              {activeTab === 'reviews' && 'Moderate customer ratings, flagged abuse reports, and partner responses.'}
              {activeTab === 'audit' && 'Security ledger tracking administrative interventions and financial settlements.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Quick Search */}
            <div style={{ position: 'relative', width: '260px' }}>
              <Search
                size={16}
                color="#667085"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search booking, pro, customer..."
                className="input-field"
                style={{ paddingLeft: '36px', height: '38px', fontSize: '0.8125rem' }}
              />
            </div>

            {/* Environment Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(49, 94, 251, 0.08)',
                color: '#315EFB',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: '1px solid rgba(49, 94, 251, 0.2)',
              }}
            >
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#315EFB' }} />
              Staging Cluster · v1.4.0
            </div>

            {/* Refresh Action */}
            <button onClick={handleRefresh} className="btn-secondary" style={{ height: '38px' }}>
              <RefreshCw
                size={15}
                style={{
                  animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
              Refresh
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="admin-content">
          {/* Executive Stat Cards (Visible across all tabs for top-level operational awareness) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div className="stat-card">
              <div className="stat-label">
                <span>Active Jobs</span>
                <Activity size={18} color="#315EFB" />
              </div>
              <div className="stat-value" style={{ color: '#315EFB' }}>
                {metrics.activeBookings}
              </div>
              <div className="stat-footer">
                <TrendingUp size={14} color="#12A879" />
                <span style={{ color: '#12A879', fontWeight: 600 }}>+4 in last 1 hr</span>
                <span>• Live dispatch</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <span>Total Bookings</span>
                <Layers size={18} color="#667085" />
              </div>
              <div className="stat-value">{metrics.totalBookings}</div>
              <div className="stat-footer">
                <span style={{ fontWeight: 600 }}>142 completed</span>
                <span>• All-time volume</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <span>Verified Partners</span>
                <ShieldCheck size={18} color="#12A879" />
              </div>
              <div className="stat-value" style={{ color: '#12A879' }}>
                {metrics.totalProviders}
              </div>
              <div className="stat-footer">
                <span>Active in 4 categories</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <span>Pending KYC</span>
                <AlertTriangle size={18} color={kycDocs.length > 0 ? '#E5484D' : '#667085'} />
              </div>
              <div className="stat-value" style={{ color: kycDocs.length > 0 ? '#E5484D' : 'var(--text-primary)' }}>
                {kycDocs.length}
              </div>
              <div className="stat-footer">
                <span style={{ color: kycDocs.length > 0 ? '#E5484D' : 'inherit', fontWeight: 600 }}>
                  {kycDocs.length > 0 ? 'Requires action' : 'Queue cleared'}
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">
                <span>Settled GMV</span>
                <DollarSign size={18} color="#12A879" />
              </div>
              <div className="stat-value">₹{metrics.totalRevenueInr}</div>
              <div className="stat-footer">
                <ArrowUpRight size={14} color="#12A879" />
                <span style={{ color: '#12A879', fontWeight: 600 }}>15.0% Platform Fee</span>
              </div>
            </div>
          </div>

          {/* TAB 1: OPERATIONS RADAR */}
          {activeTab === 'radar' && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Active Operations Dispatch & Execution
                  </h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Live tracking of active dispatches, customer start OTP verification, and photographic proof.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setBookingStatusFilter('ALL')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: bookingStatusFilter === 'ALL' ? '#315EFB' : '#FFFFFF',
                      color: bookingStatusFilter === 'ALL' ? '#FFFFFF' : 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    All Dispatches
                  </button>
                  <button
                    onClick={() => setBookingStatusFilter('ACTIVE')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: bookingStatusFilter === 'ACTIVE' ? '#315EFB' : '#FFFFFF',
                      color: bookingStatusFilter === 'ACTIVE' ? '#FFFFFF' : 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    In Progress Only
                  </button>
                </div>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking Number</th>
                      <th>Service Details</th>
                      <th>Customer</th>
                      <th>Assigned Partner</th>
                      <th>Status</th>
                      <th>Start OTP</th>
                      <th>Total (₹)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{b.bookingNumber}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.service.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {b.pricingModel} • {b.scheduledTimeSlot}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.customer.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {b.customer.phoneNumber}
                          </div>
                        </td>
                        <td>
                          {b.provider ? (
                            <>
                              <div style={{ fontWeight: 600 }}>{b.provider.user.fullName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {b.provider.businessName}
                              </div>
                            </>
                          ) : (
                            <span style={{ color: '#F5A524', fontWeight: 600, fontSize: '0.8125rem' }}>
                              Auto-Dispatching...
                            </span>
                          )}
                        </td>
                        <td>{getStatusBadge(b.currentStatus)}</td>
                        <td>
                          <span
                            style={{
                              background: 'rgba(245, 165, 36, 0.1)',
                              color: '#B45309',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                            }}
                          >
                            {b.startOtp}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>₹{(b.totalAmountPaisa / 100).toFixed(2)}</td>
                        <td>
                          <button
                            onClick={() => setSelectedBookingForMedia(b)}
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          >
                            <Camera size={14} color="#315EFB" />
                            Photos ({ (b.media?.beforeWorkPhotos?.length || 0) + (b.media?.afterWorkPhotos?.length || 0) + (b.media?.problemPhotos?.length || 0) })
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE BOOKINGS */}
          {activeTab === 'bookings' && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Customer Bookings Directory</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Complete lifecycle registry across all marketplace categories and payment settlement stages.
                  </p>
                </div>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking Ref</th>
                      <th>Category & Service</th>
                      <th>Customer Details</th>
                      <th>Assigned Professional</th>
                      <th>Scheduled Window</th>
                      <th>Lifecycle State</th>
                      <th>Bill Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBookings.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{b.bookingNumber}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.service.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {b.service.category}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.customer.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {b.customer.phoneNumber}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.provider?.user.fullName || 'Unassigned'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {b.provider?.businessName || 'Searching...'}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>{b.scheduledTimeSlot}</td>
                        <td>{getStatusBadge(b.currentStatus)}</td>
                        <td style={{ fontWeight: 700 }}>₹{(b.totalAmountPaisa / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: KYC QUEUE */}
          {activeTab === 'kyc' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Partner KYC Verification Queue</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Aadhaar, PAN card, and trade certificate verification. Strict compliance prevents unauthorized access.
                </p>
              </div>

              {kycDocs.length === 0 ? (
                <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                  <CheckCircle size={48} color="#12A879" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    KYC Verification Queue Cleared!
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    No pending partner identity documents require administrative review at this time.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                  {kycDocs.map((doc) => (
                    <div key={doc.id} className="card" style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div>
                          <span
                            className="badge"
                            style={{ background: 'rgba(49, 94, 251, 0.08)', color: '#315EFB', border: '1px solid rgba(49, 94, 251, 0.2)' }}
                          >
                            {doc.documentType.replace('_', ' ')}
                          </span>
                          <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginTop: '8px' }}>
                            {doc.provider.businessName || doc.provider.user.fullName}
                          </h3>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            Owner: {doc.provider.user.fullName} • {doc.provider.user.phoneNumber}
                          </p>
                        </div>
                      </div>

                      {/* Document Preview Box */}
                      <div
                        style={{
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-subtle)',
                          marginBottom: '14px',
                          height: '180px',
                          background: '#F8FAFC',
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

                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '20px', fontFamily: 'var(--font-mono)' }}>
                        Document Masked ID: <strong style={{ color: 'var(--text-primary)' }}>{doc.documentNumber}</strong>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => handleApproveDoc(doc.id)}
                          className="btn-success"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          <Check size={16} /> Approve & Verify
                        </button>
                        <button
                          onClick={() => handleOpenRejectDoc(doc.id)}
                          className="btn-danger"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REVIEWS MODERATION */}
          {activeTab === 'reviews' && (
            <div>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Customer Reviews Moderation Queue</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Auditable moderation for completed service reviews, spam prevention, and partner disputes.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['ALL', 'FLAGGED', 'PENDING', 'PUBLISHED', 'HIDDEN', 'REMOVED'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setReviewFilter(filter)}
                      style={{
                        background: reviewFilter === filter ? '#315EFB' : '#FFFFFF',
                        border: '1px solid var(--border-subtle)',
                        color: reviewFilter === filter ? '#FFFFFF' : 'var(--text-secondary)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
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
                  .filter((r) => reviewFilter === 'ALL' || r.status === reviewFilter)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="card"
                      style={{
                        padding: '20px',
                        borderLeft: `4px solid ${
                          r.status === 'FLAGGED'
                            ? '#E5484D'
                            : r.status === 'PENDING'
                            ? '#F5A524'
                            : r.status === 'PUBLISHED'
                            ? '#12A879'
                            : '#98A2B3'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={16}
                                  fill={i < r.rating ? '#F5A524' : 'none'}
                                  color="#F5A524"
                                />
                              ))}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{r.title || 'Review'}</span>
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
                                  background: 'rgba(229, 72, 77, 0.1)',
                                  color: '#E5484D',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Flag size={12} /> {r.reportCount} Reports
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Booking #{r.bookingNumber} • Customer: <strong>{r.customerName}</strong> • Partner: <strong>{r.providerName}</strong>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedReviewForMod(r);
                            setModReason(r.moderationReason || '');
                          }}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                        >
                          Moderate Review
                        </button>
                      </div>

                      <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: '8px 0', lineHeight: 1.5 }}>
                        "{r.comment}"
                      </p>

                      {r.photos && r.photos.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px', margin: '10px 0' }}>
                          {r.photos.map((p, pIdx) => (
                            <img
                              key={pIdx}
                              src={p}
                              alt="Review Proof"
                              style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }}
                            />
                          ))}
                        </div>
                      )}

                      {r.providerResponse && (
                        <div
                          style={{
                            background: '#F8FAFC',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            marginTop: '8px',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <MessageSquare size={13} color="#315EFB" /> Partner Response
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>{r.providerResponse}</div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 5: SERVICE CATALOG & RATES */}
          {activeTab === 'catalog' && (
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Service Catalog & Take-Rate Yield Simulator</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Category base rates, pricing models, and simulation sandbox for cluster yield planning. Canonical platform commission is enforced server-side at 15.0% (Section 194O TDS 1.0%).
                  </p>
                </div>
                {commissionSavedAlert && (
                  <div
                    style={{
                      background: 'rgba(18, 168, 121, 0.1)',
                      color: '#12A879',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Check size={16} /> Yield simulation updated. Canonical 15.0% platform commission enforced server-side.
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Plumbing */}
                <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 700 }}>Plumbing Services</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Tap repair, drain cleaning, pipe alterations
                      </p>
                    </div>
                    <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>HOURLY & FIXED</span>
                  </div>
                  <div style={{ margin: '16px 0', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Platform Take-Rate:</span>
                      <strong style={{ color: '#315EFB' }}>{catalogCommission.plumbing}%</strong>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="0.5"
                      value={catalogCommission.plumbing}
                      onChange={(e) => setCatalogCommission({ ...catalogCommission, plumbing: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#315EFB' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Standard Base: ₹199 - ₹349</span>
                    <span>Provider Keeps: {(100 - catalogCommission.plumbing).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Electrician */}
                <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 700 }}>Electrician & Wiring</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Switches, MCB trips, full house wiring
                      </p>
                    </div>
                    <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>INSPECTION QUOTE</span>
                  </div>
                  <div style={{ margin: '16px 0', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Platform Take-Rate:</span>
                      <strong style={{ color: '#315EFB' }}>{catalogCommission.electrical}%</strong>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="0.5"
                      value={catalogCommission.electrical}
                      onChange={(e) => setCatalogCommission({ ...catalogCommission, electrical: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#315EFB' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Standard Base: ₹149 - ₹199</span>
                    <span>Provider Keeps: {(100 - catalogCommission.electrical).toFixed(1)}%</span>
                  </div>
                </div>

                {/* AC & Appliance */}
                <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 700 }}>AC & Appliance Care</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Foam jet wash, gas refill, compressor repair
                      </p>
                    </div>
                    <span className="badge" style={{ background: '#ECFDF5', color: '#047857' }}>FIXED PRICE</span>
                  </div>
                  <div style={{ margin: '16px 0', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Platform Take-Rate:</span>
                      <strong style={{ color: '#315EFB' }}>{catalogCommission.acAppliance}%</strong>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="0.5"
                      value={catalogCommission.acAppliance}
                      onChange={(e) => setCatalogCommission({ ...catalogCommission, acAppliance: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#315EFB' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Standard Base: ₹499 (Deep Jet)</span>
                    <span>Provider Keeps: {(100 - catalogCommission.acAppliance).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Cleaning */}
                <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 700 }}>Home Deep Cleaning</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Bathroom scrub, kitchen degrease, 2BHK clean
                      </p>
                    </div>
                    <span className="badge" style={{ background: '#ECFDF5', color: '#047857' }}>PACKAGE</span>
                  </div>
                  <div style={{ margin: '16px 0', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Platform Take-Rate:</span>
                      <strong style={{ color: '#315EFB' }}>{catalogCommission.cleaning}%</strong>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="0.5"
                      value={catalogCommission.cleaning}
                      onChange={(e) => setCatalogCommission({ ...catalogCommission, cleaning: parseFloat(e.target.value) })}
                      style={{ width: '100%', accentColor: '#315EFB' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Standard Base: ₹449 - ₹2,999</span>
                    <span>Provider Keeps: {(100 - catalogCommission.cleaning).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSaveCommission} className="btn-primary">
                  Update Yield Simulation
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LEDGER */}
          {activeTab === 'audit' && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>System Audit & Security Ledger</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Immutable record of administrative decisions, KYC approvals, and financial transaction settlements.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="badge" style={{ background: '#FEF2F2', color: '#B91C1C' }}>REVIEW_MODERATED</span>
                    <span>Review rev_02 flagged by moderator (Vikram Mehta vs Sharma Plumbing Co.)</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>2026-10-20 11:45:00 UTC</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="badge" style={{ background: '#ECFDF5', color: '#047857' }}>KYC_DOCUMENT_APPROVED</span>
                    <span>Provider Pro-01h8a... (Ramesh Electrical) Aadhaar verified</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>2026-10-17 22:30:15 UTC</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="badge" style={{ background: '#FFFBEB', color: '#B45309' }}>START_OTP_VERIFIED</span>
                    <span>Booking LM-20261017-X82A Start OTP checked successfully</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>2026-10-17 22:15:02 UTC</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>PAYMENT_SETTLED</span>
                    <span>Payment captured for ₹499.00 (Booking LM-20261017-X82A)</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>2026-10-17 22:10:48 UTC</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: JOB PHOTOS & FIELD EVIDENCE */}
      {selectedBookingForMedia && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '780px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Job Photos & Field Evidence</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Booking #{selectedBookingForMedia.bookingNumber} • {selectedBookingForMedia.service.name}
                </p>
              </div>
              <button onClick={() => setSelectedBookingForMedia(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                ✕
              </button>
            </div>

            {/* Photos display */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px', color: '#12A879' }}>
                  Before-Work vs After-Work Proof
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>BEFORE WORK</div>
                    <img
                      src={selectedBookingForMedia.media?.beforeWorkPhotos?.[0]?.fileUrl || 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600'}
                      alt="Before"
                      style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>AFTER WORK</div>
                    <img
                      src={selectedBookingForMedia.media?.afterWorkPhotos?.[0]?.fileUrl || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600'}
                      alt="After"
                      style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedBookingForMedia(null)} className="btn-secondary">
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REVIEW MODERATION DECISION */}
      {selectedReviewForMod && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Review Moderation Decision</h3>
              <button onClick={() => setSelectedReviewForMod(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                ✕
              </button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.8125rem' }}>
              <div style={{ fontWeight: 600 }}>{selectedReviewForMod.customerName} ({selectedReviewForMod.rating} ★)</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>"{selectedReviewForMod.comment}"</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Audited Reason for Moderation *
              </label>
              <textarea
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
                placeholder="Specify rationale (e.g. Verified authentic feedback, Abusive language violation)..."
                rows={3}
                className="input-field"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <button onClick={() => handleApplyModeration('PUBLISHED')} className="btn-success" style={{ justifyContent: 'center' }}>
                ✓ Publish Review
              </button>
              <button onClick={() => handleApplyModeration('HIDDEN')} className="btn-secondary" style={{ justifyContent: 'center' }}>
                👁 Hide from Public
              </button>
              <button onClick={() => handleApplyModeration('FLAGGED')} className="btn-secondary" style={{ justifyContent: 'center', color: '#B45309' }}>
                ⚑ Flag Investigation
              </button>
              <button onClick={() => handleApplyModeration('REMOVED')} className="btn-danger" style={{ justifyContent: 'center' }}>
                ✕ Remove Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: KYC REJECTION REASON */}
      {rejectingDocId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '12px' }}>Reject Partner Document</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Please provide a clear reason. The partner will be asked to re-upload.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="input-field"
              style={{ marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setRejectingDocId(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleConfirmRejectDoc} className="btn-danger">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
