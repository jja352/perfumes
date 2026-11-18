import { Suspense, lazy } from 'react';
import { StoreProvider, useStore } from './context/StoreContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { HomePage } from './pages/HomePage.tsx';

const CollectionPage = lazy(() =>
  import('./pages/CollectionPage.tsx').then((m) => ({ default: m.CollectionPage }))
);
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage.tsx').then((m) => ({ default: m.ProductDetailPage }))
);
const DiscoveryQuizPage = lazy(() =>
  import('./pages/DiscoveryQuizPage.tsx').then((m) => ({ default: m.DiscoveryQuizPage }))
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage.tsx').then((m) => ({ default: m.CheckoutPage }))
);
const OrderTrackingPage = lazy(() =>
  import('./pages/OrderTrackingPage.tsx').then((m) => ({ default: m.OrderTrackingPage }))
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage.tsx').then((m) => ({ default: m.AccountPage }))
);
const AboutContactPage = lazy(() =>
  import('./pages/AboutContactPage.tsx').then((m) => ({ default: m.AboutContactPage }))
);

function RouteLoadingFallback() {
  return (
    <main className="max-w-[1280px] mx-auto px-5 sm:px-8 py-14 space-y-6">
      <div className="h-10 w-56 bg-[#DFCBB4] animate-pulse rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-80 bg-[#DFCBB4] animate-pulse rounded-xl" />
        <div className="h-80 bg-[#DFCBB4] animate-pulse rounded-xl hidden md:block" />
        <div className="h-80 bg-[#DFCBB4] animate-pulse rounded-xl hidden md:block" />
      </div>
    </main>
  );
}

function AppShell() {
  const { route, toastMessage } = useStore();

  const renderPage = () => {
    switch (route.view) {
      case 'home':
        return <HomePage />;
      case 'collection':
        return (
          <CollectionPage
            key={`${route.initialCategory || ''}-${route.initialFamily || ''}-${route.initialQuery || ''}`}
            initialCategory={route.initialCategory}
            initialFamily={route.initialFamily}
            initialQuery={route.initialQuery}
          />
        );
      case 'product':
        return <ProductDetailPage key={route.slug} slug={route.slug} />;
      case 'discovery':
        return <DiscoveryQuizPage />;
      case 'checkout':
        return <CheckoutPage />;
      case 'orders':
        return <OrderTrackingPage initialOrderNumber={route.orderNumber} />;
      case 'account':
        return (
          <AccountPage
            key={route.initialTab || 'profile'}
            initialTab={route.initialTab}
          />
        );
      case 'about':
        return <AboutContactPage initialSection={route.section} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-[#26180E] overflow-x-clip">
      <Navbar />
      <div className="flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>{renderPage()}</Suspense>
      </div>
      <Footer />
      <CartDrawer />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 royal-card text-[#26180E] text-xs px-4 py-3 rounded-lg border border-[#8B5E34]/35 sm:max-w-xs text-center sm:text-left shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
