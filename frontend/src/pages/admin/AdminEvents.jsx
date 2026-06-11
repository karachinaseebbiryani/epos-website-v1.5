import { useEffect, useState } from "react";
import api, { formatApiError } from "../../lib/api";
import { toast } from "sonner";

const STATUSES = ["pending", "confirmed", "completed", "cancelled"];

export default function AdminEvents() {
    const [bookings, setBookings] = useState([]);

    const load = async () => {
        const { data } = await api.get("/event-bookings");
        setBookings(data);
    };
    useEffect(() => { load(); }, []);

    const updateStatus = async (id, status) => {
        try {
            await api.put(`/event-bookings/${id}/status`, { status });
            toast.success("Updated");
            load();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail));
        }
    };

    return (
        <div data-testid="admin-events-page">
            <h1 className="font-display font-black text-3xl md:text-4xl text-brand-ink mb-2">Event Bookings</h1>
            <p className="text-neutral-500 mb-6">{bookings.length} total bookings</p>

            {bookings.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-neutral-500">No event bookings yet.</div>
            ) : (
                <div className="space-y-3">
                    {bookings.map((b) => (
                        <div key={b.id} data-testid={`admin-event-${b.id}`} className="bg-white border border-neutral-200 rounded-2xl p-5">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <div className="text-xs text-neutral-500 uppercase font-semibold tracking-wider">Name</div>
                                    <div className="font-display font-bold">{b.name}</div>
                                    <div className="text-xs text-neutral-500 mt-1">
                                        <a href={`tel:${b.phone}`} className="hover:text-brand-red">{b.phone}</a>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-neutral-500 uppercase font-semibold tracking-wider">Event</div>
                                    <div className="font-semibold">{b.event_type}</div>
                                    <div className="text-xs text-neutral-500">{b.guests} guests</div>
                                </div>
                                <div>
                                    <div className="text-xs text-neutral-500 uppercase font-semibold tracking-wider">Date</div>
                                    <div className="font-semibold">{b.event_date}</div>
                                    <div className="text-xs text-neutral-500">Booked {new Date(b.created_at).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <select value={b.status} onChange={(e) => updateStatus(b.id, e.target.value)} data-testid={`event-status-${b.id}`}
                                        className="bg-neutral-50 border border-neutral-200 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider outline-none focus:border-brand-red w-full">
                                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            {b.message && (
                                <div className="mt-3 pt-3 border-t border-neutral-100 text-sm text-neutral-600">
                                    <span className="text-xs font-semibold text-neutral-500 uppercase">Message: </span>
                                    {b.message}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
