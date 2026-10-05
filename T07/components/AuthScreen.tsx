"use client";

import { FormEvent, useState } from "react";

type Mode = "login" | "signup";

async function postAuth(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "요청 처리에 실패했습니다.");
  }

  return data;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      if (mode === "signup") {
        await postAuth("/api/auth/signup", { loginId, password });
        setPassword("");
        setMode("login");
        setNotice("가입이 완료되었습니다. 만든 계정으로 로그인해 주세요.");
        return;
      }

      await postAuth("/api/auth/login", { loginId, password });
      window.location.reload();
    } catch (value) {
      setError(value instanceof Error ? value.message : "요청 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    border: "1px solid #d8cfc2",
    borderRadius: 14,
    padding: "13px 14px",
    fontSize: 15,
    background: "#fffdf9",
    color: "#342d27",
    outline: "none",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at 20% 15%, rgba(214,162,107,.20), transparent 34%), #f6f0e7",
        color: "#342d27",
      }}
    >
      <section
        style={{
          width: "min(100%, 440px)",
          background: "rgba(255,253,249,.96)",
          border: "1px solid #e4d8ca",
          borderRadius: 28,
          padding: 30,
          boxShadow: "0 22px 70px rgba(75,55,38,.12)",
        }}
      >
        <p
          style={{
            margin: "0 0 8px",
            letterSpacing: ".18em",
            fontSize: 12,
            fontWeight: 800,
            color: "#9a6940",
          }}
        >
          PLAN · DO · SEE
        </p>

        <h1 style={{ margin: "0 0 8px", fontSize: 32, lineHeight: 1.15 }}>
          플랜두씨 다이어리
        </h1>

        <p style={{ margin: "0 0 24px", lineHeight: 1.65, color: "#75685c" }}>
          로그인한 계정의 기록만 볼 수 있습니다.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            padding: 5,
            borderRadius: 16,
            background: "#efe6da",
            marginBottom: 22,
          }}
        >
          {(["login", "signup"] as Mode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setMode(item);
                setError("");
                setNotice("");
                setPassword("");
              }}
              style={{
                border: 0,
                borderRadius: 12,
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: 800,
                background: mode === item ? "#fffdf9" : "transparent",
                color: mode === item ? "#6f4828" : "#867568",
                boxShadow:
                  mode === item ? "0 5px 14px rgba(91,67,45,.08)" : "none",
              }}
            >
              {item === "login" ? "로그인" : "가입"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit}>
          <label
            style={{
              display: "block",
              marginBottom: 7,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            아이디
          </label>
          <input
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={50}
            required
            style={inputStyle}
            placeholder="아이디 입력"
          />

          <label
            style={{
              display: "block",
              margin: "18px 0 7px",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
            style={inputStyle}
            placeholder="비밀번호 입력"
          />

          {mode === "signup" && (
            <p style={{ margin: "8px 2px 0", fontSize: 12, color: "#85776b" }}>
              비밀번호는 8자 이상으로 입력합니다. 저장할 때는 원문이 아닌
              bcrypt 해시만 보관합니다.
            </p>
          )}

          {notice && (
            <p
              role="status"
              style={{
                margin: "16px 0 0",
                padding: "11px 13px",
                borderRadius: 12,
                background: "#edf5e9",
                color: "#4c6742",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {notice}
            </p>
          )}

          {error && (
            <p
              role="alert"
              style={{
                margin: "16px 0 0",
                padding: "11px 13px",
                borderRadius: 12,
                background: "#f8e9e4",
                color: "#9a4938",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              marginTop: 22,
              border: 0,
              borderRadius: 14,
              padding: "13px 16px",
              cursor: submitting ? "wait" : "pointer",
              background: "#8a5935",
              color: "white",
              fontSize: 15,
              fontWeight: 900,
              opacity: submitting ? 0.68 : 1,
            }}
          >
            {submitting
              ? "처리 중…"
              : mode === "login"
                ? "로그인"
                : "계정 만들기"}
          </button>
        </form>

        <p
          style={{
            margin: "20px 0 0",
            borderTop: "1px solid #eee3d7",
            paddingTop: 16,
            fontSize: 12,
            lineHeight: 1.6,
            color: "#8a7b6e",
          }}
        >
          심사 화면에는 실제 계정 비밀번호를 적지 않습니다.
        </p>
      </section>
    </main>
  );
}
