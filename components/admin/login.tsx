"use client";
import { useBranding } from "@/components/theme-provider";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Fingerprint,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Check,
  Loader2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
export default function Login({
  mode = "login",
}: {
  mode?: "login" | "forgot-password" | "reset-password";
}) {
  const branding = useBranding();
  const router = useRouter();
  const query = useSearchParams();
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [backup, setBackup] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (twoFactor) {
        const result = backup
          ? await authClient.twoFactor.verifyBackupCode({
              code: String(data.code),
            })
          : await authClient.twoFactor.verifyTotp({ code: String(data.code) });
        if (result.error) throw new Error(result.error.message);
        router.replace("/admin");
        router.refresh();
        return;
      }
      if (mode === "forgot-password") {
        await authClient.requestPasswordReset({
          email: String(data.email),
          redirectTo: "/admin/reset-password",
        });
        setSent(true);
        return;
      }
      if (mode === "reset-password") {
        const result = await authClient.resetPassword({
          newPassword: String(data.password),
          token: query.get("token") || "",
        });
        if (result.error) throw new Error(result.error.message);
        toast.success("Password updated");
        router.replace("/admin/login");
        return;
      }
      const result = await authClient.signIn.email({
        email: String(data.email),
        password: String(data.password),
        rememberMe: true,
      });
      if (result.error)
        throw new Error(
          "Unable to sign in. Check your details or try again later.",
        );
      if ((result.data as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
        setTwoFactor(true);
        return;
      }
      toast.success("Welcome back", {
        description: "You’re signed in securely.",
      });
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to complete this request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="a-login">
      <div className="a-login-brand-panel">
        <Link href="/" className="logo">
          {branding.darkLogo || branding.logo ? (
            <img
              src={branding.darkLogo || branding.logo}
              alt=""
              width={34}
              height={34}
            />
          ) : (
            <span className="brand-mark">
              <i />
              <i />
            </span>
          )}
          {branding.name}
        </Link>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1 }}
        >
          <span className="eyebrow">YOUR CREATIVE WORLD, CONNECTED.</span>
          <h1>
            Good to have
            <br />
            you back.
          </h1>
          <p>
            A considered space to manage your website, content and
            conversations.
          </p>
          <ul>
            <li>
              <ShieldCheck size={17} />
              Secure, private workspace
            </li>
            <li>
              <Check size={17} />
              Role-based access
            </li>
            <li>
              <Check size={17} />
              Your content, in one place
            </li>
          </ul>
        </motion.div>

        <div className="a-login-wave" aria-hidden="true" />
      </div>
      <div className="a-login-form-panel">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <span className="a-login-kicker">ROYAL STUDIO / AGENCY CMS</span>
          <h2>
            {twoFactor
              ? "One more step."
              : mode === "login"
                ? "Sign in to your account"
                : mode === "forgot-password"
                  ? "A fresh start."
                  : "Set a new password"}
          </h2>
          <p>
            {twoFactor
              ? "Enter the six-digit code from your authenticator."
              : mode === "login"
                ? "Welcome back. Let’s make something happen."
                : mode === "forgot-password"
                  ? "We’ll send a reset link if an account matches your email."
                  : "Choose a strong password with at least 12 characters."}
          </p>
          {sent ? (
            <div className="a-reset-sent">
              <Check />
              <h3>Check your inbox</h3>
              <p>
                If an account matches that address and delivery is configured,
                you’ll receive a reset link. It expires after 30 minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="a-login-form">
              {twoFactor ? (
                <>
                  <label>
                    {backup ? "Recovery code" : "Authenticator code"}
                    <input
                      name="code"
                      inputMode={backup ? "text" : "numeric"}
                      pattern={backup ? undefined : "[0-9]{6}"}
                      maxLength={backup ? 40 : 6}
                      required
                      autoComplete="one-time-code"
                    />
                  </label>
                  <button
                    className="a-button secondary small"
                    type="button"
                    onClick={() => setBackup(!backup)}
                  >
                    {backup ? "Use authenticator code" : "Use a recovery code"}
                  </button>
                </>
              ) : (
                <>
                  {mode !== "reset-password" && (
                    <label>
                      Email address
                      <div className="a-input-icon">
                        <Mail size={17} />
                        <input
                          name="email"
                          type="email"
                          placeholder="you@agency.com"
                          required
                          autoComplete="username"
                        />
                      </div>
                    </label>
                  )}
                  {mode !== "forgot-password" && (
                    <label>
                      {mode === "reset-password" ? "New password" : "Password"}
                      <div className="a-input-icon">
                        <Lock size={17} />
                        <input
                          name="password"
                          type={show ? "text" : "password"}
                          placeholder="Enter your password"
                          required
                          minLength={mode === "reset-password" ? 12 : 1}
                          autoComplete={
                            mode === "reset-password"
                              ? "new-password"
                              : "current-password"
                          }
                        />
                        <button
                          type="button"
                          aria-label={show ? "Hide password" : "Show password"}
                          onClick={() => setShow(!show)}
                        >
                          {show ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </label>
                  )}
                  {mode === "login" && (
                    <button
                      type="button"
                      className="a-button secondary passkey-login"
                      disabled={busy}
                      onClick={async () => {
                        setError("");
                        if (
                          !window.isSecureContext ||
                          !window.PublicKeyCredential
                        ) {
                          setError(
                            "Passkeys are unavailable in this browser. Use your password to sign in.",
                          );
                          return;
                        }
                        setBusy(true);
                        try {
                          const result = await authClient.signIn.passkey();
                          if (result.error)
                            throw Error(
                              result.error.message ||
                                "Passkey sign-in was cancelled. Use your password or try again.",
                            );
                          router.replace("/admin");
                          router.refresh();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Fingerprint size={19} />
                      Sign in with fingerprint / passkey
                    </button>
                  )}
                  {mode === "login" && (
                    <div className="a-login-options">
                      <span>Stay signed in on this device</span>
                      <Link href="/admin/forgot-password">
                        Forgot password?
                      </Link>
                    </div>
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="a-form-error">
                  {error}
                </p>
              )}
              <button className="a-button" disabled={busy}>
                {busy ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <>
                    {twoFactor
                      ? "Verify code"
                      : mode === "login"
                        ? "Sign in"
                        : mode === "forgot-password"
                          ? "Send reset link"
                          : "Update password"}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}
          {mode !== "login" && (
            <Link className="a-back-login" href="/admin/login">
              Back to sign in
            </Link>
          )}
          <div className="a-login-note">
            <Lock size={12} /> Access is limited to authorized team members.
          </div>
        </motion.div>
      </div>
    </main>
  );
}
