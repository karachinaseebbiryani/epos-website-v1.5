import { useNavigate, useLocation } from "react-router-dom";
import { LogIn, ArrowRight, X } from "lucide-react";

/**
 * GuestGateSheet
 * --------------
 * A small bottom-sheet (mobile) / centered modal (desktop) that nudges guests
 * to sign in BEFORE they redeem an offer or reward. Crucially, it offers a
 * "Continue as guest" escape hatch so we never block the user from buying.
 *
 * Props
 *  - open: boolean — controls visibility
 *  - title?: string — short headline (defaults to "Sign in to unlock this perk")
 *  - subtitle?: string — supporting copy
 *  - onClose(): close without acting (used by the X icon and backdrop)
 *  - onContinueGuest?(): user explicitly chose to keep going without signing in.
 *      If omitted, the "Continue as guest" button is hidden (i.e. sign-in required).
 *  - returnTo?: string — path to come back to after a successful sign-in. Defaults
 *      to the current location.
 */
export default function GuestGateSheet({
    open,
    title = "Sign in to unlock this perk",
    subtitle = "Offers and Diamond rewards are tied to your account so we can apply them at checkout and keep your discounts safe.",
    onClose,
    onContinueGuest,
    returnTo,
}) {
    const navigate = useNavigate();
    const location = useLocation();
    if (!open) return null;
    const goSignIn = () => {
        const next = returnTo || `${location.pathname}${location.search || ""}`;
        navigate(`/login?next=${encodeURIComponent(next)}`);
    };
    return (
        <div
            className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center sm:p-4"
            onClick={onClose}
            data-testid="guest-gate-sheet"
        >
            <div
                className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-full bg-brand-red/10 flex items-center justify-center">
                        <LogIn className="w-5 h-5 text-brand-red" />
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        data-testid="guest-gate-close"
                        aria-label="Close"
                        className="w-9 h-9 rounded-full hover:bg-neutral-100 flex items-center justify-center -mr-2"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <h3 className="font-display font-black text-xl text-brand-ink leading-tight">{title}</h3>
                <p className="text-sm text-neutral-500 mt-2 leading-relaxed">{subtitle}</p>
                <button
                    type="button"
                    onClick={goSignIn}
                    data-testid="guest-gate-signin"
                    className="mt-5 w-full bg-brand-red hover:bg-brand-red-dark text-white rounded-full py-3.5 font-bold uppercase tracking-wider text-sm transition-colors flex items-center justify-center gap-2"
                >
                    Sign in <ArrowRight className="w-4 h-4" />
                </button>
                {onContinueGuest && (
                    <button
                        type="button"
                        onClick={onContinueGuest}
                        data-testid="guest-gate-continue-guest"
                        className="mt-2 w-full text-neutral-500 hover:text-brand-red py-2.5 text-sm font-semibold transition-colors"
                    >
                        Continue as guest
                    </button>
                )}
            </div>
        </div>
    );
}
