import { describe, expect, it, vi } from "vitest";

import { authErrorMessage, AUTH_TIMEOUT, withTimeout } from "./auth-errors";

describe("authErrorMessage", () => {
  it("traduce i messaggi di Supabase", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"))).toBe(
      "Email o password non corretti.",
    );
    expect(authErrorMessage("Email not confirmed")).toMatch(/confermare l'email/);
    expect(authErrorMessage(new Error("Failed to fetch"))).toMatch(
      /Connessione non riuscita/,
    );
  });

  it("dice cosa fare quando il server non risponde", () => {
    expect(authErrorMessage(new Error("tempo scaduto"))).toMatch(
      /non ha risposto.*è ancora qui/,
    );
  });

  it("su un errore sconosciuto non inventa una spiegazione", () => {
    expect(authErrorMessage(new Error("boom xyz"))).toBe("boom xyz");
    expect(authErrorMessage(undefined)).toBe("Qualcosa è andato storto. Riprova.");
  });
});

describe("withTimeout", () => {
  it("lascia passare una risposta che arriva in tempo", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("propaga gli errori veri senza mascherarli", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("credenziali")), 50),
    ).rejects.toThrow("credenziali");
  });

  it("smette di aspettare una risposta che non arriva", async () => {
    vi.useFakeTimers();
    try {
      const hanging = new Promise(() => {});
      const raced = withTimeout(hanging, 100);
      const assertion = expect(raced).rejects.toThrow("tempo scaduto");
      await vi.advanceTimersByTimeAsync(150);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("aspetta venti secondi per default", () => {
    // Abbastanza per una rete lenta, non tanto da sembrare bloccata.
    expect(AUTH_TIMEOUT).toBe(20_000);
  });
});
