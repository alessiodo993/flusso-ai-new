"use client";

import {
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ToggleRow } from "@/components/ui/toggle-row";
import { PROJECT_COLORS, safeCalendarColor } from "@/lib/colors";
import {
  useGoogleAccounts,
  useGoogleCalendars,
  useGoogleConfig,
  useGoogleSync,
  useUpdateGoogleCalendar,
  useVerifyGoogleConfig,
} from "@/lib/hooks/use-google";
import { useSettings, useUpdateSettings } from "@/lib/hooks/use-settings";
import { cn } from "@/lib/utils";

/**
 * Account e calendari Google.
 *
 * La scrittura verso Google è **spenta di default** e la prima accensione
 * chiede conferma: da quel momento un blocco spostato qui cambia un evento
 * là, e può finire sotto gli occhi di altre persone. Non è una preferenza
 * come le altre.
 */
export function GooglePanel() {
  const { accounts, needReconnect } = useGoogleAccounts();
  const { calendars } = useGoogleCalendars();
  const updateCalendar = useUpdateGoogleCalendar();
  const { settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const sync = useGoogleSync();
  const { config } = useGoogleConfig();
  const verify = useVerifyGoogleConfig();

  const [confirming, setConfirming] = useState(false);
  const writeTarget = calendars.find((one) => one.is_write_target);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/*
          `aggiungi=1` non è un dettaglio: senza, Google rimanda l'account già
          collegato invece di farne scegliere un altro, e il secondo
          collegamento sembra semplicemente non funzionare.
        */}
        <a
          className="btn btn-soft"
          href={
            accounts.length === 0
              ? "/api/google/connect"
              : "/api/google/connect?aggiungi=1"
          }
        >
          <Plus className="size-4" />
          {accounts.length === 0 ? "Collega Google" : "Aggiungi account"}
        </a>

        {accounts.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            {sync.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Aggiorna adesso
          </button>
        )}
      </div>

      {/*
        I problemi di configurazione si mostrano **prima** del collegamento.
        Altrimenti l'unica diagnosi disponibile è la pagina di Google — «Errore
        401: invalid_client» — che non dice quale variabile guardare.
      */}
      {config && config.problemi.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-flusso-md border border-danger/30 bg-danger-soft p-3"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="font-medium">
              Il collegamento fallirà: manca qualcosa nella configurazione.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-ink-soft">
              {config.problemi.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {needReconnect.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-flusso-md border border-warn/30 bg-warn-soft p-3"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <div className="min-w-0 flex-1 text-sm">
            <p>
              {needReconnect.length === 1
                ? `L'accesso a ${needReconnect[0].email} è scaduto.`
                : `${needReconnect.length} account vanno ricollegati.`}
            </p>
            {/* `email` diventa `login_hint`: Google si apre già sull'account
                scaduto invece di farne scegliere uno fra cinque. */}
            <a
              className="btn btn-soft mt-2 h-8 px-2.5 text-xs"
              href={`/api/google/connect?email=${encodeURIComponent(
                needReconnect[0].email ?? "",
              )}`}
            >
              Riconnetti {needReconnect.length === 1 ? needReconnect[0].email : ""}
            </a>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="py-2 text-sm text-ink-soft">
          Senza un account collegato il calendario mostra solo i blocchi di
          Flusso: le riunioni degli altri restano invisibili, e il planner le
          ignora perché non le conosce.
        </p>
      ) : (
        <>
          <ul className="space-y-1">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate">{account.email}</span>
                <span className="shrink-0 text-xs text-ink-faint">
                  {
                    calendars.filter(
                      (one) => one.account_id === account.id && one.enabled,
                    ).length
                  }{" "}
                  attivi
                </span>
              </li>
            ))}
          </ul>

          <div>
            <p className="label mb-1.5">Calendari</p>
            <ul className="space-y-1.5">
              {calendars.map((calendar) => (
                <li
                  key={calendar.id}
                  className="rounded-flusso-md border border-line p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: safeCalendarColor(calendar.color) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {calendar.name}
                    </span>
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-[var(--accent)]"
                      checked={calendar.enabled}
                      aria-label={`Mostra ${calendar.name} nel calendario`}
                      onChange={(event) =>
                        updateCalendar.mutate({
                          id: calendar.id,
                          enabled: event.target.checked,
                        })
                      }
                    />
                  </div>

                  {calendar.enabled && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {PROJECT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Colore ${color} per ${calendar.name}`}
                          aria-pressed={safeCalendarColor(calendar.color) === color}
                          onClick={() =>
                            updateCalendar.mutate({ id: calendar.id, color })
                          }
                          className={cn(
                            "size-6 rounded-full border-2",
                            safeCalendarColor(calendar.color) === color
                              ? "border-ink"
                              : "border-transparent",
                          )}
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="hairline pt-3">
            <ToggleRow
              label="Scrivi i blocchi su Google"
              hint={
                settings.google_write_enabled
                  ? writeTarget
                    ? `I blocchi finiscono su «${writeTarget.name}».`
                    : "Scegli sotto su quale calendario scriverli."
                  : "Per ora Flusso legge soltanto."
              }
              checked={settings.google_write_enabled}
              onCheckedChange={(next) => {
                if (!next) {
                  updateSettings.mutate({ google_write_enabled: false });
                  return;
                }
                // Prima accensione: la conferma è esplicita perché da qui in
                // poi le modifiche escono da Flusso.
                setConfirming(true);
              }}
            />

            {confirming && (
              <div className="mt-2 rounded-flusso-md border border-line bg-sunken p-3">
                <p className="text-sm">
                  Da adesso ogni blocco pianificato, spostato o completato
                  cambierà anche l&apos;evento corrispondente su Google, visibile
                  a chi ha accesso a quel calendario. Confermi?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-soft h-8 flex-1 text-xs"
                    onClick={() => setConfirming(false)}
                  >
                    No, resto in lettura
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary h-8 flex-1 text-xs"
                    onClick={() => {
                      updateSettings.mutate({ google_write_enabled: true });
                      setConfirming(false);
                      if (!writeTarget) {
                        toast("Scegli su quale calendario scrivere.");
                      }
                    }}
                  >
                    Sì, scrivi su Google
                  </button>
                </div>
              </div>
            )}

            {settings.google_write_enabled && (
              <ul className="mt-2 space-y-1">
                {calendars
                  .filter((one) => one.enabled)
                  .map((calendar) => (
                    <li key={calendar.id}>
                      <label className="flex min-h-11 items-center gap-2.5 text-sm">
                        <input
                          type="radio"
                          name="write-target"
                          className="size-4 accent-[var(--accent)]"
                          checked={calendar.is_write_target}
                          onChange={() =>
                            updateCalendar.mutate({
                              id: calendar.id,
                              is_write_target: true,
                            })
                          }
                        />
                        <span className="truncate">{calendar.name}</span>
                      </label>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </>
      )}

      {config && (
        <details className="hairline pt-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-ink-soft">
            Configurazione OAuth
          </summary>

          <div className="mt-2 space-y-2">
            <p className="text-ink-soft">
              Questi sono i valori che Flusso sta usando davvero. Devono
              coincidere con quelli in Google Cloud → APIs &amp; Services →
              Credentials.
            </p>

            {/* Il client ID **non è un segreto**: viaggia in chiaro nell'URL di
                consenso. Mostrarlo a metà renderebbe impossibile l'unica cosa
                per cui serve, cioè confrontarlo. */}
            <dl className="space-y-1.5">
              <Row label="Client ID" value={config.clientId ?? "— assente —"} />
              <Row
                label="Client secret"
                value={config.clientSecret ?? "— assente —"}
              />
              {/* Della chiave di cifratura non esce nulla, nemmeno mascherata:
                  qui serve sapere solo se è utilizzabile. */}
              <Row
                label="Chiave di cifratura"
                value={
                  config.tokenSecret === "ok"
                    ? "impostata e valida"
                    : "— non utilizzabile —"
                }
              />
              {/* Copiabile perché è l'unico valore che va **trascritto** in
                  Google Cloud: uno slash finale di troppo o `http` al posto di
                  `https` bastano a far fallire il collegamento con
                  `redirect_uri_mismatch`. */}
              <Row label="Redirect URI" value={config.redirectUri} copiabile />
              <Row
                label="APP_URL"
                value={
                  config.appUrlConfigurato
                    ? config.appUrl
                    : `${config.appUrl} (dedotto, non impostato)`
                }
              />
            </dl>

            <button
              type="button"
              className="btn btn-soft h-11"
              onClick={() => verify.mutate()}
              disabled={verify.isPending}
            >
              {verify.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Verifica le credenziali con Google
            </button>

            {config.verifica && (
              <p
                className={cn(
                  "rounded-flusso-md p-2.5",
                  config.verifica.ok
                    ? "bg-accent-soft text-ink"
                    : "bg-danger-soft text-ink",
                )}
              >
                {config.verifica.message}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

/** Una riga della diagnostica: etichetta corta, valore selezionabile. */
function Row({
  label,
  value,
  copiabile,
}: {
  label: string;
  value: string;
  copiabile?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-faint">{label}</dt>
      <dd className="flex items-start gap-2">
        <span className="min-w-0 flex-1 break-all font-mono text-xs">
          {value}
        </span>
        {copiabile && (
          <button
            type="button"
            className="btn btn-ghost size-11 shrink-0"
            aria-label={`Copia ${label}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                toast.success("Copiato: incollalo in «Authorized redirect URIs».");
              } catch {
                // Senza HTTPS il browser nega la clipboard: dirlo è meglio che
                // lasciar credere che la copia sia riuscita.
                toast.error("Copia non riuscita: selezionalo e copialo a mano.");
              }
            }}
          >
            <Copy className="size-4" />
          </button>
        )}
      </dd>
    </div>
  );
}
