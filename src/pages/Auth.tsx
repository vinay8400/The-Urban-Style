import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

const OAUTH_REDIRECT_KEY = "urban-style-auth-redirect";
const RECOVERY_COOLDOWN_SECONDS = 60;

function getSafeRedirect(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function getRoleRedirect(isAdmin: boolean, requested: string | null) {
  const safeRedirect = getSafeRedirect(requested);
  const isAdminPath = /^\/admin(?:\/|$)/.test(safeRedirect);
  if (isAdmin) return isAdminPath ? safeRedirect : "/admin";
  return isAdminPath ? "/account" : safeRedirect;
}

function getDisplayName(user: ReturnType<typeof useAuth>["user"]) {
  const fullName = user?.user_metadata.full_name;
  return typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : user?.email ?? "Customer";
}

function AuthShell({
  eyebrow = "THE URBAN STYLE",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="home-eyebrow">{eyebrow}</span>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
    </main>
  );
}

function AuthMessage({
  error,
  success,
}: {
  error: string;
  success: string;
}) {
  return (
    <>
      {error && <p className="auth-message auth-error" role="alert">{error}</p>}
      {success && <p className="auth-message auth-success" role="status">{success}</p>}
    </>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <span className="auth-password-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          className="auth-password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const { user, isAdmin, loading, error: authError } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedRedirect = searchParams.get("next");
  const redirectTo = getRoleRedirect(isAdmin, requestedRedirect);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <main className="auth-loading" role="status">Restoring your account…</main>;
  }
  if (user) return <Navigate to={redirectTo} replace />;

  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    if (isSignup && !name.trim()) {
      setError("Enter your full name.");
      return;
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (signupError) {
          setError("Unable to create your account. Check your details and try again.");
        } else if (!data.session) {
          setSuccess("Account created. Check your email and verify your address before signing in.");
        }
      } else {
        const { error: signinError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signinError) {
          setError("Sign-in was unsuccessful. Check your credentials and confirm your email address.");
        }
      }
    } catch {
      setError("We could not complete your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      sessionStorage.setItem(
        OAUTH_REDIRECT_KEY,
        getSafeRedirect(requestedRedirect),
      );
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) {
        sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
        setError("Google sign-in is unavailable. Please try again.");
        setSubmitting(false);
      }
    } catch {
      sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
      setError("We could not start Google sign-in. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={isSignup ? "Create your account" : "Welcome back"}
      description={isSignup
        ? "Create an account to place and manage your orders."
        : "Sign in to continue to your account."}
    >
      <AuthMessage error={error || authError || ""} success={success} />
      <button
        className="auth-google-button"
        type="button"
        onClick={() => void continueWithGoogle()}
        disabled={submitting}
      >
        <span aria-hidden="true">G</span>
        Continue with Google
      </button>
      <div className="auth-divider"><span>or continue with email</span></div>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        {isSignup && (
          <label className="auth-field" htmlFor="auth-name">
            <span>Full name</span>
            <input
              id="auth-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
        )}
        <label className="auth-field" htmlFor="auth-email">
          <span>Email address</span>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <PasswordInput
          id="auth-password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete={isSignup ? "new-password" : "current-password"}
        />
        {isSignup && (
          <PasswordInput
            id="auth-confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
        )}
        {!isSignup && (
          <div className="auth-inline-link">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        )}
        <button className="auth-submit-button" type="submit" disabled={submitting}>
          {submitting
            ? "Please wait…"
            : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "New to THE URBAN STYLE?"}{" "}
        <Link
          to={`${isSignup ? "/login" : "/signup"}${location.search}`}
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </AuthShell>
  );
}

export function LoginPage() {
  return <AuthPage mode="signin" />;
}

export function SignupPage() {
  return <AuthPage mode="signup" />;
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (requestError) {
        setError("We could not request a recovery code. Please check the email and try again.");
      } else {
        navigate(`/reset-password?email=${encodeURIComponent(email.trim())}&sent=1`);
      }
    } catch {
      setError("We could not request a recovery code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Reset your password" description="Enter the email address associated with your account.">
      <AuthMessage error={error} success={success} />
      <form className="auth-form" onSubmit={(event) => void requestCode(event)}>
        <label className="auth-field" htmlFor="recovery-email">
          <span>Email address</span>
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <button className="auth-submit-button" type="submit" disabled={submitting}>
          {submitting ? "Requesting code…" : "Email recovery code"}
        </button>
      </form>
      <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailFromUrl = searchParams.get("email") ?? "";
  const requestedFromForm = searchParams.get("sent") === "1";
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(
    requestedFromForm ? RECOVERY_COOLDOWN_SECONDS : 0,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit recovery code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "recovery",
      });
      if (verifyError) {
        setError("That recovery code is invalid or expired. Request a new code and try again.");
      } else {
        setVerified(true);
        setSuccess("Email verified. Choose a new password.");
      }
    } catch {
      setError("We could not verify that code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const { error: resendError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (resendError) {
        setError("We could not resend the recovery code. Please try again later.");
      } else {
        setCooldown(RECOVERY_COOLDOWN_SECONDS);
        setSuccess("If an account exists for this email, a new recovery code has been sent.");
      }
    } catch {
      setError("We could not resend the recovery code. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("We could not update your password. Please try again.");
      } else {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          setError("Your password was changed, but sign-out did not complete. Please sign out before continuing.");
        } else {
          setSuccess("Your password has been updated. You can now sign in.");
          window.setTimeout(() => navigate("/login", { replace: true }), 1200);
        }
      }
    } catch {
      setError("We could not update your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={verified ? "Choose a new password" : "Verify your email"}
      description={verified
        ? "Set a new password for your account."
        : "Enter the 6-digit recovery code sent to your email."}
    >
      <AuthMessage error={error} success={success} />
      {!verified ? (
        <form className="auth-form" onSubmit={(event) => void verifyCode(event)}>
          <label className="auth-field" htmlFor="recovery-email-address">
            <span>Email address</span>
            <input
              id="recovery-email-address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="auth-field" htmlFor="recovery-code">
            <span>6-digit recovery code</span>
            <input
              id="recovery-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </label>
          <button className="auth-submit-button" type="submit" disabled={submitting}>
            {submitting ? "Verifying…" : "Verify code"}
          </button>
          <button
            className="auth-resend-button"
            type="button"
            disabled={submitting || cooldown > 0 || !email.trim()}
            onClick={() => void resendCode()}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend recovery code"}
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={(event) => void updatePassword(event)}>
          <PasswordInput
            id="new-password"
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordInput
            id="confirm-new-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          <button className="auth-submit-button" type="submit" disabled={submitting}>
            {submitting ? "Updating password…" : "Update password"}
          </button>
        </form>
      )}
      {!verified && <p className="auth-switch"><Link to="/forgot-password">Change email</Link></p>}
    </AuthShell>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="auth-loading" role="status">Loading your account…</main>;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="auth-loading" role="status">Verifying admin access…</main>;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!isAdmin) return <Navigate to="/account" replace />;
  return children;
}

export function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSignOut() {
    setError("");
    setSubmitting(true);
    const signOutError = await signOut();
    setSubmitting(false);
    if (signOutError) {
      setError(signOutError);
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <AuthShell title="My account" description="Your THE URBAN STYLE customer account.">
      <AuthMessage error={error} success="" />
      <div className="account-profile">
        <div>
          <span className="account-profile-label">Customer name</span>
          <strong>{getDisplayName(user)}</strong>
        </div>
        <div>
          <span className="account-profile-label">Email address</span>
          <strong>{user?.email}</strong>
        </div>
      </div>
      <Link className="auth-account-link" to="/account/orders">View my orders</Link>
      <button
        className="auth-submit-button"
        type="button"
        onClick={() => void handleSignOut()}
        disabled={submitting}
      >
        {submitting ? "Signing out…" : "Sign out"}
      </button>
    </AuthShell>
  );
}

export function AuthRedirectHandler() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || loading) return;
    const destination = sessionStorage.getItem(OAUTH_REDIRECT_KEY);
    if (!destination) return;
    sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
    navigate(getRoleRedirect(isAdmin, destination), { replace: true });
  }, [user, isAdmin, loading, navigate]);

  return null;
}
