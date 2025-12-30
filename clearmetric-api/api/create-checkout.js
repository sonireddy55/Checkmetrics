// Stripe Checkout Session API
// Deploy to clearmetric-api/api/create-checkout.js

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  try {
    const { plan, userId, email, successUrl, cancelUrl } = req.body;

    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Price IDs from Stripe Dashboard
    // Replace these with your actual Stripe price IDs
    const priceIds = {
      monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_MONTHLY_ID',
      annual: process.env.STRIPE_PRICE_ANNUAL || 'price_ANNUAL_ID'
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceIds[plan],
          quantity: 1,
        },
      ],
      success_url: successUrl || 'https://clearmetric.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'https://clearmetric.app/cancel',
      customer_email: email,
      client_reference_id: userId,
      metadata: {
        userId,
        plan
      },
      subscription_data: {
        metadata: {
          userId,
          plan
        }
      },
      allow_promotion_codes: true
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create checkout session'
    });
  }
}
