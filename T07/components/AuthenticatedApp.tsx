"use client";

import { useState } from "react";
import PlannerApp from "@/components/PlannerApp";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

export default function AuthenticatedApp({ loginId }: { loginId: string }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("로그아웃에 실패했습니다.");
      }

      window.location.reload();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "로그아웃에 실패했습니다."
      );
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 14,
          right: 16,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 9px 8px 12px",
          borderRadius: 999,
          background: "rgba(255,253,249,.94)",
          border: "1px solid rgba(118,85,57,.20)",
          boxShadow: "0 8px 25px rgba(61,44,30,.10)",
          backdropFilter: "blur(8px)",
          fontSize: 12,
          color: "#66584d",
        }}
      >
        <span>
          <b style={{ color: "#654529" }}>{loginId}</b> 로그인 중
        </span>

        <button
          type="button"
          onClick={() => setChangingPassword(true)}
          disabled={loggingOut}
          style={{
            border: 0,
            borderRadius: 999,
            padding: "7px 10px",
            cursor: loggingOut ? "default" : "pointer",
            background: "#f3eadf",
            color: "#704b2f",
            fontWeight: 800,
          }}
        >
          비밀번호 변경
        </button>

        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          style={{
            border: 0,
            borderRadius: 999,
            padding: "7px 10px",
            cursor: loggingOut ? "wait" : "pointer",
            background: "#eee3d7",
            color: "#704b2f",
            fontWeight: 800,
          }}
        >
          {loggingOut ? "로그아웃 중…" : "로그아웃"}
        </button>
      </div>

      {changingPassword && (
        <ChangePasswordDialog
          onClose={() => setChangingPassword(false)}
        />
      )}

      <PlannerApp />
    </>
  );
}
