import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Users, Pencil, Trash2, Shield, Percent, Save, UserPlus, Store, DollarSign, HardDrive, Download, Mail, Send, Plus, Clock, MessageCircle, QrCode, RefreshCw, PlayCircle, Globe, Copy, ExternalLink, Printer, Type, Image as ImageIcon, UploadCloud, Trash } from "lucide-react";
import { toast } from "sonner";
import ReceiptModal from "../../components/legacy/ReceiptModal";
import { resolveImageUrl } from "../../lib/api";
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
function BrandingCard({ currentLogo, onSaved }) {
  const [preview, setPreview] = useState(currentLogo || "");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { setPreview(currentLogo || ""); }, [currentLogo]);

  // Path B backend strips restaurant_logo from /api/settings response.
  // Load the current saved logo from the small dedicated endpoint so the
  // preview shows what's actually saved in the DB.
  useEffect(() => {
    if (currentLogo) return;
    let cancelled = false;
    axios.get(`${API}/settings/logo`, { withCredentials: true })
      .then(({ data }) => { if (!cancelled) setPreview(data.restaurant_logo || ""); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentLogo]);

  const readFile = (file) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file"));
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) return reject(new Error("Only PNG / JPG / WebP images"));
    if (file.size > 600 * 1024) return reject(new Error("Image too large (max 600 KB — compress or resize)"));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Read failed"));
    r.readAsDataURL(file);
  });

  const handleFile = async (file) => {
    try {
      const dataUrl = await readFile(file);
      setPreview(dataUrl);
    } catch (err) { toast.error(err.message); }
  };

  const saveLogo = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, { restaurant_logo: preview || "" }, { withCredentials: true });
      toast.success("Logo saved");
      onSaved && onSaved();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save logo"); }
    finally { setSaving(false); }
  };

  const removeLogo = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, { restaurant_logo: "" }, { withCredentials: true });
      setPreview("");
      toast.success("Logo removed");
      onSaved && onSaved();
    } catch (err) { toast.error("Failed to remove logo"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="border-[#E5E2DC]" data-testid="branding-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
          <ImageIcon className="w-5 h-5" style={{ color: "#1E3F20" }} /> Custom Logo / Branding
        </CardTitle>
        <p className="text-xs" style={{ color: "#5C5F5C" }}>Shows in sidebar and printed on every receipt. PNG, JPG or WebP. Max 600 KB.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop zone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
          }}
          className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors"
          style={{ borderColor: dragOver ? "#1E3F20" : "#E5E2DC", background: dragOver ? "#EAF4EB" : "#F9F8F6" }}
          data-testid="logo-dropzone"
        >
          {preview ? (
            <img src={resolveImageUrl(preview)} alt="Logo preview" style={{ maxWidth: "140px", maxHeight: "140px" }} data-testid="logo-preview" />
          ) : (
            <>
              <UploadCloud className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-medium" style={{ color: "#1A1D1A" }}>Drag & drop logo here</p>
              <p className="text-xs" style={{ color: "#5C5F5C" }}>or click to browse</p>
            </>
          )}
          <input
            data-testid="logo-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </label>

        <div className="flex gap-2">
          <Button data-testid="save-logo-btn" onClick={saveLogo} disabled={saving || !preview || preview === currentLogo} className="flex-1 flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}>
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Logo"}
          </Button>
          {currentLogo && (
            <Button data-testid="remove-logo-btn" onClick={removeLogo} disabled={saving} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]" style={{ color: "#A63D31" }}>
              <Trash className="w-4 h-4" /> Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const ALL_PERMS = [
  // --- POS Operations ---
  { key: "dashboard", label: "Dashboard" },
  { key: "pos", label: "POS / Sales" },
  { key: "menu", label: "Menu Management" },
  { key: "menu_edit", label: "Edit Menu / Drag-Reorder" },
  { key: "inventory", label: "Inventory" },
  { key: "vendors", label: "Vendors" },
  { key: "expenses", label: "Expenses" },
  { key: "reports_x", label: "X Report (Mid-day)" },
  { key: "reports_z", label: "Z Report (End-of-day)" },
  { key: "orders_history", label: "Old Orders / Reprint" },
  { key: "reprint_invoices", label: "Reprint Invoices" },
  { key: "refunds", label: "Refunds" },
  { key: "settings", label: "Settings" },
  // --- Online Store (each toggleable independently) ---
  { key: "online_dashboard", label: "Online — Dashboard" },
  { key: "online_orders", label: "Online — Orders" },
  { key: "online_menu", label: "Online — Menu & Categories" },
  { key: "online_offers", label: "Online — Offers" },
  { key: "online_events", label: "Online — Events" },
  { key: "online_settings", label: "Online — Settings / Reviews / Loyalty" },
];

export default function SettingsPage() {
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "cashier", permissions: ["pos"] });
  const [deleteUserConfirm, setDeleteUserConfirm] = useState({ open: false, id: "", name: "" });
  const [settingsForm, setSettingsForm] = useState({ tax_rate: "8", online_tax_rate: "0", foodpanda1_tax_rate: "0", foodpanda2_tax_rate: "0", currency: "Rs", restaurant_name: "", restaurant_address: "", restaurant_phone: "", restaurant_email: "" });
  // Email config
  const [emailForm, setEmailForm] = useState({ smtp_host: "smtp.gmail.com", smtp_port: "587", smtp_user: "", smtp_password: "", smtp_from: "", smtp_use_tls: true, auto_email_on_z_close: false });
  const [recipients, setRecipients] = useState([]);
  const [newRecipient, setNewRecipient] = useState({ name: "", email: "", receive_x: true, receive_z: true });
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  // Schedule
  const [scheduleForm, setScheduleForm] = useState({ daily_report_time: "02:15", daily_report_timezone: "Asia/Karachi", auto_email_daily: false, auto_whatsapp_daily: false, daily_report_type: "yesterday" });
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [tzList, setTzList] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  // WhatsApp
  const [waRecipients, setWaRecipients] = useState([]);
  const [newWaRecipient, setNewWaRecipient] = useState({ name: "", phone: "", receive_x: true, receive_z: true });
  const [waStatus, setWaStatus] = useState(null);
  const [waQr, setWaQr] = useState(null);
  const [waQrOpen, setWaQrOpen] = useState(false);
  const [waTestPhone, setWaTestPhone] = useState("");
  const [savingWa, setSavingWa] = useState(false);
  const [testingWa, setTestingWa] = useState(false);
  const [autoWaOnZ, setAutoWaOnZ] = useState(false);
  // Remote Access (Cloudflare Tunnel)
  const [tunnel, setTunnel] = useState(null);
  const [tunnelNotify, setTunnelNotify] = useState(true);
  // Receipt customization
  const [receiptForm, setReceiptForm] = useState({
    receipt_font_family: "Courier New",
    receipt_base_size: 12,
    receipt_header_size: 16,
    receipt_total_size: 16,
    receipt_bold_all: false,
    receipt_bold_total: true,
    receipt_show_tax_line: true,
    receipt_footer_text: "Thank you for your order!",
    receipt_paper_width: 300,
  });
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Data management
  const [dataStats, setDataStats] = useState(null);
  const [deleteBeforeDate, setDeleteBeforeDate] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef(null);

  const fetchUsers = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/users`, { withCredentials: true }); setUsers(data); } catch {} finally { setLoadingUsers(false); }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/settings`, { withCredentials: true });
      setSettings(data);
      setSettingsForm({ tax_rate: String(data.tax_rate ?? 5), online_tax_rate: String(data.online_tax_rate || 0), foodpanda1_tax_rate: String(data.foodpanda1_tax_rate != null ? data.foodpanda1_tax_rate : (data.online_tax_rate || 0)), foodpanda2_tax_rate: String(data.foodpanda2_tax_rate != null ? data.foodpanda2_tax_rate : (data.online_tax_rate || 0)), currency: data.currency || "Rs", restaurant_name: data.restaurant_name || "", restaurant_address: data.restaurant_address || "", restaurant_phone: data.restaurant_phone || "", restaurant_email: data.restaurant_email || "" });
      setEmailForm({
        smtp_host: data.smtp_host || "smtp.gmail.com",
        smtp_port: String(data.smtp_port || 587),
        smtp_user: data.smtp_user || "",
        smtp_password: data.smtp_password || "",
        smtp_from: data.smtp_from || "",
        smtp_use_tls: data.smtp_use_tls !== false,
        auto_email_on_z_close: !!data.auto_email_on_z_close,
      });
      setRecipients(Array.isArray(data.email_recipients) ? data.email_recipients : []);
      if (!testEmailTo && data.smtp_user) setTestEmailTo(data.smtp_user);
      // Schedule
      setScheduleForm({
        daily_report_time: data.daily_report_time || "02:15",
        daily_report_timezone: data.daily_report_timezone || "Asia/Karachi",
        auto_email_daily: !!data.auto_email_daily,
        auto_whatsapp_daily: !!data.auto_whatsapp_daily,
        daily_report_type: data.daily_report_type || "yesterday",
      });
      // WhatsApp
      setWaRecipients(Array.isArray(data.whatsapp_recipients) ? data.whatsapp_recipients : []);
      setAutoWaOnZ(!!data.auto_whatsapp_on_z_close);
      setTunnelNotify(data.tunnel_notify_on_change !== false);
      setReceiptForm({
        receipt_font_family: data.receipt_font_family || "Courier New",
        receipt_base_size: data.receipt_base_size || 12,
        receipt_header_size: data.receipt_header_size || 16,
        receipt_total_size: data.receipt_total_size || 16,
        receipt_bold_all: !!data.receipt_bold_all,
        receipt_bold_total: data.receipt_bold_total !== false,
        receipt_show_tax_line: data.receipt_show_tax_line !== false,
        receipt_footer_text: data.receipt_footer_text || "Thank you for your order!",
        receipt_paper_width: data.receipt_paper_width || 300,
      });
    } catch {} finally { setLoadingSettings(false); }
  }, [testEmailTo]);

  const fetchDataStats = async () => {
    try { const { data } = await axios.get(`${API}/data/stats`, { withCredentials: true }); setDataStats(data); } catch {}
  };

  const exportAllData = async () => {
    setExporting(true);
    try {
      const { data } = await axios.get(`${API}/data/export`, { withCredentials: true });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `restopos_backup_${new Date().toISOString().split("T")[0]}.json`; a.style.display = "none";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.success("Data exported! Save this file to your external drive.");
    } catch { toast.error("Failed to export"); }
    finally { setExporting(false); }
  };

  const deleteOldData = async () => {
    setDeleteConfirm(false); setDeleting(true);
    try {
      const { data } = await axios.post(`${API}/data/delete`, { before_date: deleteBeforeDate, collections: ["orders", "z_reports", "expenses", "vendor_transactions", "vendor_payments"] }, { withCredentials: true });
      const total = Object.values(data.deleted).reduce((s, v) => s + v, 0);
      toast.success(`Deleted ${total} records`);
      fetchDataStats();
    } catch { toast.error("Failed to delete"); }
    finally { setDeleting(false); }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const { data: result } = await axios.post(`${API}/data/import`, data, { withCredentials: true });
      const total = Object.values(result.imported).reduce((s, v) => s + v, 0);
      toast.success(`Imported ${total} records from backup`);
      fetchDataStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to import - check file format");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API}/settings`, { tax_rate: parseFloat(settingsForm.tax_rate) || 0, online_tax_rate: parseFloat(settingsForm.online_tax_rate) || 0, foodpanda1_tax_rate: parseFloat(settingsForm.foodpanda1_tax_rate) || 0, foodpanda2_tax_rate: parseFloat(settingsForm.foodpanda2_tax_rate) || 0, currency: settingsForm.currency, restaurant_name: settingsForm.restaurant_name, restaurant_address: settingsForm.restaurant_address, restaurant_phone: settingsForm.restaurant_phone, restaurant_email: settingsForm.restaurant_email }, { withCredentials: true });
      toast.success("Settings saved!");
      fetchSettings();
    } catch (err) { toast.error("Failed to save"); }
    finally { setSavingSettings(false); }
  };

  const saveEmailConfig = async () => {
    setSavingEmail(true);
    try {
      await axios.put(`${API}/settings`, {
        smtp_host: emailForm.smtp_host,
        smtp_port: parseInt(emailForm.smtp_port) || 587,
        smtp_user: emailForm.smtp_user,
        smtp_password: emailForm.smtp_password,
        smtp_from: emailForm.smtp_from,
        smtp_use_tls: !!emailForm.smtp_use_tls,
        auto_email_on_z_close: !!emailForm.auto_email_on_z_close,
        email_recipients: recipients,
      }, { withCredentials: true });
      toast.success("Email settings saved!");
      fetchSettings();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save"); }
    finally { setSavingEmail(false); }
  };

  const sendTestEmail = async () => {
    if (!testEmailTo.trim()) { toast.error("Enter a test recipient email"); return; }
    setTestingEmail(true);
    try {
      // Save SMTP first so backend uses latest
      await axios.put(`${API}/settings`, {
        smtp_host: emailForm.smtp_host,
        smtp_port: parseInt(emailForm.smtp_port) || 587,
        smtp_user: emailForm.smtp_user,
        smtp_password: emailForm.smtp_password,
        smtp_from: emailForm.smtp_from,
        smtp_use_tls: !!emailForm.smtp_use_tls,
      }, { withCredentials: true });
      const { data } = await axios.post(`${API}/email/test`, { to: testEmailTo.trim() }, { withCredentials: true });
      toast.success(data.message || "Test email sent!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to send test email");
    } finally { setTestingEmail(false); }
  };

  const addRecipient = () => {
    if (!newRecipient.name.trim() || !newRecipient.email.trim()) { toast.error("Name and email required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newRecipient.email.trim())) { toast.error("Invalid email format"); return; }
    if (recipients.some((r) => r.email.toLowerCase() === newRecipient.email.trim().toLowerCase())) { toast.error("Recipient already exists"); return; }
    setRecipients([...recipients, { ...newRecipient, email: newRecipient.email.trim(), name: newRecipient.name.trim() }]);
    setNewRecipient({ name: "", email: "", receive_x: true, receive_z: true });
  };

  const removeRecipient = (email) => {
    setRecipients(recipients.filter((r) => r.email !== email));
  };

  const toggleRecipientField = (email, field) => {
    setRecipients(recipients.map((r) => r.email === email ? { ...r, [field]: !r[field] } : r));
  };

  // --- Schedule helpers ---
  const fetchScheduleStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/schedule/status`, { withCredentials: true });
      setScheduleStatus(data);
    } catch {}
  }, []);

  const fetchTimezones = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/schedule/timezones`, { withCredentials: true });
      setTzList(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const saveSchedule = async () => {
    if (!/^\d{1,2}:\d{2}$/.test(scheduleForm.daily_report_time)) { toast.error("Time must be HH:MM"); return; }
    setSavingSchedule(true);
    try {
      await axios.put(`${API}/settings`, {
        daily_report_time: scheduleForm.daily_report_time,
        daily_report_timezone: scheduleForm.daily_report_timezone,
        auto_email_daily: !!scheduleForm.auto_email_daily,
        auto_whatsapp_daily: !!scheduleForm.auto_whatsapp_daily,
        daily_report_type: scheduleForm.daily_report_type,
      }, { withCredentials: true });
      toast.success("Schedule saved!");
      fetchScheduleStatus();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSavingSchedule(false); }
  };

  const runScheduleNow = async () => {
    try {
      await axios.post(`${API}/schedule/run-now`, {}, { withCredentials: true });
      toast.success("Daily report job triggered. Check your inbox/WhatsApp.");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  // --- WhatsApp helpers ---
  const fetchWaStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/whatsapp/status`, { withCredentials: true });
      setWaStatus(data);
    } catch (err) {
      setWaStatus({ ready: false, error: "Service unreachable" });
    }
  }, []);

  // --- Tunnel (Remote Access) fetch (declared before useEffect to avoid TDZ) ---
  const fetchTunnelStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/tunnel/status`, { withCredentials: true });
      setTunnel(data);
    } catch {}
  }, []);

  useEffect(() => { fetchUsers(); fetchSettings(); fetchDataStats(); fetchScheduleStatus(); fetchTimezones(); fetchWaStatus(); fetchTunnelStatus(); }, [fetchUsers, fetchSettings, fetchScheduleStatus, fetchTimezones, fetchWaStatus, fetchTunnelStatus]);
  // Poll tunnel status every 20s
  useEffect(() => { const id = setInterval(() => { fetchTunnelStatus(); }, 20000); return () => clearInterval(id); }, [fetchTunnelStatus]);

  const openQrDialog = async () => {
    setWaQrOpen(true);
    setWaQr(null);
    try {
      const { data } = await axios.get(`${API}/whatsapp/qr`, { withCredentials: true });
      setWaQr(data?.qr || null);
      if (data?.ready) toast.success("WhatsApp already connected");
    } catch (err) {
      toast.error(err.response?.data?.detail || "QR not available yet");
    }
  };

  const refreshQr = async () => {
    setWaQr(null);
    try {
      const { data } = await axios.get(`${API}/whatsapp/qr`, { withCredentials: true });
      setWaQr(data?.qr || null);
      fetchWaStatus();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const resetWa = async () => {
    try {
      await axios.post(`${API}/whatsapp/reset`, {}, { withCredentials: true });
      toast.success("Reset. New QR will appear shortly.");
      setTimeout(refreshQr, 2500);
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const addWaRecipient = () => {
    if (!newWaRecipient.name.trim() || !newWaRecipient.phone.trim()) { toast.error("Name and phone required"); return; }
    const phone = newWaRecipient.phone.trim();
    if (!/^\+?\d{8,15}$/.test(phone.replace(/\s/g, ""))) { toast.error("Phone must include country code, e.g., +923004928411"); return; }
    if (waRecipients.some((r) => r.phone === phone)) { toast.error("Already added"); return; }
    setWaRecipients([...waRecipients, { ...newWaRecipient, phone, name: newWaRecipient.name.trim() }]);
    setNewWaRecipient({ name: "", phone: "", receive_x: true, receive_z: true });
  };

  const removeWaRecipient = (phone) => setWaRecipients(waRecipients.filter((r) => r.phone !== phone));
  const toggleWaField = (phone, field) => setWaRecipients(waRecipients.map((r) => r.phone === phone ? { ...r, [field]: !r[field] } : r));

  const saveWaConfig = async () => {
    setSavingWa(true);
    try {
      await axios.put(`${API}/settings`, { whatsapp_recipients: waRecipients, auto_whatsapp_on_z_close: !!autoWaOnZ }, { withCredentials: true });
      toast.success("WhatsApp settings saved!");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setSavingWa(false); }
  };

  const sendTestWa = async () => {
    if (!waTestPhone.trim()) { toast.error("Enter a phone number"); return; }
    setTestingWa(true);
    try {
      const { data } = await axios.post(`${API}/whatsapp/test`, { to: waTestPhone.trim() }, { withCredentials: true });
      toast.success(data.message || "Sent");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    finally { setTestingWa(false); }
  };

  // --- Tunnel (Remote Access) helpers ---
  const refreshTunnel = async () => {
    try {
      const { data } = await axios.post(`${API}/tunnel/refresh`, {}, { withCredentials: true });
      setTunnel((t) => ({ ...(t || {}), url: data.url, log_path: data.log_path }));
      toast.success(data.url ? `Latest URL: ${data.url}` : "No URL detected yet");
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const saveTunnelNotify = async (val) => {
    setTunnelNotify(val);
    try {
      await axios.put(`${API}/settings`, { tunnel_notify_on_change: !!val }, { withCredentials: true });
      toast.success("Saved");
    } catch (err) { toast.error("Failed to save"); }
  };

  const copyTunnelUrl = async () => {
    if (!tunnel?.url) return;
    try {
      await navigator.clipboard.writeText(tunnel.url);
      toast.success("URL copied to clipboard");
    } catch { toast.error("Could not copy"); }
  };

  // --- Receipt customization ---
  const saveReceipt = async () => {
    setSavingReceipt(true);
    try {
      await axios.put(`${API}/settings`, {
        receipt_font_family: receiptForm.receipt_font_family,
        receipt_base_size: parseInt(receiptForm.receipt_base_size) || 12,
        receipt_header_size: parseInt(receiptForm.receipt_header_size) || 16,
        receipt_total_size: parseInt(receiptForm.receipt_total_size) || 16,
        receipt_bold_all: !!receiptForm.receipt_bold_all,
        receipt_bold_total: !!receiptForm.receipt_bold_total,
        receipt_show_tax_line: !!receiptForm.receipt_show_tax_line,
        receipt_footer_text: receiptForm.receipt_footer_text,
        receipt_paper_width: parseInt(receiptForm.receipt_paper_width) || 300,
      }, { withCredentials: true });
      toast.success("Receipt settings saved!");
      fetchSettings();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to save"); }
    finally { setSavingReceipt(false); }
  };

  // Sample order for preview
  const sampleOrder = {
    id: "preview123abc",
    cashier_name: "Admin",
    payment_type: "cash",
    items: [
      { name: "Chicken Biryani", price: 350, quantity: 2 },
      { name: "Murg Pulao", price: 400, quantity: 1 },
      { name: "Coke 500ml", price: 80, quantity: 2 },
    ],
    subtotal: 1260,
    tax: 100.8,
    discount_amount: 0,
    total: 1360.8,
    created_at: new Date().toISOString(),
  };

  const togglePerm = (perm) => {
    setUserForm((prev) => {
      const perms = prev.permissions.includes(perm) ? prev.permissions.filter((p) => p !== perm) : [...prev.permissions, perm];
      return { ...prev, permissions: perms };
    });
  };

  const openCreateUser = () => { setEditingUser(null); setUserForm({ name: "", email: "", password: "", role: "cashier", permissions: ["pos"] }); setUserDialog(true); };
  const openEditUser = (u) => { setEditingUser(u); setUserForm({ name: u.name, email: u.email, password: "", role: u.role, permissions: u.permissions || [] }); setUserDialog(true); };

  const saveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) { toast.error("Name and email required"); return; }
    if (!editingUser && !userForm.password.trim()) { toast.error("Password required"); return; }
    try {
      if (editingUser) {
        const payload = { name: userForm.name, role: userForm.role, permissions: userForm.permissions };
        if (userForm.password.trim()) payload.password = userForm.password;
        await axios.put(`${API}/users/${editingUser.id}`, payload, { withCredentials: true });
        toast.success("User updated");
      } else {
        await axios.post(`${API}/users`, { email: userForm.email, password: userForm.password, name: userForm.name, role: userForm.role, permissions: userForm.permissions }, { withCredentials: true });
        toast.success("User created");
      }
      setUserDialog(false); fetchUsers();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  const deleteUser = async () => {
    const { id } = deleteUserConfirm;
    setDeleteUserConfirm({ open: false, id: "", name: "" });
    try { await axios.delete(`${API}/users/${id}`, { withCredentials: true }); toast.success("User deleted"); fetchUsers(); }
    catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="settings-page">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "#5C5F5C" }}>Manage users, permissions, taxes, currency & restaurant info</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-[#F9F8F6] border border-[#E5E2DC] flex-wrap">
          <TabsTrigger value="users" data-testid="tab-users" className="data-[state=active]:bg-white"><Users className="w-4 h-4 mr-2" /> Users</TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-tax" className="data-[state=active]:bg-white"><Percent className="w-4 h-4 mr-2" /> Tax & Currency</TabsTrigger>
          <TabsTrigger value="restaurant" data-testid="tab-restaurant" className="data-[state=active]:bg-white"><Store className="w-4 h-4 mr-2" /> Restaurant Info</TabsTrigger>
          <TabsTrigger value="email" data-testid="tab-email" className="data-[state=active]:bg-white"><Mail className="w-4 h-4 mr-2" /> Email</TabsTrigger>
          <TabsTrigger value="schedule" data-testid="tab-schedule" className="data-[state=active]:bg-white"><Clock className="w-4 h-4 mr-2" /> Schedule</TabsTrigger>
          <TabsTrigger value="whatsapp" data-testid="tab-whatsapp" className="data-[state=active]:bg-white"><MessageCircle className="w-4 h-4 mr-2" /> WhatsApp</TabsTrigger>
          <TabsTrigger value="remote" data-testid="tab-remote" className="data-[state=active]:bg-white"><Globe className="w-4 h-4 mr-2" /> Remote Access</TabsTrigger>
          <TabsTrigger value="receipt" data-testid="tab-receipt" className="data-[state=active]:bg-white"><Printer className="w-4 h-4 mr-2" /> Receipt</TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data" className="data-[state=active]:bg-white"><HardDrive className="w-4 h-4 mr-2" /> Data Management</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="flex justify-end mb-4">
            <Button data-testid="add-user-btn" onClick={openCreateUser} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><UserPlus className="w-4 h-4" /> Add User</Button>
          </div>
          <Card className="border-[#E5E2DC]"><Table>
            <TableHeader><TableRow className="border-[#E5E2DC]">
              <TableHead style={{ color: "#5C5F5C" }}>Name</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Email</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Role</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Permissions</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} data-testid={`user-row-${u.id}`} className="border-[#E5E2DC]">
                  <TableCell className="font-medium" style={{ color: "#1A1D1A" }}>{u.name}</TableCell>
                  <TableCell style={{ color: "#5C5F5C" }}>{u.email}</TableCell>
                  <TableCell><Badge className="text-xs capitalize" style={{ background: u.role === "admin" ? "#EAF4EB" : "#FDF2E9", color: u.role === "admin" ? "#1E3F20" : "#D97736", border: "none" }}><Shield className="w-3 h-3 mr-1" />{u.role}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(u.permissions || []).map((p) => <Badge key={p} className="text-[10px]" style={{ background: "#EAF4EB", color: "#1E3F20", border: "none" }}>{ALL_PERMS.find((x) => x.key === p)?.label || p}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button data-testid={`edit-user-${u.id}`} onClick={() => openEditUser(u)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#EAF4EB]" style={{ color: "#1E3F20" }}><Pencil className="w-4 h-4" /></button>
                      <button data-testid={`delete-user-${u.id}`} onClick={() => setDeleteUserConfirm({ open: true, id: u.id, name: u.name })} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></Card>
        </TabsContent>

        {/* Tax & Currency */}
        <TabsContent value="tax">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-[#E5E2DC]"><CardHeader><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}><Percent className="w-5 h-5" style={{ color: "#D97736" }} /> Restaurant Tax Rate</CardTitle></CardHeader>
              <CardContent><div className="space-y-2"><Label>Tax (%)</Label><div className="flex gap-2"><Input data-testid="tax-rate-input" type="number" step="0.1" min="0" max="100" value={settingsForm.tax_rate} onChange={(e) => setSettingsForm({...settingsForm, tax_rate: e.target.value})} className="border-[#E5E2DC] text-lg font-bold" /><span className="flex items-center text-sm font-bold" style={{ color: "#5C5F5C" }}>%</span></div>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>Applied to Cash & Card sales</p></div></CardContent></Card>
            <Card className="border-[#E5E2DC]"><CardHeader><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}><Percent className="w-5 h-5" style={{ color: "#D70F64" }} /> FoodPanda 1 Commission</CardTitle></CardHeader>
              <CardContent><div className="space-y-2"><Label>FP1 Commission (%)</Label><div className="flex gap-2"><Input data-testid="fp1-tax-input" type="number" step="0.1" min="0" max="100" value={settingsForm.foodpanda1_tax_rate} onChange={(e) => setSettingsForm({...settingsForm, foodpanda1_tax_rate: e.target.value})} className="border-[#E5E2DC] text-lg font-bold" /><span className="flex items-center text-sm font-bold" style={{ color: "#5C5F5C" }}>%</span></div>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>Deducted from FoodPanda 1 sales</p></div></CardContent></Card>
            <Card className="border-[#E5E2DC]"><CardHeader><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}><Percent className="w-5 h-5" style={{ color: "#D70F64" }} /> FoodPanda 2 Commission</CardTitle></CardHeader>
              <CardContent><div className="space-y-2"><Label>FP2 Commission (%)</Label><div className="flex gap-2"><Input data-testid="fp2-tax-input" type="number" step="0.1" min="0" max="100" value={settingsForm.foodpanda2_tax_rate} onChange={(e) => setSettingsForm({...settingsForm, foodpanda2_tax_rate: e.target.value})} className="border-[#E5E2DC] text-lg font-bold" /><span className="flex items-center text-sm font-bold" style={{ color: "#5C5F5C" }}>%</span></div>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>Deducted from FoodPanda 2 sales</p></div></CardContent></Card>
            <Card className="border-[#E5E2DC]"><CardHeader><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}><DollarSign className="w-5 h-5" style={{ color: "#1E3F20" }} /> Currency</CardTitle></CardHeader>
              <CardContent><div className="space-y-2"><Label>Currency Symbol</Label><Input data-testid="currency-input" placeholder="Rs, $, £" value={settingsForm.currency} onChange={(e) => setSettingsForm({...settingsForm, currency: e.target.value})} className="border-[#E5E2DC] text-lg font-bold" />
                <p className="text-xs" style={{ color: "#5C5F5C" }}>e.g., Rs for Rupees, £ for Pounds, $ for Dollars</p></div></CardContent></Card>
          </div>
          <div className="mt-4"><Button data-testid="save-tax-btn" onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><Save className="w-4 h-4" /> {savingSettings ? "Saving..." : "Save All Settings"}</Button></div>
        </TabsContent>

        {/* Restaurant Info */}
        <TabsContent value="restaurant">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            <Card className="border-[#E5E2DC]"><CardHeader><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}><Store className="w-5 h-5" style={{ color: "#1E3F20" }} /> Restaurant Details</CardTitle><p className="text-xs" style={{ color: "#5C5F5C" }}>Shows on receipts</p></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1"><Label>Restaurant Name</Label><Input data-testid="rest-name-input" value={settingsForm.restaurant_name} onChange={(e) => setSettingsForm({...settingsForm, restaurant_name: e.target.value})} className="border-[#E5E2DC]" /></div>
                <div className="space-y-1"><Label>Address</Label><Input data-testid="rest-address-input" value={settingsForm.restaurant_address} onChange={(e) => setSettingsForm({...settingsForm, restaurant_address: e.target.value})} className="border-[#E5E2DC]" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Phone</Label><Input data-testid="rest-phone-input" value={settingsForm.restaurant_phone} onChange={(e) => setSettingsForm({...settingsForm, restaurant_phone: e.target.value})} className="border-[#E5E2DC]" /></div>
                  <div className="space-y-1"><Label>Email</Label><Input data-testid="rest-email-input" value={settingsForm.restaurant_email} onChange={(e) => setSettingsForm({...settingsForm, restaurant_email: e.target.value})} className="border-[#E5E2DC]" /></div>
                </div>
                <Button data-testid="save-restaurant-btn" onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><Save className="w-4 h-4" /> {savingSettings ? "Saving..." : "Save"}</Button>
              </CardContent>
            </Card>

            <BrandingCard currentLogo={settings?.restaurant_logo} onSaved={fetchSettings} />
          </div>
        </TabsContent>

        {/* Data Management */}
        <TabsContent value="email">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SMTP Configuration */}
            <Card className="border-[#E5E2DC]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
                  <Mail className="w-5 h-5" style={{ color: "#1E3F20" }} /> SMTP Server
                </CardTitle>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>
                  Configure your email server. For Gmail, use an{" "}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#1E3F20" }}>App Password</a>.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label>SMTP Host</Label>
                    <Input data-testid="smtp-host-input" placeholder="smtp.gmail.com" value={emailForm.smtp_host} onChange={(e) => setEmailForm({ ...emailForm, smtp_host: e.target.value })} className="border-[#E5E2DC]" />
                  </div>
                  <div className="space-y-1">
                    <Label>Port</Label>
                    <Input data-testid="smtp-port-input" type="number" placeholder="587" value={emailForm.smtp_port} onChange={(e) => setEmailForm({ ...emailForm, smtp_port: e.target.value })} className="border-[#E5E2DC]" />
                  </div>
                  <div className="space-y-1 flex items-end">
                    <label className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E2DC] cursor-pointer w-full" data-testid="smtp-tls-toggle">
                      <Checkbox checked={emailForm.smtp_use_tls} onCheckedChange={(v) => setEmailForm({ ...emailForm, smtp_use_tls: !!v })} />
                      <span className="text-sm">Use TLS</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>SMTP Username (your email)</Label>
                  <Input data-testid="smtp-user-input" type="email" placeholder="you@gmail.com" value={emailForm.smtp_user} onChange={(e) => setEmailForm({ ...emailForm, smtp_user: e.target.value })} className="border-[#E5E2DC]" />
                </div>
                <div className="space-y-1">
                  <Label>SMTP Password / App Password</Label>
                  <Input data-testid="smtp-password-input" type="password" placeholder="••••••••" value={emailForm.smtp_password} onChange={(e) => setEmailForm({ ...emailForm, smtp_password: e.target.value })} className="border-[#E5E2DC]" />
                </div>
                <div className="space-y-1">
                  <Label>From Address (optional)</Label>
                  <Input data-testid="smtp-from-input" type="email" placeholder="Defaults to username" value={emailForm.smtp_from} onChange={(e) => setEmailForm({ ...emailForm, smtp_from: e.target.value })} className="border-[#E5E2DC]" />
                </div>

                <Separator />

                <label className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E2DC] cursor-pointer" data-testid="auto-email-z-toggle">
                  <Checkbox checked={emailForm.auto_email_on_z_close} onCheckedChange={(v) => setEmailForm({ ...emailForm, auto_email_on_z_close: !!v })} />
                  <div>
                    <span className="text-sm font-medium block" style={{ color: "#1A1D1A" }}>Auto-email Z-report when closed</span>
                    <span className="text-xs" style={{ color: "#5C5F5C" }}>Sends to all recipients automatically at end of day</span>
                  </div>
                </label>

                <div className="flex gap-2 pt-2">
                  <Button data-testid="save-email-btn" onClick={saveEmailConfig} disabled={savingEmail} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}>
                    <Save className="w-4 h-4" /> {savingEmail ? "Saving..." : "Save"}
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Send Test Email</Label>
                  <div className="flex gap-2">
                    <Input data-testid="test-email-to-input" type="email" placeholder="test@example.com" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} className="border-[#E5E2DC] flex-1" />
                    <Button data-testid="send-test-email-btn" onClick={sendTestEmail} disabled={testingEmail} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]">
                      <Send className="w-4 h-4" /> {testingEmail ? "Sending..." : "Test"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recipients List */}
            <Card className="border-[#E5E2DC]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
                  <Users className="w-5 h-5" style={{ color: "#1E3F20" }} /> Report Recipients
                </CardTitle>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>People who receive X / Z report emails. Toggle which type each person gets.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add new recipient */}
                <div className="p-3 rounded-lg border border-dashed border-[#E5E2DC] space-y-2" style={{ background: "#F9F8F6" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <Input data-testid="new-recipient-name" placeholder="Name (e.g., Owner)" value={newRecipient.name} onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })} className="border-[#E5E2DC]" />
                    <Input data-testid="new-recipient-email" type="email" placeholder="email@example.com" value={newRecipient.email} onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })} className="border-[#E5E2DC]" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-3 text-xs">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox data-testid="new-recipient-x" checked={newRecipient.receive_x} onCheckedChange={(v) => setNewRecipient({ ...newRecipient, receive_x: !!v })} /> X
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox data-testid="new-recipient-z" checked={newRecipient.receive_z} onCheckedChange={(v) => setNewRecipient({ ...newRecipient, receive_z: !!v })} /> Z
                      </label>
                    </div>
                    <Button data-testid="add-recipient-btn" onClick={addRecipient} size="sm" className="text-white" style={{ background: "#1E3F20" }}>
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>

                {recipients.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: "#5C5F5C" }}>No recipients yet. Add one above.</p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map((r) => (
                      <div key={r.email} data-testid={`recipient-${r.email}`} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[#E5E2DC]">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#1A1D1A" }}>{r.name}</p>
                          <p className="text-xs truncate" style={{ color: "#5C5F5C" }}>{r.email}</p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <Checkbox data-testid={`recipient-x-${r.email}`} checked={r.receive_x !== false} onCheckedChange={() => toggleRecipientField(r.email, "receive_x")} /> X
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <Checkbox data-testid={`recipient-z-${r.email}`} checked={r.receive_z !== false} onCheckedChange={() => toggleRecipientField(r.email, "receive_z")} /> Z
                          </label>
                        </div>
                        <button data-testid={`remove-recipient-${r.email}`} onClick={() => removeRecipient(r.email)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs italic" style={{ color: "#5C5F5C" }}>Click "Save" on the SMTP card to persist recipient changes.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Schedule */}
        <TabsContent value="schedule">
          <Card className="border-[#E5E2DC] max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
                <Clock className="w-5 h-5" style={{ color: "#1E3F20" }} /> Daily Auto-Send Schedule
              </CardTitle>
              <p className="text-xs" style={{ color: "#5C5F5C" }}>
                The system will automatically send the previous day's (or today's) report at this time, every day.
                Make sure your computer is on, the backend is running, and email/WhatsApp are configured.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Time of day (24-hour)</Label>
                  <Input data-testid="schedule-time-input" type="time" value={scheduleForm.daily_report_time} onChange={(e) => setScheduleForm({ ...scheduleForm, daily_report_time: e.target.value })} className="border-[#E5E2DC] text-lg font-bold" />
                  <p className="text-xs" style={{ color: "#5C5F5C" }}>e.g., 02:15 means 2:15 AM</p>
                </div>
                <div className="space-y-1">
                  <Label>Timezone (region)</Label>
                  <Select value={scheduleForm.daily_report_timezone} onValueChange={(v) => setScheduleForm({ ...scheduleForm, daily_report_timezone: v })}>
                    <SelectTrigger data-testid="schedule-tz-select" className="border-[#E5E2DC]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tzList.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Report period</Label>
                <Select value={scheduleForm.daily_report_type} onValueChange={(v) => setScheduleForm({ ...scheduleForm, daily_report_type: v })}>
                  <SelectTrigger data-testid="schedule-type-select" className="border-[#E5E2DC]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yesterday">Yesterday's report (recommended for 2:15 AM run)</SelectItem>
                    <SelectItem value="today">Today's report so far</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Send via:</Label>
                <label className="flex items-center gap-2 p-3 rounded-lg border border-[#E5E2DC] cursor-pointer" data-testid="auto-email-daily-toggle">
                  <Checkbox checked={scheduleForm.auto_email_daily} onCheckedChange={(v) => setScheduleForm({ ...scheduleForm, auto_email_daily: !!v })} />
                  <Mail className="w-4 h-4" style={{ color: "#1E3F20" }} />
                  <div>
                    <span className="text-sm font-medium block" style={{ color: "#1A1D1A" }}>Email recipients</span>
                    <span className="text-xs" style={{ color: "#5C5F5C" }}>Sends to everyone in Email tab → Recipients list</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-lg border border-[#E5E2DC] cursor-pointer" data-testid="auto-whatsapp-daily-toggle">
                  <Checkbox checked={scheduleForm.auto_whatsapp_daily} onCheckedChange={(v) => setScheduleForm({ ...scheduleForm, auto_whatsapp_daily: !!v })} />
                  <MessageCircle className="w-4 h-4" style={{ color: "#25D366" }} />
                  <div>
                    <span className="text-sm font-medium block" style={{ color: "#1A1D1A" }}>WhatsApp recipients</span>
                    <span className="text-xs" style={{ color: "#5C5F5C" }}>Requires WhatsApp service connected (see WhatsApp tab)</span>
                  </div>
                </label>
              </div>

              {scheduleStatus && scheduleStatus.next_run && (
                <div className="p-3 rounded-lg" style={{ background: "#EAF4EB" }}>
                  <p className="text-xs font-medium" style={{ color: "#1E3F20" }}>
                    ⏰ Next scheduled run: <span className="font-bold">{new Date(scheduleStatus.next_run).toLocaleString()}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button data-testid="save-schedule-btn" onClick={saveSchedule} disabled={savingSchedule} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}>
                  <Save className="w-4 h-4" /> {savingSchedule ? "Saving..." : "Save Schedule"}
                </Button>
                <Button data-testid="run-schedule-now-btn" onClick={runScheduleNow} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]" style={{ color: "#D97736" }}>
                  <PlayCircle className="w-4 h-4" /> Run Now (test)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp */}
        <TabsContent value="whatsapp">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Connection */}
            <Card className="border-[#E5E2DC]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
                  <MessageCircle className="w-5 h-5" style={{ color: "#25D366" }} /> WhatsApp Connection
                </CardTitle>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>
                  Free WhatsApp via your phone (using whatsapp-web.js). Scan a QR code once with your phone, after that messages send automatically. Requires the local WhatsApp service to be running.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg" style={{ background: waStatus?.ready ? "#EAF4EB" : "#FCECEB" }}>
                  <p className="text-sm font-medium" style={{ color: waStatus?.ready ? "#1E3F20" : "#A63D31" }}>
                    {waStatus?.ready ? "✅ Connected" : (waStatus?.initializing ? "⏳ Initializing…" : "🔴 Not connected")}
                  </p>
                  {waStatus?.phone && <p className="text-xs mt-1" style={{ color: "#5C5F5C" }}>Linked phone: {waStatus.phone}</p>}
                  {waStatus?.error && <p className="text-xs mt-1" style={{ color: "#A63D31" }}>{waStatus.error}</p>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button data-testid="wa-refresh-status-btn" onClick={fetchWaStatus} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]">
                    <RefreshCw className="w-4 h-4" /> Refresh Status
                  </Button>
                  <Button data-testid="wa-show-qr-btn" onClick={openQrDialog} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#25D366" }}>
                    <QrCode className="w-4 h-4" /> {waStatus?.ready ? "Re-link Phone" : "Show QR Code"}
                  </Button>
                  {waStatus?.ready && <Button data-testid="wa-reset-btn" onClick={resetWa} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]" style={{ color: "#A63D31" }}>
                    <Trash2 className="w-4 h-4" /> Disconnect / Reset
                  </Button>}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Send Test Message</Label>
                  <div className="flex gap-2">
                    <Input data-testid="wa-test-phone-input" type="tel" placeholder="+923004928411" value={waTestPhone} onChange={(e) => setWaTestPhone(e.target.value)} className="border-[#E5E2DC] flex-1" />
                    <Button data-testid="wa-send-test-btn" onClick={sendTestWa} disabled={testingWa || !waStatus?.ready} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]">
                      <Send className="w-4 h-4" /> {testingWa ? "..." : "Test"}
                    </Button>
                  </div>
                  <p className="text-xs" style={{ color: "#5C5F5C" }}>Include country code with +. Phone must be on WhatsApp.</p>
                </div>

                <Separator />

                <label className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E2DC] cursor-pointer" data-testid="auto-wa-on-z-toggle">
                  <Checkbox checked={autoWaOnZ} onCheckedChange={(v) => setAutoWaOnZ(!!v)} />
                  <div>
                    <span className="text-sm font-medium block" style={{ color: "#1A1D1A" }}>Auto-WhatsApp Z-report when closed</span>
                    <span className="text-xs" style={{ color: "#5C5F5C" }}>Sends to all recipients when admin closes the day</span>
                  </div>
                </label>
              </CardContent>
            </Card>

            {/* Recipients */}
            <Card className="border-[#E5E2DC]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
                  <Users className="w-5 h-5" style={{ color: "#1E3F20" }} /> WhatsApp Recipients
                </CardTitle>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>People who receive WhatsApp report messages.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border border-dashed border-[#E5E2DC] space-y-2" style={{ background: "#F9F8F6" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <Input data-testid="new-wa-name" placeholder="Name (e.g., Owner)" value={newWaRecipient.name} onChange={(e) => setNewWaRecipient({ ...newWaRecipient, name: e.target.value })} className="border-[#E5E2DC]" />
                    <Input data-testid="new-wa-phone" type="tel" placeholder="+923004928411" value={newWaRecipient.phone} onChange={(e) => setNewWaRecipient({ ...newWaRecipient, phone: e.target.value })} className="border-[#E5E2DC]" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-3 text-xs">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox data-testid="new-wa-x" checked={newWaRecipient.receive_x} onCheckedChange={(v) => setNewWaRecipient({ ...newWaRecipient, receive_x: !!v })} /> X
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox data-testid="new-wa-z" checked={newWaRecipient.receive_z} onCheckedChange={(v) => setNewWaRecipient({ ...newWaRecipient, receive_z: !!v })} /> Z
                      </label>
                    </div>
                    <Button data-testid="add-wa-recipient-btn" onClick={addWaRecipient} size="sm" className="text-white" style={{ background: "#25D366" }}>
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>

                {waRecipients.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: "#5C5F5C" }}>No WhatsApp recipients yet.</p>
                ) : (
                  <div className="space-y-2">
                    {waRecipients.map((r) => (
                      <div key={r.phone} data-testid={`wa-recipient-${r.phone}`} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[#E5E2DC]">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#1A1D1A" }}>{r.name}</p>
                          <p className="text-xs truncate font-mono" style={{ color: "#5C5F5C" }}>{r.phone}</p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <Checkbox data-testid={`wa-x-${r.phone}`} checked={r.receive_x !== false} onCheckedChange={() => toggleWaField(r.phone, "receive_x")} /> X
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <Checkbox data-testid={`wa-z-${r.phone}`} checked={r.receive_z !== false} onCheckedChange={() => toggleWaField(r.phone, "receive_z")} /> Z
                          </label>
                        </div>
                        <button data-testid={`remove-wa-${r.phone}`} onClick={() => removeWaRecipient(r.phone)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button data-testid="save-wa-btn" onClick={saveWaConfig} disabled={savingWa} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}>
                  <Save className="w-4 h-4" /> {savingWa ? "Saving..." : "Save"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Remote Access (Cloudflare Tunnel) */}
        <TabsContent value="remote">
          <Card className="border-[#E5E2DC] max-w-3xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
                <Globe className="w-5 h-5" style={{ color: "#1565C0" }} /> Remote Access (Cloudflare Tunnel)
              </CardTitle>
              <p className="text-xs" style={{ color: "#5C5F5C" }}>
                Free secure live access to your POS from anywhere in the world. The Pakistan PC must be ON. URL changes each time you start the app — the new URL is auto-emailed/WhatsApp'd to recipients.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {tunnel?.url ? (
                <div className="p-4 rounded-lg border-2" style={{ background: "#EAF4EB", borderColor: "#1E3F20" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded text-white" style={{ background: "#1E3F20" }}>ONLINE</span>
                    <span className="text-xs" style={{ color: "#5C5F5C" }}>Last updated: {tunnel?.updated_at ? new Date(tunnel.updated_at).toLocaleTimeString() : "—"}</span>
                  </div>
                  <p className="text-sm font-semibold mb-2" style={{ color: "#1A1D1A" }}>Your live POS URL:</p>
                  <div className="flex items-center gap-2 mb-3">
                    <code data-testid="tunnel-url" className="flex-1 px-3 py-2 rounded font-mono text-sm break-all" style={{ background: "white", border: "1px solid #E5E2DC", color: "#1565C0" }}>{tunnel.url}</code>
                    <Button data-testid="tunnel-copy-btn" onClick={copyTunnelUrl} variant="outline" size="sm" className="border-[#E5E2DC]"><Copy className="w-4 h-4" /></Button>
                    <Button data-testid="tunnel-open-btn" onClick={() => window.open(tunnel.url, "_blank")} variant="outline" size="sm" className="border-[#E5E2DC]"><ExternalLink className="w-4 h-4" /></Button>
                  </div>
                  <p className="text-xs" style={{ color: "#5C5F5C" }}>Open this URL in any browser anywhere — login with your usual admin credentials.</p>
                </div>
              ) : (
                <div className="p-4 rounded-lg border-2 border-dashed" style={{ background: "#FCECEB", borderColor: "#A63D31" }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: "#A63D31" }}>🔴 No tunnel URL detected yet</p>
                  <p className="text-xs" style={{ color: "#5C5F5C" }}>
                    Make sure cloudflared is running. The launcher VBS auto-starts it after install. If you ran the old installer, re-run <code>1_INSTALL.bat</code>.
                  </p>
                  {tunnel?.log_path ? (
                    <p className="text-xs mt-2 font-mono" style={{ color: "#5C5F5C" }}>Log: {tunnel.log_path}</p>
                  ) : (
                    <p className="text-xs mt-2" style={{ color: "#5C5F5C" }}>No <code>cloudflared.log</code> file found in the project folder.</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button data-testid="tunnel-refresh-btn" onClick={refreshTunnel} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]">
                  <RefreshCw className="w-4 h-4" /> Refresh Now
                </Button>
              </div>

              <Separator />

              <label className="flex items-center gap-2 p-3 rounded-lg border border-[#E5E2DC] cursor-pointer" data-testid="tunnel-notify-toggle">
                <Checkbox checked={tunnelNotify} onCheckedChange={(v) => saveTunnelNotify(!!v)} />
                <div>
                  <span className="text-sm font-medium block" style={{ color: "#1A1D1A" }}>Auto-notify recipients when URL changes</span>
                  <span className="text-xs" style={{ color: "#5C5F5C" }}>Sends the new URL via Email + WhatsApp every time the Pakistan PC starts up</span>
                </div>
              </label>

              <Separator />

              <div className="text-xs space-y-2 p-3 rounded-lg" style={{ background: "#F9F8F6", color: "#5C5F5C" }}>
                <p className="font-semibold" style={{ color: "#1A1D1A" }}>How this works:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>The launcher starts <code>cloudflared.exe</code> in the background.</li>
                  <li>Cloudflare assigns a free public URL like <code>https://random-name.trycloudflare.com</code>.</li>
                  <li>The backend reads the URL from <code>cloudflared.log</code> and stores it here.</li>
                  <li>When you log in to that URL from the UK, you get the same POS — fully secured by admin password.</li>
                  <li>Each PC restart gives a NEW URL — recipients are auto-notified by email/WhatsApp.</li>
                </ol>
                <p className="pt-2"><strong>Only people with your admin email + password can log in, even if someone discovers the URL.</strong></p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipt Customization */}
        <TabsContent value="receipt">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-[#E5E2DC]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
                  <Printer className="w-5 h-5" style={{ color: "#1E3F20" }} /> Print Receipt Format
                </CardTitle>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>
                  Customize how your receipts look when printed. Changes apply to all new and re-printed receipts.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1"><Type className="w-3.5 h-3.5" /> Font Family</Label>
                  <Select value={receiptForm.receipt_font_family} onValueChange={(v) => setReceiptForm({ ...receiptForm, receipt_font_family: v })}>
                    <SelectTrigger data-testid="receipt-font-select" className="border-[#E5E2DC]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Courier New">Courier New (classic, monospace)</SelectItem>
                      <SelectItem value="Consolas">Consolas (clean monospace)</SelectItem>
                      <SelectItem value="Arial">Arial (modern, clean)</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman (traditional)</SelectItem>
                      <SelectItem value="Georgia">Georgia (elegant serif)</SelectItem>
                      <SelectItem value="Verdana">Verdana (very readable)</SelectItem>
                      <SelectItem value="Tahoma">Tahoma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Body size</Label>
                    <Input data-testid="receipt-base-size" type="number" min="8" max="20" value={receiptForm.receipt_base_size} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_base_size: e.target.value })} className="border-[#E5E2DC]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Header size</Label>
                    <Input data-testid="receipt-header-size" type="number" min="10" max="32" value={receiptForm.receipt_header_size} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_header_size: e.target.value })} className="border-[#E5E2DC]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total size</Label>
                    <Input data-testid="receipt-total-size" type="number" min="10" max="32" value={receiptForm.receipt_total_size} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_total_size: e.target.value })} className="border-[#E5E2DC]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E2DC] cursor-pointer" data-testid="receipt-bold-all-toggle">
                    <Checkbox checked={receiptForm.receipt_bold_all} onCheckedChange={(v) => setReceiptForm({ ...receiptForm, receipt_bold_all: !!v })} />
                    <div>
                      <span className="text-sm font-medium block" style={{ color: "#1A1D1A" }}>Make EVERYTHING bold</span>
                      <span className="text-xs" style={{ color: "#5C5F5C" }}>For thermal printers with light ink</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E2DC] cursor-pointer" data-testid="receipt-bold-total-toggle">
                    <Checkbox checked={receiptForm.receipt_bold_total} onCheckedChange={(v) => setReceiptForm({ ...receiptForm, receipt_bold_total: !!v })} />
                    <div>
                      <span className="text-sm font-medium block" style={{ color: "#1A1D1A" }}>Bold the TOTAL line</span>
                      <span className="text-xs" style={{ color: "#5C5F5C" }}>Recommended (default on)</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E2DC] cursor-pointer" data-testid="receipt-show-tax-toggle">
                    <Checkbox checked={receiptForm.receipt_show_tax_line} onCheckedChange={(v) => setReceiptForm({ ...receiptForm, receipt_show_tax_line: !!v })} />
                    <div>
                      <span className="text-sm font-medium block" style={{ color: "#1A1D1A" }}>Show "Tax:" line</span>
                      <span className="text-xs" style={{ color: "#5C5F5C" }}>Hide if your total already includes tax</span>
                    </div>
                  </label>
                </div>

                <div className="space-y-1">
                  <Label>Footer Message</Label>
                  <Input data-testid="receipt-footer-input" placeholder="Thank you for your order!" value={receiptForm.receipt_footer_text} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_footer_text: e.target.value })} className="border-[#E5E2DC]" />
                  <p className="text-xs" style={{ color: "#5C5F5C" }}>Tip: try "Like our food? Find us on Foodpanda!" or your tagline.</p>
                </div>

                <div className="space-y-1">
                  <Label>Receipt Paper Width (px)</Label>
                  <Input data-testid="receipt-width-input" type="number" min="200" max="600" value={receiptForm.receipt_paper_width} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_paper_width: e.target.value })} className="border-[#E5E2DC]" />
                  <p className="text-xs" style={{ color: "#5C5F5C" }}>Thermal 80mm = ~300px • A4 = ~600px</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button data-testid="save-receipt-btn" onClick={saveReceipt} disabled={savingReceipt} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}>
                    <Save className="w-4 h-4" /> {savingReceipt ? "Saving..." : "Save"}
                  </Button>
                  <Button data-testid="receipt-preview-btn" onClick={() => setPreviewOpen(true)} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]">
                    <Printer className="w-4 h-4" /> Live Preview
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Live preview card */}
            <Card className="border-[#E5E2DC]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}>
                  <Type className="w-5 h-5" style={{ color: "#D97736" }} /> Live Preview
                </CardTitle>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>This is roughly how the printed receipt will look. Click "Live Preview" on the left for a full preview with print button.</p>
              </CardHeader>
              <CardContent>
                <div data-testid="receipt-preview" className="rounded-lg border border-[#E5E2DC] p-4 bg-white mx-auto" style={{
                  fontFamily: `'${receiptForm.receipt_font_family}', monospace`,
                  fontSize: `${receiptForm.receipt_base_size}px`,
                  fontWeight: receiptForm.receipt_bold_all ? "bold" : "normal",
                  maxWidth: `${receiptForm.receipt_paper_width}px`,
                }}>
                  <div style={{ textAlign: "center" }}>
                    <h2 style={{ margin: "4px 0", fontSize: `${receiptForm.receipt_header_size}px`, fontWeight: "bold" }}>{settingsForm.restaurant_name || "RESTAURANT NAME"}</h2>
                    <p style={{ margin: "2px 0", fontSize: `${Math.max(8, receiptForm.receipt_base_size - 2)}px` }}>{settingsForm.restaurant_address || "Your Address"}</p>
                    <p style={{ margin: "2px 0", fontSize: `${Math.max(8, receiptForm.receipt_base_size - 2)}px` }}>Tel: {settingsForm.restaurant_phone || "+923000000000"}</p>
                  </div>
                  <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Receipt #:</span><span style={{ fontWeight: "bold" }}>ABC123</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Date:</span><span>{new Date().toLocaleDateString()}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Cashier:</span><span>Admin</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Payment:</span><span style={{ fontWeight: "bold" }}>CASH</span></div>
                  <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Chicken Biryani</span><span>{settingsForm.currency || "Rs"} 700.00</span></div>
                  <div style={{ fontSize: `${Math.max(8, receiptForm.receipt_base_size - 1)}px`, paddingLeft: 8, color: "#666" }}>2 x {settingsForm.currency || "Rs"} 350.00</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Coke 500ml</span><span>{settingsForm.currency || "Rs"} 160.00</span></div>
                  <div style={{ fontSize: `${Math.max(8, receiptForm.receipt_base_size - 1)}px`, paddingLeft: 8, color: "#666" }}>2 x {settingsForm.currency || "Rs"} 80.00</div>
                  <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal:</span><span>{settingsForm.currency || "Rs"} 860.00</span></div>
                  {receiptForm.receipt_show_tax_line && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tax:</span><span>{settingsForm.currency || "Rs"} 68.80</span></div>}
                  <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: `${receiptForm.receipt_total_size}px`, fontWeight: receiptForm.receipt_bold_total ? "bold" : "normal" }}>
                    <span>TOTAL:</span><span>{settingsForm.currency || "Rs"} 928.80</span>
                  </div>
                  <div style={{ borderTop: "1px dashed #999", margin: "12px 0" }} />
                  <div style={{ textAlign: "center", fontSize: `${Math.max(8, receiptForm.receipt_base_size - 1)}px` }}>{receiptForm.receipt_footer_text}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Management */}
        <TabsContent value="data">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-[#E5E2DC]">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}><Download className="w-5 h-5" style={{ color: "#1E3F20" }} /> Export All Data</CardTitle>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>Download all data as JSON file. Save to external drive as backup.</p></CardHeader>
              <CardContent>
                {dataStats && (
                  <div className="mb-4 space-y-1">
                    <p className="text-xs" style={{ color: "#5C5F5C" }}>Current data: {dataStats.orders || 0} orders, {dataStats.z_reports || 0} Z reports, {dataStats.expenses || 0} expenses, {dataStats.vendor_transactions || 0} vendor transactions, {dataStats.vendor_payments || 0} vendor payments</p>
                  </div>
                )}
                <Button data-testid="export-all-data-btn" onClick={exportAllData} disabled={exporting} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Export All Data (JSON)"}</Button>
              </CardContent>
            </Card>
            <Card className="border-[#E5E2DC]">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}><HardDrive className="w-5 h-5" style={{ color: "#A63D31" }} /> Free Up Space</CardTitle>
                <p className="text-xs" style={{ color: "#5C5F5C" }}>Delete old data before a specific date. Export first!</p></CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg" style={{ background: "#FCECEB" }}>
                  <p className="text-xs font-medium" style={{ color: "#A63D31" }}>Warning: This permanently deletes orders, reports, expenses, and vendor transactions before the selected date. Export your data first!</p>
                </div>
                <div className="space-y-1"><Label>Delete data before this date:</Label>
                  <Input data-testid="delete-before-date" type="date" value={deleteBeforeDate} onChange={(e) => setDeleteBeforeDate(e.target.value)} className="border-[#E5E2DC]" />
                </div>
                <Button data-testid="delete-old-data-btn" onClick={() => { if (!deleteBeforeDate) { toast.error("Select a date first"); return; } setDeleteConfirm(true); }} disabled={deleting} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#A63D31" }}><Trash2 className="w-4 h-4" /> {deleting ? "Deleting..." : "Delete Old Data"}</Button>
              </CardContent>
            </Card>
          </div>
          {/* Import Section */}
          <Card className="border-[#E5E2DC] mt-6">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "Manrope" }}><HardDrive className="w-5 h-5" style={{ color: "#D97736" }} /> Import Data (JSON)</CardTitle>
              <p className="text-xs" style={{ color: "#5C5F5C" }}>Restore data from a previously exported JSON backup file</p></CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg" style={{ background: "#FDF2E9" }}>
                <p className="text-xs font-medium" style={{ color: "#D97736" }}>This will ADD imported records to your existing data. It will not replace or delete anything.</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} style={{ display: "none" }} />
              <Button data-testid="import-data-btn" onClick={() => fileInputRef.current?.click()} disabled={importing} variant="outline" className="flex items-center gap-2 border-[#E5E2DC]">
                <HardDrive className="w-4 h-4" /> {importing ? "Importing..." : "Select JSON File to Import"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Dialog with Permission Checkboxes */}
      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent className="border-[#E5E2DC] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle style={{ fontFamily: "Manrope" }}>{editingUser ? "Edit User" : "Add New User"}</DialogTitle><DialogDescription>{editingUser ? "Update details and permissions" : "Create a new user"}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name</Label><Input data-testid="user-name-input" value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} className="border-[#E5E2DC]" /></div>
              <div className="space-y-1"><Label>Email</Label><Input data-testid="user-email-input" type="email" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} disabled={!!editingUser} className="border-[#E5E2DC]" /></div>
            </div>
            <div className="space-y-1"><Label>{editingUser ? "New Password (blank = keep)" : "Password"}</Label><Input data-testid="user-password-input" type="password" value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} className="border-[#E5E2DC]" /></div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Permissions</Label>
              <p className="text-xs" style={{ color: "#5C5F5C" }}>Select which sections this user can access</p>
              {/* Bounded, scrollable list — with 19 permission rows the dialog body would
                  otherwise overflow the viewport (especially on mobile / short laptop screens)
                  and push the Save button below the fold. */}
              <div className="grid grid-cols-2 gap-2 max-h-[45vh] overflow-y-auto pr-1 -mr-1">
                {ALL_PERMS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 p-2 rounded-lg border border-[#E5E2DC] cursor-pointer hover:bg-[#F9F8F6]" data-testid={`perm-${p.key}`}>
                    <Checkbox checked={userForm.permissions.includes(p.key)} onCheckedChange={() => togglePerm(p.key)} />
                    <span className="text-sm" style={{ color: "#1A1D1A" }}>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button data-testid="save-user-btn" onClick={saveUser} className="text-white font-semibold" style={{ background: "#1E3F20" }}>{editingUser ? "Update" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteUserConfirm.open} onOpenChange={(o) => !o && setDeleteUserConfirm({...deleteUserConfirm, open: false})}>
        <AlertDialogContent className="border-[#E5E2DC]"><AlertDialogHeader><AlertDialogTitle>Delete User?</AlertDialogTitle><AlertDialogDescription>Delete "{deleteUserConfirm.name}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="border-[#E5E2DC]">Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteUser} className="text-white" style={{ background: "#A63D31" }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Data Confirm */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent className="border-[#E5E2DC]"><AlertDialogHeader><AlertDialogTitle>Delete Old Data?</AlertDialogTitle><AlertDialogDescription>This will permanently delete all orders, reports, expenses, and vendor transactions before {deleteBeforeDate}. Make sure you have exported first!</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="border-[#E5E2DC]">Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteOldData} className="text-white" style={{ background: "#A63D31" }}>Delete Permanently</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* WhatsApp QR Dialog */}
      <Dialog open={waQrOpen} onOpenChange={setWaQrOpen}>
        <DialogContent className="border-[#E5E2DC] max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Manrope" }}>Connect WhatsApp</DialogTitle>
            <DialogDescription>
              Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → scan this QR code.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {waQr ? (
              <img data-testid="wa-qr-image" src={waQr} alt="WhatsApp QR code" className="w-64 h-64 border border-[#E5E2DC] rounded-lg" />
            ) : (
              <div className="w-64 h-64 flex flex-col items-center justify-center border border-dashed border-[#E5E2DC] rounded-lg" style={{ color: "#5C5F5C" }}>
                <RefreshCw className="w-8 h-8 mb-2 animate-spin opacity-30" />
                <p className="text-xs text-center px-4">Waiting for QR code… (the WhatsApp service must be running)</p>
              </div>
            )}
            <p className="text-xs mt-3 text-center" style={{ color: "#5C5F5C" }}>The code refreshes every 20 seconds. Click Refresh if expired.</p>
          </div>
          <DialogFooter className="flex justify-between">
            <Button data-testid="wa-qr-refresh-btn" onClick={refreshQr} variant="outline" className="border-[#E5E2DC]">
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button data-testid="wa-qr-done-btn" onClick={() => { setWaQrOpen(false); fetchWaStatus(); }} className="text-white" style={{ background: "#1E3F20" }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Receipt Live Preview Modal */}
      <ReceiptModal
        open={previewOpen}
        onClose={setPreviewOpen}
        order={sampleOrder}
        settings={{
          restaurant_name: settingsForm.restaurant_name,
          restaurant_address: settingsForm.restaurant_address,
          restaurant_phone: settingsForm.restaurant_phone,
          restaurant_email: settingsForm.restaurant_email,
          ...receiptForm,
        }}
        currency={settingsForm.currency || "Rs"}
      />
    </div>
  );
}
