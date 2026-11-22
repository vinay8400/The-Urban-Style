import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  IndianRupee,
  Users,
  TrendingUp,
  ArrowUpRight,
  Plus,
  ClipboardList,
  Boxes,
  FolderTree,
  Settings,
  Eye,
  Clock3,
  Truck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface StoredOrder {
  orderId: string;
  createdAt: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  items?: {
    name: string;
    quantity: number;
  }[];
  total?: number;
  orderStatus?: string;
  payment?: {
    status?: string;
    method?: string;
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function AdminDashboard() {
  const orders = useMemo<StoredOrder[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("urban-style-orders") || "[]",
      );
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }, []);

  const totalOrders = orders.length;

  const totalSales = orders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0,
  );

  const pendingOrders = orders.filter(
    (order) => order.orderStatus === "pending_confirmation",
  ).length;

  const pendingPayments = orders.filter(
    (order) => order.payment?.status === "pending_verification",
  ).length;

  const recentOrders = [...orders]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  const stats = [
    {
      label: "Total Orders",
      value: totalOrders.toString(),
      icon: ShoppingBag,
      note: "Orders recorded in this browser",
    },
    {
      label: "Order Value",
      value: formatCurrency(totalSales),
      icon: IndianRupee,
      note: "Demo order value, not verified revenue",
    },
    {
      label: "Pending Orders",
      value: pendingOrders.toString(),
      icon: Clock3,
      note: "Awaiting store confirmation",
    },
    {
      label: "Payment Verification",
      value: pendingPayments.toString(),
      icon: AlertTriangle,
      note: "Payments awaiting verification",
    },
  ];

  const quickActions = [
    {
      title: "Add New Product",
      description: "Add product photos, prices and sizes",
      icon: Plus,
      path: "/admin/products",
    },
    {
      title: "Manage Categories",
      description: "Create categories and subcategories",
      icon: FolderTree,
      path: "/admin/categories",
    },
    {
      title: "Manage Orders",
      description: "Review and update customer orders",
      icon: ClipboardList,
      path: "/admin/orders",
    },
    {
      title: "Inventory",
      description: "Review product stock and sizes",
      icon: Boxes,
      path: "/admin/inventory",
    },
  ];

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          <img
            src="/assets/brand/logo-main.jpeg"
            alt="The Urban Style"
          />
        </Link>

        <div className="admin-sidebar-label">MAIN MENU</div>

        <nav className="admin-navigation">
          <Link to="/admin" className="admin-nav-link active">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>

          <Link to="/admin/products" className="admin-nav-link">
            <Package size={18} />
            <span>Products</span>
          </Link>

          <Link to="/admin/categories" className="admin-nav-link">
            <FolderTree size={18} />
            <span>Categories</span>
          </Link>

          <Link to="/admin/orders" className="admin-nav-link">
            <ShoppingBag size={18} />
            <span>Orders</span>
          </Link>

          <Link to="/admin/inventory" className="admin-nav-link">
            <Boxes size={18} />
            <span>Inventory</span>
          </Link>

          <Link to="/admin/customers" className="admin-nav-link">
            <Users size={18} />
            <span>Customers</span>
          </Link>

          <div className="admin-sidebar-label admin-sidebar-bottom">
            SETTINGS
          </div>

          <Link to="/admin/settings" className="admin-nav-link">
            <Settings size={18} />
            <span>Store Settings</span>
          </Link>
        </nav>

        <Link to="/" className="admin-store-link">
          <Eye size={16} />
          View Store
        </Link>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span>THE URBAN STYLE / ADMIN</span>
            <h1>Dashboard</h1>
          </div>

          <div className="admin-topbar-right">
            <div className="admin-owner-avatar">A</div>
            <div>
              <strong>Store Owner</strong>
              <small>Administrator</small>
            </div>
          </div>
        </header>

        <section className="admin-welcome">
          <div>
            <span>STORE OVERVIEW</span>
            <h2>Welcome to your dashboard.</h2>
            <p>Manage your products, orders and store operations.</p>
          </div>
          <TrendingUp size={34} />
        </section>

        <section className="admin-stats-grid">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <article className="admin-stat-card" key={stat.label}>
                <div className="admin-stat-top">
                  <span>{stat.label}</span>
                  <Icon size={19} />
                </div>
                <strong>{stat.value}</strong>
                <small>{stat.note}</small>
              </article>
            );
          })}
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <span>STORE MANAGEMENT</span>
              <h2>Quick Actions</h2>
            </div>
          </div>

          <div className="admin-actions-grid">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  to={action.path}
                  className="admin-action-card"
                  key={action.title}
                >
                  <div className="admin-action-icon">
                    <Icon size={21} />
                  </div>
                  <div>
                    <strong>{action.title}</strong>
                    <p>{action.description}</p>
                  </div>
                  <ArrowUpRight size={17} />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <span>RECENT ACTIVITY</span>
              <h2>Recent Orders</h2>
            </div>
            <Link to="/admin/orders">View all orders →</Link>
          </div>

          <div className="admin-orders-card">
            {recentOrders.length === 0 ? (
              <div className="admin-empty-state">
                <ShoppingBag size={32} />
                <strong>No orders yet</strong>
                <p>Customer orders will appear here.</p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-orders-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.orderId}>
                        <td>{order.orderId}</td>
                        <td>{order.customer?.name || "Customer"}</td>
                        <td>
                          {new Date(order.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td>{formatCurrency(Number(order.total) || 0)}</td>
                        <td>
                          <span className="admin-order-status">
                            {order.orderStatus?.replaceAll("_", " ") || "Unknown"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="admin-notice">
          <Truck size={19} />
          <div>
            <strong>Local delivery policy</strong>
            <p>
              Online delivery is limited to a maximum 10 km radius from the
              store. Delivery eligibility must be verified before order
              confirmation.
            </p>
          </div>
          <CheckCircle2 size={18} />
        </section>

        <footer className="admin-footer">
          THE URBAN STYLE · ADMIN PANEL
        </footer>
      </main>
    </div>
  );
}