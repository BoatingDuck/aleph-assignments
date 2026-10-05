"use client";

import { FormEvent, useState } from "react";

export default function ChangePasswordDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError("");

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "비밀번호 변경에 실패했습니다.");
      }

      window.alert("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
      window.location.reload();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "비밀번호 변경에 실패했습니다."
      );
      setSubmitting(false);
    }
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    border: "1px solid #d8cfc2",
    borderRadius: 12,
    padding: "11px 12px",
    fontSize: 14,
    background: "#fffdf9",
    color: "#342d27",
    outline: "none",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(42, 32, 24, .38)",
        backdropFilter: "blur(4px)",
      }}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !submitting) {
          onClose();
        }
      }}
    >
      <section
        style={{
          width: "min(100%, 420px)",
          borderRadius: 24,
          border: "1px solid #e4d8ca",
          background: "#fffdf9",
          padding: 26,
          boxShadow: "0 24px 80px rgba(44, 31, 20, .24)",
          color: "#342d27",
        }}
      >
        <h2
          id="change-password-title"
          style={{ margin: "0 0 8px", fontSize: 23 }}
        >
          비밀번호 변경
        </h2>

        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13,
            lineHeight: 1.6,
            color: "#77695e",
          }}
        >
          변경이 완료되면 기존 로그인 세션을 모두 끊고 다시 로그인합니다.
        </p>

        <form onSubmit={submit}>
          <label
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            현재 비밀번호
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
            style={fieldStyle}
          />

          <label
            style={{
              display: "block",
              margin: "16px 0 6px",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            새 비밀번호
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            style={fieldStyle}
          />

          <label
            style={{
              display: "block",
              margin: "16px 0 6px",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            새 비밀번호 확인
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            style={fieldStyle}
          />

          {error && (
            <p
              role="alert"
              style={{
                margin: "15px 0 0",
                borderRadius: 12,
                padding: "10px 12px",
                background: "#f8e9e4",
                color: "#994735",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 9,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                border: "1px solid #dfd3c6",
                borderRadius: 13,
                padding: "11px 12px",
                cursor: submitting ? "default" : "pointer",
                background: "#fffdf9",
                color: "#6d5b4d",
                fontWeight: 800,
              }}
            >
              취소
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                border: 0,
                borderRadius: 13,
                padding: "11px 12px",
                cursor: submitting ? "wait" : "pointer",
                background: "#8a5935",
                color: "white",
                fontWeight: 900,
                opacity: submitting ? 0.68 : 1,
              }}
            >
              {submitting ? "변경 중…" : "변경하기"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
