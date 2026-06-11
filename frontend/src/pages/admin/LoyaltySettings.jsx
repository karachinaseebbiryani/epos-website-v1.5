import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { toast } from "sonner";
import axios from "axios";
import { Diamond, Save, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LoyaltySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: true,
    earning_rate: 10.0,
    min_order_for_points: 0.0,
    points_expiry_days: null,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/loyalty/settings`, { withCredentials: true });
      setSettings(data);
    } catch (err) {
      toast.error("Failed to load loyalty settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/admin/loyalty/settings`, settings, { withCredentials: true });
      toast.success("Loyalty settings saved!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1E3F20] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Diamond className="w-6 h-6" style={{ color: "#1E3F20" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#1A1D1A" }}>Loyalty Settings</h1>
        </div>
        <p className="text-sm" style={{ color: "#5C5F5C" }}>
          Configure Diamond rewards system for customer loyalty
        </p>
      </div>

      {/* Alert */}
      <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: "#EAF4EB", border: "1px solid #1E3F20" }}>
        <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: "#1E3F20" }} />
        <div className="flex-1 text-sm" style={{ color: "#1E3F20" }}>
          <p className="font-semibold mb-1">How it works</p>
          <p>Customers earn Diamonds on every order. They can redeem Diamonds for rewards you create in the Rewards Management page.</p>
        </div>
      </div>

      {/* Settings Form */}
      <Card className="border-[#E5E2DC]">
        <CardHeader>
          <CardTitle>Earning Configuration</CardTitle>
          <CardDescription>Set how customers earn Diamonds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-[#E5E2DC]">
            <div>
              <Label className="text-base font-semibold">Enable Loyalty System</Label>
              <p className="text-sm text-[#5C5F5C] mt-1">Turn on Diamond rewards for customers</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                settings.enabled ? "bg-[#1E3F20]" : "bg-gray-300"
              }`}
              data-testid="loyalty-enabled-toggle">
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                  settings.enabled ? "translate-x-7" : ""
                }`}
              />
            </button>
          </div>

          {/* Earning Rate */}
          <div>
            <Label htmlFor="earning-rate">Earning Rate (Diamonds per Rs 100 spent)</Label>
            <Input
              id="earning-rate"
              type="number"
              min="0"
              step="0.1"
              value={settings.earning_rate}
              onChange={(e) => setSettings({ ...settings, earning_rate: parseFloat(e.target.value) || 0 })}
              className="mt-2 border-[#E5E2DC]"
              data-testid="earning-rate-input"
            />
            <p className="text-xs text-[#5C5F5C] mt-1">
              Example: Rate of 10 means customers earn 10 Diamonds for every Rs 100 spent
            </p>
          </div>

          {/* Minimum Order */}
          <div>
            <Label htmlFor="min-order">Minimum Order Amount (Rs)</Label>
            <Input
              id="min-order"
              type="number"
              min="0"
              step="10"
              value={settings.min_order_for_points}
              onChange={(e) => setSettings({ ...settings, min_order_for_points: parseFloat(e.target.value) || 0 })}
              className="mt-2 border-[#E5E2DC]"
              data-testid="min-order-input"
            />
            <p className="text-xs text-[#5C5F5C] mt-1">
              Orders below this amount won't earn Diamonds (set to 0 for no minimum)
            </p>
          </div>

          {/* Points Expiry */}
          <div>
            <Label htmlFor="expiry-days">Diamond Expiry (days)</Label>
            <Input
              id="expiry-days"
              type="number"
              min="0"
              step="1"
              value={settings.points_expiry_days || ""}
              placeholder="Never expire (leave empty)"
              onChange={(e) => setSettings({ ...settings, points_expiry_days: e.target.value ? parseInt(e.target.value) : null })}
              className="mt-2 border-[#E5E2DC]"
              data-testid="expiry-days-input"
            />
            <p className="text-xs text-[#5C5F5C] mt-1">
              Leave empty for Diamonds to never expire
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Example Calculation */}
      <Card className="border-[#E5E2DC]" style={{ backgroundColor: "#F9F8F6" }}>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Example Calculation</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "#5C5F5C" }}>Order Amount:</span>
              <span className="font-semibold">Rs 500</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "#5C5F5C" }}>Earning Rate:</span>
              <span className="font-semibold">{settings.earning_rate} Diamonds / Rs 100</span>
            </div>
            <div className="border-t border-[#E5E2DC] my-2" />
            <div className="flex justify-between text-base">
              <span className="font-semibold" style={{ color: "#1E3F20" }}>Diamonds Earned:</span>
              <span className="font-bold text-lg" style={{ color: "#1E3F20" }}>
                {Math.floor((500 * settings.earning_rate) / 100)} 💎
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-white font-semibold"
          style={{ background: "#1E3F20" }}
          data-testid="save-settings-btn">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
