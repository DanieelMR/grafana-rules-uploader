const DRY_RUN = false;

const DISABLE_PROVENANCE = true;

const rulesConfig = { 
  //aqui va el json xd
};

(async function () {
  const BASE = window.location.origin;

  const log = (...args) => console.log("[Upserter]", ...args);
  const warn = (...args) => console.warn("[Upserter]", ...args);
  const err = (...args) => console.error("[Upserter]", ...args);

  const headers = {
    "Content-Type": "application/json"
  };
  if (DISABLE_PROVENANCE) {
    headers["X-Disable-Provenance"] = "true";
  }

  async function getCurrentOrgId() {
    try {
      const r = await fetch(`${BASE}/api/org`);
      if (r.ok) {
        const j = await r.json();
        if (j && (j.id || j.orgId)) return j.id || j.orgId;
      }
    } catch (e) {}
    try {
      const r = await fetch(`${BASE}/api/user/using`);
      if (r.ok) {
        const j = await r.json();
        if (j && (j.orgId || j.orgID)) return j.orgId || j.orgID;
      }
    } catch (e) {}
    return 1;
  }

  async function resolveFolderUID(folderRef) {
    if (typeof folderRef === "string" && /^[A-Za-z0-9_-]{8,}$/.test(folderRef)) {
      return folderRef;
    }
    try {
      const resp = await fetch(
        `${BASE}/api/search?type=dash-folder&query=${encodeURIComponent(folderRef)}`
      );
      if (resp.ok) {
        const arr = await resp.json();
        const exact = arr.find((x) => x.title === folderRef && x.type === "dash-folder");
        const first = exact || arr.find((x) => x.type === "dash-folder");
        if (first && first.uid) return first.uid;
      }
    } catch (e) {
      warn("No se pudo resolver folder por nombre:", e.message);
    }
    
    log(`Carpeta "${folderRef}" no encontrada. Creándola...`);
    try {
      const createResp = await fetch(`${BASE}/api/folders`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          title: folderRef
        })
      });
      if (createResp.ok) {
        const created = await createResp.json();
        log(`Carpeta "${folderRef}" creada con UID: ${created.uid}`);
        return created.uid;
      } else {
        const errText = await createResp.text();
        throw new Error(`No se pudo crear carpeta: ${createResp.status} - ${errText}`);
      }
    } catch (e) {
      throw new Error(`Error al crear carpeta "${folderRef}": ${e.message}`);
    }
  }

  function normalizeQuery(q) {
    const refId = q.refId || "A";
    const modelDefaults = {
      hide: false,
      intervalMs: 1000,
      maxDataPoints: 43200,
      refId
    };
    return {
      refId,
      queryType: q.queryType || "",
      datasourceUid: q.datasourceUid,
      relativeTimeRange: q.relativeTimeRange || { from: 600, to: 0 },
      model: { ...modelDefaults, ...(q.model || {}) }
    };
  }

  function buildPayload(group, rule, orgId, folderUID) {
    const data = (rule.data || []).map(normalizeQuery);
    const condition =
      rule.condition ||
      (data.length ? data[0].refId : null) ||
      "A";

    if (!condition) {
      throw new Error(`La regla "${rule.title}" no tiene 'condition' ni queries para inferirla.`);
    }

    const payload = {
      uid: rule.uid || "",
      title: rule.title,
      ruleGroup: group.name,
      folderUID: folderUID,
      noDataState: rule.noDataState || "OK",
      execErrState: rule.execErrState || "Alerting",
      for: rule.for || "0s",
      orgId: group.orgId || orgId,
      condition,
      annotations: rule.annotations || {},
      labels: rule.labels || {},
      isPaused: !!rule.isPaused,
      data
    };

    if (rule.record) {
      payload.record = rule.record;
    }

    return payload;
  }

  async function upsertRule(payload) {
    const createUrl = `${BASE}/api/v1/provisioning/alert-rules`;
    const hasUid = payload.uid && String(payload.uid).trim().length > 0;
    if (hasUid) {
      const putUrl = `${BASE}/api/v1/provisioning/alert-rules/${encodeURIComponent(payload.uid)}`;
      const putBody = JSON.stringify(payload);
      if (DRY_RUN) {
        log("DRY_RUN PUT", putUrl, putBody);
        return { ok: true, method: "PUT (dry-run)" };
      }
      const putResp = await fetch(putUrl, {
        method: "PUT",
        headers,
        credentials: "include",
        body: putBody
      });
      if (putResp.ok) {
        return { ok: true, method: "PUT", status: putResp.status };
      }
      if (putResp.status === 404) {
        const postBody = JSON.stringify(payload);
        if (DRY_RUN) {
          log("DRY_RUN POST (fallback)", createUrl, postBody);
          return { ok: true, method: "POST (dry-run)" };
        }
        const postResp = await fetch(createUrl, {
          method: "POST",
          headers,
          credentials: "include",
          body: postBody
        });
        if (postResp.ok) return { ok: true, method: "POST", status: postResp.status };
        const t = await postResp.text();
        return { ok: false, method: "POST", status: postResp.status, error: t };
      }
      const t = await putResp.text();
      return { ok: false, method: "PUT", status: putResp.status, error: t };
    } else {
      const postBody = JSON.stringify(payload);
      if (DRY_RUN) {
        log("DRY_RUN POST", createUrl, postBody);
        return { ok: true, method: "POST (dry-run)" };
      }
      const postResp = await fetch(createUrl, {
        method: "POST",
        headers,
        credentials: "include",
        body: postBody
      });
      if (postResp.ok) return { ok: true, method: "POST", status: postResp.status };
      const t = await postResp.text();
      return { ok: false, method: "POST", status: postResp.status, error: t };
    }
  }

  try {
    if (!rulesConfig || !Array.isArray(rulesConfig.groups) || rulesConfig.groups.length === 0) {
      throw new Error("rulesConfig.groups está vacío");
    }

    log("========================================");
    log("Grafana Alerting Rules Upserter");
    log("Instancia:", BASE);
    log("Grupos:", rulesConfig.groups.length);

    const discoveredOrgId = await getCurrentOrgId();
    log("orgId detectado:", discoveredOrgId);

    for (const group of rulesConfig.groups) {
      log(`\nProcesando grupo: ${group.name}`);
      log(`  Folder (referencia): ${group.folder || "general"}`);
      log(`  Reglas: ${group.rules?.length || 0}`);

      const folderUID = await resolveFolderUID(group.folder || "General");
      log(`  folderUID resuelto: ${folderUID}`);

      for (const rule of group.rules || []) {
        try {
          const payload = buildPayload(group, rule, discoveredOrgId, folderUID);

          const required = ["title", "ruleGroup", "folderUID", "noDataState", "execErrState", "for", "orgId", "condition", "data"];
          const missing = required.filter((k) => payload[k] === undefined || payload[k] === null);
          if (missing.length) {
            throw new Error(`Faltan campos obligatorios: ${missing.join(", ")}`);
          }
          if (!Array.isArray(payload.data) || payload.data.length === 0) {
            throw new Error("La regla no contiene consultas en 'data'.");
          }

          log(`  Upsert: ${payload.title} (uid: ${payload.uid || "auto"})`);
          const res = await upsertRule(payload);
          if (res.ok) {
            log(`    [OK] ${payload.title} vía ${res.method}${res.status ? " - " + res.status : ""}`);
          } else {
            err(`    [ERROR] ${payload.title} vía ${res.method} - Status ${res.status}: ${res.error}`);
          }
        } catch (e) {
          err(`    [ERROR] ${rule.title || "(sin título)"} - ${e.message}`);
        }
      }
    }

    log("\nFinalizado.");
    log("Ver reglas en:", `${BASE}/alerting/list`);
    log("========================================");
  } catch (e) {
    err("Fallo del proceso:", e.message);
  }
})();
