import { useState } from "react";
import { api } from "./api";
import "./App.css";
import PhoneLogin from "./components/PhoneLogin";
import OtpVerify from "./components/OtpVerify";
import RegisterProfile from "./components/RegisterProfile";
import Home from "./components/Home";
import Feed from "./components/Feed";
import OnboardingWizard from "./components/onboarding/OnboardingWizard";

export default function App() {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otpMeta, setOtpMeta] = useState(null);
  const [user, setUser] = useState(null);

  function handleOtpSent(phoneNumber, result) {
    setPhone(phoneNumber);
    setOtpMeta(result);
    setStep("otp");
  }

  async function handleResend() {
    const result = await api("POST", "/api/auth/request-otp", { phone });
    setOtpMeta(result);
  }

  function handleVerified(verifiedUser) {
    if (!verifiedUser.profile_complete) {
      setStep("register");
      return;
    }
    setUser(verifiedUser);
    setStep(needsOnboarding(verifiedUser) ? "onboarding" : "home");
  }

  function needsOnboarding(u) {
    return u.role === "worker" && !u.onboarding_complete;
  }

  function handleRegisterDone(newUser) {
    setUser(newUser);
    setStep(needsOnboarding(newUser) ? "onboarding" : "home");
  }

  function handleLogout() {
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
    return <RegisterProfile phone={phone} onDone={handleRegisterDone} onBack={() => setStep("phone")} />;
  }
  if (step === "onboarding") {
    return <OnboardingWizard phone={phone} onComplete={() => setStep("home")} />;
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
      onGoRegister={() => setStep("phone")}
    />
  );
}
