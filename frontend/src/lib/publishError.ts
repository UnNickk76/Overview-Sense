import { ApiError } from "./client";

// Turn any publish failure into an explicit, actionable Italian message instead
// of a generic "Pubblicazione non riuscita".
export function publishErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return "Sessione scaduta. Accedi di nuovo e riprova.";
    if (e.status === 413) return "Immagine troppo grande per la pubblicazione.";
    if (e.status === 422 || e.status === 400) return e.message || "Dati non validi per la pubblicazione.";
    if (e.status === 429) return "Troppe richieste. Attendi qualche istante e riprova.";
    if (e.status >= 500) return "Errore del server. Riprova tra poco.";
    return e.message || `Errore ${e.status}.`;
  }
  const name = (e as { name?: string })?.name || "";
  const msg = (e as Error)?.message || "";
  if (name === "AbortError" || /abort|timed? ?out|timeout/i.test(msg)) {
    return "Tempo scaduto: la pubblicazione ha impiegato troppo. Verifica la connessione e riprova.";
  }
  if (/network|failed to fetch|network request failed|typeerror/i.test(msg)) {
    return "Connessione assente. Verifica la rete e riprova.";
  }
  return "Pubblicazione non riuscita. Riprova.";
}
