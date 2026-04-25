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

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = sessionStorage.getItem("pkce_state");
    const codeVerifier = sessionStorage.getItem("pkce_verifier") ?? undefined;

    sessionStorage.removeItem("pkce_verifier");
    sessionStorage.removeItem("pkce_state");

    if (!code || state !== storedState) {
      consumePostLoginRedirect();
      navigate("/", { replace: true });
      return;
    }

    handleCallback(code, codeVerifier).then((ok) => {
      const redirectPath = consumePostLoginRedirect();
      navigate(ok ? (redirectPath ?? "/") : "/?login_error=1", {
        replace: true,
      });
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
