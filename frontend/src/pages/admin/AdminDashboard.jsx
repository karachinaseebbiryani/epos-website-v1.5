import { useEffect, useState } from "react";
import api from "../../lib/api";
import { ShoppingBag, Tag, CalendarDays, ChefHat, TrendingUp, DollarSign, CreditCard, Wallet, Bike, Package, Users, Clock, Download } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        orders: 0,
        pending: 0,
        today_revenue: 0,
        menu_items: 0,
        offers: 0,
        events: 0,
        payment_breakdown: { cod: 0, card: 0, wallet: 0, bank: 0 },
        order_type_breakdown: { delivery: 0, pickup: 0 },
        total_customers: 0,
        avg_order_value: 0,
        hourly_sales: []
    });
    const [recentOrders, setRecentOrders] = useState([]);
    const [allOrders, setAllOrders] = useState([]);
    const [topItems, setTopItems] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);

    // Filters
    const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
    const [statusFilter, setStatusFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");
    const [orderTypeFilter, setOrderTypeFilter] = useState("all");

    const [showAllOrders, setShowAllOrders] = useState(false);

    useEffect(() => {
        loadStats();
    }, [dateFrom, dateTo, statusFilter, paymentFilter, orderTypeFilter]);

    const loadStats = async () => {
        try {
            const [ordersRes, menuRes, offersRes, eventsRes] = await Promise.all([
                api.get("/online-orders"),
                api.get("/menu"),
                api.get("/offers", { params: { active_only: false } }),
                api.get("/event-bookings"),
            ]);

            const orders = ordersRes.data;
            const allOrdersList = orders;

            // Apply date filter
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);

            let filteredOrders = orders.filter((o) => {
                const orderDate = new Date(o.created_at || o.date);
                return orderDate >= fromDate && orderDate <= toDate;
            });

            // Apply status filter
            if (statusFilter !== "all") {
                filteredOrders = filteredOrders.filter(o => o.status === statusFilter);
            }

            // Apply payment filter
            if (paymentFilter !== "all") {
                filteredOrders = filteredOrders.filter(o => o.payment_method === paymentFilter);
            }

            // Apply order type filter
            if (orderTypeFilter !== "all") {
                filteredOrders = filteredOrders.filter(o => (o.order_type || "delivery") === orderTypeFilter);
            }

            // Calculate stats
            const totalRevenue = filteredOrders.reduce((s, o) => s + (o.total_price || 0), 0);

            // Payment method breakdown
            const paymentBreakdown = { cod: 0, card: 0, wallet: 0, bank: 0 };
            filteredOrders.forEach(o => {
                const method = o.payment_method || "cod";
                if (paymentBreakdown.hasOwnProperty(method)) {
                    paymentBreakdown[method] += o.total_price || 0;
                } else {
                    paymentBreakdown.cod += o.total_price || 0;
                }
            });

            // Order type breakdown
            const orderTypeBreakdown = { delivery: 0, pickup: 0 };
            filteredOrders.forEach(o => {
                const type = o.order_type || "delivery";
                orderTypeBreakdown[type] += o.total_price || 0;
            });

            // Top selling items
            const itemCount = {};
            const itemRevenue = {};
            filteredOrders.forEach(o => {
                (o.items || []).forEach(item => {
                    const name = item.name;
                    itemCount[name] = (itemCount[name] || 0) + (item.quantity || 1);
                    itemRevenue[name] = (itemRevenue[name] || 0) + ((item.price || 0) * (item.quantity || 1));
                });
            });

            const topItemsList = Object.keys(itemCount).map(name => ({
                name,
                quantity: itemCount[name],
                revenue: itemRevenue[name]
            })).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

            // Top customers
            const customerSpend = {};
            const customerOrders = {};
            filteredOrders.forEach(o => {
                const name = o.customer_name || "Guest";
                customerSpend[name] = (customerSpend[name] || 0) + (o.total_price || 0);
                customerOrders[name] = (customerOrders[name] || 0) + 1;
            });

            const topCustomersList = Object.keys(customerSpend).map(name => ({
                name,
                total_spent: customerSpend[name],
                order_count: customerOrders[name]
            })).sort((a, b) => b.total_spent - a.total_spent).slice(0, 10);

            // Hourly sales (for today or selected date range)
            const hourlySales = Array.from({ length: 24 }, (_, i) => ({ hour: i, revenue: 0, orders: 0 }));
            filteredOrders.forEach(o => {
                const date = new Date(o.created_at || o.date);
                const hour = date.getHours();
                hourlySales[hour].revenue += o.total_price || 0;
                hourlySales[hour].orders += 1;
            });

            // Active orders (not delivered, picked_up, cancelled, rejected)
            const activeOrders = orders.filter((o) =>
                !["delivered", "picked_up", "cancelled", "rejected"].includes(o.status)
            );

            setStats({
                orders: filteredOrders.length,
                pending: filteredOrders.filter((o) => o.status === "pending").length,
                today_revenue: totalRevenue,
                menu_items: menuRes.data.items.length,
                offers: offersRes.data.length,
                events: eventsRes.data.length,
                payment_breakdown: paymentBreakdown,
                order_type_breakdown: orderTypeBreakdown,
                total_customers: Object.keys(customerSpend).length,
                avg_order_value: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
                hourly_sales: hourlySales.filter(h => h.orders > 0)
            });

            setRecentOrders(activeOrders.slice(0, 5));
            setAllOrders(filteredOrders);
            setTopItems(topItemsList);
            setTopCustomers(topCustomersList);
        } catch (err) {
            console.error("Error loading stats:", err);
        }
    };

    const exportToCSV = () => {
        const headers = ["Order #", "Customer", "Phone", "Total", "Payment", "Type", "Status", "Date"];
        const rows = allOrders.map(o => [
            o.receipt_no,
            o.customer_name,
            o.phone,
            o.total_price?.toFixed(2),
            o.payment_method,
            o.order_type || "delivery",
            o.status,
            new Date(o.created_at).toLocaleString()
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orders_${dateFrom}_to_${dateTo}.csv`;
        a.click();
    };

    const paymentChartData = [
        { name: "Cash on Delivery", value: stats.payment_breakdown.cod, color: "#10b981" },
        { name: "Card", value: stats.payment_breakdown.card, color: "#3b82f6" },
        { name: "Wallet", value: stats.payment_breakdown.wallet, color: "#f59e0b" },
        { name: "Bank Transfer", value: stats.payment_breakdown.bank, color: "#8b5cf6" },
    ].filter(item => item.value > 0);

    const orderTypeChartData = [
        { name: "Delivery", value: stats.order_type_breakdown.delivery, color: "#ef4444" },
        { name: "Pickup", value: stats.order_type_breakdown.pickup, color: "#06b6d4" },
    ].filter(item => item.value > 0);

    return (
        <div data-testid="admin-dashboard" className="pb-8">
            <div className="mb-6">
                <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-2">Online Orders Dashboard</h1>
                <p className="text-neutral-500 mb-4">Comprehensive analytics &amp; insights</p>

                {/* Filters */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">From Date</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">To Date</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="preparing">Preparing</option>
                                <option value="ready">Ready</option>
                                <option value="out_for_delivery">Out for Delivery</option>
                                <option value="delivered">Delivered</option>
                                <option value="picked_up">Picked Up</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">Payment Method</label>
                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                            >
                                <option value="all">All Methods</option>
                                <option value="cod">Cash on Delivery</option>
                                <option value="card">Card</option>
                                <option value="wallet">Wallet</option>
                                <option value="bank">Bank Transfer</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">Order Type</label>
                            <select
                                value={orderTypeFilter}
                                onChange={(e) => setOrderTypeFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                            >
                                <option value="all">All Types</option>
                                <option value="delivery">Delivery</option>
                                <option value="pickup">Pickup</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Stat icon={<ShoppingBag className="w-5 h-5" />} label="Total Orders" value={stats.orders} accent="bg-brand-red text-white" testid="stat-orders" />
                <Stat icon={<TrendingUp className="w-5 h-5" />} label="Pending Orders" value={stats.pending} accent="bg-brand-yellow text-brand-ink" testid="stat-pending" />
                <Stat icon={<DollarSign className="w-5 h-5" />} label="Total Revenue" value={`Rs. ${stats.today_revenue.toFixed(0)}`} accent="bg-brand-ink text-white" testid="stat-revenue" />
                <Stat icon={<TrendingUp className="w-5 h-5" />} label="Avg Order Value" value={`Rs. ${stats.avg_order_value.toFixed(0)}`} accent="bg-purple-100 text-purple-700" testid="stat-avg" />
                <Stat icon={<Users className="w-5 h-5" />} label="Total Customers" value={stats.total_customers} accent="bg-blue-100 text-blue-700" testid="stat-customers" />
                <Stat icon={<ChefHat className="w-5 h-5" />} label="Menu Items" value={stats.menu_items} accent="bg-neutral-200 text-brand-ink" testid="stat-menu" />
                <Stat icon={<Tag className="w-5 h-5" />} label="Active Offers" value={stats.offers} accent="bg-green-100 text-green-700" testid="stat-offers" />
                <Stat icon={<CalendarDays className="w-5 h-5" />} label="Event Bookings" value={stats.events} accent="bg-blue-100 text-blue-700" testid="stat-events" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Payment Method Breakdown */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                    <h2 className="font-display font-bold text-xl text-brand-ink mb-4">Payment Methods</h2>
                    {paymentChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={paymentChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {paymentChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `Rs. ${value.toFixed(2)}`} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-neutral-500 text-center py-12">No payment data available</p>
                    )}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        {paymentChartData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-neutral-600">{item.name}: Rs. {item.value.toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order Type Breakdown */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                    <h2 className="font-display font-bold text-xl text-brand-ink mb-4">Order Types</h2>
                    {orderTypeChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={orderTypeChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {orderTypeChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `Rs. ${value.toFixed(2)}`} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-neutral-500 text-center py-12">No order type data available</p>
                    )}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        {orderTypeChartData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-neutral-600">{item.name}: Rs. {item.value.toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hourly Sales Chart */}
            {stats.hourly_sales.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-8">
                    <h2 className="font-display font-bold text-xl text-brand-ink mb-4">Hourly Sales</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.hourly_sales}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" label={{ value: "Hour", position: "insideBottom", offset: -5 }} />
                            <YAxis label={{ value: "Revenue (Rs)", angle: -90, position: "insideLeft" }} />
                            <Tooltip formatter={(value) => `Rs. ${value.toFixed(2)}`} />
                            <Legend />
                            <Bar dataKey="revenue" fill="#ef4444" name="Revenue" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Top Selling Items */}
            {topItems.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-8">
                    <h2 className="font-display font-bold text-xl text-brand-ink mb-4">Top Selling Items</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-neutral-500 border-b border-neutral-100">
                                    <th className="py-2 px-2">Item Name</th>
                                    <th className="py-2 px-2 text-right">Quantity Sold</th>
                                    <th className="py-2 px-2 text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topItems.map((item, idx) => (
                                    <tr key={idx} className="border-b border-neutral-50 last:border-0">
                                        <td className="py-3 px-2 font-semibold">{item.name}</td>
                                        <td className="py-3 px-2 text-right">{item.quantity}</td>
                                        <td className="py-3 px-2 text-right font-semibold">Rs. {item.revenue.toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Top Customers */}
            {topCustomers.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-8">
                    <h2 className="font-display font-bold text-xl text-brand-ink mb-4">Top Customers</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-neutral-500 border-b border-neutral-100">
                                    <th className="py-2 px-2">Customer Name</th>
                                    <th className="py-2 px-2 text-right">Orders</th>
                                    <th className="py-2 px-2 text-right">Total Spent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topCustomers.map((customer, idx) => (
                                    <tr key={idx} className="border-b border-neutral-50 last:border-0">
                                        <td className="py-3 px-2 font-semibold">{customer.name}</td>
                                        <td className="py-3 px-2 text-right">{customer.order_count}</td>
                                        <td className="py-3 px-2 text-right font-semibold">Rs. {customer.total_spent.toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Recent Active Orders */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-8">
                <h2 className="font-display font-bold text-xl text-brand-ink mb-4">Recent Active Orders</h2>
                {recentOrders.length === 0 ? (
                    <p className="text-neutral-500 text-sm">No active orders.</p>
                ) : (
                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-neutral-500 border-b border-neutral-100">
                                    <th className="py-2 px-2">Order #</th>
                                    <th className="py-2 px-2">Customer</th>
                                    <th className="py-2 px-2">Total</th>
                                    <th className="py-2 px-2">Payment</th>
                                    <th className="py-2 px-2">Type</th>
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
                                        <td className="py-3 px-2"><PaymentBadge method={o.payment_method} /></td>
                                        <td className="py-3 px-2"><TypeBadge type={o.order_type || "delivery"} /></td>
                                        <td className="py-3 px-2"><StatusBadge status={o.status} /></td>
                                        <td className="py-3 px-2 text-neutral-500">{new Date(o.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* All Orders List */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display font-bold text-xl text-brand-ink">All Orders ({allOrders.length})</h2>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-white rounded-lg hover:bg-opacity-90 text-sm font-semibold"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
                {allOrders.length === 0 ? (
                    <p className="text-neutral-500 text-sm">No orders found for the selected filters.</p>
                ) : (
                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-neutral-500 border-b border-neutral-100">
                                    <th className="py-2 px-2">Order #</th>
                                    <th className="py-2 px-2">Customer</th>
                                    <th className="py-2 px-2">Phone</th>
                                    <th className="py-2 px-2">Total</th>
                                    <th className="py-2 px-2">Payment</th>
                                    <th className="py-2 px-2">Type</th>
                                    <th className="py-2 px-2">Status</th>
                                    <th className="py-2 px-2">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(showAllOrders ? allOrders : allOrders.slice(0, 20)).map((o) => (
                                    <tr key={o.id} className="border-b border-neutral-50 last:border-0">
                                        <td className="py-3 px-2 font-mono font-semibold">{o.receipt_no}</td>
                                        <td className="py-3 px-2">{o.customer_name}</td>
                                        <td className="py-3 px-2 text-neutral-500">{o.phone}</td>
                                        <td className="py-3 px-2 font-semibold">Rs. {o.total_price?.toFixed(0)}</td>
                                        <td className="py-3 px-2"><PaymentBadge method={o.payment_method} /></td>
                                        <td className="py-3 px-2"><TypeBadge type={o.order_type || "delivery"} /></td>
                                        <td className="py-3 px-2"><StatusBadge status={o.status} /></td>
                                        <td className="py-3 px-2 text-neutral-500">{new Date(o.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!showAllOrders && allOrders.length > 20 && (
                            <div className="text-center mt-4">
                                <button
                                    onClick={() => setShowAllOrders(true)}
                                    className="px-4 py-2 bg-neutral-100 text-brand-ink rounded-lg hover:bg-neutral-200 text-sm font-semibold"
                                >
                                    Show All {allOrders.length} Orders
                                </button>
                            </div>
                        )}
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
        picked_up: "bg-green-50 text-green-700",
        cancelled: "bg-red-50 text-red-700",
        rejected: "bg-red-50 text-red-700",
    };
    return <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${colors[status] || "bg-neutral-100"}`}>{status?.replace(/_/g, " ")}</span>;
}

function PaymentBadge({ method }) {
    const colors = {
        cod: "bg-green-50 text-green-700",
        card: "bg-blue-50 text-blue-700",
        wallet: "bg-orange-50 text-orange-700",
        bank: "bg-purple-50 text-purple-700",
    };
    const labels = {
        cod: "COD",
        card: "Card",
        wallet: "Wallet",
        bank: "Bank",
    };
    return <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${colors[method] || "bg-neutral-100"}`}>{labels[method] || method}</span>;
}

function TypeBadge({ type }) {
    const colors = {
        delivery: "bg-red-50 text-red-700",
        pickup: "bg-cyan-50 text-cyan-700",
    };
    return <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full ${colors[type] || "bg-neutral-100"}`}>{type}</span>;
}
