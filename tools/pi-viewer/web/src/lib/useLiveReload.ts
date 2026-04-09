import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type Change = { change: string; path: string };

/** Subscribe to /api/events SSE; invalidate React Query caches based on which files changed. */
export function useLiveReload() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (ev) => {
      try {
        const changes: Change[] = JSON.parse(ev.data);
        const paths = changes.map((c) => c.path);
        if (paths.some((p) => p.startsWith(".pi/state/sprints/"))) {
          qc.invalidateQueries({ queryKey: ["sprints"] });
          qc.invalidateQueries({ queryKey: ["sprint"] });
          qc.invalidateQueries({ queryKey: ["activity"] });
        }
        // Session file writes trigger activity-feed refresh; the
        // server marks these with { feed: "activity" }.
        if (changes.some((c: any) => c.feed === "activity")) {
          qc.invalidateQueries({ queryKey: ["activity"] });
        }
        if (paths.some((p) => p.startsWith(".pi/agents/"))) {
          qc.invalidateQueries({ queryKey: ["personas"] });
          qc.invalidateQueries({ queryKey: ["chains"] });
          qc.invalidateQueries({ queryKey: ["persona"] });
        }
        if (paths.some((p) => p.startsWith("docs/"))) {
          qc.invalidateQueries({ queryKey: ["docs", "tree"] });
          qc.invalidateQueries({ queryKey: ["doc"] });
        }
        if (paths.some((p) => p.startsWith(".pi/state/progress"))) {
          qc.invalidateQueries({ queryKey: ["progress"] });
        }
        if (paths.some((p) => p === ".pi/settings.json" || p === ".pi/safety-rules.yaml")) {
          qc.invalidateQueries({ queryKey: ["settings-file"] });
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      // Browser auto-reconnects; nothing to do.
    };
    return () => es.close();
  }, [qc]);
}
