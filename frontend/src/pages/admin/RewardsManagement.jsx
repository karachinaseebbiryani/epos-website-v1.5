import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import { Gift, Plus, Pencil, Trash2, Diamond } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RewardsManagement() {
  const [rewards, setRewards] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    cost_diamonds: 100,
    reward_type: "discount_percent",
    reward_value: "10",
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rewardsRes, menuRes] = await Promise.all([
        axios.get(`${API}/admin/loyalty/rewards`, { withCredentials: true }),
        axios.get(`${API}/menu-items`, { withCredentials: true }),
      ]);
      setRewards(rewardsRes.data);
      setMenuItems(menuRes.data);
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (reward = null) => {
    if (reward) {
      setEditing(reward);
      setForm({
        title: reward.title,
        description: reward.description || "",
        cost_diamonds: reward.cost_diamonds,
        reward_type: reward.reward_type,
        reward_value: reward.reward_value,
        is_active: reward.is_active,
      });
    } else {
      setEditing(null);
      setForm({
        title: "",
        description: "",
        cost_diamonds: 100,
        reward_type: "discount_percent",
        reward_value: "10",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      if (editing) {
        await axios.put(`${API}/admin/loyalty/rewards/${editing.id}`, form, { withCredentials: true });
        toast.success("Reward updated!");
      } else {
        await axios.post(`${API}/admin/loyalty/rewards`, form, { withCredentials: true });
        toast.success("Reward created!");
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save reward");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this reward? This cannot be undone.")) return;

    try {
      await axios.delete(`${API}/admin/loyalty/rewards/${id}`, { withCredentials: true });
      toast.success("Reward deleted");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete reward");
    }
  };

  const getRewardValueDisplay = (reward) => {
    if (reward.reward_type === "discount_percent") return `${reward.reward_value}% OFF`;
    if (reward.reward_type === "discount_fixed") return `Rs ${reward.reward_value} OFF`;
    if (reward.reward_type === "free_item") {
      const item = menuItems.find((m) => m.id === reward.reward_value);
      return item ? `Free ${item.name}` : "Free Item";
    }
    return reward.reward_value;
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-6 h-6" style={{ color: "#1E3F20" }} />
            <h1 className="text-2xl font-bold" style={{ color: "#1A1D1A" }}>Rewards Management</h1>
          </div>
          <p className="text-sm" style={{ color: "#5C5F5C" }}>Create and manage Diamond rewards</p>
        </div>
        <Button
          onClick={() => openDialog()}
          className="flex items-center gap-2 text-white font-semibold"
          style={{ background: "#1E3F20" }}
          data-testid="create-reward-btn">
          <Plus className="w-4 h-4" /> Create Reward
        </Button>
      </div>

      {/* Rewards Grid */}
      {rewards.length === 0 ? (
        <Card className="border-[#E5E2DC]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Gift className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm font-semibold mb-1" style={{ color: "#1A1D1A" }}>No rewards yet</p>
            <p className="text-sm mb-4" style={{ color: "#5C5F5C" }}>Create your first Diamond reward</p>
            <Button onClick={() => openDialog()} className="text-white" style={{ background: "#1E3F20" }}>
              <Plus className="w-4 h-4 mr-2" /> Create Reward
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((reward) => (
            <Card key={reward.id} className={`border-[#E5E2DC] ${!reward.is_active ? "opacity-50" : ""}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1" style={{ color: "#1A1D1A" }}>{reward.title}</h3>
                    {reward.description && (
                      <p className="text-sm" style={{ color: "#5C5F5C" }}>{reward.description}</p>
                    )}
                  </div>
                  {!reward.is_active && (
                    <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600">Inactive</span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "#5C5F5C" }}>Cost:</span>
                    <span className="font-bold flex items-center gap-1" style={{ color: "#1E3F20" }}>
                      {reward.cost_diamonds} <Diamond className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "#5C5F5C" }}>Reward:</span>
                    <span className="font-semibold">{getRewardValueDisplay(reward)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "#5C5F5C" }}>Redeemed:</span>
                    <span className="font-semibold">{reward.total_redemptions || 0} times</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => openDialog(reward)}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-[#E5E2DC]"
                    data-testid={`edit-reward-${reward.id}`}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button
                    onClick={() => handleDelete(reward.id)}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    data-testid={`delete-reward-${reward.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-[#E5E2DC]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Reward" : "Create Reward"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., 10% OFF on next order"
                className="mt-2 border-[#E5E2DC]"
                data-testid="reward-title-input"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional details"
                className="mt-2 border-[#E5E2DC]"
              />
            </div>

            <div>
              <Label htmlFor="cost">Cost (Diamonds) *</Label>
              <Input
                id="cost"
                type="number"
                min="1"
                value={form.cost_diamonds}
                onChange={(e) => setForm({ ...form, cost_diamonds: parseInt(e.target.value) || 0 })}
                className="mt-2 border-[#E5E2DC]"
                data-testid="reward-cost-input"
              />
            </div>

            <div>
              <Label htmlFor="type">Reward Type *</Label>
              <select
                id="type"
                value={form.reward_type}
                onChange={(e) => setForm({ ...form, reward_type: e.target.value, reward_value: "" })}
                className="w-full mt-2 px-3 py-2 border border-[#E5E2DC] rounded-md"
                data-testid="reward-type-select">
                <option value="discount_percent">Discount Percent (%)</option>
                <option value="discount_fixed">Discount Fixed (Rs)</option>
                <option value="free_item">Free Menu Item</option>
              </select>
            </div>

            <div>
              <Label htmlFor="value">
                {form.reward_type === "discount_percent" && "Discount Percent *"}
                {form.reward_type === "discount_fixed" && "Discount Amount (Rs) *"}
                {form.reward_type === "free_item" && "Select Menu Item *"}
              </Label>
              {form.reward_type === "free_item" ? (
                <select
                  id="value"
                  value={form.reward_value}
                  onChange={(e) => setForm({ ...form, reward_value: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border border-[#E5E2DC] rounded-md"
                  data-testid="reward-value-select">
                  <option value="">-- Select Item --</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Rs {item.price})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="value"
                  type="number"
                  min="1"
                  value={form.reward_value}
                  onChange={(e) => setForm({ ...form, reward_value: e.target.value })}
                  placeholder={form.reward_type === "discount_percent" ? "e.g., 10" : "e.g., 50"}
                  className="mt-2 border-[#E5E2DC]"
                  data-testid="reward-value-input"
                />
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded border border-[#E5E2DC]">
              <Label>Active</Label>
              <button
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  form.is_active ? "bg-[#1E3F20]" : "bg-gray-300"
                }`}
                data-testid="reward-active-toggle">
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    form.is_active ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-[#E5E2DC]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="text-white"
              style={{ background: "#1E3F20" }}
              data-testid="save-reward-btn">
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
