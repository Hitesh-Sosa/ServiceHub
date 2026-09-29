import api, { errMsg } from "../api";

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Full flow: create order (server decides the amount) -> open checkout ->
// verify signature on the server. Throws on cancel/failure.
export async function payForBooking(bookingId, user) {
  const { data: order } = await api.post("/payments/order", { bookingId });

  const ok = await loadRazorpay();
  if (!ok) throw new Error("Could not load Razorpay checkout");

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.keyId, // public key only - secret never touches the frontend
      amount: order.amount,
      currency: order.currency,
      name: "ServiceHub",
      description: "Service booking payment",
      order_id: order.orderId,
      prefill: { name: user?.name, email: user?.email },
      theme: { color: "#2563eb" },
      handler: async (res) => {
        try {
          const { data } = await api.post("/payments/verify", res);
          resolve(data);
        } catch (e) {
          reject(new Error(errMsg(e)));
        }
      },
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
    });
    rzp.open();
  });
}