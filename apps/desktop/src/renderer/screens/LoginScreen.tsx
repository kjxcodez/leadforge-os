import { useState } from "react";
import { AuthenticationLayout } from "../components/layout/auth-layout";
import { LoginForm } from "../components/auth/login-form";
import type { LoginDto } from "@leadforge/schema";

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onLoginSuccess: () => void;
}

/**
 * Screen wrapper for the Login interface.
 * Connects layout shell with LoginForm component and manages local loading state.
 */
export function LoginScreen({
  onNavigateToRegister,
  onLoginSuccess,
}: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (data: LoginDto) => {
    setIsLoading(true);
    setErrorMsg(null);
    console.log("Login submitted with details:", data);

    try {
      const res = await window.ipc.invoke("auth:login", data);
      setIsLoading(false);
      if (res && res.token) {
        onLoginSuccess();
      } else {
        setErrorMsg("Authentication failed. Please verify credentials.");
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || "An unexpected error occurred during login.");
    }
  };

  return (
    <AuthenticationLayout>
      <LoginForm
        onSubmit={handleSubmit}
        onNavigateToRegister={onNavigateToRegister}
        isLoading={isLoading}
        error={errorMsg}
      />
    </AuthenticationLayout>
  );
}
