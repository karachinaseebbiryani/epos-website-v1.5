import React, { useState, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { FileBarChart, Download, DollarSign, Banknote, CreditCard, ShoppingCart, Package, TrendingUp, Lock, History, Printer, Bike, Receipt, Mail } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function downloadCSV(data, filename) {
  if (!data || !data.length) { toast.error("No data to export"); return; }
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(","), ...data.map((row) => headers.map((h) => { const s = String(row[h] ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; }).join(","))];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  toast.success(`Downloaded ${filename}`);
}

function buildReportHTML(report, type) {
  const itemRows = report.top_items?.map((it, i) => `<tr><td>${i+1}</td><td>${it.name}</td><td>${it.quantity}</td></tr>`).join("") || "";
  return `<html><head><title>${type} Report</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#1A1D1A}h1{color:#1E3F20;margin-bottom:4px}.sub{color:#5C5F5C;font-size:14px;margin-bottom:20px}.sg{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}.sb{border:1px solid #E5E2DC;border-radius:8px;padding:16px}.sl{font-size:11px;text-transform:uppercase;color:#5C5F5C}.sv{font-size:24px;font-weight:bold;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #E5E2DC;padding:8px 12px;text-align:left;font-size:13px}th{background:#F9F8F6}@media print{body{margin:20px}}</style></head><body>
    <h1>${type} Sales Report</h1><p class="sub">Date: ${report.date} | Generated: ${new Date(report.generated_at).toLocaleString()}</p>
    <div class="sg">
      <div class="sb"><div class="sl">Total Sales</div><div class="sv">${report.total_sales?.toFixed(2)}</div></div>
      <div class="sb"><div class="sl">Cash</div><div class="sv">${report.cash_sales?.toFixed(2)}</div></div>
      <div class="sb"><div class="sl">Card</div><div class="sv">${report.credit_sales?.toFixed(2)}</div></div>
      <div class="sb"><div class="sl">FoodPanda 1</div><div class="sv">${report.foodpanda1_sales?.toFixed(2)}</div></div>
      <div class="sb"><div class="sl">FoodPanda 2</div><div class="sv">${report.foodpanda2_sales?.toFixed(2)}</div></div>
      <div class="sb"><div class="sl">Expenses</div><div class="sv" style="color:#A63D31">${report.total_expenses?.toFixed(2)}</div></div>
      <div class="sb"><div class="sl">Net Revenue</div><div class="sv" style="color:#1E3F20">${report.net_revenue?.toFixed(2)}</div></div>
    </div>
    ${report.top_items?.length ? `<h3>Top Selling Items</h3><table><thead><tr><th>#</th><th>Item</th><th>Qty</th></tr></thead><tbody>${itemRows}</tbody></table>` : ""}
  </body></html>`;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const hasZPerm = user?.role === "admin" || (user?.permissions || []).includes("reports_z");
  const [xReport, setXReport] = useState(null);
  const [zReport, setZReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingX, setLoadingX] = useState(false);
  const [loadingZ, setLoadingZ] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [closingZ, setClosingZ] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const printFrameRef = useRef(null);

  const printReport = (report, type) => {
    if (!report) return;
    const iframe = printFrameRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(buildReportHTML(report, type)); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
  };

  const fetchXReport = useCallback(async () => {
    setLoadingX(true);
    try { const { data } = await axios.get(`${API}/reports/x`, { withCredentials: true }); setXReport(data); toast.success("X Report generated"); }
    catch { toast.error("Failed"); } finally { setLoadingX(false); }
  }, []);

  const fetchZReport = useCallback(async () => {
    setLoadingZ(true);
    try { const { data } = await axios.get(`${API}/reports/z`, { withCredentials: true }); setZReport(data); toast.success("Z Report generated"); }
    catch { toast.error("Failed"); } finally { setLoadingZ(false); }
  }, []);

  const closeZReport = async () => {
    setCloseConfirm(false); setClosingZ(true);
    try { await axios.post(`${API}/reports/z/close`, {}, { withCredentials: true }); toast.success("Z Report closed!"); fetchZReport(); fetchHistory(); }
    catch (err) { toast.error(typeof err.response?.data?.detail === "string" ? err.response.data.detail : "Failed"); }
    finally { setClosingZ(false); }
  };

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let url = `${API}/reports/history`;
      const params = [];
      if (startDate) params.push(`start_date=${startDate}`);
      if (endDate) params.push(`end_date=${endDate}`);
      if (params.length) url += `?${params.join("&")}`;
      const { data } = await axios.get(url, { withCredentials: true });
      setHistory(data);
      toast.success(data.length ? `Loaded ${data.length} reports` : "No reports found");
    } catch { toast.error("Failed"); } finally { setLoadingHistory(false); }
  }, [startDate, endDate]);

  const exportTodayCSV = async () => {
    try { const { data } = await axios.get(`${API}/reports/export/csv`, { withCredentials: true }); downloadCSV(data, `sales_${new Date().toISOString().split("T")[0]}.csv`); }
    catch { toast.error("Failed"); }
  };

  const exportHistoryCSV = () => {
    if (!history.length) { toast.error("No data"); return; }
    downloadCSV(history.map((r) => ({ date: r.date, total_sales: r.total_sales, cash: r.cash_sales, card: r.credit_sales, foodpanda1: r.foodpanda1_sales || 0, foodpanda2: r.foodpanda2_sales || 0, online: r.online_sales || 0, orders: r.total_orders, items: r.total_items_sold, expenses: r.total_expenses || 0, net_revenue: r.net_revenue || 0 })), "z_report_history.csv");
  };

  const emailReport = async (type, date) => {
    try {
      const payload = { report_type: type };
      if (date) payload.date = date;
      const { data } = await axios.post(`${API}/email/send-report`, payload, { withCredentials: true });
      toast.success(data.message || "Email sent!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send email");
    }
  };

  const ReportCard = ({ report, type }) => {
    if (!report) return null;
    const stats = [
      { label: "Total Sales", value: report.total_sales?.toFixed(2), icon: DollarSign, color: "#1E3F20", bg: "#EAF4EB" },
      { label: "Cash", value: report.cash_sales?.toFixed(2), icon: Banknote, color: "#2E5C31", bg: "#EAF4EB" },
      { label: "Card", value: report.credit_sales?.toFixed(2), icon: CreditCard, color: "#C05746", bg: "#FCECEB" },
      { label: "FoodPanda 1", value: report.foodpanda1_sales?.toFixed(2), icon: Bike, color: "#D70F64", bg: "#FDE8F0" },
      { label: "FoodPanda 2", value: report.foodpanda2_sales?.toFixed(2), icon: Bike, color: "#D70F64", bg: "#FDE8F0" },
      { label: "Orders", value: report.total_orders, icon: ShoppingCart, color: "#D97736", bg: "#FDF2E9" },
      { label: "Items Sold", value: report.total_items_sold, icon: Package, color: "#1E3F20", bg: "#EAF4EB" },
      { label: "Expenses", value: report.total_expenses?.toFixed(2), icon: Receipt, color: "#A63D31", bg: "#FCECEB" },
      { label: "Net Revenue", value: report.net_revenue?.toFixed(2), icon: TrendingUp, color: "#1E3F20", bg: "#EAF4EB" },
    ];
    return (
      <div className="space-y-4">
        <div><Badge className="text-xs mb-2" style={{ background: type === "X" ? "#FDF2E9" : "#EAF4EB", color: type === "X" ? "#D97736" : "#1E3F20", border: "none" }}>{type} Report</Badge>
          <p className="text-sm" style={{ color: "#5C5F5C" }}>Date: {report.date} | Generated: {new Date(report.generated_at).toLocaleTimeString()}</p></div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="border-[#E5E2DC]"><CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-lg mx-auto mb-1 flex items-center justify-center" style={{ background: s.bg }}><s.icon className="w-4 h-4" style={{ color: s.color }} /></div>
              <p className="text-xs" style={{ color: "#5C5F5C" }}>{s.label}</p>
              <p className="text-base font-bold" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>{s.value}</p>
            </CardContent></Card>
          ))}
        </div>
        {report.top_items?.length > 0 && (
          <Card className="border-[#E5E2DC]"><CardHeader className="py-3 px-4"><CardTitle className="text-sm flex items-center gap-2" style={{ color: "#1A1D1A" }}><TrendingUp className="w-4 h-4" style={{ color: "#D97736" }} /> Top Selling Items</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              {report.top_items.map((item, idx) => (<div key={idx} className="flex items-center justify-between py-1"><span className="text-sm"><span className="font-mono text-xs mr-2" style={{ color: "#5C5F5C" }}>#{idx+1}</span>{item.name}</span><Badge className="text-xs" style={{ background: "#F9F8F6", color: "#5C5F5C", border: "1px solid #E5E2DC" }}>{item.quantity} sold</Badge></div>))}
            </CardContent></Card>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="reports-page">
      <iframe ref={printFrameRef} title="print" style={{ position: "absolute", width: 0, height: 0, border: "none", left: "-9999px" }} />
      <div className="mb-6"><h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>Sales Reports</h1></div>

      <Tabs defaultValue="x-report" className="space-y-4">
        <TabsList className="bg-[#F9F8F6] border border-[#E5E2DC]">
          <TabsTrigger value="x-report" data-testid="tab-x-report" className="data-[state=active]:bg-white"><FileBarChart className="w-4 h-4 mr-2" /> X Report</TabsTrigger>
          {hasZPerm && <TabsTrigger value="z-report" data-testid="tab-z-report" className="data-[state=active]:bg-white"><Lock className="w-4 h-4 mr-2" /> Z Report</TabsTrigger>}
          {hasZPerm && <TabsTrigger value="history" data-testid="tab-history" className="data-[state=active]:bg-white"><History className="w-4 h-4 mr-2" /> History</TabsTrigger>}
        </TabsList>

        <TabsContent value="x-report">
          <div className="flex flex-wrap justify-end gap-2 mb-4">
            <Button data-testid="export-x-csv-btn" onClick={exportTodayCSV} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]"><Download className="w-4 h-4" /> Export CSV</Button>
            {xReport && <Button data-testid="print-x-pdf-btn" onClick={() => printReport(xReport, "X")} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]"><Printer className="w-4 h-4" /> Print / Save PDF</Button>}
            {xReport && isAdmin && <Button data-testid="email-x-report-btn" onClick={() => emailReport("X")} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]" style={{ color: "#1E3F20" }}><Mail className="w-4 h-4" /> Email Report</Button>}
            <Button data-testid="generate-x-report-btn" onClick={fetchXReport} disabled={loadingX} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#D97736" }}><FileBarChart className="w-4 h-4" /> {loadingX ? "Generating..." : "Generate X Report"}</Button>
          </div>
          {xReport ? <ReportCard report={xReport} type="X" /> : <Card className="border-[#E5E2DC]"><CardContent className="flex flex-col items-center py-16"><FileBarChart className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm" style={{ color: "#5C5F5C" }}>Click Generate to view</p></CardContent></Card>}
        </TabsContent>

        {hasZPerm && <TabsContent value="z-report">
          <div className="flex flex-wrap justify-end gap-2 mb-4">
            {zReport && <><Button data-testid="export-z-csv-btn" onClick={exportTodayCSV} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]"><Download className="w-4 h-4" /> CSV</Button>
              <Button data-testid="print-z-pdf-btn" onClick={() => printReport(zReport, "Z")} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]"><Printer className="w-4 h-4" /> Print PDF</Button>
              {isAdmin && <Button data-testid="email-z-report-btn" onClick={() => emailReport("Z")} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]" style={{ color: "#1E3F20" }}><Mail className="w-4 h-4" /> Email Report</Button>}</>}
            <Button data-testid="generate-z-report-btn" onClick={fetchZReport} disabled={loadingZ} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><FileBarChart className="w-4 h-4" /> {loadingZ ? "..." : "Generate Z Report"}</Button>
            {zReport && <Button data-testid="close-z-report-btn" onClick={() => setCloseConfirm(true)} disabled={closingZ} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#C05746" }}><Lock className="w-4 h-4" /> {closingZ ? "..." : "Close Day"}</Button>}
          </div>
          {zReport ? <ReportCard report={zReport} type="Z" /> : <Card className="border-[#E5E2DC]"><CardContent className="flex flex-col items-center py-16"><Lock className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm" style={{ color: "#5C5F5C" }}>Generate Z Report</p></CardContent></Card>}
        </TabsContent>}

        {hasZPerm && <TabsContent value="history">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1"><Label className="text-xs">From</Label><Input data-testid="history-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-[#E5E2DC] w-40" /></div>
            <div className="space-y-1"><Label className="text-xs">To</Label><Input data-testid="history-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-[#E5E2DC] w-40" /></div>
            <Button data-testid="load-history-btn" onClick={fetchHistory} disabled={loadingHistory} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><History className="w-4 h-4" /> {loadingHistory ? "..." : "Load History"}</Button>
            {history.length > 0 && <>
              <Button data-testid="export-history-csv-btn" onClick={exportHistoryCSV} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]"><Download className="w-4 h-4" /> Export CSV</Button>
            </>}
          </div>
          {history.length > 0 ? (
            <Card className="border-[#E5E2DC]"><Table>
              <TableHeader><TableRow className="border-[#E5E2DC]">
                <TableHead style={{ color: "#5C5F5C" }}>Date</TableHead>
                <TableHead style={{ color: "#5C5F5C" }}>Total Sales</TableHead>
                <TableHead style={{ color: "#5C5F5C" }}>Cash</TableHead>
                <TableHead style={{ color: "#5C5F5C" }}>Card</TableHead>
                <TableHead style={{ color: "#5C5F5C" }}>Online</TableHead>
                <TableHead style={{ color: "#5C5F5C" }}>Expenses</TableHead>
                <TableHead style={{ color: "#5C5F5C" }}>Net</TableHead>
                <TableHead style={{ color: "#5C5F5C" }}>Orders</TableHead>
                <TableHead style={{ color: "#5C5F5C" }}>Top Item</TableHead>
                {isAdmin && <TableHead style={{ color: "#5C5F5C" }}>Send</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {history.map((r, idx) => (
                  <TableRow key={idx} className="border-[#E5E2DC]">
                    <TableCell className="font-medium" style={{ color: "#1A1D1A" }}>{r.date}</TableCell>
                    <TableCell className="font-bold" style={{ color: "#1E3F20" }}>{r.total_sales?.toFixed(2)}</TableCell>
                    <TableCell>{r.cash_sales?.toFixed(2)}</TableCell>
                    <TableCell style={{ color: "#C05746" }}>{r.credit_sales?.toFixed(2)}</TableCell>
                    <TableCell style={{ color: "#D70F64" }}>{r.online_sales?.toFixed(2)}</TableCell>
                    <TableCell style={{ color: "#A63D31" }}>{r.total_expenses?.toFixed(2)}</TableCell>
                    <TableCell className="font-bold" style={{ color: "#1E3F20" }}>{r.net_revenue?.toFixed(2)}</TableCell>
                    <TableCell>{r.total_orders}</TableCell>
                    <TableCell><Badge className="text-xs" style={{ background: "#EAF4EB", color: "#1E3F20", border: "none" }}>{r.top_items?.[0]?.name || "-"} ({r.top_items?.[0]?.quantity || 0})</Badge></TableCell>
                    {isAdmin && <TableCell>
                      <button data-testid={`email-history-${r.date}`} onClick={() => emailReport("Z", r.date)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }} title="Email this report">
                        <Mail className="w-4 h-4" />
                      </button>
                    </TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table></Card>
          ) : <Card className="border-[#E5E2DC]"><CardContent className="flex flex-col items-center py-16"><History className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm" style={{ color: "#5C5F5C" }}>Select dates and click Load History</p></CardContent></Card>}
        </TabsContent>}
      </Tabs>

      <AlertDialog open={closeConfirm} onOpenChange={setCloseConfirm}>
        <AlertDialogContent className="border-[#E5E2DC]"><AlertDialogHeader><AlertDialogTitle>Close Day?</AlertDialogTitle><AlertDialogDescription>Archive today's Z Report. This can only be done once per day.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="border-[#E5E2DC]">Cancel</AlertDialogCancel><AlertDialogAction data-testid="confirm-close-day-btn" onClick={closeZReport} className="text-white" style={{ background: "#C05746" }}>Close Day</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
