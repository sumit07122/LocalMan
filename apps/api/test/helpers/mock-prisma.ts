import { BookingStatus } from '@localman/constants';

export interface MockDataStore {
  users: Map<string, any>;
  providers: Map<string, any>;
  bookings: Map<string, any>;
  bookingStatusHistory: any[];
  refreshTokens: Map<string, any>;
  providerPayouts: any[];
  providerDocuments: Map<string, any>;
  bookingMaterials: Map<string, any>;
  payments: Map<string, any>;
  paymentTransactions: any[];
  auditLogs: any[];
  providerWallets: Map<string, any>;
  walletLedgerEntries: any[];
  dispatchOffers: Map<string, any>;
  providerLocationLogs: any[];
  addresses: Map<string, any>;
  serviceCategories: Map<string, any>;
  services: Map<string, any>;
  refunds: Map<string, any>;
  complaints: Map<string, any>;
  bookingQuotes: Map<string, any>;
  conversations: Map<string, any>;
  conversationParticipants: Map<string, any>;
  messages: Map<string, any>;
  chatOutboxEvents: Map<string, any>;
  reviews: Map<string, any>;
  reviewReports: Map<string, any>;
  mediaAttachments: Map<string, any>;
  otpVerifications: Map<string, any>;
  userRoles: any[];
}

export function createMockPrisma(initialStore?: Partial<MockDataStore>) {
  const store: MockDataStore = {
    users: initialStore?.users || new Map(),
    providers: initialStore?.providers || new Map(),
    bookings: initialStore?.bookings || new Map(),
    bookingStatusHistory: initialStore?.bookingStatusHistory || [],
    refreshTokens: initialStore?.refreshTokens || new Map(),
    providerPayouts: initialStore?.providerPayouts || [],
    providerDocuments: initialStore?.providerDocuments || new Map(),
    bookingMaterials: initialStore?.bookingMaterials || new Map(),
    payments: initialStore?.payments || new Map(),
    paymentTransactions: initialStore?.paymentTransactions || [],
    auditLogs: initialStore?.auditLogs || [],
    providerWallets: initialStore?.providerWallets || new Map(),
    walletLedgerEntries: initialStore?.walletLedgerEntries || [],
    dispatchOffers: initialStore?.dispatchOffers || new Map(),
    providerLocationLogs: initialStore?.providerLocationLogs || [],
    addresses: initialStore?.addresses || new Map(),
    serviceCategories: initialStore?.serviceCategories || new Map(),
    services: initialStore?.services || new Map(),
    refunds: initialStore?.refunds || new Map(),
    complaints: initialStore?.complaints || new Map(),
    bookingQuotes: initialStore?.bookingQuotes || new Map(),
    conversations: initialStore?.conversations || new Map(),
    conversationParticipants: initialStore?.conversationParticipants || new Map(),
    messages: initialStore?.messages || new Map(),
    chatOutboxEvents: initialStore?.chatOutboxEvents || new Map(),
    reviews: initialStore?.reviews || new Map(),
    reviewReports: initialStore?.reviewReports || new Map(),
    mediaAttachments: initialStore?.mediaAttachments || new Map(),
    otpVerifications: initialStore?.otpVerifications || new Map(),
    userRoles: initialStore?.userRoles || [],
  };

  const mockPrisma = {
    _store: store,

    user: {
      findUnique: async ({ where }: { where: { id?: string; phoneNumber?: string } }) => {
        for (const u of store.users.values()) {
          if ((where.id && u.id === where.id) || (where.phoneNumber && u.phoneNumber === where.phoneNumber)) {
            const addrs = Array.from(store.addresses.values())
              .filter((a) => a.userId === u.id)
              .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
            const provider = Array.from(store.providers.values()).find((p) => p.userId === u.id) || u.provider || null;
            const roles = u.userRoles || store.userRoles.filter((r) => r.userId === u.id);
            return {
              ...u,
              userRoles: roles,
              provider,
              addresses: u.addresses || addrs,
            };
          }
        }
        return null;
      },
      upsert: async ({ where, create, update }: any) => {
        let u = null;
        for (const existing of store.users.values()) {
          if (where.phoneNumber && existing.phoneNumber === where.phoneNumber) {
            u = existing;
            break;
          }
        }
        if (u) {
          Object.assign(u, update);
          u.userRoles = u.userRoles || store.userRoles.filter((r) => r.userId === u.id);
          u.provider = Array.from(store.providers.values()).find((p) => p.userId === u.id) || u.provider || null;
          return u;
        }
        const created = { id: create.id || `usr_${Date.now()}`, isActive: true, ...create, userRoles: [] };
        store.users.set(created.id, created);
        created.userRoles = created.userRoles || [];
        created.provider = null;
        return created;
      },
      update: async ({ where, data }: any) => {
        let u = store.users.get(where.id);
        if (!u) {
          for (const existing of store.users.values()) {
            if (where.phoneNumber && existing.phoneNumber === where.phoneNumber) {
              u = existing;
              break;
            }
          }
        }
        if (!u) throw new Error('User not found in mock store');
        Object.assign(u, data);
        return u;
      },
      count: async ({ where }: any = {}) => {
        if (!where) return store.users.size;
        let count = 0;
        for (const u of store.users.values()) {
          if (where.userRoles?.some?.roleId) {
            const roleId = where.userRoles.some.roleId;
            const roles = u.userRoles || store.userRoles.filter((r) => r.userId === u.id);
            if (roles.some((r: any) => r.roleId === roleId)) count++;
          } else {
            count++;
          }
        }
        return count;
      },
      findMany: async () => Array.from(store.users.values()),
    },

    provider: {
      findUnique: async ({ where }: any) => {
        for (const p of store.providers.values()) {
          let match = false;
          if (where.id && p.id === where.id) match = true;
          if (where.userId && p.userId === where.userId) match = true;
          if (where.OR && Array.isArray(where.OR)) {
            match = where.OR.some((cond: any) => {
              if (cond.id && p.id === cond.id) return true;
              if (cond.userId && p.userId === cond.userId) return true;
              return false;
            });
          }
          if (match) {
            const user = store.users.get(p.userId) || p.user;
            const offers = Array.from(store.dispatchOffers.values()).filter((o) => o.providerId === p.id);
            const bookings = Array.from(store.bookings.values()).filter((b) => b.providerId === p.id);
            return {
              ...p,
              user: p.user || user,
              services: p.services || [],
              serviceAreas: p.serviceAreas || [],
              bookings: p.bookings || bookings,
              dispatchOffers: offers,
            };
          }
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        if (!where) return Array.from(store.providers.values())[0] || null;
        for (const p of store.providers.values()) {
          if (where.id && p.id === where.id) return p;
          if (where.userId && p.userId === where.userId) return p;
          if (where.OR && Array.isArray(where.OR)) {
            const matches = where.OR.some((cond: any) => {
              if (cond.id && p.id === cond.id) return true;
              if (cond.userId && p.userId === cond.userId) return true;
              return false;
            });
            if (matches) return p;
          }
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        const list: any[] = [];
        for (const p of store.providers.values()) {
          if (where?.id?.notIn && where.id.notIn.includes(p.id)) continue;
          if (where?.verificationStatus && p.verificationStatus !== where.verificationStatus) continue;
          if (where?.isOnline !== undefined && p.isOnline !== where.isOnline) continue;
          if (where?.user?.isActive !== undefined) {
            const u = store.users.get(p.userId) || p.user;
            if (!u || u.isActive !== where.user.isActive) continue;
          }
          if (where?.services?.some) {
            const sReq = where.services.some;
            const sList = p.services || [];
            const hasS = sList.some((s: any) => {
              if (sReq.serviceId && s.serviceId !== sReq.serviceId) return false;
              if (sReq.isActive !== undefined && s.isActive !== sReq.isActive) return false;
              return true;
            });
            if (!hasS) continue;
          }
          const user = store.users.get(p.userId) || p.user;
          const offers = Array.from(store.dispatchOffers.values()).filter((o) => o.providerId === p.id);
          const bookings = Array.from(store.bookings.values()).filter((b) => b.providerId === p.id);
          list.push({
            ...p,
            user: p.user || user,
            services: p.services || [],
            serviceAreas: p.serviceAreas || [],
            bookings: p.bookings || bookings,
            dispatchOffers: offers,
          });
        }
        return list;
      },
      count: async () => store.providers.size,
      create: async ({ data }: any) => {
        const p = {
          id: data.id || `prv_${Date.now()}`,
          ratingAverage: 5.0,
          ratingCount: 0,
          verificationStatus: 'DRAFT',
          isOnline: false,
          ...data,
        };
        store.providers.set(p.id, p);
        return p;
      },
      update: async ({ where, data }: any) => {
        for (const p of store.providers.values()) {
          if ((where.id && p.id === where.id) || (where.userId && p.userId === where.userId)) {
            Object.assign(p, data);
            return p;
          }
        }
        throw new Error('Provider not found in mock store');
      },
    },

    providerDocument: {
      create: async ({ data }: any) => {
        const doc = {
          id: data.id || `doc_${Date.now()}_${Math.random()}`,
          status: 'PENDING',
          createdAt: new Date(),
          ...data,
        };
        store.providerDocuments.set(doc.id, doc);
        return doc;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        return store.providerDocuments.get(where.id) || null;
      },
      findMany: async ({ where }: any) => {
        const list: any[] = [];
        for (const d of store.providerDocuments.values()) {
          if (where?.providerId && d.providerId !== where.providerId) continue;
          if (where?.status && d.status !== where.status) continue;
          list.push(d);
        }
        return list;
      },
      count: async ({ where }: any = {}) => {
        let c = 0;
        for (const d of store.providerDocuments.values()) {
          if (where?.providerId && d.providerId !== where.providerId) continue;
          if (where?.status && d.status !== where.status) continue;
          c++;
        }
        return c;
      },
      update: async ({ where, data }: any) => {
        const d = store.providerDocuments.get(where.id);
        if (!d) throw new Error('Document not found in mock store');
        Object.assign(d, data);
        return d;
      },
    },

    refreshToken: {
      create: async ({ data }: any) => {
        const record = { id: `rt_${Date.now()}_${Math.random()}`, ...data };
        store.refreshTokens.set(record.id, record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        if (where.id) return store.refreshTokens.get(where.id) || null;
        for (const token of store.refreshTokens.values()) {
          if (where.tokenHash && token.tokenHash !== where.tokenHash) continue;
          return token;
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const token of store.refreshTokens.values()) {
          if (where.tokenHash && token.tokenHash !== where.tokenHash) continue;
          if (where.userId && token.userId !== where.userId) continue;
          if (where.revokedAt !== undefined && token.revokedAt !== where.revokedAt) continue;
          return token;
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        const token = store.refreshTokens.get(where.id);
        if (token) {
          Object.assign(token, data);
          return token;
        }
        return null;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const token of store.refreshTokens.values()) {
          let match = true;
          if (where.tokenHash && token.tokenHash !== where.tokenHash) match = false;
          if (where.userId && token.userId !== where.userId) match = false;
          if (match) {
            Object.assign(token, data);
            count++;
          }
        }
        return { count };
      },
    },

    otpVerification: {
      count: async ({ where }: any = {}) => {
        let count = 0;
        for (const ov of store.otpVerifications.values()) {
          if (where?.phoneNumber && ov.phoneNumber !== where.phoneNumber) continue;
          if (where?.createdAt?.gte && ov.createdAt < where.createdAt.gte) continue;
          count++;
        }
        return count;
      },
      create: async ({ data }: any) => {
        const id = `otp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = { id, attempts: 0, isConsumed: false, createdAt: new Date(), ...data };
        store.otpVerifications.set(id, record);
        return record;
      },
      findFirst: async ({ where, orderBy }: any = {}) => {
        let list = Array.from(store.otpVerifications.values()).filter((ov) => {
          if (where?.phoneNumber && ov.phoneNumber !== where.phoneNumber) return false;
          if (where?.isConsumed !== undefined && ov.isConsumed !== where.isConsumed) return false;
          if (where?.expiresAt?.gt && ov.expiresAt <= where.expiresAt.gt) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return list[0] || null;
      },
      update: async ({ where, data }: any) => {
        const ov = store.otpVerifications.get(where.id);
        if (!ov) return null;
        if (data.attempts?.increment) {
          ov.attempts = (ov.attempts || 0) + data.attempts.increment;
        }
        if (data.isConsumed !== undefined) {
          ov.isConsumed = data.isConsumed;
        }
        return ov;
      },
    },

    userRole: {
      create: async ({ data }: any) => {
        const record = { id: `ur_${Date.now()}_${Math.random()}`, ...data };
        store.userRoles.push(record);
        const user = store.users.get(data.userId);
        if (user) {
          user.userRoles = user.userRoles || [];
          user.userRoles.push(record);
        }
        return record;
      },
      findMany: async ({ where }: any = {}) => {
        return store.userRoles.filter((r) => !where?.userId || r.userId === where.userId);
      },
    },

    booking: {
      create: async ({ data, include }: any) => {
        const id = data.id || `bkg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const b = {
          id,
          bookingNumber: data.bookingNumber || `BKG-${Date.now()}`,
          currentStatus: 'REQUESTED',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.bookings.set(id, b);
        const res: any = { ...b };
        if (include?.service) {
          res.service = store.services.get(b.serviceId) || { id: b.serviceId, name: 'Standard Service' };
        }
        if (include?.address) {
          res.address = store.addresses.get(b.addressId) || { id: b.addressId, city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 };
        }
        return res;
      },
      findFirst: async ({ where, include }: any) => {
        for (const b of store.bookings.values()) {
          if (where?.id && b.id !== where.id) continue;
          if (where?.customerId && b.customerId !== where.customerId) continue;
          if (where?.idempotencyKey && b.idempotencyKey !== where.idempotencyKey) continue;
          if (where?.currentStatus && b.currentStatus !== where.currentStatus) continue;

          const res: any = { ...b };
          if (include?.service) {
            res.service = store.services.get(b.serviceId) || { id: b.serviceId, name: 'Standard Service' };
          }
          if (include?.address) {
            res.address = store.addresses.get(b.addressId) || { id: b.addressId, city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 };
          }
          return res;
        }
        return null;
      },
      findMany: async ({ where, skip = 0, take, orderBy }: any) => {
        const list: any[] = [];
        for (const b of store.bookings.values()) {
          if (where?.providerId && b.providerId !== where.providerId) continue;
          if (where?.customerId && b.customerId !== where.customerId) continue;
          if (where?.currentStatus && b.currentStatus !== where.currentStatus) continue;
          list.push(b);
        }
        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        const sliced = take !== undefined ? list.slice(skip, skip + take) : list.slice(skip);
        return sliced.map((b) => ({
          ...b,
          service: store.services.get(b.serviceId) || b.service || { id: b.serviceId, name: 'Standard Service' },
          address: store.addresses.get(b.addressId) || b.address || { city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
        }));
      },
      count: async ({ where }: any = {}) => {
        let count = 0;
        for (const b of store.bookings.values()) {
          if (where?.providerId && b.providerId !== where.providerId) continue;
          if (where?.customerId && b.customerId !== where.customerId) continue;
          if (where?.currentStatus && b.currentStatus !== where.currentStatus) continue;
          count++;
        }
        return count;
      },
      findUnique: async ({ where }: any) => {
        const b = store.bookings.get(where.id);
        if (!b) return null;
        const materials = Array.from(store.bookingMaterials.values()).filter((m) => m.bookingId === b.id);
        const offers = Array.from(store.dispatchOffers.values()).filter((o) => o.bookingId === b.id);
        const customer = store.users.get(b.customerId);
        const provider = b.providerId ? store.providers.get(b.providerId) : null;
        const statusHistory = store.bookingStatusHistory.filter((h) => h.bookingId === b.id);
        const payment = Array.from(store.payments.values()).find((p) => p.bookingId === b.id);
        const complaints = Array.from(store.complaints.values()).filter((c) => c.bookingId === b.id);
        const refunds = payment ? Array.from(store.refunds.values()).filter((r) => r.paymentId === payment.id) : [];
        const populatedPayment = payment ? { ...payment, refunds: payment.refunds || refunds } : null;
        const quotes = Array.from(store.bookingQuotes.values()).filter((q) => q.bookingId === b.id);
        return {
          ...b,
          payment: b.payment || populatedPayment || null,
          materials: b.materials || materials,
          dispatchOffers: b.dispatchOffers || offers,
          customer: b.customer || customer,
          provider: b.provider || (provider ? { ...provider, user: store.users.get(provider.userId) || provider.user } : null),
          statusHistory: b.statusHistory || statusHistory,
          complaints: b.complaints || complaints,
          quotes: b.quotes || quotes,
          review: b.review || Array.from(store.reviews.values()).find((r) => r.bookingId === b.id) || null,
          conversation: Array.from(store.conversations.values()).find((c) => c.bookingId === b.id) || null,
          service: store.services.get(b.serviceId) || b.service || { id: b.serviceId, name: 'Standard Service' },
          address: store.addresses.get(b.addressId) || b.address || { city: 'Bengaluru', latitude: 12.9716, longitude: 77.5946 },
        };
      },
      update: async ({ where, data }: any) => {
        const b = store.bookings.get(where.id);
        if (!b) throw new Error('Booking not found in mock store');
        if (data.totalAmountPaisa && typeof data.totalAmountPaisa === 'object' && 'increment' in data.totalAmountPaisa) {
          b.totalAmountPaisa = (b.totalAmountPaisa || 0) + data.totalAmountPaisa.increment;
          const { totalAmountPaisa, ...rest } = data;
          Object.assign(b, rest);
        } else {
          Object.assign(b, data);
        }
        return b;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const b of store.bookings.values()) {
          let match = true;
          if (where?.id && b.id !== where.id) match = false;
          if (where?.currentStatus && b.currentStatus !== where.currentStatus) match = false;
          if (where?.providerId === null && b.providerId !== null && b.providerId !== undefined) match = false;
          else if (where?.providerId && b.providerId !== where.providerId) match = false;
          if (where?.customerId && b.customerId !== where.customerId) match = false;
          if (match) {
            Object.assign(b, data);
            count++;
          }
        }
        return { count };
      },
    },

    bookingStatusHistory: {
      create: async ({ data }: any) => {
        const entry = {
          id: data.id || `bsh_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          createdAt: new Date(),
          ...data,
        };
        store.bookingStatusHistory.push(entry);
        return entry;
      },
      findMany: async ({ where }: any = {}) => {
        return store.bookingStatusHistory.filter((h: any) => !where?.bookingId || h.bookingId === where.bookingId);
      },
    },

    bookingMaterial: {
      create: async ({ data }: any) => {
        const mat = {
          id: data.id || `mat_${Date.now()}_${Math.random()}`,
          isCustomerApproved: false,
          createdAt: new Date(),
          ...data,
        };
        store.bookingMaterials.set(mat.id, mat);
        return mat;
      },
      findFirst: async ({ where }: any) => {
        for (const m of store.bookingMaterials.values()) {
          if (where.id && m.id !== where.id) continue;
          if (where.bookingId && m.bookingId !== where.bookingId) continue;
          return m;
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        return Array.from(store.bookingMaterials.values()).filter((m) => {
          if (where?.bookingId && m.bookingId !== where.bookingId) return false;
          return true;
        });
      },
      update: async ({ where, data }: any) => {
        const m = store.bookingMaterials.get(where.id);
        if (!m) throw new Error('Material not found in mock store');
        Object.assign(m, data);
        return m;
      },
    },

    payment: {
      create: async ({ data }: any) => {
        const pay = {
          id: data.id || `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.payments.set(pay.id, pay);
        return pay;
      },
      findUnique: async ({ where }: any) => {
        let match: any = null;
        for (const p of store.payments.values()) {
          if (where.id && p.id === where.id) { match = p; break; }
          if (where.bookingId && p.bookingId === where.bookingId) { match = p; break; }
          if (where.gatewayOrderId && p.gatewayOrderId === where.gatewayOrderId) { match = p; break; }
          if (where.gatewayPaymentId && p.gatewayPaymentId === where.gatewayPaymentId) { match = p; break; }
          if (where.idempotencyKey && p.idempotencyKey === where.idempotencyKey) { match = p; break; }
        }
        if (!match) return null;
        const b = store.bookings.get(match.bookingId);
        const refunds = Array.from(store.refunds.values()).filter((r) => r.paymentId === match.id);
        return {
          ...match,
          refunds: match.refunds || refunds,
          booking: b
            ? {
                ...b,
                customer: store.users.get(b.customerId),
                provider: store.providers.get(b.providerId),
                service: b.service || { platformCommissionPercent: 15.0 },
                materials: Array.from(store.bookingMaterials.values()).filter((m) => m.bookingId === b.id),
              }
            : undefined,
        };
      },
      findFirst: async ({ where }: any) => {
        for (const p of store.payments.values()) {
          if (where?.id && p.id !== where.id) continue;
          if (where?.bookingId && p.bookingId !== where.bookingId) continue;
          if (where?.gatewayOrderId && p.gatewayOrderId !== where.gatewayOrderId) continue;
          if (where?.gatewayPaymentId && p.gatewayPaymentId !== where.gatewayPaymentId) continue;
          if (where?.idempotencyKey && p.idempotencyKey !== where.idempotencyKey) continue;
          if (where?.status && p.status !== where.status) continue;
          const b = store.bookings.get(p.bookingId);
          const refunds = Array.from(store.refunds.values()).filter((r) => r.paymentId === p.id);
          return {
            ...p,
            refunds: p.refunds || refunds,
            booking: b
              ? {
                  ...b,
                  customer: store.users.get(b.customerId),
                  provider: store.providers.get(b.providerId),
                  service: b.service || { platformCommissionPercent: 15.0 },
                  materials: Array.from(store.bookingMaterials.values()).filter((m) => m.bookingId === b.id),
                }
              : undefined,
          };
        }
        return null;
      },
      update: async ({ where, data }: any) => {
        let p = store.payments.get(where.id);
        if (!p) {
          for (const item of store.payments.values()) {
            if (where.bookingId && item.bookingId === where.bookingId) { p = item; break; }
            if (where.idempotencyKey && item.idempotencyKey === where.idempotencyKey) { p = item; break; }
          }
        }
        if (!p) throw new Error('Payment not found in mock store');
        Object.assign(p, data, { updatedAt: new Date() });
        return p;
      },
      aggregate: async ({ where, _sum }: any = {}) => {
        let total = 0;
        for (const p of store.payments.values()) {
          if (where?.status && p.status !== where.status) continue;
          total += (p.amountPaisa || 0);
        }
        return {
          _sum: {
            amountPaisa: total,
          },
        };
      },
      count: async ({ where }: any = {}) => {
        let c = 0;
        for (const p of store.payments.values()) {
          if (where?.status && p.status !== where.status) continue;
          c++;
        }
        return c;
      },
    },

    refund: {
      create: async ({ data }: any) => {
        const id = data.id || `rfnd_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = { id, createdAt: new Date(), ...data };
        store.refunds.set(id, r);
        return r;
      },
      findUnique: async ({ where }: any) => {
        for (const r of store.refunds.values()) {
          if (where?.id && r.id === where.id) return r;
          if (where?.idempotencyKey && r.idempotencyKey === where.idempotencyKey) return r;
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const r of store.refunds.values()) {
          if (where?.id && r.id !== where.id) continue;
          if (where?.paymentId && r.paymentId !== where.paymentId) continue;
          if (where?.idempotencyKey && r.idempotencyKey !== where.idempotencyKey) continue;
          if (where?.OR && Array.isArray(where.OR)) {
            const orMatch = where.OR.some((cond: any) => {
              if (cond.idempotencyKey && r.idempotencyKey === cond.idempotencyKey) return true;
              if (cond.reason?.contains && r.reason?.includes(cond.reason.contains)) return true;
              return false;
            });
            if (!orMatch) continue;
            return r;
          }
          if (where?.reason?.contains && !r.reason?.includes(where.reason.contains)) continue;
          return r;
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        return Array.from(store.refunds.values()).filter((r) => {
          if (where?.paymentId && r.paymentId !== where.paymentId) return false;
          return true;
        });
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of store.refunds.values()) {
          let match = true;
          if (where?.paymentId && r.paymentId !== where.paymentId) match = false;
          if (where?.gatewayRefundId && r.gatewayRefundId !== where.gatewayRefundId) match = false;
          if (match) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      },
    },

    complaint: {
      create: async ({ data }: any) => {
        const id = data.id || `cmpl_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const c = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        store.complaints.set(id, c);
        return c;
      },
      findUnique: async ({ where, include }: any) => {
        const c = store.complaints.get(where.id);
        if (!c) return null;
        const res: any = { ...c };
        if (include?.booking) {
          const b = store.bookings.get(c.bookingId);
          res.booking = b
            ? {
                ...b,
                customer: store.users.get(b.customerId),
                provider: b.providerId ? store.providers.get(b.providerId) : null,
                payment: Array.from(store.payments.values()).find((p) => p.bookingId === b.id) || null,
              }
            : null;
        }
        return res;
      },
      findFirst: async ({ where }: any) => {
        for (const c of store.complaints.values()) {
          if (where?.id && c.id !== where.id) continue;
          if (where?.bookingId && c.bookingId !== where.bookingId) continue;
          if (where?.ticketNumber && c.ticketNumber !== where.ticketNumber) continue;
          return c;
        }
        return null;
      },
      findMany: async ({ where, skip = 0, take }: any) => {
        let list = Array.from(store.complaints.values()).filter((c) => {
          if (where?.status && c.status !== where.status) return false;
          if (where?.bookingId && c.bookingId !== where.bookingId) return false;
          return true;
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (skip !== undefined) list = list.slice(skip);
        if (take !== undefined) list = list.slice(0, take);
        return list;
      },
      count: async ({ where }: any) => {
        return Array.from(store.complaints.values()).filter((c) => {
          if (where?.status && c.status !== where.status) return false;
          if (where?.bookingId && c.bookingId !== where.bookingId) return false;
          return true;
        }).length;
      },
      update: async ({ where, data }: any) => {
        const c = store.complaints.get(where.id);
        if (!c) throw new Error('Complaint not found in mock store');
        Object.assign(c, data, { updatedAt: new Date() });
        return c;
      },
    },

    bookingQuote: {
      create: async ({ data, include }: any) => {
        const id = data.id || `quote_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          bookingId: data.bookingId,
          providerId: data.providerId,
          quoteAmountPaisa: data.quoteAmountPaisa,
          subtotalPaisa: data.subtotalPaisa ?? data.quoteAmountPaisa ?? 0,
          materialsPaisa: data.materialsPaisa ?? 0,
          taxPaisa: data.taxPaisa ?? 0,
          breakdownNotes: data.breakdownNotes ?? null,
          estimatedHours: data.estimatedHours ?? null,
          estimatedDurationMinutes: data.estimatedDurationMinutes ?? null,
          items: data.items ?? null,
          status: data.status || 'SUBMITTED',
          validUntil: data.validUntil ?? new Date(Date.now() + 86400000),
          version: data.version || 1,
          acceptedAt: data.acceptedAt || null,
          rejectedAt: data.rejectedAt || null,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        store.bookingQuotes.set(id, record);
        const res: any = { ...record };
        if (include?.provider) {
          const prv = store.providers.get(record.providerId);
          res.provider = prv ? { ...prv, user: store.users.get(prv.userId) || prv.user } : null;
        }
        if (include?.booking) {
          res.booking = store.bookings.get(record.bookingId) || null;
        }
        return res;
      },
      findUnique: async ({ where, include }: any) => {
        const q = store.bookingQuotes.get(where.id);
        if (!q) return null;
        const res: any = { ...q };
        if (include?.provider) {
          const prv = store.providers.get(q.providerId);
          res.provider = prv ? { ...prv, user: store.users.get(prv.userId) || prv.user } : null;
        }
        if (include?.booking) {
          const b = store.bookings.get(q.bookingId);
          res.booking = b ? { ...b, customer: store.users.get(b.customerId), service: store.services.get(b.serviceId) } : null;
        }
        return res;
      },
      findFirst: async ({ where, include }: any) => {
        for (const q of store.bookingQuotes.values()) {
          if (where?.id && q.id !== where.id) continue;
          if (where?.bookingId && q.bookingId !== where.bookingId) continue;
          if (where?.providerId && q.providerId !== where.providerId) continue;
          if (where?.status && q.status !== where.status) continue;
          const res: any = { ...q };
          if (include?.provider) {
            const prv = store.providers.get(q.providerId);
            res.provider = prv ? { ...prv, user: store.users.get(prv.userId) || prv.user } : null;
          }
          if (include?.booking) {
            const b = store.bookings.get(q.bookingId);
            res.booking = b ? { ...b, customer: store.users.get(b.customerId), service: store.services.get(b.serviceId) } : null;
          }
          return res;
        }
        return null;
      },
      findMany: async ({ where, include, orderBy }: any) => {
        let list = Array.from(store.bookingQuotes.values()).filter((q) => {
          if (where?.bookingId && q.bookingId !== where.bookingId) return false;
          if (where?.providerId && q.providerId !== where.providerId) return false;
          if (where?.status?.in && !where.status.in.includes(q.status)) return false;
          if (where?.status && typeof where.status === 'string' && q.status !== where.status) return false;
          if (where?.validUntil?.lte && !(new Date(q.validUntil) <= new Date(where.validUntil.lte))) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return list.map((q) => {
          const res: any = { ...q };
          if (include?.provider) {
            const prv = store.providers.get(q.providerId);
            res.provider = prv ? { ...prv, user: store.users.get(prv.userId) || prv.user } : null;
          }
          return res;
        });
      },
      update: async ({ where, data, include }: any) => {
        const q = store.bookingQuotes.get(where.id);
        if (!q) throw new Error(`Booking quote ${where.id} not found in mock store`);
        Object.assign(q, data, { updatedAt: new Date() });
        const res: any = { ...q };
        if (include?.provider) {
          const prv = store.providers.get(q.providerId);
          res.provider = prv ? { ...prv, user: store.users.get(prv.userId) || prv.user } : null;
        }
        return res;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const q of store.bookingQuotes.values()) {
          let match = true;
          if (where?.bookingId && q.bookingId !== where.bookingId) match = false;
          if (where?.id?.not && q.id === where.id.not) match = false;
          if (where?.id?.in && !where.id.in.includes(q.id)) match = false;
          if (where?.status?.in && !where.status.in.includes(q.status)) match = false;
          if (where?.status && typeof where.status === 'string' && q.status !== where.status) match = false;
          if (match) {
            Object.assign(q, data, { updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
      count: async ({ where }: any = {}) => {
        return Array.from(store.bookingQuotes.values()).filter((q) => {
          if (where?.bookingId && q.bookingId !== where.bookingId) return false;
          if (where?.providerId && q.providerId !== where.providerId) return false;
          if (where?.status && q.status !== where.status) return false;
          return true;
        }).length;
      },
    },

    paymentTransaction: {
      create: async ({ data }: any) => {
        const tx = { id: `ptx_${Date.now()}_${Math.random()}`, createdAt: new Date(), ...data };
        store.paymentTransactions.push(tx);
        return tx;
      },
    },

    auditLog: {
      create: async ({ data }: any) => {
        const log = { id: `aud_${Date.now()}_${Math.random()}`, createdAt: new Date(), ...data };
        store.auditLogs.push(log);
        return log;
      },
      findMany: async () => store.auditLogs,
      count: async () => store.auditLogs.length,
    },

    bookingStatusHistory: {
      create: async ({ data }: any) => {
        const entry = { id: `bsh_${Date.now()}_${Math.random()}`, createdAt: new Date(), ...data };
        store.bookingStatusHistory.push(entry);
        return entry;
      },
      findMany: async ({ where }: { where: { bookingId: string } }) => {
        return store.bookingStatusHistory.filter((e) => e.bookingId === where.bookingId);
      },
    },

    providerPayout: {
      create: async ({ data }: any) => {
        const entry = { id: data.id || `pout_${Date.now()}_${Math.random()}`, createdAt: new Date(), ...data };
        store.providerPayouts.push(entry);
        return entry;
      },
      findUnique: async ({ where }: any) => {
        return store.providerPayouts.find((p) => {
          if (where.id && p.id === where.id) return true;
          if (where.idempotencyKey && p.idempotencyKey === where.idempotencyKey) return true;
          return false;
        }) || null;
      },
      findFirst: async ({ where }: any) => {
        return store.providerPayouts.find((p) => {
          if (where.providerId && p.providerId !== where.providerId) return false;
          if (where.idempotencyKey && p.idempotencyKey !== where.idempotencyKey) return false;
          return true;
        }) || null;
      },
      update: async ({ where, data }: any) => {
        const p = store.providerPayouts.find((item) => item.id === where.id);
        if (!p) throw new Error('Payout not found in mock store');
        for (const [key, val] of Object.entries(data)) {
          if (val && typeof val === 'object' && 'increment' in (val as any)) {
            p[key] = (p[key] || 0) + (val as any).increment;
          } else if (val && typeof val === 'object' && 'decrement' in (val as any)) {
            p[key] = (p[key] || 0) - (val as any).decrement;
          } else {
            p[key] = val;
          }
        }
        return p;
      },
      findMany: async ({ where, skip, take }: any) => {
        let list = store.providerPayouts.filter((p) => {
          if (where?.providerId && p.providerId !== where.providerId) return false;
          if (where?.status && p.status !== where.status) return false;
          return true;
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (skip !== undefined) list = list.slice(skip);
        if (take !== undefined) list = list.slice(0, take);
        return list;
      },
      count: async ({ where }: any) => {
        return store.providerPayouts.filter((p) => {
          if (where?.providerId && p.providerId !== where.providerId) return false;
          if (where?.status && p.status !== where.status) return false;
          return true;
        }).length;
      },
      aggregate: async ({ where, _sum }: any) => {
        const matching = store.providerPayouts.filter((p) => {
          if (where?.providerId && p.providerId !== where.providerId) return false;
          if (where?.status && p.status !== where.status) return false;
          return true;
        });
        const result: Record<string, any> = { _sum: {} };
        if (_sum) {
          for (const field of Object.keys(_sum)) {
            result._sum[field] = matching.reduce((sum: number, p: any) => sum + (p[field] || 0), 0);
          }
        }
        return result;
      },
    },

    providerWallet: {
      findUnique: async ({ where }: any) => {
        for (const w of store.providerWallets.values()) {
          if (where.id && w.id === where.id) return w;
          if (where.providerId && w.providerId === where.providerId) return w;
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const w of store.providerWallets.values()) {
          if (where.providerId && w.providerId === where.providerId) return w;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const wallet = {
          id: data.id || `wal_${Date.now()}_${Math.random()}`,
          availableBalancePaisa: 0,
          pendingBalancePaisa: 0,
          paidOutBalancePaisa: 0,
          currency: 'INR',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.providerWallets.set(wallet.id, wallet);
        return wallet;
      },
      update: async ({ where, data }: any) => {
        let wallet = null;
        for (const w of store.providerWallets.values()) {
          if ((where.id && w.id === where.id) || (where.providerId && w.providerId === where.providerId)) {
            wallet = w;
            break;
          }
        }
        if (!wallet) throw new Error('Provider wallet not found in mock store');

        for (const [key, val] of Object.entries(data)) {
          if (val && typeof val === 'object' && 'increment' in (val as any)) {
            wallet[key] = (wallet[key] || 0) + (val as any).increment;
          } else if (val && typeof val === 'object' && 'decrement' in (val as any)) {
            wallet[key] = (wallet[key] || 0) - (val as any).decrement;
          } else {
            wallet[key] = val;
          }
        }
        wallet.updatedAt = new Date();
        return wallet;
      },
    },

    walletLedgerEntry: {
      create: async ({ data }: any) => {
        if (data.idempotencyKey) {
          const dup = store.walletLedgerEntries.find((e) => e.idempotencyKey === data.idempotencyKey);
          if (dup) {
            throw new Error(`Unique constraint failed on idempotencyKey: ${data.idempotencyKey}`);
          }
        }
        const entry = {
          id: data.id || `wle_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          createdAt: new Date(),
          ...data,
        };
        store.walletLedgerEntries.push(entry);
        return entry;
      },
      findFirst: async ({ where }: any) => {
        return store.walletLedgerEntries.find((e) => {
          if (where?.idempotencyKey && e.idempotencyKey !== where.idempotencyKey) return false;
          if (where?.bookingId && e.bookingId !== where.bookingId) return false;
          if (where?.providerId && e.providerId !== where.providerId) return false;
          if (where?.walletId && e.walletId !== where.walletId) return false;
          if (where?.entryType && e.entryType !== where.entryType) return false;
          return true;
        }) || null;
      },
      findMany: async ({ where, skip, take }: any) => {
        let list = store.walletLedgerEntries.filter((e) => {
          if (where?.providerId && e.providerId !== where.providerId) return false;
          if (where?.walletId && e.walletId !== where.walletId) return false;
          if (where?.entryType && e.entryType !== where.entryType) return false;
          if (where?.direction && e.direction !== where.direction) return false;
          return true;
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (skip !== undefined) list = list.slice(skip);
        if (take !== undefined) list = list.slice(0, take);
        return list;
      },
      count: async ({ where }: any) => {
        return store.walletLedgerEntries.filter((e) => {
          if (where?.providerId && e.providerId !== where.providerId) return false;
          if (where?.walletId && e.walletId !== where.walletId) return false;
          if (where?.entryType && e.entryType !== where.entryType) return false;
          if (where?.direction && e.direction !== where.direction) return false;
          return true;
        }).length;
      },
    },

    dispatchOffer: {
      create: async ({ data }: any) => {
        const offer = {
          id: data.id || `off_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          status: data.status || 'OFFERED',
          attemptNumber: data.attemptNumber || 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        store.dispatchOffers.set(offer.id, offer);
        const booking = store.bookings.get(offer.bookingId);
        const provider = store.providers.get(offer.providerId);
        return {
          ...offer,
          booking: {
            ...booking,
            service: booking?.service || { name: 'Standard Service' },
            address: booking?.address || { city: 'Bengaluru' },
          },
          provider: {
            ...provider,
            user: store.users.get(provider?.userId) || { fullName: 'Service Partner' },
          },
        };
      },
      findUnique: async ({ where }: any) => {
        const offer = store.dispatchOffers.get(where.id);
        if (!offer) return null;
        const booking = store.bookings.get(offer.bookingId);
        const provider = store.providers.get(offer.providerId);
        return {
          ...offer,
          booking: {
            ...booking,
            service: booking?.service || { name: 'Standard Service' },
            address: booking?.address || { city: 'Bengaluru' },
            customer: store.users.get(booking?.customerId),
          },
          provider: {
            ...provider,
            user: store.users.get(provider?.userId) || { fullName: 'Service Partner' },
          },
        };
      },
      findFirst: async ({ where, orderBy }: any) => {
        let list = Array.from(store.dispatchOffers.values()).filter((o) => {
          if (where?.providerId && o.providerId !== where.providerId) return false;
          if (where?.bookingId && o.bookingId !== where.bookingId) return false;
          if (where?.status && o.status !== where.status) return false;
          if (where?.expiresAt?.gt && !(new Date(o.expiresAt) > where.expiresAt.gt)) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        const offer = list[0];
        if (!offer) return null;
        const booking = store.bookings.get(offer.bookingId);
        const provider = store.providers.get(offer.providerId);
        return {
          ...offer,
          booking: {
            ...booking,
            service: booking?.service || { name: 'Standard Service' },
            address: booking?.address || { city: 'Bengaluru' },
          },
          provider: {
            ...provider,
            user: store.users.get(provider?.userId) || { fullName: 'Service Partner' },
          },
        };
      },
      findMany: async ({ where, orderBy, take, skip }: any) => {
        let list = Array.from(store.dispatchOffers.values()).filter((o) => {
          if (where?.providerId && o.providerId !== where.providerId) return false;
          if (where?.bookingId && o.bookingId !== where.bookingId) return false;
          if (where?.status && o.status !== where.status) return false;
          if (where?.expiresAt?.lte && !(new Date(o.expiresAt) <= where.expiresAt.lte)) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        if (skip !== undefined) list = list.slice(skip);
        if (take !== undefined) list = list.slice(0, take);
        return list.map((offer) => {
          const booking = store.bookings.get(offer.bookingId);
          const provider = store.providers.get(offer.providerId);
          return {
            ...offer,
            booking: {
              ...booking,
              service: booking?.service || { name: 'Standard Service' },
              address: booking?.address || { city: 'Bengaluru' },
            },
            provider: {
              ...provider,
              user: store.users.get(provider?.userId) || { fullName: 'Service Partner' },
            },
          };
        });
      },
      update: async ({ where, data }: any) => {
        const offer = store.dispatchOffers.get(where.id);
        if (!offer) throw new Error('Dispatch offer not found in mock store');
        Object.assign(offer, data, { updatedAt: new Date() });
        return offer;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const offer of store.dispatchOffers.values()) {
          let match = true;
          if (where.bookingId && offer.bookingId !== where.bookingId) match = false;
          if (where.id?.not && offer.id === where.id.not) match = false;
          if (where.status && offer.status !== where.status) match = false;
          if (match) {
            Object.assign(offer, data, { updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
      count: async ({ where }: any) => {
        return Array.from(store.dispatchOffers.values()).filter((o) => {
          if (where?.providerId && o.providerId !== where.providerId) return false;
          if (where?.bookingId && o.bookingId !== where.bookingId) return false;
          if (where?.status && o.status !== where.status) return false;
          return true;
        }).length;
      },
    },

    providerLocationLog: {
      create: async ({ data }: any) => {
        const log = {
          id: data.id || `loc_log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          providerId: data.providerId,
          bookingId: data.bookingId || null,
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy || null,
          heading: data.heading || null,
          speed: data.speed || null,
          source: data.source || 'FOREGROUND_APP',
          createdAt: data.createdAt || new Date(),
        };
        store.providerLocationLogs.push(log);
        return log;
      },
      findMany: async ({ where }: any) => {
        return store.providerLocationLogs.filter((l) => {
          if (where?.providerId && l.providerId !== where.providerId) return false;
          if (where?.bookingId && l.bookingId !== where.bookingId) return false;
          return true;
        });
      },
      deleteMany: async ({ where }: any) => {
        const initialCount = store.providerLocationLogs.length;
        if (where?.createdAt?.lt) {
          const cutoff = new Date(where.createdAt.lt).getTime();
          store.providerLocationLogs = store.providerLocationLogs.filter(
            (l) => new Date(l.createdAt).getTime() >= cutoff
          );
        } else {
          store.providerLocationLogs = [];
        }
        return { count: initialCount - store.providerLocationLogs.length };
      },
      count: async () => store.providerLocationLogs.length,
    },

    auditLog: {
      create: async ({ data }: any) => {
        const log = {
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          userId: data.userId || null,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId || null,
          oldState: data.oldState || null,
          newState: data.newState || null,
          createdAt: data.createdAt || new Date(),
        };
        store.auditLogs.push(log);
        return log;
      },
      findMany: async ({ where }: any) => {
        return store.auditLogs.filter((l) => {
          if (where?.resourceType && l.resourceType !== where.resourceType) return false;
          if (where?.action && l.action !== where.action) return false;
          return true;
        });
      },
      count: async () => store.auditLogs.length,
    },

    address: {
      findUnique: async ({ where }: any) => {
        return store.addresses.get(where.id) || null;
      },
      findFirst: async ({ where, orderBy }: any) => {
        let addrs = Array.from(store.addresses.values());
        if (where?.userId) {
          addrs = addrs.filter((a) => a.userId === where.userId);
        }
        if (where?.isDefault !== undefined) {
          addrs = addrs.filter((a) => a.isDefault === where.isDefault);
        }
        if (orderBy?.createdAt === 'desc') {
          addrs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return addrs[0] || null;
      },
      findMany: async ({ where, orderBy }: any) => {
        let addrs = Array.from(store.addresses.values());
        if (where?.userId) {
          addrs = addrs.filter((a) => a.userId === where.userId);
        }
        if (orderBy) {
          addrs.sort((a, b) => {
            if (b.isDefault !== a.isDefault) {
              return b.isDefault ? 1 : -1;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        }
        return addrs;
      },
      count: async ({ where }: any) => {
        let addrs = Array.from(store.addresses.values());
        if (where?.userId) {
          addrs = addrs.filter((a) => a.userId === where.userId);
        }
        return addrs.length;
      },
      create: async ({ data }: any) => {
        const id = data.id || `addr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          userId: data.userId,
          label: data.label || 'Home',
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 || null,
          landmark: data.landmark || null,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          latitude: data.latitude,
          longitude: data.longitude,
          isDefault: Boolean(data.isDefault),
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        store.addresses.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const existing = store.addresses.get(where.id);
        if (!existing) throw new Error(`Address ${where.id} not found`);
        Object.assign(existing, data, { updatedAt: new Date() });
        return existing;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const addr of store.addresses.values()) {
          let match = true;
          if (where?.userId && addr.userId !== where.userId) match = false;
          if (where?.isDefault !== undefined && addr.isDefault !== where.isDefault) match = false;
          if (match) {
            Object.assign(addr, data, { updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
      delete: async ({ where }: any) => {
        const existing = store.addresses.get(where.id);
        if (existing) {
          store.addresses.delete(where.id);
          return existing;
        }
        return null;
      },
    },

    serviceCategory: {
      findMany: async ({ where, include, orderBy }: any) => {
        let list = Array.from(store.serviceCategories.values());
        if (where?.isActive !== undefined) {
          list = list.filter((c) => c.isActive === where.isActive);
        }
        if (where?.parentId === null) {
          list = list.filter((c) => c.parentId === null || c.parentId === undefined);
        } else if (where?.parentId !== undefined) {
          list = list.filter((c) => c.parentId === where.parentId);
        }
        if (orderBy?.displayOrder === 'asc') {
          list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        }

        return list.map((c) => {
          const res: any = { ...c };
          if (include?.children) {
            let children = Array.from(store.serviceCategories.values()).filter(
              (sub) => sub.parentId === c.id && (include.children.where?.isActive !== undefined ? sub.isActive === include.children.where.isActive : true)
            );
            if (include.children.orderBy?.displayOrder === 'asc') {
              children.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            }
            res.children = children.map((sub) => {
              const subRes: any = { ...sub };
              if (include.children.include?._count?.select?.services) {
                const subServices = Array.from(store.services.values()).filter(
                  (s) => s.categoryId === sub.id && s.isActive
                );
                subRes._count = { services: subServices.length };
              }
              return subRes;
            });
          }
          if (include?._count?.select?.services) {
            const servs = Array.from(store.services.values()).filter(
              (s) => s.categoryId === c.id && s.isActive
            );
            res._count = { services: servs.length };
          }
          if (include?.services) {
            let servs = Array.from(store.services.values()).filter(
              (s) => s.categoryId === c.id && (include.services.where?.isActive !== undefined ? s.isActive === include.services.where.isActive : true)
            );
            if (include.services.orderBy?.name === 'asc') {
              servs.sort((a, b) => a.name.localeCompare(b.name));
            }
            res.services = servs;
          }
          return res;
        });
      },
      findFirst: async ({ where, include }: any) => {
        let list = Array.from(store.serviceCategories.values());
        if (where?.isActive !== undefined) {
          list = list.filter((c) => c.isActive === where.isActive);
        }
        if (where?.OR && Array.isArray(where.OR)) {
          list = list.filter((c) =>
            where.OR.some((cond: any) => (cond.id && c.id === cond.id) || (cond.slug && c.slug === cond.slug))
          );
        }
        const c = list[0];
        if (!c) return null;

        const res: any = { ...c };
        if (include?.children) {
          let children = Array.from(store.serviceCategories.values()).filter(
            (sub) => sub.parentId === c.id && (include.children.where?.isActive !== undefined ? sub.isActive === include.children.where.isActive : true)
          );
          if (include.children.orderBy?.displayOrder === 'asc') {
            children.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
          }
          res.children = children;
        }
        if (include?._count?.select?.services) {
          const servs = Array.from(store.services.values()).filter(
            (s) => s.categoryId === c.id && s.isActive
          );
          res._count = { services: servs.length };
        }
        if (include?.services) {
          let servs = Array.from(store.services.values()).filter(
            (s) => s.categoryId === c.id && (include.services.where?.isActive !== undefined ? s.isActive === include.services.where.isActive : true)
          );
          if (include.services.orderBy?.name === 'asc') {
            servs.sort((a, b) => a.name.localeCompare(b.name));
          }
          res.services = servs;
        }
        return res;
      },
      findUnique: async ({ where }: any) => {
        for (const c of store.serviceCategories.values()) {
          if (where.id && c.id === where.id) return c;
          if (where.slug && c.slug === where.slug) return c;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const id = data.id || `cat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          name: data.name,
          slug: data.slug,
          parentId: data.parentId || null,
          iconUrl: data.iconUrl || null,
          imageUrl: data.imageUrl || null,
          displayOrder: data.displayOrder || 0,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
          createdAt: data.createdAt || new Date(),
        };
        store.serviceCategories.set(id, record);
        return record;
      },
    },

    service: {
      findMany: async ({ where, include, skip = 0, take = 50, orderBy }: any) => {
        let list = Array.from(store.services.values());
        if (where?.isActive !== undefined) {
          list = list.filter((s) => s.isActive === where.isActive);
        }
        if (where?.categoryId) {
          list = list.filter((s) => s.categoryId === where.categoryId);
        }
        if (where?.pricingModel) {
          list = list.filter((s) => s.pricingModel === where.pricingModel);
        }
        if (where?.category) {
          list = list.filter((s) => {
            const cat = store.serviceCategories.get(s.categoryId);
            if (!cat) return false;
            if (where.category.isActive !== undefined && cat.isActive !== where.category.isActive) return false;
            if (where.category.OR && Array.isArray(where.category.OR)) {
              return where.category.OR.some((cond: any) => (cond.id && cat.id === cond.id) || (cond.slug && cat.slug === cond.slug));
            }
            return true;
          });
        }
        if (where?.OR && Array.isArray(where.OR)) {
          list = list.filter((s) => {
            const nameCond = where.OR.find((c: any) => c.name?.contains);
            const descCond = where.OR.find((c: any) => c.description?.contains);
            const nameQuery = nameCond?.name?.contains?.toLowerCase() || '';
            const descQuery = descCond?.description?.contains?.toLowerCase() || '';
            const matchName = nameQuery ? s.name.toLowerCase().includes(nameQuery) : false;
            const matchDesc = descQuery && s.description ? s.description.toLowerCase().includes(descQuery) : false;
            return matchName || matchDesc;
          });
        }

        if (orderBy?.name === 'asc') {
          list.sort((a, b) => a.name.localeCompare(b.name));
        } else if (orderBy?.name === 'desc') {
          list.sort((a, b) => b.name.localeCompare(a.name));
        } else if (orderBy?.basePricePaisa === 'asc') {
          list.sort((a, b) => a.basePricePaisa - b.basePricePaisa);
        } else if (orderBy?.basePricePaisa === 'desc') {
          list.sort((a, b) => b.basePricePaisa - a.basePricePaisa);
        }

        const sliced = list.slice(skip, skip + take);
        return sliced.map((s) => {
          const res: any = { ...s };
          if (include?.category) {
            const cat = store.serviceCategories.get(s.categoryId);
            res.category = cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null;
          }
          return res;
        });
      },
      count: async ({ where }: any) => {
        let list = Array.from(store.services.values());
        if (where?.isActive !== undefined) {
          list = list.filter((s) => s.isActive === where.isActive);
        }
        if (where?.categoryId) {
          list = list.filter((s) => s.categoryId === where.categoryId);
        }
        if (where?.pricingModel) {
          list = list.filter((s) => s.pricingModel === where.pricingModel);
        }
        if (where?.category) {
          list = list.filter((s) => {
            const cat = store.serviceCategories.get(s.categoryId);
            if (!cat) return false;
            if (where.category.isActive !== undefined && cat.isActive !== where.category.isActive) return false;
            if (where.category.OR && Array.isArray(where.category.OR)) {
              return where.category.OR.some((cond: any) => (cond.id && cat.id === cond.id) || (cond.slug && cat.slug === cond.slug));
            }
            return true;
          });
        }
        if (where?.OR && Array.isArray(where.OR)) {
          list = list.filter((s) => {
            const nameCond = where.OR.find((c: any) => c.name?.contains);
            const descCond = where.OR.find((c: any) => c.description?.contains);
            const nameQuery = nameCond?.name?.contains?.toLowerCase() || '';
            const descQuery = descCond?.description?.contains?.toLowerCase() || '';
            const matchName = nameQuery ? s.name.toLowerCase().includes(nameQuery) : false;
            const matchDesc = descQuery && s.description ? s.description.toLowerCase().includes(descQuery) : false;
            return matchName || matchDesc;
          });
        }
        return list.length;
      },
      findFirst: async ({ where, include }: any) => {
        let list = Array.from(store.services.values());
        if (where?.isActive !== undefined) {
          list = list.filter((s) => s.isActive === where.isActive);
        }
        if (where?.OR && Array.isArray(where.OR)) {
          list = list.filter((s) =>
            where.OR.some((cond: any) => (cond.id && s.id === cond.id) || (cond.slug && s.slug === cond.slug))
          );
        }
        if (where?.category) {
          list = list.filter((s) => {
            const cat = store.serviceCategories.get(s.categoryId);
            if (!cat) return false;
            if (where.category.isActive !== undefined && cat.isActive !== where.category.isActive) return false;
            return true;
          });
        }
        const s = list[0];
        if (!s) return null;

        const res: any = { ...s };
        if (include?.category) {
          res.category = store.serviceCategories.get(s.categoryId) || null;
        }
        return res;
      },
      findUnique: async ({ where, include }: any) => {
        for (const s of store.services.values()) {
          if ((where.id && s.id === where.id) || (where.slug && s.slug === where.slug)) {
            const res: any = { ...s };
            if (include?.category) {
              res.category = store.serviceCategories.get(s.categoryId) || null;
            }
            return res;
          }
        }
        return null;
      },
      create: async ({ data }: any) => {
        const id = data.id || `srv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          categoryId: data.categoryId,
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          pricingModel: data.pricingModel || 'FIXED_PRICE',
          basePricePaisa: data.basePricePaisa || 0,
          hourlyRatePaisa: data.hourlyRatePaisa || null,
          inspectionFeePaisa: data.inspectionFeePaisa || null,
          estimatedDurationMinutes: data.estimatedDurationMinutes || 60,
          isMaterialAllowed: data.isMaterialAllowed !== undefined ? Boolean(data.isMaterialAllowed) : true,
          platformCommissionPercent: data.platformCommissionPercent || 15.0,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        store.services.set(id, record);
        return record;
      },
    },

    conversation: {
      create: async ({ data, include }: any) => {
        const id = data.id || `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          bookingId: data.bookingId,
          status: data.status || 'ACTIVE',
          lastMessageAt: data.lastMessageAt || null,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        store.conversations.set(id, record);
        const res: any = { ...record };
        if (include?.booking) {
          res.booking = store.bookings.get(record.bookingId) || null;
        }
        if (include?.participants) {
          res.participants = Array.from(store.conversationParticipants.values()).filter((p) => p.conversationId === record.id);
        }
        if (include?.messages) {
          res.messages = Array.from(store.messages.values()).filter((m) => m.conversationId === record.id);
        }
        return res;
      },
      findUnique: async ({ where, include }: any) => {
        let c: any = null;
        if (where?.id) c = store.conversations.get(where.id);
        if (!c && where?.bookingId) {
          c = Array.from(store.conversations.values()).find((x) => x.bookingId === where.bookingId);
        }
        if (!c) return null;
        const res: any = { ...c };
        if (include?.booking) {
          res.booking = store.bookings.get(c.bookingId) || null;
        }
        if (include?.participants) {
          res.participants = Array.from(store.conversationParticipants.values())
            .filter((p) => p.conversationId === c.id)
            .map((p) => ({ ...p, user: store.users.get(p.userId) }));
        }
        if (include?.messages) {
          res.messages = Array.from(store.messages.values()).filter((m) => m.conversationId === c.id);
        }
        return res;
      },
      findFirst: async ({ where, include }: any) => {
        for (const c of store.conversations.values()) {
          if (where?.id && c.id !== where.id) continue;
          if (where?.bookingId && c.bookingId !== where.bookingId) continue;
          const res: any = { ...c };
          if (include?.booking) {
            res.booking = store.bookings.get(c.bookingId) || null;
          }
          if (include?.participants) {
            res.participants = Array.from(store.conversationParticipants.values())
              .filter((p) => p.conversationId === c.id)
              .map((p) => ({ ...p, user: store.users.get(p.userId) }));
          }
          if (include?.messages) {
            res.messages = Array.from(store.messages.values()).filter((m) => m.conversationId === c.id);
          }
          return res;
        }
        return null;
      },
      update: async ({ where, data, include }: any) => {
        let c = where.id ? store.conversations.get(where.id) : null;
        if (!c && where.bookingId) {
          c = Array.from(store.conversations.values()).find((x) => x.bookingId === where.bookingId);
        }
        if (!c) throw new Error('Conversation not found in mock store');
        Object.assign(c, data, { updatedAt: new Date() });
        const res: any = { ...c };
        if (include?.booking) res.booking = store.bookings.get(c.bookingId) || null;
        if (include?.participants) {
          res.participants = Array.from(store.conversationParticipants.values()).filter((p) => p.conversationId === c.id);
        }
        return res;
      },
    },

    conversationParticipant: {
      create: async ({ data }: any) => {
        const id = data.id || `cp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          conversationId: data.conversationId,
          userId: data.userId,
          role: data.role || 'CUSTOMER',
          lastReadMessageId: data.lastReadMessageId || null,
          lastReadAt: data.lastReadAt || null,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        store.conversationParticipants.set(id, record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        if (where?.id) return store.conversationParticipants.get(where.id) || null;
        const compound = where?.idx_participant_conversation_user || where?.conversationId_userId;
        if (compound) {
          const { conversationId, userId } = compound;
          for (const p of store.conversationParticipants.values()) {
            if (p.conversationId === conversationId && p.userId === userId) return { ...p };
          }
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const p of store.conversationParticipants.values()) {
          if (where?.conversationId && p.conversationId !== where.conversationId) continue;
          if (where?.userId && p.userId !== where.userId) continue;
          return { ...p };
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        return Array.from(store.conversationParticipants.values()).filter((p) => {
          if (where?.conversationId && p.conversationId !== where.conversationId) return false;
          if (where?.userId && p.userId !== where.userId) return false;
          return true;
        });
      },
      update: async ({ where, data }: any) => {
        let p: any = null;
        if (where?.id) p = store.conversationParticipants.get(where.id);
        const compound = where?.idx_participant_conversation_user || where?.conversationId_userId;
        if (!p && compound) {
          const { conversationId, userId } = compound;
          p = Array.from(store.conversationParticipants.values()).find(
            (x) => x.conversationId === conversationId && x.userId === userId
          );
        }
        if (!p) throw new Error('ConversationParticipant not found');
        Object.assign(p, data, { updatedAt: new Date() });
        return { ...p };
      },
      upsert: async ({ where, create, update }: any) => {
        let p: any = null;
        if (where?.id) p = store.conversationParticipants.get(where.id);
        const compound = where?.idx_participant_conversation_user || where?.conversationId_userId;
        if (!p && compound) {
          const { conversationId, userId } = compound;
          p = Array.from(store.conversationParticipants.values()).find(
            (x) => x.conversationId === conversationId && x.userId === userId
          );
        }
        if (p) {
          Object.assign(p, update, { updatedAt: new Date() });
          return { ...p };
        }
        const id = create.id || `cp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          conversationId: create.conversationId,
          userId: create.userId,
          role: create.role || 'CUSTOMER',
          lastReadMessageId: create.lastReadMessageId || null,
          lastReadAt: create.lastReadAt || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.conversationParticipants.set(id, record);
        return { ...record };
      },
    },

    message: {
      create: async ({ data, include }: any) => {
        // Enforce uniqueness constraint: (conversationId, clientMessageId)
        if (data.clientMessageId) {
          for (const existing of store.messages.values()) {
            if (
              existing.conversationId === data.conversationId &&
              existing.clientMessageId === data.clientMessageId
            ) {
              const err: any = new Error('Unique constraint failed on the fields: (`conversationId`,`clientMessageId`)');
              err.code = 'P2002';
              throw err;
            }
          }
        }
        const id = data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          conversationId: data.conversationId,
          senderUserId: data.senderUserId || null,
          clientMessageId: data.clientMessageId || null,
          messageType: data.messageType || 'TEXT',
          body: data.body,
          replyToMessageId: data.replyToMessageId || null,
          metadata: data.metadata || null,
          editedAt: data.editedAt || null,
          deletedAt: data.deletedAt || null,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        store.messages.set(id, record);
        const res: any = { ...record };
        if (include?.sender && record.senderUserId) {
          res.sender = store.users.get(record.senderUserId) || null;
        }
        if (include?.replyTo && record.replyToMessageId) {
          res.replyTo = store.messages.get(record.replyToMessageId) || null;
        }
        return res;
      },
      findUnique: async ({ where, include }: any) => {
        const m = store.messages.get(where.id);
        if (!m) return null;
        const res: any = { ...m };
        if (include?.sender && m.senderUserId) {
          res.sender = store.users.get(m.senderUserId) || null;
        }
        if (include?.replyTo && m.replyToMessageId) {
          res.replyTo = store.messages.get(m.replyToMessageId) || null;
        }
        return res;
      },
      findFirst: async ({ where, include, orderBy }: any) => {
        let matches: any[] = [];
        for (const m of store.messages.values()) {
          if (where?.id && m.id !== where.id) continue;
          if (where?.conversationId && m.conversationId !== where.conversationId) continue;
          if (where?.clientMessageId && m.clientMessageId !== where.clientMessageId) continue;
          if (where?.senderUserId && m.senderUserId !== where.senderUserId) continue;
          if (where?.deletedAt === null && m.deletedAt !== null) continue;
          matches.push(m);
        }
        if (orderBy?.createdAt === 'desc') {
          matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (orderBy?.createdAt === 'asc') {
          matches.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
        const m = matches[0];
        if (!m) return null;
        const res: any = { ...m };
        if (include?.sender && m.senderUserId) {
          res.sender = store.users.get(m.senderUserId) || null;
        }
        if (include?.replyTo && m.replyToMessageId) {
          res.replyTo = store.messages.get(m.replyToMessageId) || null;
        }
        return res;
      },
      findMany: async ({ where, orderBy, take, skip = 0, cursor, include }: any) => {
        let list = Array.from(store.messages.values()).filter((m) => {
          if (where?.conversationId && m.conversationId !== where.conversationId) return false;
          if (where?.senderUserId && m.senderUserId !== where.senderUserId) return false;
          if (where?.deletedAt === null && m.deletedAt !== null) return false;
          if (where?.createdAt?.gt && !(new Date(m.createdAt) > new Date(where.createdAt.gt))) return false;
          if (where?.createdAt?.lt && !(new Date(m.createdAt) < new Date(where.createdAt.lt))) return false;
          if (where?.senderUserId?.not && m.senderUserId === where.senderUserId.not) return false;
          return true;
        });

        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else {
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }

        if (cursor?.id) {
          const idx = list.findIndex((m) => m.id === cursor.id);
          if (idx !== -1) {
            list = list.slice(idx);
          }
        }

        if (skip) list = list.slice(skip);
        if (take !== undefined) list = list.slice(0, take);

        return list.map((m) => {
          const res: any = { ...m };
          if (include?.sender && m.senderUserId) {
            res.sender = store.users.get(m.senderUserId) || null;
          }
          if (include?.replyTo && m.replyToMessageId) {
            res.replyTo = store.messages.get(m.replyToMessageId) || null;
          }
          return res;
        });
      },
      count: async ({ where }: any) => {
        return Array.from(store.messages.values()).filter((m) => {
          if (where?.conversationId && m.conversationId !== where.conversationId) return false;
          if (where?.deletedAt === null && m.deletedAt !== null) return false;
          if (where?.createdAt?.gt && !(new Date(m.createdAt) > new Date(where.createdAt.gt))) return false;
          if (where?.senderUserId?.not && m.senderUserId === where.senderUserId.not) return false;
          return true;
        }).length;
      },
      update: async ({ where, data }: any) => {
        const m = store.messages.get(where.id);
        if (!m) throw new Error('Message not found');
        Object.assign(m, data, { updatedAt: new Date() });
        return { ...m };
      },
    },

    chatOutboxEvent: {
      create: async ({ data }: any) => {
        const id = data.id || `outbox_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          channel: data.channel,
          eventType: data.eventType,
          payload: data.payload,
          isDelivered: data.isDelivered || false,
          deliveredAt: data.deliveredAt || null,
          createdAt: data.createdAt || new Date(),
        };
        store.chatOutboxEvents.set(id, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        return Array.from(store.chatOutboxEvents.values()).filter((e) => {
          if (where?.isDelivered !== undefined && e.isDelivered !== where.isDelivered) return false;
          return true;
        });
      },
      update: async ({ where, data }: any) => {
        const e = store.chatOutboxEvents.get(where.id);
        if (!e) throw new Error('Outbox event not found');
        Object.assign(e, data);
        return { ...e };
      },
    },

    review: {
      create: async ({ data, include }: any) => {
        const id = data.id || `rev_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          bookingId: data.bookingId,
          customerId: data.customerId,
          providerId: data.providerId,
          rating: data.rating,
          title: data.title || null,
          body: data.body || data.comment || null,
          comment: data.comment || data.body || null,
          status: data.status || 'PUBLISHED',
          isFlagged: data.isFlagged || false,
          providerResponse: data.providerResponse || data.providerReply || null,
          providerReply: data.providerReply || data.providerResponse || null,
          providerRespondedAt: data.providerRespondedAt || null,
          moderatedAt: data.moderatedAt || null,
          moderatedBy: data.moderatedBy || null,
          moderationReason: data.moderationReason || null,
          photos: data.photos || [],
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        store.reviews.set(id, record);

        const booking = store.bookings.get(data.bookingId);
        if (booking) {
          booking.review = record;
        }

        const res: any = { ...record };
        if (include?.customer) {
          res.customer = store.users.get(record.customerId) || { fullName: 'Verified Customer' };
        }
        if (include?.provider) {
          res.provider = store.providers.get(record.providerId) || null;
        }
        return res;
      },
      findUnique: async ({ where, include }: any) => {
        for (const r of store.reviews.values()) {
          if ((where.id && r.id === where.id) || (where.bookingId && r.bookingId === where.bookingId)) {
            const res: any = { ...r };
            if (include?.customer) {
              res.customer = store.users.get(r.customerId) || { fullName: 'Verified Customer' };
            }
            if (include?.provider) {
              const p = store.providers.get(r.providerId);
              res.provider = p ? { ...p, user: store.users.get(p.userId) } : null;
            }
            if (include?.booking) {
              res.booking = store.bookings.get(r.bookingId) || null;
            }
            if (include?.reports) {
              res.reports = Array.from(store.reviewReports.values()).filter((rep) => rep.reviewId === r.id);
            }
            return res;
          }
        }
        return null;
      },
      findFirst: async ({ where, include }: any) => {
        for (const r of store.reviews.values()) {
          if (where?.id && r.id !== where.id) continue;
          if (where?.bookingId && r.bookingId !== where.bookingId) continue;
          if (where?.customerId && r.customerId !== where.customerId) continue;
          if (where?.providerId && r.providerId !== where.providerId) continue;
          if (where?.status && r.status !== where.status) continue;

          const res: any = { ...r };
          if (include?.customer) {
            res.customer = store.users.get(r.customerId) || { fullName: 'Verified Customer' };
          }
          if (include?.provider) {
            const p = store.providers.get(r.providerId);
            res.provider = p ? { ...p, user: store.users.get(p.userId) } : null;
          }
          if (include?.booking) {
            res.booking = store.bookings.get(r.bookingId) || null;
          }
          if (include?.reports) {
            res.reports = Array.from(store.reviewReports.values()).filter((rep) => rep.reviewId === r.id);
          }
          return res;
        }
        return null;
      },
      findMany: async ({ where, skip = 0, take, orderBy, include, select }: any) => {
        let list = Array.from(store.reviews.values()).filter((r) => {
          if (where?.providerId && r.providerId !== where.providerId) return false;
          if (where?.customerId && r.customerId !== where.customerId) return false;
          if (where?.status && r.status !== where.status) return false;
          if (where?.rating && r.rating !== where.rating) return false;
          if (where?.isFlagged !== undefined && r.isFlagged !== where.isFlagged) return false;
          return true;
        });

        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (orderBy?.createdAt === 'asc') {
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }

        if (skip) list = list.slice(skip);
        if (take !== undefined) list = list.slice(0, take);

        return list.map((r) => {
          if (select) {
            const selRes: any = {};
            for (const key of Object.keys(select)) {
              if (select[key]) selRes[key] = r[key];
            }
            return selRes;
          }
          const res: any = { ...r };
          if (include?.customer) {
            res.customer = store.users.get(r.customerId) || { fullName: 'Verified Customer' };
          }
          if (include?.provider) {
            const p = store.providers.get(r.providerId);
            res.provider = p ? { ...p, user: store.users.get(p.userId) } : null;
          }
          if (include?.reports) {
            res.reports = Array.from(store.reviewReports.values()).filter((rep) => rep.reviewId === r.id);
          }
          return res;
        });
      },
      count: async ({ where }: any) => {
        return Array.from(store.reviews.values()).filter((r) => {
          if (where?.providerId && r.providerId !== where.providerId) return false;
          if (where?.customerId && r.customerId !== where.customerId) return false;
          if (where?.status && r.status !== where.status) return false;
          if (where?.rating && r.rating !== where.rating) return false;
          if (where?.isFlagged !== undefined && r.isFlagged !== where.isFlagged) return false;
          return true;
        }).length;
      },
      update: async ({ where, data, include }: any) => {
        const r = store.reviews.get(where.id);
        if (!r) throw new Error('Review not found in mock store');
        Object.assign(r, data, { updatedAt: new Date() });
        const res: any = { ...r };
        if (include?.customer) {
          res.customer = store.users.get(r.customerId) || { fullName: 'Verified Customer' };
        }
        if (include?.provider) {
          const p = store.providers.get(r.providerId);
          res.provider = p ? { ...p, user: store.users.get(p.userId) } : null;
        }
        return res;
      },
      delete: async ({ where }: any) => {
        const r = store.reviews.get(where.id);
        if (r) store.reviews.delete(where.id);
        return r;
      },
    },

    reviewReport: {
      create: async ({ data }: any) => {
        const id = data.id || `rep_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          reviewId: data.reviewId,
          reporterId: data.reporterId,
          reason: data.reason,
          details: data.details || null,
          status: data.status || 'PENDING',
          createdAt: data.createdAt || new Date(),
          resolvedAt: data.resolvedAt || null,
          resolvedBy: data.resolvedBy || null,
        };
        store.reviewReports.set(id, record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        for (const rep of store.reviewReports.values()) {
          if (where?.reviewId && rep.reviewId !== where.reviewId) continue;
          if (where?.reporterId && rep.reporterId !== where.reporterId) continue;
          return rep;
        }
        return null;
      },
      findUnique: async ({ where }: any) => {
        if (where.id) return store.reviewReports.get(where.id) || null;
        if (where.reviewId_reporterId) {
          for (const rep of store.reviewReports.values()) {
            if (
              rep.reviewId === where.reviewId_reporterId.reviewId &&
              rep.reporterId === where.reviewId_reporterId.reporterId
            ) {
              return rep;
            }
          }
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        return Array.from(store.reviewReports.values()).filter((rep) => {
          if (where?.reviewId && rep.reviewId !== where.reviewId) return false;
          if (where?.reporterId && rep.reporterId !== where.reporterId) return false;
          if (where?.status && rep.status !== where.status) return false;
          return true;
        });
      },
      update: async ({ where, data }: any) => {
        const rep = store.reviewReports.get(where.id);
        if (!rep) throw new Error('Report not found in mock store');
        Object.assign(rep, data);
        return { ...rep };
      },
      count: async ({ where }: any) => {
        return Array.from(store.reviewReports.values()).filter((rep) => {
          if (where?.reviewId && rep.reviewId !== where.reviewId) return false;
          if (where?.status && rep.status !== where.status) return false;
          return true;
        }).length;
      },
    },

    mediaAttachment: {
      create: async ({ data }: any) => {
        const id = data.id || `med_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const record = {
          id,
          storageKey: data.storageKey,
          fileUrl: data.fileUrl,
          purpose: data.purpose,
          entityId: data.entityId,
          bookingId: data.bookingId || data.entityId,
          uploaderUserId: data.uploaderUserId,
          uploaderRole: data.uploaderRole,
          caption: data.caption || null,
          contentType: data.contentType || 'image/jpeg',
          fileSizeBytes: data.fileSizeBytes || 0,
          createdAt: data.createdAt || new Date(),
        };
        store.mediaAttachments.set(id, record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        if (where?.id) return store.mediaAttachments.get(where.id) || null;
        return null;
      },
      findFirst: async ({ where }: any) => {
        for (const m of store.mediaAttachments.values()) {
          if (where?.id && m.id !== where.id) continue;
          if (where?.bookingId && m.bookingId !== where.bookingId) continue;
          if (where?.entityId && m.entityId !== where.entityId) continue;
          if (where?.purpose && m.purpose !== where.purpose) continue;
          return m;
        }
        return null;
      },
      findMany: async ({ where, orderBy }: any) => {
        let list = Array.from(store.mediaAttachments.values()).filter((m) => {
          if (where?.bookingId && m.bookingId !== where.bookingId) return false;
          if (where?.entityId && m.entityId !== where.entityId) return false;
          if (where?.purpose && m.purpose !== where.purpose) return false;
          if (where?.uploaderUserId && m.uploaderUserId !== where.uploaderUserId) return false;
          return true;
        });
        if (orderBy?.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return list;
      },
      delete: async ({ where }: any) => {
        const m = store.mediaAttachments.get(where.id);
        if (m) store.mediaAttachments.delete(where.id);
        return m;
      },
      count: async ({ where }: any) => {
        return Array.from(store.mediaAttachments.values()).filter((m) => {
          if (where?.bookingId && m.bookingId !== where.bookingId) return false;
          if (where?.entityId && m.entityId !== where.entityId) return false;
          if (where?.purpose && m.purpose !== where.purpose) return false;
          return true;
        }).length;
      },
    },

    $transaction: async (arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === 'function') {
        return arg(mockPrisma);
      }
      return arg;
    },

    $queryRaw: async (_query: any, ..._values: any[]) => {
      return [{ '?column?': 1 }];
    },
  };

  return mockPrisma;
}
