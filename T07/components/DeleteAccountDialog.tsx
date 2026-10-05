"use client";

import { FormEvent, useState } from "react";

export default function DeleteAccountDialog({
  loginId,
  onClose,
}: {
  loginId: string;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canDelete =
    password.length > 0 &&
    confirmation.trim() === "계정 삭제" &&
    !submitting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canDelete) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "계정 삭제에 실패했습니다.");
      }

      window.location.href = "/";
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "계정 삭제에 실패했습니다."
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      className="delete-account-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <form className="delete-account-dialog" onSubmit={submit}>
        <div>
          <p className="delete-account-eyebrow">ACCOUNT</p>
          <h2 id="delete-account-title">계정 삭제</h2>
        </div>

        <p className="delete-account-warning">
          <b>{loginId}</b> 계정을 삭제하면 이 계정의 계획, 할 일,
          실행 기록, 돌아보기, 관찰 설정과 관찰 기록, 세션이 함께
          삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>

        <label>
          현재 비밀번호
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label>
          확인 문구
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="계정 삭제"
            required
          />
          <small>
            계속하려면 <b>계정 삭제</b>를 정확히 입력하세요.
          </small>
        </label>

        {error && <p className="delete-account-error">{error}</p>}

        <div className="delete-account-actions">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </button>

          <button
            type="submit"
            disabled={!canDelete}
          >
            {submitting ? "삭제 중" : "계정 영구 삭제"}
          </button>
        </div>
      </form>
    </div>
  );
}
