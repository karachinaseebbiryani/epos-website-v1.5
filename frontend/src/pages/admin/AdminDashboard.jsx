import { useEffect, useState } from "react";
import api from "../../lib/api";
import { ShoppingBag, Tag, CalendarDays, ChefHat, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
    const [stats, setStats] = useState({ orders: 0, pending: 0, today_revenue: 0, menu_items: 0, offers: 0, events: 0 });
    const [recentOrders, setRecentOrders] = useState([]);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const [ordersRes, menuRes, offersRes, eventsRes] = await Promise.all([
                api.get("/online-orders"),
                api.get("/menu"),
                api.get("/offers", { params: { active_only: false } }),
                api.get("/event-bookings"),
            ]);
            const orders = ordersRes.data;
            const today = new Date().toISOString().slice(0, 10);
            const todayOrders = orders.filter((o) => o.date === today);
            const todayRev = todayOrders.reduce((s, o) => s + (o.total_price || 0), 0);

            // Filter to only show current/active orders (not delivered, picked_up, cancelled, rejected)
            const activeOrders = orders.filter((o) =>
                !["delivered", "picked_up", "cancelled", "rejected"].includes(o.status)
            );

            setStats({
                orders: orders.length,
                pending: orders.filter((o) => o.status === "pending").length,
                today_revenue: todayRev,
                menu_items: menuRes.data.items.length,
                offers: offersRes.data.length,
                events: eventsRes.data.length,
            });
            setRecentOrders(activeOrders.slice(0, 5));
        } catch (err) {
            // noop
        }
    };

    return (
        <div data-testid="admin-dashboard">
            <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-2">Dashboard</h1>
            <p className="text-neutral-500 mb-8">Overview of online orders &amp; activity</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Stat icon={<ShoppingBag className="w-5 h-5" />} label="Total Online Orders" value={stats.orders} accent="bg-brand-red text-white" testid="stat-orders" />
                <Stat icon={<TrendingUp className="w-5 h-5" />} label="Pending Orders" value={stats.pending} accent="bg-brand-yellow text-brand-ink" testid="stat-pending" />
                <Stat icon={<TrendingUp className="w-5 h-5" />} label="Today Revenue" value={`Rs. ${stats.today_revenue.toFixed(0)}`} accent="bg-brand-ink text-white" testid="stat-revenue" />
                <Stat icon={<ChefHat className="w-5 h-5" />} label="Menu Items" value={stats.menu_items} accent="bg-neutral-200 text-brand-ink" testid="stat-menu" />
                <Stat icon={<Tag className="w-5 h-5" />} label="Active Offers" value={stats.offers} accent="bg-green-100 text-green-700" testid="stat-offers" />
                <Stat icon={<CalendarDays className="w-5 h-5" />} label="Event Bookings" value={stats.events} accent="bg-blue-100 text-blue-700" testid="stat-events" />
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                <h2 className="font-display font-bold text-xl text-brand-ink mb-4">Recent Orders</h2>
                {recentOrders.length === 0 ? (
                    <p className="text-neutral-500 text-sm">No orders yet.</p>
                ) : (
                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-neutral-500 border-b border-neutral-100">
                                    <th className="py-2 px-2">Order #</th>
                                    <th className="py-2 px-2">Customer</th>
                                    <th className="py-2 px-2">Total</th>
                                    <th className="py-2 px-2">Status</th>
                                    <th className="py-2 px-2">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((o) => (
                                    <tr key={o.id} className="border-b border-neutral-50 last:border-0">
                                        <td className="py-3 px-2 font-mono font-semibold">{o.receipt_no}</td>
                                        <td className="py-3 px-2">{o.customer_name}</td>
                                        <td className="py-3 px-2 font-semibold">Rs. {o.total_price?.toFixed(0)}</td>
                                        <td className="py-3 px-2"><StatusBadge status={o.status} /></td>
                                        <td className="py-3 px-2 text-neutral-500">{new Date(o.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ icon, label, value, accent, testid }) {
    return (
        <div data-testid={testid} className="bg-white border border-neutral-200 rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${accent}`}>{icon}</div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">{label}</div>
            <div className="font-display font-black text-2xl text-brand-ink mt-1">{value}</div>
        </div>
    );
}

function StatusBadge({ status }) {
    const colors = {
        pending: "bg-yellow-50 text-yellow-700",
        preparing: "bg-blue-50 text-blue-700",
        ready: "bg-purple-50 text-purple-700",
        out_for_delivery: "bg-indigo-50 text-indigo-700",
        delivered: "bg-green-50 text-green-700",
        cancelled: "bg-red-50 text-red-700",
    };
    return <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${colors[status] || "bg-neutral-100"}`}>{status}</span>;
}
