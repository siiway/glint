import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@fluentui/react-components";
import { useAuth } from "../auth";
import { consumePostLoginRedirect } from "../utils/authRedirect";

export function CallbackPage() {
  const { handleCallback } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const failNavigate = (reason: string, message?: string) => {
      consumePostLoginRedirect();
      const params = new URLSearchParams({ reason });
      if (message) params.set("message", message);
      navigate(`/login-failed?${params.toString()}`, { replace: true });
    };

    const providerError = searchParams.get("error");
    if (providerError) {
      const description =
        searchParams.get("error_description") ?? providerError;
      failNavigate("provider_denied", description);
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = sessionStorage.getItem("pkce_state");
    const codeVerifier = sessionStorage.getItem("pkce_verifier") ?? undefined;

    sessionStorage.removeItem("pkce_verifier");
    sessionStorage.removeItem("pkce_state");

    if (!code || state !== storedState) {
      failNavigate("state_mismatch");
      return;
    }

    handleCallback(code, codeVerifier).then((result) => {
      if (result.ok) {
        const redirectPath = consumePostLoginRedirect();
        navigate(redirectPath ?? "/", { replace: true });
      } else {
        failNavigate(result.reason, result.message);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
      }}
    >
      <Spinner size="large" />
    </div>
  );
}
