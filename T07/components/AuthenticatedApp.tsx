"use client";

import { useState } from "react";
import PlannerApp from "@/components/PlannerApp";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";

export default function AuthenticatedApp({ loginId }: { loginId: string }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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
      <div className="auth-account-bar">
        <span>
          <b>{loginId}</b> 로그인 중
        </span>

        <button
          type="button"
          onClick={() => setChangingPassword(true)}
          disabled={loggingOut}
        >
          비밀번호 변경
        </button>

        <button
          type="button"
          onClick={() => setDeletingAccount(true)}
          disabled={loggingOut}
        >
          계정 삭제
        </button>

        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
        >
          {loggingOut ? "로그아웃 중" : "로그아웃"}
        </button>
      </div>

      {changingPassword && (
        <ChangePasswordDialog onClose={() => setChangingPassword(false)} />
      )}

      {deletingAccount && (
        <DeleteAccountDialog
          loginId={loginId}
          onClose={() => setDeletingAccount(false)}
        />
      )}

      <PlannerApp />
    </>
  );
}
