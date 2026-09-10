"use client";

import { FormEvent, useMemo, useState } from "react";

type RegisterFormProps = {
  statusMessage?: string;
};

type DraftRegistration = {
  email: string;
  full_name: string;
  password: string;
};

function createOtp(fullName: string, email: string) {
  const seed = `${fullName}:${email}:${Date.now()}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1_000_000;
  }
  return String(hash).padStart(6, "0");
}

export function RegisterForm({ statusMessage }: RegisterFormProps) {
  const [draft, setDraft] = useState<DraftRegistration | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const helperMessage = useMemo(
    () =>
      statusMessage ??
      "Create your seller account to open your store and begin publishing products.",
    [statusMessage],
  );

  function openOtpModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextDraft = {
      email: String(formData.get("email") ?? "").trim(),
      full_name: String(formData.get("full_name") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };

    const nextOtp = createOtp(nextDraft.full_name, nextDraft.email);
    setDraft(nextDraft);
    setOtpCode(nextOtp);
    setOtpInput("");
    setOtpError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setOtpInput("");
    setOtpError("");
  }

  function confirmOtp() {
    if (!draft) {
      setOtpError("Please complete the registration form again.");
      return;
    }

    if (otpInput.trim() !== otpCode) {
      setOtpError("That verification code does not match. Please try again.");
      return;
    }

    const form = document.createElement("form");
    form.method = "post";
    form.action = "/auth/actions/register";

    for (const [name, value] of Object.entries(draft)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

  return (
    <>
      <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141413]">Register</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{helperMessage}</p>

      <form action="/auth/actions/register" className="mt-6 grid gap-4" method="post" onSubmit={openOtpModal}>
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          Full name
          <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" name="full_name" required />
        </label>
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          Email
          <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" name="email" required type="email" />
        </label>
        <label className="grid gap-2 text-sm text-[var(--muted)]">
          Password
          <input className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]" minLength={8} name="password" required type="password" />
        </label>
        <button className="inline-flex items-center justify-center rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white" type="submit">
          Create vendor account
        </button>
      </form>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,14,12,0.48)] px-4 py-6">
          <div className="w-full max-w-md rounded-[1.6rem] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgba(18,16,12,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#907314]">Verification Code</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#141413]">Confirm your new seller account</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Enter the verification code below to continue creating your account.
            </p>
            <div className="mt-5 rounded-[1.2rem] bg-[#f5efe2] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d7727]">Your code</p>
              <p className="mt-2 text-3xl font-semibold tracking-[0.24em] text-[#171615]">{otpCode}</p>
            </div>
            <label className="mt-5 grid gap-2 text-sm text-[var(--muted)]">
              Verification code
              <input
                className="rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-base text-[#121212]"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setOtpInput(event.target.value)}
                value={otpInput}
              />
            </label>
            {otpError ? <p className="mt-3 text-sm text-[#b42318]">{otpError}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center justify-center rounded-full bg-[#111111] px-5 py-3 text-sm font-semibold text-white"
                onClick={confirmOtp}
                type="button"
              >
                Confirm account
              </button>
              <button
                className="inline-flex items-center justify-center rounded-full border border-[#111111] px-5 py-3 text-sm font-semibold text-[#111111]"
                onClick={closeModal}
                type="button"
              >
                Edit details
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
