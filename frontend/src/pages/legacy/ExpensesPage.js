import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Receipt, Plus, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("general");
  const [currency, setCurrency] = useState("Rs");
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: "" });

  const fetchData = useCallback(async () => {
    try {
      const [expRes, sumRes, setRes] = await Promise.all([
        axios.get(`${API}/expenses`, { withCredentials: true }),
        axios.get(`${API}/expenses/summary`, { withCredentials: true }),
        axios.get(`${API}/settings`, { withCredentials: true }),
      ]);
      setExpenses(expRes.data);
      setSummary(sumRes.data);
      setCurrency(setRes.data.currency || "Rs");
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addExpense = async () => {
    if (!desc.trim() || !amount) { toast.error("Description and amount required"); return; }
    try {
      await axios.post(`${API}/expenses`, { description: desc, amount: parseFloat(amount), category }, { withCredentials: true });
      toast.success("Expense added");
      setDesc(""); setAmount(""); setCategory("general");
      fetchData();
    } catch (err) { toast.error("Failed to add expense"); }
  };

  const doDelete = async () => {
    const { id } = deleteConfirm;
    setDeleteConfirm({ open: false, id: "" });
    try {
      await axios.delete(`${API}/expenses/${id}`, { withCredentials: true });
      toast.success("Expense deleted");
      fetchData();
    } catch (err) { toast.error("Failed to delete"); }
  };

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><p style={{ color: "#5C5F5C" }}>Loading...</p></div>;

  return (
    <div className="flex-1 p-6 md:p-8 overflow-auto" data-testid="expenses-page">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>Expense Register</h1>
        <p className="text-sm mt-1" style={{ color: "#5C5F5C" }}>Track daily expenses - shows in closing Z Report</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-[#E5E2DC]"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#FCECEB" }}><DollarSign className="w-5 h-5" style={{ color: "#A63D31" }} /></div>
          <div><p className="text-xs uppercase tracking-wider" style={{ color: "#5C5F5C" }}>Today's Expenses</p><p className="text-xl font-bold" style={{ fontFamily: "Manrope", color: "#A63D31" }}>{currency} {summary?.total_expenses?.toFixed(2) || "0.00"}</p></div>
        </CardContent></Card>
        <Card className="border-[#E5E2DC]"><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#FDF2E9" }}><Receipt className="w-5 h-5" style={{ color: "#D97736" }} /></div>
          <div><p className="text-xs uppercase tracking-wider" style={{ color: "#5C5F5C" }}>Entries</p><p className="text-xl font-bold" style={{ fontFamily: "Manrope" }}>{summary?.count || 0}</p></div>
        </CardContent></Card>
      </div>

      {/* Add Expense Form */}
      <Card className="border-[#E5E2DC] mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-lg" style={{ fontFamily: "Manrope", color: "#1A1D1A" }}>Add Expense</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Description</Label>
              <Input data-testid="expense-desc-input" placeholder="e.g., Petrol Buy" value={desc} onChange={(e) => setDesc(e.target.value)} className="border-[#E5E2DC]" />
            </div>
            <div className="w-40 space-y-1">
              <Label className="text-xs">Amount ({currency})</Label>
              <Input data-testid="expense-amount-input" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="border-[#E5E2DC]" />
            </div>
            <div className="w-36 space-y-1">
              <Label className="text-xs">Category</Label>
              <Input data-testid="expense-category-input" placeholder="general" value={category} onChange={(e) => setCategory(e.target.value)} className="border-[#E5E2DC]" />
            </div>
            <Button data-testid="add-expense-btn" onClick={addExpense} className="flex items-center gap-2 text-white font-semibold" style={{ background: "#1E3F20" }}><Plus className="w-4 h-4" /> Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card className="border-[#E5E2DC]">
        <Table>
          <TableHeader><TableRow className="border-[#E5E2DC]">
            <TableHead style={{ color: "#5C5F5C" }}>Description</TableHead>
            <TableHead style={{ color: "#5C5F5C" }}>Category</TableHead>
            <TableHead style={{ color: "#5C5F5C" }}>Amount</TableHead>
            <TableHead style={{ color: "#5C5F5C" }}>Time</TableHead>
            <TableHead style={{ color: "#5C5F5C" }}>Action</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8" style={{ color: "#5C5F5C" }}>No expenses today</TableCell></TableRow>
            ) : expenses.map((e) => (
              <TableRow key={e.id} data-testid={`expense-row-${e.id}`} className="border-[#E5E2DC]">
                <TableCell className="font-medium" style={{ color: "#1A1D1A" }}>{e.description}</TableCell>
                <TableCell><Badge className="text-xs" style={{ background: "#FDF2E9", color: "#D97736", border: "none" }}>{e.category}</Badge></TableCell>
                <TableCell className="font-bold" style={{ color: "#A63D31" }}>{currency} {e.amount.toFixed(2)}</TableCell>
                <TableCell style={{ color: "#5C5F5C" }}>{e.created_at ? new Date(e.created_at).toLocaleTimeString() : ""}</TableCell>
                <TableCell>
                  <button data-testid={`delete-expense-${e.id}`} onClick={() => setDeleteConfirm({ open: true, id: e.id })} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#FCECEB]" style={{ color: "#A63D31" }}><Trash2 className="w-4 h-4" /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(o) => !o && setDeleteConfirm({ ...deleteConfirm, open: false })}>
        <AlertDialogContent className="border-[#E5E2DC]">
          <AlertDialogHeader><AlertDialogTitle>Delete Expense?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="border-[#E5E2DC]">Cancel</AlertDialogCancel><AlertDialogAction onClick={doDelete} className="text-white" style={{ background: "#A63D31" }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
