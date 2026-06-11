import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function PaymentResultPage({ outcome }) {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState({ payment_status: "checking", attempts: 0 });
    const sessionId = params.get("session_id");
    const orderId = params.get("order_id");

    useEffect(() => {
        if (outcome === "cancel" || !sessionId) return;
        let attempts = 0;
        const max = 10;
        const interval = 2000;
        const poll = async () => {
            try {
                const { data } = await api.get(`/payments/stripe/status/${sessionId}`);
                if (data.payment_status === "paid") {
                    setStatus({ payment_status: "paid", order_id: data.order_id });
                    return;
                }
                if (data.status === "expired") {
                    setStatus({ payment_status: "expired" });
                    return;
                }
                attempts++;
                if (attempts < max) setTimeout(poll, interval);
                else setStatus({ payment_status: "timeout", order_id: data.order_id });
            } catch (e) {
                attempts++;
                if (attempts < max) setTimeout(poll, interval);
                else setStatus({ payment_status: "error" });
            }
        };
        poll();
    }, [sessionId, outcome]);

    if (outcome === "cancel") {
        return (
            <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="payment-cancel-page">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                    <XCircle className="w-12 h-12 text-red-600" />
                </div>
                <h1 className="font-display font-black text-3xl text-brand-ink mb-3">Payment Cancelled</h1>
                <p className="text-neutral-500 mb-8">No charge was made. You can try again or pay on delivery.</p>
                <button onClick={() => navigate(orderId ? `/order/${orderId}/success` : "/")}
                    data-testid="cancel-continue-button"
                    className="bg-brand-red text-white rounded-full px-7 py-3.5 font-bold">
                    {orderId ? "View Order" : "Back to Home"}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto px-4 py-24 text-center" data-testid="payment-success-page">
            {status.payment_status === "paid" && (
                <>
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
                        <CheckCircle className="w-12 h-12 text-green-600" />
                    </div>
                    <h1 className="font-display font-black text-3xl text-brand-ink mb-3">Payment Successful!</h1>
                    <p className="text-neutral-500 mb-8">Your card was charged. Order is confirmed.</p>
                    <button onClick={() => navigate(`/order/${status.order_id || orderId}/success`)}
                        className="bg-brand-red text-white rounded-full px-7 py-3.5 font-bold" data-testid="paid-continue-button">
                        Track My Order
                    </button>
                </>
            )}
            {status.payment_status === "checking" && (
                <>
                    <Loader2 className="w-12 h-12 mx-auto mb-6 text-brand-red animate-spin" />
                    <h1 className="font-display font-black text-2xl text-brand-ink mb-2">Verifying Payment...</h1>
                    <p className="text-neutral-500">Please wait, this won't take long.</p>
                </>
            )}
            {(status.payment_status === "timeout" || status.payment_status === "error" || status.payment_status === "expired") && (
                <>
                    <XCircle className="w-12 h-12 mx-auto mb-6 text-yellow-600" />
                    <h1 className="font-display font-black text-2xl text-brand-ink mb-2">Payment Status Unclear</h1>
                    <p className="text-neutral-500 mb-6">We could not confirm your payment. If you were charged, please contact us.</p>
                    <a href="tel:+923004928411" className="text-brand-red font-semibold">Call Restaurant</a>
                </>
            )}
        </div>
    );
}
