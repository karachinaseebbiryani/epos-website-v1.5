import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DollarSign, ShoppingCart, Package, AlertTriangle, Banknote, CreditCard, TrendingUp, Bike, Receipt, Lock, CalendarDays } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (<div className="rounded-lg border border-[#E5E2DC] bg-white p-3 shadow-lg">
      <p className="text-sm font-semibold mb-1" style={{ color: "#1A1D1A" }}>{label}</p>
      {payload.map((p, i) => (<p key={i} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value.toFixed(2)}</p>))}
    </div>);
  }
  return null;
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [hourlyData, setHourlyData] = useState([]);
  const [currency, setCurrency] = useState("Rs");
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchAll = useCallback(async (date) => {
    setLoading(true);
    try {
      const dateParam = date ? `?date=${date}` : "";
      const [statsRes, hourlyRes, settingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats${dateParam}`, { withCredentials: true }),
        axios.get(`${API}/dashboard/hourly-sales${dateParam}`, { withCredentials: true }),
        axios.get(`${API}/settings`, { withCredentials: true }),
      ]);
      setStats(statsRes.data);
      setHourlyData(hourlyRes.data.filter((h) => parseInt(h.hour) >= 6 && parseInt(h.hour) <= 23));
      setCurrency(settingsRes.data.currency || "Rs");
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(selectedDate); }, [fetchAll, selectedDate]);

  if (loading) return (<div className="flex-1 p-8 flex items-center justify-center"><p style={{ color: "#5C5F5C" }}>Loading...</p></div>);

  const c = currency;
  const isClosed = stats?.is_closed;
  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const statCards = [
    { label: "Total Sales", value: `${c} ${stats?.total_sales?.toFixed(2) || "0.00"}`, icon: DollarSign, color: "#1E3F20", bgColor: "#EAF4EB" },
    { label: "Cash Sales", value: `${c} ${stats?.cash_sales?.toFixed(2) || "0.00"}`, icon: Banknote, color: "#2E5C31", bgColor: "#EAF4EB" },
    { label: "Card Sales", value: `${c} ${stats?.credit_sales?.toFixed(2) || "0.00"}`, icon: CreditCard, color: "#C05746", bgColor: "#FCECEB" },
    { label: "FoodPanda", value: `${c} ${stats?.online_sales?.toFixed(2) || "0.00"}`, icon: Bike, color: "#D70F64", bgColor: "#FDE8F0" },
    { label: "Total Orders", value: stats?.total_orders || 0, icon: ShoppingCart, color: "#D97736", bgColor: "#FDF2E9" },
    { label: "Expenses", value: `${c} ${stats?.total_expenses?.toFixed(2) || "0.00"}`, icon: Receipt, color: "#A63D31", bgColor: "#FCECEB" },
    { label: "Net Revenue", value: `${c} ${stats?.net_revenue?.toFixed(2) || "0.00"}`, icon: TrendingUp, color: "#1E3F20", bgColor: "#EAF4EB" },
    { label: "Low Stock", value: stats?.low_stock_count || 0, icon: AlertTriangle, color: stats?.low_stock_count > 0 ? "#A63D31" : "#2E5C31", bgColor: stats?.low_stock_count > 0 ? "#FCECEB" : "#EAF4EB" },
  ];

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="dashboard-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "#5C5F5C" }}>{isToday ? "Today's overview" : `Viewing ${selectedDate}`} - {stats?.today}</p>
        </div>
        <div className="flex items-center gap-3">
          {isClosed && (
            <Badge className="flex items-center gap-1 px-3 py-1.5 text-sm" style={{ background: "#FCECEB", color: "#A63D31", border: "none" }}>
              <Lock className="w-3.5 h-3.5" /> Day Closed
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" style={{ color: "#5C5F5C" }} />
            <Input data-testid="dashboard-date-picker" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40 border-[#E5E2DC]" />
          </div>
          {!isToday && <Button size="sm" variant="outline" onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} className="text-xs border-[#E5E2DC]">Today</Button>}
        </div>
      </div>

      {isClosed && isToday && (
        <div className="mb-6 p-4 rounded-lg border border-[#E5E2DC]" style={{ background: "#FDF2E9" }}>
          <p className="text-sm font-medium" style={{ color: "#D97736" }}>Day has been closed (Z Report archived). Dashboard shows today's final numbers. New orders will appear after a new day starts.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((card, idx) => (
          <Card key={card.label} data-testid={`stat-card-${card.label.toLowerCase().replace(/[\s']/g, "-")}`} className={`border-[#E5E2DC] report-stat fade-in fade-in-delay-${idx % 4}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div><p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#5C5F5C" }}>{card.label}</p><p className="text-2xl font-bold mt-1" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>{card.value}</p></div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: card.bgColor }}><card.icon className="w-5 h-5" style={{ color: card.color }} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#E5E2DC]" data-testid="hourly-sales-chart">
        <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}><TrendingUp className="w-5 h-5" style={{ color: "#D97736" }} /> Hourly Sales - {selectedDate}</CardTitle></CardHeader>
        <CardContent>
          {hourlyData.some((h) => h.total > 0) ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#5C5F5C" }} tickLine={false} axisLine={{ stroke: "#E5E2DC" }} />
                <YAxis tick={{ fontSize: 11, fill: "#5C5F5C" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="square" iconSize={10} />
                <Bar dataKey="cash" name="Cash" fill="#1E3F20" radius={[4, 4, 0, 0]} stackId="s" />
                <Bar dataKey="credit" name="Card" fill="#C05746" radius={[4, 4, 0, 0]} stackId="s" />
                <Bar dataKey="online" name="FoodPanda" fill="#D70F64" radius={[4, 4, 0, 0]} stackId="s" />
              </BarChart>
            </ResponsiveContainer>
          ) : (<div className="flex flex-col items-center justify-center py-16"><TrendingUp className="w-12 h-12 mb-3 opacity-15" /><p className="text-sm" style={{ color: "#5C5F5C" }}>No sales data for this date</p></div>)}
        </CardContent>
      </Card>
    </div>
  );
}
