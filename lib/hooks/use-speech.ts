"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dettatura con l'API del browser.
 *
 * Non c'è nulla da installare e nulla che viaggi verso di noi: il
 * riconoscimento lo fa il browser. Non tutti ce l'hanno — Firefox no, per
 * esempio — quindi `supported` è parte dell'interfaccia pubblica: chi usa
 * questo hook deve poter mostrare il campo di testo e basta, invece di un
 * microfono che non fa niente.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
};

type SpeechConstructor = new () => SpeechRecognitionLike;

function constructorOf(): SpeechConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech({
  onTranscript,
}: {
  /** Riceve il testo definitivo man mano che il browser lo consolida. */
  onTranscript: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;

  // La disponibilità si sa solo nel browser: deciderla al primo render
  // farebbe divergere il markup del server da quello del client.
  useEffect(() => setSupported(constructorOf() !== null), []);

  const stop = useCallback(() => {
    recognition.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Recognition = constructorOf();
    if (!Recognition) {
      setError("Questo browser non sa ascoltare: scrivi pure a mano.");
      return;
    }

    setError(null);
    const instance = new Recognition();
    instance.lang = "it-IT";
    instance.continuous = true;
    instance.interimResults = true;

    instance.onresult = (event) => {
      let finalText = "";
      let pending = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else pending += text;
      }

      setInterim(pending);
      if (finalText.trim()) callback.current(finalText);
    };

    instance.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Il microfono è bloccato: dallo permesso dalla barra degli indirizzi."
          : "Non sono riuscito ad ascoltare. Riprova, o scrivi a mano.",
      );
      setListening(false);
    };

    instance.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognition.current = instance;
    instance.start();
    setListening(true);
  }, []);

  // Uscire dalla schermata con il microfono aperto lo lascerebbe acceso.
  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
