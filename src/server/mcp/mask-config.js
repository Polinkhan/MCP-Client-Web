export function maskEnvRecord(env) {
  if (!env || typeof env !== "object") return {};
  const out = {};
  for (const key of Object.keys(env)) {
    const v = env[key];
    out[key] =
      typeof v === "string" && v.length > 0 ? "••••••••" : "";
  }
  return out;
}

export function summarizeServerForUi(name, def) {
  return {
    name,
    command: def.command,
    args: def.args ?? [],
    envKeys: Object.keys(def.env ?? {}),
    maskedEnv: maskEnvRecord(def.env ?? {}),
    cwd: def.cwd ?? null,
  };
}
