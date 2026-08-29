import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { toast } from "sonner";
import { Search, Wallet, Plus, Minus, X, Mail, Phone, Calendar, Package, Diamond, History } from "lucide-react";

export default function AdminCustomers() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [creditModal, setCreditModal] = useState(null);
    const [historyModal, setHistoryModal] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [creditForm, setCreditForm] = useState({ amount: 0, note: "" });
    const [submitting, setSubmitting] = useState(false);

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

    const filteredCustomers = customers.filter((c) =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

    if (loading) {
        return <div className="p-8 text-center text-neutral-500">Loading customers...</div>;
    }

    return (
        <div className="p-6 md:p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-neutral-900">Customer Management</h1>
                <p className="text-neutral-600 mt-1">Manage customer accounts and wallet credits</p>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-brand-red focus:border-transparent"
                />
            </div>

            {/* Customers Table */}
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
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
                                    <tr key={customer.id} className="hover:bg-neutral-50">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-neutral-900">{customer.name}</div>
                                            {customer.email_verified && (
                                                <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-1">
                                                    <Mail className="w-3 h-3" /> Verified
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-neutral-600">{customer.email}</div>
                                            <div className="text-sm text-neutral-500 flex items-center gap-1 mt-1">
                                                <Phone className="w-3 h-3" />
                                                {customer.phone || "—"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-neutral-600">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(customer.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-sm font-semibold text-neutral-700">
                                                <Package className="w-4 h-4" />
                                                {customer.order_count || 0}
                                            </div>
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
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-neutral-900">
                                {creditModal.isAdd ? "Add" : "Deduct"} Wallet Credit
                            </h2>
                            <button onClick={() => setCreditModal(null)} className="p-2 hover:bg-neutral-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                            <div className="text-sm text-neutral-600">Customer</div>
                            <div className="font-semibold text-neutral-900">{creditModal.name}</div>
                            <div className="text-sm text-neutral-500">{creditModal.email}</div>
                            <div className="text-sm text-neutral-600 mt-2">
                                Current Balance: <span className="font-bold text-green-600">Rs. {creditModal.wallet_balance?.toFixed(0) || 0}</span>
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
                                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent"
                                    placeholder="Enter amount"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                    Reason / Note
                                </label>
                                <textarea
                                    value={creditForm.note}
                                    onChange={(e) => setCreditForm({ ...creditForm, note: e.target.value })}
                                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent"
                                    placeholder="e.g., Compensation for late delivery"
                                    rows="3"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setCreditModal(null)}
                                className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={adjustWalletCredit}
                                disabled={submitting}
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white ${
                                    creditModal.isAdd ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                                } disabled:opacity-50`}
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
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <div>
                                <h2 className="text-xl font-bold text-neutral-900">Transaction History</h2>
                                <p className="text-sm text-neutral-600 mt-1">{historyModal.name} • {historyModal.email}</p>
                            </div>
                            <button onClick={() => setHistoryModal(null)} className="p-2 hover:bg-neutral-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingHistory ? (
                                <div className="text-center py-12 text-neutral-500">Loading transactions...</div>
                            ) : transactions.length === 0 ? (
                                <div className="text-center py-12 text-neutral-500">No transactions yet</div>
                            ) : (
                                <div className="space-y-3">
                                    {transactions.map((t, idx) => (
                                        <div key={idx} className="flex items-start gap-4 p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50">
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

                        <div className="p-6 border-t border-neutral-200">
                            <button
                                onClick={() => setHistoryModal(null)}
                                className="w-full px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg font-semibold"
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
