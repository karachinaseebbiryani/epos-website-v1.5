import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStaffAuth as useAuth } from "../../contexts/StaffAuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Lock, Mail, User, Eye, EyeOff } from "lucide-react";

function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  return String(detail);
}

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Once staff JWT is set, jump straight into the POS terminal.
  useEffect(() => {
    if (user && user !== false) {
      const target = user.role === "admin" ? "/admin/dashboard-classic" : "/admin/pos";
      navigate(target, { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, name, "cashier");
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1618063881344-1a55711a3275?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwzfHxjYWZlJTIwcmVzdGF1cmFudCUyMGludGVyaW9yJTIwbG9naW4lMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc3NzEwNjE5Nnww&ixlib=rb-4.1.0&q=85"
          alt="Restaurant"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <h2 className="text-4xl font-bold text-white tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
            RestoPOS
          </h2>
          <p className="text-white/80 mt-2 text-lg">
            Your complete restaurant management system
          </p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: "#F9F8F6" }}>
        <Card className="w-full max-w-md border-[#E5E2DC] shadow-lg">
          <CardHeader className="space-y-1 text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center mb-2" style={{ background: "#1E3F20" }}>
              <Lock className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold" style={{ fontFamily: "Manrope, sans-serif", color: "#1A1D1A" }}>
              {isRegister ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <p className="text-sm" style={{ color: "#5C5F5C" }}>
              {isRegister ? "Register a new cashier account" : "Sign in to your POS system"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium" style={{ color: "#1A1D1A" }}>Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5C5F5C" }} />
                    <Input
                      id="name"
                      data-testid="register-name-input"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 border-[#E5E2DC] focus:ring-[#1E3F20]"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium" style={{ color: "#1A1D1A" }}>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5C5F5C" }} />
                  <Input
                    id="email"
                    data-testid="login-email-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-[#E5E2DC] focus:ring-[#1E3F20]"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium" style={{ color: "#1A1D1A" }}>Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#5C5F5C" }} />
                  <Input
                    id="password"
                    data-testid="login-password-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 border-[#E5E2DC] focus:ring-[#1E3F20]"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#5C5F5C" }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div data-testid="login-error" className="text-sm rounded-lg px-3 py-2" style={{ background: "#FCECEB", color: "#A63D31" }}>
                  {error}
                </div>
              )}
              <Button
                data-testid="login-submit-btn"
                type="submit"
                className="w-full font-semibold text-white"
                style={{ background: "#1E3F20" }}
                disabled={loading}
              >
                {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                data-testid="toggle-auth-mode-btn"
                onClick={() => { setIsRegister(!isRegister); setError(""); }}
                className="text-sm font-medium hover:underline"
                style={{ color: "#1E3F20" }}
              >
                {isRegister ? "Already have an account? Sign in" : "Need a cashier account? Register"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
