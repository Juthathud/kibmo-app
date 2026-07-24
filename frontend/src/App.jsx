import { useEffect, useState } from "react";
import { api, setAuthToken } from "./api";
import "./App.css";
import PhoneLogin from "./components/PhoneLogin";
import OtpVerify from "./components/OtpVerify";
import RegisterProfile from "./components/RegisterProfile";
import Home from "./components/Home";
import Feed from "./components/Feed";
import OnboardingWizard from "./components/onboarding/OnboardingWizard";

const STORAGE_KEY = "kibmoo_user";

function needsOnboarding(u) {
  return (u.role === "worker" || u.role === "both") && !u.onboarding_complete;
}

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const storedUser = loadStoredUser();
  const [step, setStep] = useState(storedUser ? (needsOnboarding(storedUser) ? "onboarding" : "home") : "phone");
  const [phone, setPhone] = useState(storedUser?.phone || "");
  const [otpMeta, setOtpMeta] = useState(null);
  const [user, setUser] = useState(storedUser);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  function handleOtpSent(phoneNumber, result) {
    setPhone(phoneNumber);
    setOtpMeta(result);
    setStep("otp");
  }

  async function handleResend() {
    const result = await api("POST", "/api/auth/request-otp", { phone });
    setOtpMeta(result);
  }

  function handleVerified(verifiedUser, token) {
    setAuthToken(token);
    if (!verifiedUser.profile_complete) {
      setStep("register");
      return;
    }
    setUser(verifiedUser);
    setStep(needsOnboarding(verifiedUser) ? "onboarding" : "home");
  }

  function handleRegisterDone(newUser) {
    setUser(newUser);
    setStep(needsOnboarding(newUser) ? "onboarding" : "home");
  }

  function handleOnboardingComplete() {
    setUser((u) => (u ? { ...u, onboarding_complete: 1 } : u));
    setStep("home");
  }

  async function handleLogout() {
    try {
      await api("POST", "/api/auth/logout");
    } catch {
      // best-effort — proceed with client-side logout even if this fails
      // (e.g. offline, or the session was already gone)
    }
    setAuthToken(null);
    setUser(null);
    setPhone("");
    setOtpMeta(null);
    setStep("phone");
  }

  if (step === "otp") {
    return (
      <OtpVerify
        phone={phone}
        refCode={otpMeta.ref}
        ttlSeconds={otpMeta.ttl_seconds}
        devOtp={otpMeta.dev_otp}
        onVerified={handleVerified}
        onResend={handleResend}
        onBack={() => setStep("phone")}
      />
    );
  }
  if (step === "register") {
    return <RegisterProfile onDone={handleRegisterDone} onBack={() => setStep("phone")} />;
  }
  if (step === "onboarding") {
    return <OnboardingWizard phone={phone} onComplete={handleOnboardingComplete} />;
  }
  if (step === "home" && user) {
    return <Home user={user} onLogout={handleLogout} />;
  }
  if (step === "feed") {
    return <Feed onGoLogin={() => setStep("phone")} />;
  }
  return (
    <PhoneLogin
      onOtpSent={handleOtpSent}
      onBrowseFeed={() => setStep("feed")}
    />
  );
}
