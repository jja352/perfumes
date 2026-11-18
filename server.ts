import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  contactRepo,
  orderRepo,
  paymentGateway,
  productRepo,
  promoRepo,
  userRepo,
} from './server/repositories/memoryStore.ts';
import type { Order, PaymentMethod, ShippingAddress, UserAccount } from './src/types/perfume.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // --- Product & Review Routes ---
  app.get('/api/products', async (_req, res) => {
    const products = await productRepo.listAll();
    res.json({ products });
  });

  app.get('/api/products/:slug', async (req, res) => {
    const product = await productRepo.findBySlug(req.params.slug);
    if (!product) {
      res.status(404).json({ error: 'Fragrance not found' });
      return;
    }
    const reviews = await productRepo.listReviews(product.id);
    res.json({ product, reviews });
  });

  app.post('/api/products/:slug/reviews', async (req, res) => {
    const product = await productRepo.findBySlug(req.params.slug);
    if (!product) {
      res.status(404).json({ error: 'Fragrance not found' });
      return;
    }
    const { author, location, rating, title, comment } = req.body as {
      author?: string;
      location?: string;
      rating?: number;
      title?: string;
      comment?: string;
    };

    if (!author?.trim() || !title?.trim() || !comment?.trim()) {
      res.status(400).json({ error: 'Please complete your name, review headline, and tasting notes.' });
      return;
    }

    const clampedRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const review = await productRepo.addReview({
      perfumeId: product.id,
      author: author.trim(),
      location: location?.trim() || 'Verified Boutique Client',
      rating: clampedRating,
      title: title.trim(),
      comment: comment.trim(),
      verifiedPurchase: true,
    });

    const updatedProduct = await productRepo.findBySlug(req.params.slug);
    const reviews = await productRepo.listReviews(product.id);
    res.status(201).json({ review, product: updatedProduct, reviews });
  });

  // --- Promo Code Validation ---
  app.post('/api/promo/validate', async (req, res) => {
    const { code, subtotal } = req.body as { code?: string; subtotal?: number };
    const result = await promoRepo.validate(code || '', Number(subtotal) || 0);
    if (!result.valid) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  // --- Orders & Checkout ---
  app.post('/api/orders', async (req, res) => {
    const {
      items,
      shippingAddress,
      paymentMethod,
      shippingMethod,
      discountCode,
      instructions,
      userId,
    } = req.body as {
      items?: Order['items'];
      shippingAddress?: ShippingAddress;
      paymentMethod?: PaymentMethod;
      shippingMethod?: 'standard' | 'express' | 'cod';
      discountCode?: string;
      instructions?: string;
      userId?: string;
    };

    if (!items || items.length === 0 || items.some((i) => !Number.isFinite(i.quantity) || i.quantity < 1)) {
      res.status(400).json({ error: 'Your shopping bag is empty or contains an invalid quantity.' });
      return;
    }

    if (
      !shippingAddress?.fullName?.trim() ||
      !shippingAddress?.phone?.trim() ||
      !shippingAddress?.street?.trim() ||
      !shippingAddress?.city?.trim()
    ) {
      res.status(400).json({ error: 'Please provide complete shipping contact and address details.' });
      return;
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let discountAmount = 0;
    let appliedCode: string | undefined;

    if (discountCode) {
      const promoCheck = await promoRepo.validate(discountCode, subtotal);
      if (promoCheck.valid && promoCheck.promo) {
        discountAmount = Math.round((subtotal * promoCheck.promo.discountPercent) / 100);
        appliedCode = promoCheck.promo.code;
      }
    }

    const method = shippingMethod || 'standard';
    const freeThreshold = 15000;
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const shippingFee =
      method === 'express' ? 950 : afterDiscount >= freeThreshold ? 0 : 450;

    const total = Math.round(afterDiscount + shippingFee);

    const paymentAuth = await paymentGateway.authorizePayment({
      amount: total,
      currency: 'PKR',
      method: paymentMethod || 'card',
    });

    if (!paymentAuth.authorized) {
      res.status(402).json({ error: 'Payment authorization failed.' });
      return;
    }

    const orderNum = `JDJ-${Math.floor(1050 + Math.random() * 8900)}`;
    const nowLabel = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: orderNum,
      createdAt: new Date().toISOString(),
      status: 'Confirmed',
      estimatedDelivery: method === 'express' ? '2–3 Business Days' : '4–6 Business Days',
      items,
      subtotal,
      discountCode: appliedCode,
      discountAmount,
      shippingFee,
      total,
      paymentMethod: paymentMethod || 'card',
      shippingMethod: method,
      shippingAddress: {
        ...shippingAddress,
        email: shippingAddress.email?.trim() || '',
        postalCode: shippingAddress.postalCode?.trim() || '',
        whatsappNumber: shippingAddress.whatsappNumber?.trim() || shippingAddress.phone.trim(),
      },
      instructions: instructions?.trim() || undefined,
      userId,
      timeline: [
        {
          step: 'Confirmed',
          timestamp: nowLabel,
          detail:
            paymentMethod === 'cod'
              ? 'Cash on Delivery reservation verified. Preparing boutique parcel.'
              : 'Payment authorized. Order assigned to Jardin de Jour Herbal Apothecary.',
          completed: true,
        },
        {
          step: 'Hand-Poured in Atelier',
          timestamp: 'Pending',
          detail: 'Flacon inspection, ribbon boxing, and complimentary sample vials.',
          completed: false,
        },
        {
          step: 'Dispatched',
          timestamp: 'Pending',
          detail: 'Climate-protected courier dispatch.',
          completed: false,
        },
        {
          step: 'Out for Delivery',
          timestamp: 'Pending',
          detail: 'Local courier en route.',
          completed: false,
        },
        {
          step: 'Delivered',
          timestamp: 'Pending',
          detail: 'Signature delivery completed.',
          completed: false,
        },
      ],
    };

    const savedOrder = await orderRepo.create(newOrder);
    res.status(201).json({ order: savedOrder, transactionId: paymentAuth.transactionId });
  });

  app.get('/api/orders/track', async (req, res) => {
    const orderNumber = String(req.query.orderNumber || '');
    const email = req.query.email ? String(req.query.email) : undefined;
    if (!orderNumber.trim()) {
      res.status(400).json({ error: 'Please enter an order number (for example, JDJ-1042).' });
      return;
    }
    const order = await orderRepo.findByOrderNumber(orderNumber, email);
    if (!order) {
      res.status(404).json({ error: 'No matching order was found. Check the order reference and email.' });
      return;
    }
    res.json({ order });
  });

  app.get('/api/orders/by-email', async (req, res) => {
    const email = String(req.query.email || '');
    if (!email.trim()) {
      res.json({ orders: [] });
      return;
    }
    const orders = await orderRepo.listByEmail(email);
    res.json({ orders });
  });

  // --- Customer Accounts ---
  app.post('/api/auth/session', async (req, res) => {
    const { name, email, scentProfile, savedAddress } = req.body as Partial<UserAccount>;
    if (!email?.trim()) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }
    const existing = await userRepo.findByEmail(email);
    if (existing && !name && !scentProfile && !savedAddress) {
      const orders = await orderRepo.listByEmail(existing.email);
      res.json({ user: existing, orders });
      return;
    }

    const account: UserAccount = {
      id: existing?.id || `usr-${Date.now()}`,
      name: name?.trim() || existing?.name || email.split('@')[0],
      email: email.trim().toLowerCase(),
      savedAddress: savedAddress || existing?.savedAddress,
      scentProfile: scentProfile || existing?.scentProfile,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    const savedUser = await userRepo.upsert(account);
    const orders = await orderRepo.listByEmail(savedUser.email);
    res.json({ user: savedUser, orders });
  });

  // --- Contact Form ---
  app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body as {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
    };
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      res.status(400).json({ error: 'Please provide your name, email address, and message.' });
      return;
    }
    const inquiry = await contactRepo.saveInquiry({
      id: `inq-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      subject: subject?.trim() || 'Private Atelier Consultation',
      message: message.trim(),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ inquiry, status: 'Received by our Jardin de Jour concierge (Lahore).' });
  });

  // --- Vite / Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jardin de Jour boutique server listening on http://localhost:${PORT}`);
  });
}

startServer();
