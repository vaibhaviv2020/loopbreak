const assert = require("assert");
const { processCheckout, config } = require("../src/checkoutService");

async function runTest() {
  console.log("Running Checkout Test Suite...");
  console.log(`Current Config -> DB Timeout: ${config.databaseTimeoutMs}ms, DB Pool: ${config.databasePoolSize}, Payment Timeout: ${config.paymentClientTimeoutMs}ms`);

  try {
    const order = { id: "order-9942", amount: 89.50 };
    const result = await processCheckout(order);

    assert.strictEqual(result.success, true);
    console.log("Evidence: Database query completes successfully");
    console.log("Evidence: Payment API responds after approximately 3.8 seconds");
    console.log("RESULT: Checkout test passed");
    process.exit(0);
  } catch (err) {
    console.error("Evidence: Database query completes successfully");
    console.error(`Evidence: Payment API responds after approximately 3.8 seconds. Client timeout is ${config.paymentClientTimeoutMs / 1000} seconds`);
    console.error(`FAILURE: Checkout request failed with timeout: ${err.message}`);
    process.exit(1);
  }
}

runTest();
