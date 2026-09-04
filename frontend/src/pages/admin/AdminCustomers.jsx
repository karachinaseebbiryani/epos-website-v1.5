import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { Search, Wallet, Plus, Minus, X, Mail, Phone, Calendar, Package, Diamond, History, ExternalLink, Users, TrendingUp, Award, DollarSign, Download, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminCustomers() {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterVerified, setFilterVerified] = useState("all"); // all, verified, unverified
    const [filterWallet, setFilterWallet] = useState("all"); // all, with_balance, zero
    const [filterOrders, setFilterOrders] = useState("all"); // all, active, inactive
    const [sortBy, setSortBy] = useState("recent"); // recent, name, orders, wallet, diamonds
    const [creditModal, setCreditModal] = useState(null);
    const [historyModal, setHistoryModal] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [creditForm, setCreditForm] = useState({ amount: 0, note: "" });
    const [submitting, setSubmitting] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const { data } = await api.get("/admin/customers");
            setCustomers(data);
        } catch (err) {
            toast.error("Failed to load customers");
        } finally {
            setLoading(false);
        }
    };

    const openCreditModal = (customer, isAdd = true) => {
        setCreditModal({ ...customer, isAdd });
        setCreditForm({ amount: 0, note: "" });
    };

    const openHistoryModal = async (customer) => {
        setHistoryModal(customer);
        setLoadingHistory(true);
        try {
            const { data } = await api.get(`/admin/customers/${customer.id}/wallet-history`);
            setTransactions(data);
        } catch (err) {
            toast.error("Failed to load transaction history");
        } finally {
            setLoadingHistory(false);
        }
    };

    const adjustWalletCredit = async () => {
        if (!creditForm.amount || creditForm.amount === 0) {
            toast.error("Please enter an amount");
            return;
        }
        if (!creditForm.note.trim()) {
            toast.error("Please enter a reason/note");
            return;
        }

        setSubmitting(true);
        try {
            const finalAmount = creditModal.isAdd ? Math.abs(creditForm.amount) : -Math.abs(creditForm.amount);
            await api.post(`/admin/customers/${creditModal.id}/adjust-wallet`, {
                amount: finalAmount,
                note: creditForm.note.trim(),
            });
            toast.success(`${creditModal.isAdd ? "Added" : "Deducted"} Rs. ${Math.abs(creditForm.amount)} ${creditModal.isAdd ? "to" : "from"} ${creditModal.name}'s wallet`);
            setCreditModal(null);
            loadCustomers();
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setSubmitting(false);
        }
    };

    const exportToCSV = () => {
        const headers = ["Name", "Email", "Phone", "Verified", "Joined", "Orders", "Wallet Balance", "Diamonds"];
        const rows = filteredCustomers.map(c => [
            c.name,
            c.email,
            c.phone || "",
            c.email_verified ? "Yes" : "No",
            new Date(c.created_at).toLocaleDateString(),
            c.order_count || 0,
            c.wallet_balance?.toFixed(2) || 0,
            c.diamond_balance || 0
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    const filteredCustomers = customers
        .filter((c) => {
            // Search filter
            const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone?.includes(searchTerm);
            if (!matchesSearch) return false;

            // Verification filter
            if (filterVerified === "verified" && !c.email_verified) return false;
            if (filterVerified === "unverified" && c.email_verified) return false;

            // Wallet filter
            if (filterWallet === "with_balance" && (c.wallet_balance || 0) <= 0) return false;
            if (filterWallet === "zero" && (c.wallet_balance || 0) > 0) return false;

            // Orders filter
            if (filterOrders === "active" && (c.order_count || 0) === 0) return false;
            if (filterOrders === "inactive" && (c.order_count || 0) > 0) return false;

            return true;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case "name":
                    return (a.name || "").localeCompare(b.name || "");
                case "orders":
                    return (b.order_count || 0) - (a.order_count || 0);
                case "wallet":
                    return (b.wallet_balance || 0) - (a.wallet_balance || 0);
                case "diamonds":
                    return (b.diamond_balance || 0) - (a.diamond_balance || 0);
                case "recent":
                default:
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            }
        });

    // Calculate statistics
    const stats = {
        total: customers.length,
        verified: customers.filter(c => c.email_verified).length,
        withOrders: customers.filter(c => (c.order_count || 0) > 0).length,
        totalOrders: customers.reduce((sum, c) => sum + (c.order_count || 0), 0),
        totalWallet: customers.reduce((sum, c) => sum + (c.wallet_balance || 0), 0),
        totalDiamonds: customers.reduce((sum, c) => sum + (c.diamond_balance || 0), 0),
    };

    if (loading) {
        return <div className="p-8 text-center text-neutral-500">Loading customers...</div>;
    }

    return (
        <div className="p-6 md:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-neutral-900">Customer Management</h1>
                <p className="text-neutral-600 mt-1">Manage customer accounts, wallet credits, and view analytics</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
                <StatCard icon={<Users className="w-5 h-5" />} label="Total Customers" value={stats.total} color="blue" />
                <StatCard icon={<Mail className="w-5 h-5" />} label="Verified" value={stats.verified} color="green" />
                <StatCard icon={<Package className="w-5 h-5" />} label="Active Customers" value={stats.withOrders} color="purple" />
                <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Total Orders" value={stats.totalOrders} color="orange" />
                <StatCard icon={<Wallet className="w-5 h-5" />} label="Total Wallet" value={`Rs. ${stats.totalWallet.toFixed(0)}`} color="green" />
                <StatCard icon={<Diamond className="w-5 h-5" />} label="Total Diamonds" value={stats.totalDiamonds} color="amber" />
            </div>

            {/* Search and Actions */}
            <div className="mb-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-red focus:border-transparent"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-3 border rounded-xl font-semibold flex items-center gap-2 ${
                            showFilters ? "bg-brand-red text-white border-brand-red" : "border-neutral-300 hover:bg-neutral-50"
                        }`}
                    >
                        <Filter className="w-5 h-5" />
                        Filters
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xl font-semibold flex items-center gap-2"
                    >
                        <Download className="w-5 h-5" />
                        Export
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="mb-6 p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-neutral-700">Status:</label>
                            <select
                                value={filterVerified}
                                onChange={(e) => setFilterVerified(e.target.value)}
                                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent"
                            >
                                <option value="all">All</option>
                                <option value="verified">Verified</option>
                                <option value="unverified">Unverified</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-neutral-700">Wallet:</label>
                            <select
                                value={filterWallet}
                                onChange={(e) => setFilterWallet(e.target.value)}
                                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent"
                            >
                                <option value="all">All</option>
                                <option value="with_balance">With Balance</option>
                                <option value="zero">Zero Balance</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-neutral-700">Orders:</label>
                            <select
                                value={filterOrders}
                                onChange={(e) => setFilterOrders(e.target.value)}
                                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent"
                            >
                                <option value="all">All</option>
                                <option value="active">Active (Has Orders)</option>
                                <option value="inactive">Inactive (No Orders)</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-neutral-700">Sort by:</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red focus:border-transparent"
                            >
                                <option value="recent">Most Recent</option>
                                <option value="name">Name (A-Z)</option>
                                <option value="orders">Most Orders</option>
                                <option value="wallet">Highest Wallet Balance</option>
                                <option value="diamonds">Most Diamonds</option>
                            </select>
                        </div>

                        <div className="ml-auto text-sm text-neutral-600 font-semibold">
                            Showing {filteredCustomers.length} of {customers.length}
                        </div>
                    </div>
                </div>
            )}

            {/* Customers Table */}
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-neutral-50 border-b border-neutral-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Orders</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Wallet</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Diamonds</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-neutral-500">
                                        {searchTerm ? "No customers match your search" : "No customers yet"}
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-start gap-2">
                                                <div className="w-10 h-10 rounded-full bg-brand-red text-white flex items-center justify-center font-bold">
                                                    {customer.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-neutral-900">{customer.name}</div>
                                                    {customer.email_verified && (
                                                        <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                                                            <Mail className="w-3 h-3" /> Verified
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-neutral-600 flex items-center gap-1">
                                                <Mail className="w-3 h-3" />
                                                {customer.email}
                                            </div>
                                            {customer.phone && (
                                                <div className="text-sm text-neutral-600 flex items-center gap-1 mt-1">
                                                    <Phone className="w-3 h-3" />
                                                    {customer.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-neutral-600">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(customer.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {customer.order_count > 0 ? (
                                                <button
                                                    onClick={() => navigate(`/admin/orders?customer=${customer.id}`)}
                                                    className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                                                >
                                                    <Package className="w-4 h-4" />
                                                    {customer.order_count}
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1 text-sm text-neutral-400">
                                                    <Package className="w-4 h-4" />
                                                    0
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-sm font-bold text-green-600">
                                                <Wallet className="w-4 h-4" />
                                                Rs. {customer.wallet_balance?.toFixed(0) || 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-sm font-bold text-amber-600">
                                                <Diamond className="w-4 h-4" fill="currentColor" />
                                                {customer.diamond_balance || 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openCreditModal(customer, true)}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="Add credit"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openCreditModal(customer, false)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Deduct credit"
                                                    disabled={!customer.wallet_balance || customer.wallet_balance <= 0}
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openHistoryModal(customer)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View transaction history"
                                                >
                                                    <History className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Adjust Credit Modal */}
            {creditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-neutral-900">
                                {creditModal.isAdd ? "Add" : "Deduct"} Wallet Credit
                            </h2>
                            <button onClick={() => setCreditModal(null)} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-lg">
                                    {creditModal.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-semibold text-neutral-900">{creditModal.name}</div>
                                    <div className="text-sm text-neutral-500">{creditModal.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
                                <span className="text-sm text-neutral-600">Current Balance:</span>
                                <span className="font-bold text-green-600 text-lg">Rs. {creditModal.wallet_balance?.toFixed(0) || 0}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                    Amount (Rs.)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="10"
                                    value={creditForm.amount}
                                    onChange={(e) => setCreditForm({ ...creditForm, amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent text-lg font-semibold"
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                    Reason / Note <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={creditForm.note}
                                    onChange={(e) => setCreditForm({ ...creditForm, note: e.target.value })}
                                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent"
                                    placeholder="e.g., Compensation for late delivery, Promotional credit, etc."
                                    rows="3"
                                />
                            </div>

                            {creditForm.amount > 0 && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="text-sm text-blue-800">
                                        <strong>New Balance:</strong> Rs. {
                                            creditModal.isAdd
                                                ? ((creditModal.wallet_balance || 0) + creditForm.amount).toFixed(0)
                                                : Math.max(0, (creditModal.wallet_balance || 0) - creditForm.amount).toFixed(0)
                                        }
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setCreditModal(null)}
                                className="flex-1 px-4 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-50 font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={adjustWalletCredit}
                                disabled={submitting}
                                className={`flex-1 px-4 py-3 rounded-lg font-semibold text-white transition-colors ${
                                    creditModal.isAdd ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {submitting ? "Processing..." : creditModal.isAdd ? "Add Credit" : "Deduct Credit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction History Modal */}
            {historyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-xl">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-lg">
                                    {historyModal.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-neutral-900">Transaction History</h2>
                                    <p className="text-sm text-neutral-600">{historyModal.name} • {historyModal.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setHistoryModal(null)} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingHistory ? (
                                <div className="text-center py-12 text-neutral-500">Loading transactions...</div>
                            ) : transactions.length === 0 ? (
                                <div className="text-center py-12">
                                    <History className="w-16 h-16 mx-auto text-neutral-300 mb-4" />
                                    <p className="text-neutral-500">No transactions yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {transactions.map((t, idx) => (
                                        <div key={idx} className="flex items-start gap-4 p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                                            <div className={`p-2 rounded-lg ${
                                                t.amount > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                            }`}>
                                                <Wallet className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-neutral-900">
                                                            {t.type === "manual_adjustment" && "Manual Adjustment"}
                                                            {t.type === "refund" && "Refund Approved"}
                                                            {t.type === "order" && "Order Payment"}
                                                            {t.type === "restore" && "Credit Restored"}
                                                        </div>
                                                        <div className="text-sm text-neutral-600 mt-1">{t.note}</div>
                                                        {t.adjusted_by && (
                                                            <div className="text-xs text-neutral-500 mt-1">By: {t.adjusted_by}</div>
                                                        )}
                                                        {t.order_id && (
                                                            <div className="text-xs text-neutral-500 mt-1">Order: #{t.order_id.slice(-6).toUpperCase()}</div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`font-bold text-lg ${
                                                            t.amount > 0 ? "text-green-600" : "text-red-600"
                                                        }`}>
                                                            {t.amount > 0 ? "+" : ""}Rs. {t.amount.toFixed(0)}
                                                        </div>
                                                        <div className="text-xs text-neutral-500 mt-1">
                                                            {new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-neutral-200 bg-neutral-50">
                            <button
                                onClick={() => setHistoryModal(null)}
                                className="w-full px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    const colors = {
        blue: "bg-blue-100 text-blue-600",
        green: "bg-green-100 text-green-600",
        purple: "bg-purple-100 text-purple-600",
        orange: "bg-orange-100 text-orange-600",
        amber: "bg-amber-100 text-amber-600",
    };

    return (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
                {icon}
            </div>
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">{label}</div>
            <div className="text-2xl font-black text-neutral-900 mt-1">{value}</div>
        </div>
    );
}
