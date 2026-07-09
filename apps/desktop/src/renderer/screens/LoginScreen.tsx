import { useState } from "react";
import { AuthenticationLayout } from "../components/layout/auth-layout";
import { LoginForm } from "../components/auth/login-form";
import type { LoginDto } from "@leadforge/types";

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

  const handleSubmit = (data: LoginDto) => {
    setIsLoading(true);
    console.log("Login submitted with details:", data);

    // Simulated local timeout for UX demonstration
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess();
    }, 1000);
  };

  return (
    <AuthenticationLayout>
      <LoginForm
        onSubmit={handleSubmit}
        onNavigateToRegister={onNavigateToRegister}
        isLoading={isLoading}
      />
    </AuthenticationLayout>
  );
}
