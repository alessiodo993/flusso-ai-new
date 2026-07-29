"use client";

import { useTheme } from "@/components/shell/theme-provider";
import { SelectField } from "@/components/ui/select-field";
import { useSettings, useUpdateSettings } from "@/lib/hooks/use-settings";
import { fmtDuration, fmtMin, SLOT } from "@/lib/time";

/**
 * Orari, fasce, buffer, tetto, tema.
 *
 * Tutto a passi di quindici minuti e con menu invece di campi liberi: qui
 * non si scrive un orario, si sceglie. Un campo di testo per «08:00»
 * significa accettare «8», «8.00», «otto» e poi doverli interpretare.
 */
export function HoursPanel() {
  const { settings } = useSettings();
  const update = useUpdateSettings();
  const { preference, setPreference } = useTheme();

  const hours = minuteOptions(0, 1440);

  return (
    <div className="space-y-4">
      <Field label="Giornata lavorativa" hint="Fuori da questa finestra il planner non mette niente.">
        <div className="flex items-center gap-2">
          <SelectField
            ariaLabel="Inizio della giornata"
            className="flex-1"
            value={String(settings.work_start)}
            onChange={(value) => update.mutate({ work_start: Number(value) })}
            options={hours}
          />
          <span className="text-sm text-ink-faint">→</span>
          <SelectField
            ariaLabel="Fine della giornata"
            className="flex-1"
            value={String(settings.work_end)}
            onChange={(value) => update.mutate({ work_end: Number(value) })}
            options={hours}
          />
        </div>
      </Field>

      <Field
        label="Ore di picco"
        hint="Quando rendi di più: qui finiscono i task a energia alta."
      >
        <TimePair
          start={settings.peak_hours_start}
          end={settings.peak_hours_end}
          startLabel="Inizio delle ore di picco"
          endLabel="Fine delle ore di picco"
          // Le ore di picco non sono annullabili nello schema, e non lo sono
          // nemmeno concettualmente: un momento migliore della giornata c'è
          // sempre. Solo quelle di calo si possono lasciare vuote.
          onChange={(start, end) =>
            update.mutate({
              peak_hours_start: start ?? settings.peak_hours_start,
              peak_hours_end: end ?? settings.peak_hours_end,
            })
          }
        />
      </Field>

      <Field
        label="Ore di calo"
        hint="Quando sei stanco: qui vanno i task leggeri. Lascia vuoto se non ne hai."
      >
        <TimePair
          start={settings.low_hours_start}
          end={settings.low_hours_end}
          startLabel="Inizio delle ore di calo"
          endLabel="Fine delle ore di calo"
          clearable
          onChange={(start, end) =>
            update.mutate({ low_hours_start: start, low_hours_end: end })
          }
        />
      </Field>

      <Field
        label="Respiro fra i blocchi"
        hint="Il tempo che serve per alzarsi, bere, cambiare testa."
      >
        <SelectField
          ariaLabel="Minuti di respiro fra i blocchi"
          value={String(settings.buffer_minutes)}
          onChange={(value) => update.mutate({ buffer_minutes: Number(value) })}
          options={[0, 5, 10, 15, 20, 30].map((m) => ({
            value: String(m),
            label: m === 0 ? "Nessuno" : fmtDuration(m),
          }))}
        />
      </Field>

      <Field
        label="Tetto giornaliero"
        hint="Un massimo, non un obiettivo: se la giornata si chiude prima, meglio."
      >
        <SelectField
          ariaLabel="Tetto di minuti al giorno"
          value={String(settings.daily_cap_minutes)}
          onChange={(value) =>
            update.mutate({ daily_cap_minutes: Number(value) })
          }
          options={[120, 180, 240, 300, 360, 420, 480, 600].map((m) => ({
            value: String(m),
            label: fmtDuration(m),
          }))}
        />
      </Field>

      <Field
        label="Micro-avvio"
        hint="Quanto dura il «solo cinque minuti» che serve a cominciare."
      >
        <SelectField
          ariaLabel="Durata del micro-avvio"
          value={String(settings.micro_start_minutes)}
          onChange={(value) =>
            update.mutate({ micro_start_minutes: Number(value) })
          }
          options={[2, 5, 10, 15, 20, 30].map((m) => ({
            value: String(m),
            label: fmtDuration(m),
          }))}
        />
      </Field>

      <Field label="Tema">
        <div className="seg" role="group" aria-label="Tema">
          {(["auto", "light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              data-on={preference === value}
              aria-pressed={preference === value}
              onClick={() => {
                setPreference(value);
                // La preferenza vive nel localStorage per non far lampeggiare
                // il tema al caricamento; qui la si salva anche sul profilo,
                // così segue l'utente su un altro dispositivo.
                update.mutate({ theme: value });
              }}
            >
              {value === "auto" ? "Auto" : value === "light" ? "Chiaro" : "Scuro"}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      {hint && <p className="mb-1.5 text-xs text-ink-faint">{hint}</p>}
      <div className={hint ? "" : "mt-1.5"}>{children}</div>
    </div>
  );
}

/** Le due estremità di una fascia oraria, con il formato `time` di Postgres. */
function TimePair({
  start,
  end,
  startLabel,
  endLabel,
  clearable,
  onChange,
}: {
  start: string | null;
  end: string | null;
  startLabel: string;
  endLabel: string;
  clearable?: boolean;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const options = minuteOptions(0, 1440).map((option) => ({
    value: toTime(Number(option.value)),
    label: option.label,
  }));

  return (
    <div className="flex items-center gap-2">
      <SelectField
        ariaLabel={startLabel}
        className="flex-1"
        placeholder={clearable ? "Nessuna" : undefined}
        value={start?.slice(0, 5) ? toTime(fromTime(start)) : ""}
        onChange={(value) => onChange(value || null, value ? end : null)}
        options={options}
      />
      <span className="text-sm text-ink-faint">→</span>
      <SelectField
        ariaLabel={endLabel}
        className="flex-1"
        placeholder={clearable ? "Nessuna" : undefined}
        value={end?.slice(0, 5) ? toTime(fromTime(end)) : ""}
        onChange={(value) => onChange(value ? start : null, value || null)}
        options={options}
      />
    </div>
  );
}

function minuteOptions(from: number, to: number) {
  const options: Array<{ value: string; label: string }> = [];
  for (let m = from; m <= to - SLOT; m += SLOT) {
    options.push({ value: String(m), label: fmtMin(m) });
  }
  return options;
}

function toTime(minute: number): string {
  const h = String(Math.floor(minute / 60)).padStart(2, "0");
  const m = String(minute % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}

function fromTime(value: string): number {
  const [h, m] = value.split(":");
  return Number(h) * 60 + Number(m);
}
