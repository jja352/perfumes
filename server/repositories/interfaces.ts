import type {
  ContactInquiry,
  Order,
  Perfume,
  PerfumeReview,
  PromoCode,
  UserAccount,
} from '../../src/types/perfume.ts';

/**
 * Repository interfaces designed so the in-memory / JSON persistence layer
 * can be replaced cleanly with PostgreSQL (Drizzle/Prisma), Firestore,
 * and Stripe / Adyen payment gateways without touching API routes or UI.
 */

export interface IProductRepository {
  listAll(): Promise<Perfume[]>;
  findBySlug(slug: string): Promise<Perfume | undefined>;
  findById(id: string): Promise<Perfume | undefined>;
  listReviews(perfumeId: string): Promise<PerfumeReview[]>;
  addReview(review: Omit<PerfumeReview, 'id' | 'date'>): Promise<PerfumeReview>;
}

export interface IOrderRepository {
  create(order: Order): Promise<Order>;
  findByOrderNumber(orderNumber: string, email?: string): Promise<Order | undefined>;
  listByEmail(email: string): Promise<Order[]>;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserAccount | undefined>;
  upsert(user: UserAccount): Promise<UserAccount>;
}

export interface IPromoRepository {
  validate(code: string, subtotal: number): Promise<{ valid: boolean; promo?: PromoCode; reason?: string }>;
}

export interface IContactRepository {
  saveInquiry(inquiry: ContactInquiry): Promise<ContactInquiry>;
}

export interface PaymentIntentResult {
  authorized: boolean;
  transactionId: string;
  provider: 'stripe_ready_adapter' | 'cod_verification';
}

export interface IPaymentGateway {
  authorizePayment(params: {
    amount: number;
    currency: string;
    method: 'card' | 'apple_pay' | 'cod';
  }): Promise<PaymentIntentResult>;
}
