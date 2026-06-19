import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Diamond, Gift, Percent, DollarSign, ShoppingBag, Lock } from "lucide-react";
import GuestGateSheet from "../components/GuestGateSheet";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RewardsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [rewards, setRewards] = useState([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [gateOpen, setGateOpen] = useState(false);

    useEffect(() => {
        // Guests can BROWSE the catalog. The sign-in gate fires only on the "Use" action.
        loadData();
        // eslint-disable-next-line
    }, [user]);
    
    // Auto-refresh balance when window gets focus or Diamonds update
    useEffect(() => {
        if (!user) return;
        
        const loadBalance = async () => {
            try {
                const token = localStorage.getItem('knb_token');
                const { data } = await axios.get(`${API}/loyalty/balance`, { headers: { Authorization: `Bearer ${token}` } });
                setBalance(data.diamond_balance || 0);
            } catch (err) {
                // Silent fail
            }
        };
        
        const handleFocus = () => loadBalance();
        const handleDiamondsUpdate = () => loadBalance();
        
        window.addEventListener('focus', handleFocus);
        window.addEventListener('diamondsUpdated', handleDiamondsUpdate);
        
        // Poll balance every 30 seconds while on rewards page
        const interval = setInterval(loadBalance, 30000);
        
        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('diamondsUpdated', handleDiamondsUpdate);
            clearInterval(interval);
        };
        // eslint-disable-next-line
    }, [user]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Rewards catalog is public — load it for everyone.
            const rewardsRes = await axios.get(`${API}/loyalty/rewards`);
            setRewards(rewardsRes.data);
            if (user) {
                // Balance only makes sense for signed-in customers.
                const token = localStorage.getItem('knb_token');
                const balanceRes = await axios.get(`${API}/loyalty/balance`, { headers: { Authorization: `Bearer ${token}` } });
                setBalance(balanceRes.data.diamond_balance || 0);
            } else {
                setBalance(0);
            }
        } catch (err) {
            toast.error("Failed to load rewards");
        } finally {
            setLoading(false);
        }
    };

    const getRewardIcon = (type) => {
        if (type === "discount_percent") return <Percent className="w-5 h-5" />;
        if (type === "discount_fixed") return <DollarSign className="w-5 h-5" />;
        return <Gift className="w-5 h-5" />;
    };

    const getRewardValueDisplay = (reward) => {
        if (reward.reward_type === "discount_percent") return `${reward.reward_value}% OFF`;
        if (reward.reward_type === "discount_fixed") return `Rs ${reward.reward_value} OFF`;
        return "Free Item";
    };

    const canAfford = (cost) => balance >= cost;

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12" data-testid="rewards-page">
            {/* Header with Balance */}
            <div className="mb-8">
                <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Diamond Rewards</span>
                <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mt-2">Rewards Catalog</h1>

                {user ? (
                    <div className="mt-4 inline-flex items-center gap-3 px-6 py-4 bg-brand-yellow rounded-2xl">
                        <Diamond className="w-8 h-8" fill="currentColor" />
                        <div>
                            <p className="text-xs font-semibold text-brand-ink/70 uppercase tracking-wider">Your Balance</p>
                            <p className="text-2xl font-black text-brand-ink">{balance} Diamonds</p>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setGateOpen(true)}
                        data-testid="rewards-guest-signin-cta"
                        className="mt-4 inline-flex items-center gap-3 px-6 py-4 bg-brand-yellow rounded-2xl hover:bg-brand-yellow/90 transition-colors text-left"
                    >
                        <Diamond className="w-8 h-8 text-brand-ink/70" fill="currentColor" />
                        <div>
                            <p className="text-xs font-semibold text-brand-ink/70 uppercase tracking-wider">Sign in to see your balance</p>
                            <p className="text-base font-bold text-brand-ink">Earn Diamonds on every order →</p>
                        </div>
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-16">
                    <div className="inline-block w-8 h-8 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-neutral-500 mt-3">Loading rewards...</p>
                </div>
            ) : rewards.length === 0 ? (
                <div className="bg-white border border-neutral-100 rounded-2xl p-10 md:p-16 text-center">
                    <Gift className="w-16 h-16 mx-auto text-neutral-300 mb-4" />
                    <h3 className="font-display font-bold text-xl text-brand-ink mb-2">No rewards available yet</h3>
                    <p className="text-neutral-500">Check back soon for exciting rewards!</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {rewards.map((reward) => {
                        const affordable = canAfford(reward.cost_diamonds);
                        // Guests should see full-brightness cards (they're browsing); affordability
                        // dimming only makes sense for signed-in users who actually have a balance.
                        const dim = user && !affordable;

                        return (
                            <div
                                key={reward.id}
                                data-testid={`reward-${reward.id}`}
                                className={`bg-white border rounded-2xl p-3 md:p-6 shadow-sm transition-all ${
                                    dim ? "border-neutral-100 opacity-50" : "border-neutral-100 hover:shadow-lg hover:scale-105"
                                }`}
                            >
                                {/* Icon & Type */}
                                <div className="flex items-center justify-between mb-2 md:mb-4">
                                    <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-brand-yellow/20 flex items-center justify-center text-brand-ink">
                                        {getRewardIcon(reward.reward_type)}
                                    </div>
                                    {dim && (
                                        <Lock className="w-4 h-4 md:w-5 md:h-5 text-neutral-400" />
                                    )}
                                </div>

                                {/* Title & Description */}
                                <h3 className="font-display font-bold text-sm md:text-lg text-brand-ink mb-1 line-clamp-1">
                                    {reward.title}
                                </h3>
                                {reward.description && (
                                    <p className="text-[11px] md:text-sm text-neutral-500 mb-2 md:mb-3 line-clamp-2">{reward.description}</p>
                                )}

                                {/* Value */}
                                <div className="mb-3 md:mb-4">
                                    <span className="inline-block px-2 py-0.5 md:px-3 md:py-1 bg-brand-red text-white text-[10px] md:text-sm font-bold rounded-full">
                                        {getRewardValueDisplay(reward)}
                                    </span>
                                </div>

                                {/* Cost & CTA */}
                                <div className="border-t border-neutral-100 pt-2 md:pt-4 mt-2 md:mt-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1 text-brand-ink font-bold">
                                            <Diamond className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" />
                                            <span className="text-sm md:text-lg">{reward.cost_diamonds}</span>
                                        </div>
                                        {affordable || !user ? (
                                            <button
                                                onClick={() => {
                                                    if (!user) {
                                                        setGateOpen(true);
                                                        return;
                                                    }
                                                    localStorage.setItem('selected_reward', JSON.stringify(reward));
                                                    try { window.dispatchEvent(new Event("rewardSelectionChanged")); } catch { /* */ }
                                                    navigate('/menu');
                                                    toast.success('Reward selected! Add items and checkout to redeem.');
                                                }}
                                                data-testid={`use-reward-${reward.id}`}
                                                className="px-2.5 py-1.5 md:px-4 md:py-2 bg-brand-red text-white text-[11px] md:text-sm font-semibold rounded-full hover:bg-brand-red-dark transition-colors"
                                            >
                                                {!user ? "Sign in" : "Use"}
                                            </button>
                                        ) : (
                                            <span className="text-[10px] md:text-xs text-neutral-400 font-semibold text-right">Need {reward.cost_diamonds - balance}<br className="md:hidden" /> more</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* How to Earn Section */}
            <div className="mt-12 bg-brand-yellow/10 border border-brand-yellow/30 rounded-2xl p-6 md:p-8">
                <h2 className="font-display font-bold text-xl text-brand-ink mb-3 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    How to Earn More Diamonds
                </h2>
                <p className="text-neutral-600 mb-4">
                    Earn Diamonds automatically on every order! The more you spend, the more Diamonds you earn.
                </p>
                <ul className="space-y-2 text-sm text-neutral-600">
                    <li className="flex items-center gap-2">
                        <Diamond className="w-4 h-4 text-brand-yellow" fill="currentColor" />
                        <span>Place orders and earn Diamonds instantly</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <Diamond className="w-4 h-4 text-brand-yellow" fill="currentColor" />
                        <span>Redeem Diamonds for discounts and free items</span>
                    </li>
                    <li className="flex items-center gap-2">
                        <Diamond className="w-4 h-4 text-brand-yellow" fill="currentColor" />
                        <span>Keep ordering to unlock bigger rewards!</span>
                    </li>
                </ul>
            </div>

            <GuestGateSheet
                open={gateOpen}
                title="Sign in to redeem rewards"
                subtitle="Sign in to start earning Diamonds and unlock free items, discounts and exclusive perks."
                onClose={() => setGateOpen(false)}
            />
        </div>
    );
}
