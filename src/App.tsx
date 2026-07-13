import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { I18nProvider } from "@/hooks/useI18n";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Reports from "./pages/Reports";
import Cashbooks from "./pages/Cashbooks";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import BillingReturn from "./pages/BillingReturn";
import Admin from "./pages/Admin";
import Team from "./pages/Team";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NewPassword from "./pages/NewPassword";
import Checkout from "./pages/Checkout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <I18nProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth defaultMode="signin" />} />
            <Route path="/register" element={<Auth defaultMode="signup" />} />
            <Route path="/new-password" element={<NewPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-your-password" element={<ResetPassword />} />
            <Route path="/Reset-your-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/cashbooks" element={<Cashbooks />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/billing/return" element={<BillingReturn />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/team" element={<Team />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </I18nProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
