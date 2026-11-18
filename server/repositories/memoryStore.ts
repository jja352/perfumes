import type {
  ContactInquiry,
  Order,
  Perfume,
  PerfumeReview,
  PromoCode,
  UserAccount,
} from '../../src/types/perfume.ts';
import { INITIAL_REVIEWS, PERFUMES, PROMO_CODES, SEEDED_ORDERS } from '../data/perfumes.ts';
import type {
  IContactRepository,
  IOrderRepository,
  IPaymentGateway,
  IProductRepository,
  IPromoRepository,
  IUserRepository,
  PaymentIntentResult,
} from './interfaces.ts';

class MemoryProductRepository implements IProductRepository {
  private perfumes: Perfume[] = PERFUMES.map((p) => ({ ...p }));
  private reviews: PerfumeReview[] = [...INITIAL_REVIEWS];

  async listAll(): Promise<Perfume[]> {
    return this.perfumes;
  }

  async findBySlug(slug: string): Promise<Perfume | undefined> {
    return this.perfumes.find((p) => p.slug === slug);
  }

  async findById(id: string): Promise<Perfume | undefined> {
    return this.perfumes.find((p) => p.id === id);
  }

  async listReviews(perfumeId: string): Promise<PerfumeReview[]> {
    return this.reviews.filter((r) => r.perfumeId === perfumeId);
  }

  async addReview(review: Omit<PerfumeReview, 'id' | 'date'>): Promise<PerfumeReview> {
    const newReview: PerfumeReview = {
      ...review,
      id: `rev-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
    };
    this.reviews.unshift(newReview);

    const target = this.perfumes.find((p) => p.id === review.perfumeId);
    if (target) {
      const productReviews = this.reviews.filter((r) => r.perfumeId === target.id);
      const totalRating = productReviews.reduce((sum, r) => sum + r.rating, 0);
      target.reviewCount = target.reviewCount + 1;
      target.rating = Number((totalRating / productReviews.length).toFixed(1));
    }
    return newReview;
  }
}

class MemoryOrderRepository implements IOrderRepository {
  private orders: Order[] = [...SEEDED_ORDERS];

  async create(order: Order): Promise<Order> {
    this.orders.unshift(order);
    return order;
  }

  async findByOrderNumber(orderNumber: string, email?: string): Promise<Order | undefined> {
    const normalized = orderNumber.trim().toUpperCase();
    return this.orders.find((o) => {
      const numberMatch = o.orderNumber.toUpperCase() === normalized;
      if (!email || !email.trim()) return numberMatch;
      return numberMatch && (o.shippingAddress.email || '').toLowerCase() === email.trim().toLowerCase();
    });
  }

  async listByEmail(email: string): Promise<Order[]> {
    const normalized = email.trim().toLowerCase();
    return this.orders.filter((o) => (o.shippingAddress.email || '').toLowerCase() === normalized);
  }
}

class MemoryUserRepository implements IUserRepository {
  private users: UserAccount[] = [
    {
      id: 'usr-claire',
      name: 'Claire Moreau',
      email: 'claire.moreau@example.com',
      createdAt: '2026-04-12T10:00:00Z',
      savedAddress: {
        fullName: 'Claire Moreau',
        email: 'claire.moreau@example.com',
        phone: '+33 6 12 45 89 10',
        street: '24 Rue Saint-Honoré',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
      },
      scentProfile: {
        personality: 'Warm & Sensual',
        preferredFamily: 'Oriental · Amber',
        topMatchSlug: 'jia-flora-extrait',
        updatedAt: '2026-10-15',
      },
    },
  ];

  async findByEmail(email: string): Promise<UserAccount | undefined> {
    return this.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  async upsert(user: UserAccount): Promise<UserAccount> {
    const idx = this.users.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) {
      this.users[idx] = { ...this.users[idx], ...user };
      return this.users[idx];
    }
    this.users.push(user);
    return user;
  }
}

class MemoryPromoRepository implements IPromoRepository {
  private promos: PromoCode[] = [...PROMO_CODES];

  async validate(code: string, subtotal: number) {
    const clean = code.trim().toUpperCase();
    const promo = this.promos.find((p) => p.code === clean);
    if (!promo) {
      return { valid: false, reason: 'Offer code not recognized. Try JARDIN15 or WELCOME10.' };
    }
    if (subtotal < promo.minSubtotal) {
      return {
        valid: false,
        reason: `Code ${promo.code} requires a minimum subtotal of PKR ${promo.minSubtotal.toLocaleString('en-US')}.`,
      };
    }
    return { valid: true, promo };
  }
}

class MemoryContactRepository implements IContactRepository {
  private inquiries: ContactInquiry[] = [];

  async saveInquiry(inquiry: ContactInquiry): Promise<ContactInquiry> {
    this.inquiries.unshift(inquiry);
    return inquiry;
  }
}

class ReadyPaymentGateway implements IPaymentGateway {
  async authorizePayment(params: {
    amount: number;
    currency: string;
    method: 'card' | 'apple_pay' | 'cod';
  }): Promise<PaymentIntentResult> {
    return {
      authorized: true,
      transactionId: `TXN-${Date.now().toString(36).toUpperCase()}`,
      provider: params.method === 'cod' ? 'cod_verification' : 'stripe_ready_adapter',
    };
  }
}

export const productRepo = new MemoryProductRepository();
export const orderRepo = new MemoryOrderRepository();
export const userRepo = new MemoryUserRepository();
export const promoRepo = new MemoryPromoRepository();
export const contactRepo = new MemoryContactRepository();
export const paymentGateway = new ReadyPaymentGateway();
