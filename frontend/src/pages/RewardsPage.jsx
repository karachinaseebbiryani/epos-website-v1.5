import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Diamond, Gift, Percent, DollarSign, ShoppingBag, Lock } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RewardsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [rewards, setRewards] = useState([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user === null) navigate("/login");
        if (user) loadData();
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
            const token = localStorage.getItem('knb_token');
            const [rewardsRes, balanceRes] = await Promise.all([
                axios.get(`${API}/loyalty/rewards`),
                axios.get(`${API}/loyalty/balance`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setRewards(rewardsRes.data);
            setBalance(balanceRes.data.diamond_balance || 0);
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

    if (!user) return null;

    return (
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12" data-testid="rewards-page">
            {/* Header with Balance */}
            <div className="mb-8">
                <span className="text-brand-red text-xs uppercase tracking-[0.2em] font-bold">Diamond Rewards</span>
                <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mt-2">Rewards Catalog</h1>
                
                <div className="mt-4 inline-flex items-center gap-3 px-6 py-4 bg-brand-yellow rounded-2xl">
                    <Diamond className="w-8 h-8" fill="currentColor" />
                    <div>
                        <p className="text-xs font-semibold text-brand-ink/70 uppercase tracking-wider">Your Balance</p>
                        <p className="text-2xl font-black text-brand-ink">{balance} Diamonds</p>
                    </div>
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rewards.map((reward) => {
                        const affordable = canAfford(reward.cost_diamonds);
                        
                        return (
                            <div
                                key={reward.id}
                                data-testid={`reward-${reward.id}`}
                                className={`bg-white border rounded-2xl p-6 shadow-sm transition-all ${
                                    affordable ? "border-neutral-100 hover:shadow-lg hover:scale-105" : "border-neutral-100 opacity-50"
                                }`}
                            >
                                {/* Icon & Type */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-12 h-12 rounded-full bg-brand-yellow/20 flex items-center justify-center text-brand-ink">
                                        {getRewardIcon(reward.reward_type)}
                                    </div>
                                    {!affordable && (
                                        <Lock className="w-5 h-5 text-neutral-400" />
                                    )}
                                </div>

                                {/* Title & Description */}
                                <h3 className="font-display font-bold text-lg text-brand-ink mb-1">
                                    {reward.title}
                                </h3>
                                {reward.description && (
                                    <p className="text-sm text-neutral-500 mb-3">{reward.description}</p>
                                )}

                                {/* Value */}
                                <div className="mb-4">
                                    <span className="inline-block px-3 py-1 bg-brand-red text-white text-sm font-bold rounded-full">
                                        {getRewardValueDisplay(reward)}
                                    </span>
                                </div>

                                {/* Cost & CTA */}
                                <div className="border-t border-neutral-100 pt-4 mt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-brand-ink font-bold">
                                            <Diamond className="w-5 h-5" fill="currentColor" />
                                            <span className="text-lg">{reward.cost_diamonds}</span>
                                        </div>
                                        {affordable ? (
                                            <button
                                                onClick={() => {
                                                    localStorage.setItem('selected_reward', JSON.stringify(reward));
                                                    try { window.dispatchEvent(new Event("rewardSelectionChanged")); } catch { /* */ }
                                                    navigate('/menu');
                                                    toast.success('Reward selected! Add items and checkout to redeem.');
                                                }}
                                                data-testid={`use-reward-${reward.id}`}
                                                className="px-4 py-2 bg-brand-red text-white text-sm font-semibold rounded-full hover:bg-brand-red-dark transition-colors"
                                            >
                                                Use Now
                                            </button>
                                        ) : (
                                            <span className="text-xs text-neutral-400 font-semibold">Need {reward.cost_diamonds - balance} more</span>
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
        </div>
    );
}
