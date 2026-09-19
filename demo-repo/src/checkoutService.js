/**
 * CheckoutService - core checkout transaction coordinator
 * repo_id: demo-checkout
 * component: checkoutService
 */

const config = {
  databaseTimeoutMs: 2000,
  databasePoolSize: 10,
  paymentClientTimeoutMs: 5000 // BUG: Payment service latency is 3800ms, exceeding this 2000ms client timeout
};

async function queryDatabase() {
  // Database health check / order reservation always succeeds
  return {
    status: "ok",
    durationMs: 45,
    message: "Database query completes successfully"
  };
}

async function callPaymentGateway(orderId, amount) {
  const paymentLatencyMs = 3800; // Payment service nominal latency

  if (paymentLatencyMs > config.paymentClientTimeoutMs) {
    const error = new Error(
      `Payment API response exceeded client timeout of ${config.paymentClientTimeoutMs}ms (gateway latency ~${paymentLatencyMs}ms)`
    );
    error.paymentLatencyMs = paymentLatencyMs;
    error.clientTimeoutMs = config.paymentClientTimeoutMs;
    throw error;
  }

  return {
    status: "success",
    transactionId: "txn_" + Date.now(),
    latencyMs: paymentLatencyMs
  };
}

async function processCheckout(order) {
  const dbResult = await queryDatabase();

  const paymentResult = await callPaymentGateway(order.id, order.amount);

  return {
    success: true,
    orderId: order.id,
    db: dbResult,
    payment: paymentResult
  };
}

module.exports = {
  config,
  queryDatabase,
  callPaymentGateway,
  processCheckout
};
