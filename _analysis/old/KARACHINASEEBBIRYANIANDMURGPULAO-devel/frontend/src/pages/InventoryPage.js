import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Package,
  AlertTriangle,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockDialog, setStockDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newStock, setNewStock] = useState("");

  const fetchInventory = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/inventory`, { withCredentials: true });
      setInventory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const updateStock = async () => {
    if (!selectedItem || newStock === "") return;
    try {
      await axios.put(`${API}/inventory/${selectedItem.id}`, { stock: parseInt(newStock) }, { withCredentials: true });
      toast.success(`Stock updated for ${selectedItem.name}`);
      setStockDialog(false);
      setSelectedItem(null);
      setNewStock("");
      fetchInventory();
    } catch (err) {
      toast.error("Failed to update stock");
    }
  };

  const openStockDialog = (item) => {
    setSelectedItem(item);
    setNewStock(String(item.stock));
    setStockDialog(true);
  };

  const filtered = inventory.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category_name.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = inventory.filter((i) => i.is_low_stock).length;

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <p style={{ color: "#5C5F5C" }}>Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="inventory-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>
            Inventory
          </h1>
          <p className="text-sm mt-1" style={{ color: "#5C5F5C" }}>Track and manage stock levels</p>
        </div>
        <Button
          data-testid="refresh-inventory-btn"
          onClick={fetchInventory}
          variant="outline"
          className="flex items-center gap-2 border-[#E5E2DC]"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-[#E5E2DC]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#EAF4EB" }}>
              <Package className="w-5 h-5" style={{ color: "#1E3F20" }} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: "#5C5F5C" }}>Total Items</p>
              <p className="text-xl font-bold" style={{ fontFamily: "Manrope, sans-serif" }}>{inventory.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E2DC]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: lowStockCount > 0 ? "#FCECEB" : "#EAF4EB" }}>
              <AlertTriangle className="w-5 h-5" style={{ color: lowStockCount > 0 ? "#A63D31" : "#2E5C31" }} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: "#5C5F5C" }}>Low Stock</p>
              <p className="text-xl font-bold" style={{ fontFamily: "Manrope, sans-serif", color: lowStockCount > 0 ? "#A63D31" : "#1A1D1A" }}>
                {lowStockCount}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#E5E2DC]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#FDF2E9" }}>
              <Package className="w-5 h-5" style={{ color: "#D97736" }} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: "#5C5F5C" }}>Total Stock</p>
              <p className="text-xl font-bold" style={{ fontFamily: "Manrope, sans-serif" }}>
                {inventory.reduce((sum, i) => sum + i.stock, 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5C5F5C" }} />
        <Input
          data-testid="inventory-search-input"
          placeholder="Search by name or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 border-[#E5E2DC]"
        />
      </div>

      {/* Table */}
      <Card className="border-[#E5E2DC]">
        <Table>
          <TableHeader>
            <TableRow className="border-[#E5E2DC]">
              <TableHead style={{ color: "#5C5F5C" }}>Item Name</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Category</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Price</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Stock</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Status</TableHead>
              <TableHead style={{ color: "#5C5F5C" }}>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8" style={{ color: "#5C5F5C" }}>
                  No inventory items found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow key={item.id} data-testid={`inventory-row-${item.id}`} className="border-[#E5E2DC]">
                  <TableCell className="font-medium" style={{ color: "#1A1D1A" }}>{item.name}</TableCell>
                  <TableCell>
                    <Badge className="text-xs" style={{ background: "#EAF4EB", color: "#1E3F20", border: "none" }}>
                      {item.category_name}
                    </Badge>
                  </TableCell>
                  <TableCell style={{ color: "#1A1D1A" }}>${item.price.toFixed(2)}</TableCell>
                  <TableCell className="font-semibold" style={{ color: "#1A1D1A" }}>{item.stock}</TableCell>
                  <TableCell>
                    {item.is_low_stock ? (
                      <Badge className="text-xs" style={{ background: "#FCECEB", color: "#A63D31", border: "none" }}>
                        <AlertTriangle className="w-3 h-3 mr-1" /> Low Stock
                      </Badge>
                    ) : (
                      <Badge className="text-xs" style={{ background: "#EAF4EB", color: "#2E5C31", border: "none" }}>
                        In Stock
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      data-testid={`update-stock-${item.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => openStockDialog(item)}
                      className="text-xs border-[#E5E2DC]"
                    >
                      Update Stock
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Stock Update Dialog */}
      <Dialog open={stockDialog} onOpenChange={setStockDialog}>
        <DialogContent className="border-[#E5E2DC]">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Manrope, sans-serif" }}>
              Update Stock - {selectedItem?.name}
            </DialogTitle>
            <DialogDescription>
              Set the new stock quantity for this item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Current Stock: {selectedItem?.stock}</Label>
              <Input
                data-testid="new-stock-input"
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className="border-[#E5E2DC]"
                min="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="save-stock-btn"
              onClick={updateStock}
              className="text-white font-semibold"
              style={{ background: "#1E3F20" }}
            >
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
