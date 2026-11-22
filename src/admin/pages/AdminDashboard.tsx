import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
import { useAuth } from "../../auth/AuthContext";
import {
  advanceStoreOrder,
  cancelStoreOrder,
  fetchAdminOrders,
  fulfillStoreOrder,
  verifyStorePayment,
  type StoreOrder,
} from "../../data/supabaseOrders";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function AdminDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [orderActionId, setOrderActionId] = useState<string | null>(null);
  const showAllOrders = location.pathname === "/admin/orders";

  useEffect(() => {
    let active = true;
    void fetchAdminOrders()
      .then((loadedOrders) => {
        if (active) setOrders(loadedOrders);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setOrders([]);
        setOrdersError(error instanceof Error ? error.message : "Unable to load store orders.");
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleOrderAction(order: StoreOrder, action: string) {
    setOrderActionId(order.id);
    setOrdersError("");
    try {
      if (action === "verify") {
        if (!user) throw new Error("Your admin session is unavailable.");
        await verifyStorePayment(order.id, user.id);
      } else if (action === "cancel") {
        await cancelStoreOrder(order.id);
      } else if (action === "fulfill") {
        await fulfillStoreOrder(order.id);
      } else {
        await advanceStoreOrder(order.id, action);
      }
      setOrders(await fetchAdminOrders());
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Unable to update this order.");
    } finally {
      setOrderActionId(null);
    }
  }

  const totalOrders = orders.length;

  const totalSales = orders.reduce(
    (sum, order) => sum + order.total,
    0,
  );

  const pendingOrders = orders.filter(
    (order) => order.order_status === "pending_confirmation",
  ).length;

  const pendingPayments = orders.filter(
    (order) => order.payments.some((payment) => payment.status === "pending_verification"),
  ).length;

  const displayedOrders = showAllOrders ? orders : orders.slice(0, 5);

  const stats = [
    {
      label: "Total Orders",
      value: totalOrders.toString(),
      icon: ShoppingBag,
      note: "Orders stored in Supabase",
    },
    {
      label: "Order Value",
      value: formatCurrency(totalSales),
      icon: IndianRupee,
      note: "Total order value",
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
              <span>{showAllOrders ? "ORDER MANAGEMENT" : "RECENT ACTIVITY"}</span>
              <h2>{showAllOrders ? "Store Orders" : "Recent Orders"}</h2>
            </div>
            {!showAllOrders && <Link to="/admin/orders">View all orders →</Link>}
          </div>

          <div className="admin-orders-card">
            {ordersError && <p className="admin-add-product-error" role="alert">{ordersError}</p>}
            {ordersLoading ? (
              <p role="status">Loading orders from Supabase…</p>
            ) : displayedOrders.length === 0 ? (
              <div className="admin-empty-state">
                <ShoppingBag size={32} />
                <strong>No orders yet</strong>
                <p>Orders placed by signed-in customers will appear here.</p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-orders-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer / Items</th>
                      <th>Delivery</th>
                      <th>Payment</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedOrders.map((order) => {
                      const payment = order.payments[0];
                      const nextStatus: Record<string, string> = {
                        pending_confirmation: "confirmed",
                        confirmed: "preparing",
                        preparing: "dispatched",
                      };
                      const working = orderActionId === order.id;
                      return (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.order_number}</strong>
                          <small>{order.order_status.replaceAll("_", " ")}</small>
                        </td>
                        <td>
                          <strong>{order.customer_name_snapshot}</strong>
                          <small>{order.customer_phone_snapshot}</small>
                          <details>
                            <summary>{order.items.length} item(s)</summary>
                            {order.items.map((item) => (
                              <small key={item.id}>
                                {item.product_name_snapshot} · {item.color_snapshot} · {item.size_snapshot}
                                {" × "}{item.quantity} · {formatCurrency(item.line_total)}
                              </small>
                            ))}
                          </details>
                        </td>
                        <td>
                          <strong>{order.fulfillment_method === "pickup" ? "Store pickup" : "Delivery"}</strong>
                          {order.fulfillment_method === "delivery" && (
                            <small>
                              {order.address_line_snapshot}, {order.city_snapshot} {order.postal_code_snapshot}
                              {" · "}{order.delivery_radius_status.replaceAll("_", " ")}
                            </small>
                          )}
                        </td>
                        <td>
                          <strong>{order.payment_method.toUpperCase()}</strong>
                          <small>{payment?.status.replaceAll("_", " ") ?? "No payment record"}</small>
                          {payment?.upi_reference && <small>UTR: {payment.upi_reference}</small>}
                        </td>
                        <td>
                          {new Date(order.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td>{formatCurrency(order.total)}</td>
                        <td>
                          <span className="admin-order-status">
                            {order.order_status.replaceAll("_", " ")}
                          </span>
                        </td>
                        <td>
                          {payment?.method === "upi" && payment.status === "pending_verification" && (
                            <button type="button" disabled={working} onClick={() => void handleOrderAction(order, "verify")}>
                              Verify UPI
                            </button>
                          )}
                          {nextStatus[order.order_status] && (
                            <button type="button" disabled={working} onClick={() => void handleOrderAction(order, nextStatus[order.order_status])}>
                              {nextStatus[order.order_status]}
                            </button>
                          )}
                          {order.order_status === "dispatched" && (
                            <button type="button" disabled={working} onClick={() => void handleOrderAction(order, "fulfill")}>
                              Fulfil
                            </button>
                          )}
                          {!["cancelled", "fulfilled"].includes(order.order_status) && (
                            <button type="button" disabled={working} onClick={() => void handleOrderAction(order, "cancel")}>
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );})}
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