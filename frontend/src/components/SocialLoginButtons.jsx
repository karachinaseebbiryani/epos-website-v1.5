import { useEffect, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";

/**
 * Reusable Google + Facebook sign-in row used on both LoginPage and RegisterPage.
 * - Google: uses @react-oauth/google's <GoogleLogin/> credential flow. The ID token is
 *   sent to /api/customer/google for verification, which returns the standard customer JWT.
 * - Facebook: lazy-loads the FB JS SDK (no NPM dep needed) and calls FB.login(). The
 *   short-lived access_token is sent to /api/customer/facebook which re-verifies it via
 *   the Graph API debug_token endpoint and returns the same JWT shape.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
export default function SocialLoginButtons({ onSuccess, redirectTo }) {
    const { socialLogin } = useAuth();
    const [fbLoading, setFbLoading] = useState(false);
    const fbReadyRef = useRef(false);

    const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
    const fbAppId = process.env.REACT_APP_FACEBOOK_APP_ID || "";

    // Lazy-load Facebook JS SDK once per page.
    useEffect(() => {
        if (!fbAppId) return;
        if (window.FB) { fbReadyRef.current = true; return; }
        // Inject the SDK exactly once.
        if (!document.getElementById("fb-jssdk")) {
            window.fbAsyncInit = function () {
                try {
                    window.FB.init({ appId: fbAppId, cookie: true, xfbml: false, version: "v19.0" });
                    fbReadyRef.current = true;
                } catch (e) { /* silent */ }
            };
            const s = document.createElement("script");
            s.id = "fb-jssdk";
            s.async = true; s.defer = true; s.crossOrigin = "anonymous";
            s.src = "https://connect.facebook.net/en_US/sdk.js";
            document.body.appendChild(s);
        }
    }, [fbAppId]);

    const handleGoogleSuccess = async (resp) => {
        try {
            await socialLogin("google", { credential: resp.credential });
            toast.success("Signed in with Google");
            onSuccess && onSuccess(redirectTo);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Google sign-in failed");
        }
    };

    const handleGoogleError = () => {
        toast.error("Google sign-in was cancelled or failed");
    };

    const handleFacebookClick = () => {
        if (!fbAppId) { toast.error("Facebook login not configured"); return; }
        if (!window.FB) { toast.error("Facebook is still loading, please try again in a moment"); return; }
        setFbLoading(true);
        try {
            window.FB.login(async (response) => {
                try {
                    if (response.authResponse && response.authResponse.accessToken) {
                        await socialLogin("facebook", {
                            access_token: response.authResponse.accessToken,
                            user_id: response.authResponse.userID,
                        });
                        toast.success("Signed in with Facebook");
                        onSuccess && onSuccess(redirectTo);
                    } else {
                        toast.error("Facebook sign-in was cancelled");
                    }
                } catch (err) {
                    toast.error(formatApiError(err.response?.data?.detail) || "Facebook sign-in failed");
                } finally {
                    setFbLoading(false);
                }
            }, { scope: "public_profile,email" });
        } catch (e) {
            setFbLoading(false);
            toast.error("Facebook sign-in failed");
        }
    };

    if (!googleClientId && !fbAppId) return null;

    return (
        <div className="mt-6" data-testid="social-login-container">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">or continue with</span>
                <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {googleClientId && (
                    <div data-testid="google-login-wrapper" className="w-full flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            shape="pill"
                            theme="outline"
                            size="large"
                            text="continue_with"
                            useOneTap={false}
                        />
                    </div>
                )}
                {fbAppId && (
                    <button
                        type="button"
                        onClick={handleFacebookClick}
                        disabled={fbLoading}
                        data-testid="facebook-login-btn"
                        className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60"
                        style={{ background: "#1877F2" }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
                        </svg>
                        {fbLoading ? "Signing in…" : "Continue with Facebook"}
                    </button>
                )}
            </div>
        </div>
    );
}
