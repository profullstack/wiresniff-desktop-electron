import React, { useState, useEffect } from 'react';
import { useAuthStore, useSubscriptionStore, PRICING_PLANS } from '../stores';
import { CRYPTO_PAYMENT_OPTIONS, type CryptoCurrency } from '../services/crypto';

type BillingPeriod = 'monthly' | 'yearly';

export const BillingPage: React.FC = () => {
  const { user, profile } = useAuthStore();
  const { 
    subscription, 
    isLoading, 
    error, 
    pendingCryptoPayment,
    fetchSubscription, 
    subscribe, 
    subscribeCrypto,
    checkCryptoPayment,
    openBillingPortal,
    cancelCurrentSubscription,
    resumeCurrentSubscription,
    clearError,
    clearPendingPayment,
  } = useSubscriptionStore();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('yearly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCryptoModal, setShowCryptoModal] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoCurrency>('BTC');
  const [localError, setLocalError] = useState<string | null>(null);

  // Fetch subscription on mount
  useEffect(() => {
    if (user?.id) {
      fetchSubscription(user.id);
    }
  }, [user?.id, fetchSubscription]);

  // Poll for crypto payment status
  useEffect(() => {
    if (pendingCryptoPayment && pendingCryptoPayment.status === 'pending') {
      const interval = setInterval(async () => {
        const status = await checkCryptoPayment(pendingCryptoPayment.paymentId);
        if (status === 'completed') {
          clearPendingPayment();
          if (user?.id) {
            fetchSubscription(user.id);
          }
        } else if (status === 'expired' || status === 'failed') {
          clearPendingPayment();
        }
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [pendingCryptoPayment, checkCryptoPayment, clearPendingPayment, fetchSubscription, user?.id]);

  const handleSubscribe = async (planId: string) => {
    if (!user?.id) {
      setLocalError('Please sign in to subscribe');
      return;
    }

    const plan = PRICING_PLANS.find(p => p.id === planId);
    if (!plan) return;

    const priceId = billingPeriod === 'yearly' 
      ? plan.stripePriceIdYearly 
      : plan.stripePriceIdMonthly;

    if (!priceId) {
      setLocalError('This plan is not available for purchase');
      return;
    }

    const result = await subscribe(priceId, user.id);
    if (!result.success) {
      setLocalError(result.error || 'Failed to start subscription');
    }
  };

  const handleCryptoSubscribe = async () => {
    if (!user?.id || !selectedPlan || !profile?.email) {
      setLocalError('Please sign in to subscribe');
      return;
    }

    const result = await subscribeCrypto(
      user.id,
      selectedPlan,
      billingPeriod,
      selectedCrypto,
      profile.email
    );

    if (!result.success) {
      setLocalError(result.error || 'Failed to create crypto payment');
    } else {
      setShowCryptoModal(false);
    }
  };

  const handleManageBilling = async () => {
    if (!subscription?.stripeCustomerId) {
      setLocalError('No billing information found');
      return;
    }

    const result = await openBillingPortal(subscription.stripeCustomerId);
    if (!result.success) {
      setLocalError(result.error || 'Failed to open billing portal');
    }
  };

  const handleCancelSubscription = async () => {
    if (confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      const result = await cancelCurrentSubscription();
      if (!result.success) {
        setLocalError(result.error || 'Failed to cancel subscription');
      }
    }
  };

  const handleResumeSubscription = async () => {
    const result = await resumeCurrentSubscription();
    if (!result.success) {
      setLocalError(result.error || 'Failed to resume subscription');
    }
  };

  const displayError = localError || error;
  const currentTier = subscription?.tier || 'free';
  const yearlySavings = Math.round((1 - (PRICING_PLANS[1].yearlyPrice / (PRICING_PLANS[1].monthlyPrice * 12))) * 100);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-text-primary mb-4">Choose Your Plan</h1>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Unlock powerful features to supercharge your API development workflow.
            All plans include a 14-day free trial.
          </p>
        </div>

        {/* Error Message */}
        {displayError && (
          <div className="mb-8 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-center">
            {displayError}
            <button 
              onClick={() => { clearError(); setLocalError(null); }}
              className="ml-4 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Pending Crypto Payment */}
        {pendingCryptoPayment && (
          <div className="mb-8 p-6 bg-warning/10 border border-warning/20 rounded-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Pending Crypto Payment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-text-secondary mb-2">Send exactly:</p>
                <p className="text-2xl font-mono font-bold text-text-primary">
                  {pendingCryptoPayment.amount} {pendingCryptoPayment.currency}
                </p>
                <p className="text-text-secondary mt-4 mb-2">To address:</p>
                <p className="font-mono text-sm bg-background p-2 rounded break-all">
                  {pendingCryptoPayment.address}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center">
                <img 
                  src={pendingCryptoPayment.qrCode} 
                  alt="Payment QR Code" 
                  className="w-40 h-40 rounded-lg"
                />
                <p className="text-sm text-text-muted mt-2">
                  Expires: {new Date(pendingCryptoPayment.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-4">
              <button
                onClick={() => checkCryptoPayment(pendingCryptoPayment.paymentId)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Check Payment Status
              </button>
              <button
                onClick={clearPendingPayment}
                className="px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-surface rounded-lg p-1 inline-flex">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
                Save {yearlySavings}%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {PRICING_PLANS.map((plan) => {
            const price = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
            const isCurrentPlan = currentTier === plan.tier;
            const isUpgrade = ['pro', 'team', 'enterprise'].indexOf(plan.tier) > ['pro', 'team', 'enterprise'].indexOf(currentTier);

            return (
              <div
                key={plan.id}
                className={`relative bg-surface rounded-xl border p-6 ${
                  plan.popular 
                    ? 'border-primary shadow-lg shadow-primary/10' 
                    : 'border-border'
                } ${isCurrentPlan ? 'ring-2 ring-success' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-success text-white text-xs font-medium px-3 py-1 rounded-full">
                      Current Plan
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-bold text-text-primary mb-2">{plan.name}</h3>
                <p className="text-text-secondary text-sm mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-text-primary">
                    ${billingPeriod === 'yearly' ? Math.round(price / 12) : price}
                  </span>
                  <span className="text-text-muted">/month</span>
                  {billingPeriod === 'yearly' && price > 0 && (
                    <p className="text-sm text-text-muted mt-1">
                      Billed ${price}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.tier === 'free' ? (
                  <button
                    disabled={isCurrentPlan}
                    className="w-full py-2.5 bg-surface border border-border text-text-primary rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors"
                  >
                    {isCurrentPlan ? 'Current Plan' : 'Downgrade'}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={isLoading || isCurrentPlan}
                      className={`w-full py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        plan.popular
                          ? 'bg-primary text-white hover:bg-primary-hover'
                          : 'bg-surface border border-border text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      {isLoading ? 'Processing...' : isCurrentPlan ? 'Current Plan' : isUpgrade ? 'Upgrade' : 'Subscribe'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPlan(plan.id);
                        setShowCryptoModal(true);
                      }}
                      disabled={isLoading || isCurrentPlan}
                      className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pay with Crypto
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Current Subscription Management */}
        {subscription && subscription.tier !== 'free' && (
          <div className="bg-surface rounded-xl border border-border p-6 mb-8">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Subscription Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-text-muted text-sm">Current Plan</p>
                <p className="text-text-primary font-medium capitalize">{subscription.tier}</p>
              </div>
              <div>
                <p className="text-text-muted text-sm">Status</p>
                <p className={`font-medium capitalize ${
                  subscription.status === 'active' ? 'text-success' : 'text-warning'
                }`}>
                  {subscription.status}
                  {subscription.cancelAtPeriodEnd && ' (Canceling)'}
                </p>
              </div>
              <div>
                <p className="text-text-muted text-sm">
                  {subscription.cancelAtPeriodEnd ? 'Access Until' : 'Next Billing Date'}
                </p>
                <p className="text-text-primary font-medium">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-4">
              <button
                onClick={handleManageBilling}
                disabled={isLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                Manage Billing
              </button>
              {subscription.cancelAtPeriodEnd ? (
                <button
                  onClick={handleResumeSubscription}
                  disabled={isLoading}
                  className="px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50"
                >
                  Resume Subscription
                </button>
              ) : (
                <button
                  onClick={handleCancelSubscription}
                  disabled={isLoading}
                  className="px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
                >
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        )}

        {/* FAQ Section */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-6">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-text-primary mb-2">Can I change plans later?</h4>
              <p className="text-text-secondary text-sm">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-text-primary mb-2">What payment methods do you accept?</h4>
              <p className="text-text-secondary text-sm">
                We accept all major credit cards via Stripe, and cryptocurrency payments including BTC, ETH, and more.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-text-primary mb-2">Is there a free trial?</h4>
              <p className="text-text-secondary text-sm">
                Yes, all paid plans include a 14-day free trial. No credit card required to start.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-text-primary mb-2">Can I get a refund?</h4>
              <p className="text-text-secondary text-sm">
                We offer a 30-day money-back guarantee. Contact support if you're not satisfied.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Crypto Payment Modal */}
      {showCryptoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl border border-border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Pay with Cryptocurrency</h3>
            <p className="text-text-secondary text-sm mb-6">
              Select your preferred cryptocurrency to complete the payment.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {CRYPTO_PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.currency}
                  onClick={() => setSelectedCrypto(option.currency)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedCrypto === option.currency
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="text-2xl mr-2">{option.icon}</span>
                  <span className="text-text-primary font-medium">{option.name}</span>
                  {option.network && (
                    <span className="text-xs text-text-muted block mt-1">{option.network}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCryptoModal(false)}
                className="flex-1 py-2.5 bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCryptoSubscribe}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;