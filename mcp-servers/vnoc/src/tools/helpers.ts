import { vnocApiCall } from "../utils/vnocClient";

// Helper interfaces
export interface Host {
  hostid: string;
  host: string;
  name: string;
  available?: string; // "0" = unknown, "1" = available, "2" = unavailable
}

export interface Item {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  units?: string;
  hostid: string;
}

export interface HistoryValue {
  itemid: string;
  clock: string;
  value: string;
  ns?: string;
}

// Helper function to find host by identifier (hostid, hostname, or name)
export async function findHost(identifier: string): Promise<Host | null> {
  // First, try to get by hostid if it's numeric
  if (/^\d+$/.test(identifier)) {
    try {
      const hosts = await vnocApiCall<Host[]>("host.get", {
        hostids: [identifier],
        output: ["hostid", "host", "name"],
      });
      if (hosts.length > 0 && hosts[0]) return hosts[0];
    } catch {
      // Continue to search by name/host
    }
  }

  // Search by hostname or name
  try {
    const hosts = await vnocApiCall<Host[]>("host.get", {
      filter: {
        host: [identifier],
      },
      output: ["hostid", "host", "name"],
    });
    if (hosts.length > 0 && hosts[0]) return hosts[0];
  } catch {
    // Continue
  }

  // Search by name (case-insensitive partial match)
  try {
    const allHosts = await vnocApiCall<Host[]>("host.get", {
      output: ["hostid", "host", "name"],
    });
    const lowerIdentifier = identifier.toLowerCase();
    const matched = allHosts.find(
      (h) =>
        h.name?.toLowerCase().includes(lowerIdentifier) ||
        h.host?.toLowerCase().includes(lowerIdentifier)
    );
    return matched || null;
  } catch {
    // Continue
  }

  return null;
}

// Helper function to get items for a host
export async function getHostItems(hostid: string): Promise<Item[]> {
  return await vnocApiCall<Item[]>("item.get", {
    hostids: [hostid],
    output: ["itemid", "name", "key_", "value_type", "units", "hostid"],
  });
}

// Helper function to match items based on natural language query
export function matchItems(query: string, items: Item[]): Item[] {
  const lowerQuery = query.toLowerCase();
  const queryWords = lowerQuery.split(/\s+/);

  // Common metric patterns
  const patterns: Record<string, string[]> = {
    cpu: ["cpu", "processor", "utilization", "usage", "load"],
    memory: ["memory", "ram", "mem", "swap"],
    disk: ["disk", "storage", "space", "filesystem", "fs"],
    network: ["network", "net", "bandwidth", "traffic", "interface"],
    uptime: ["uptime", "boot", "running"],
    temperature: ["temp", "temperature", "thermal"],
    process: ["process", "proc", "service"],
  };

  // Score items based on relevance
  const scoredItems = items.map((item) => {
    const itemText = `${item.name} ${item.key_}`.toLowerCase();
    let score = 0;

    // Check for direct keyword matches
    for (const word of queryWords) {
      if (itemText.includes(word)) {
        score += 10;
      }
    }

    // Check for pattern matches
    for (const [category, keywords] of Object.entries(patterns)) {
      const queryHasCategory = keywords.some((kw) => lowerQuery.includes(kw));
      const itemHasCategory = keywords.some((kw) => itemText.includes(kw));

      if (queryHasCategory && itemHasCategory) {
        score += 20;
      }
    }

    // Prefer numeric value types (0=numeric, 1=text, 2=log, 3=text)
    if (item.value_type === "0" || item.value_type === "3") {
      score += 5;
    }

    return { item, score };
  });

  // Sort by score and return top matches
  return scoredItems
    .filter((si) => si.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((si) => si.item);
}

// Helper function to get history data
export async function getItemHistory(
  itemid: string,
  valueType: string,
  limit: number = 1
): Promise<HistoryValue[]> {
  // For numeric values, use trends.get for better performance if available
  // Otherwise use history.get
  const historyType = valueType === "0" ? "trends.get" : "history.get";
  const historyParams: Record<string, unknown> = {
    itemids: [itemid],
    limit,
    sortfield: "clock",
    sortorder: "DESC",
  };

  if (historyType === "trends.get") {
    historyParams.output = ["itemid", "clock", "value_min", "value_avg", "value_max"];
  } else {
    historyParams.output = ["itemid", "clock", "value"];
  }

  try {
    return await vnocApiCall<HistoryValue[]>(historyType, historyParams);
  } catch {
    // Fallback to history.get if trends.get fails
    if (historyType === "trends.get") {
      return await vnocApiCall<HistoryValue[]>("history.get", {
        itemids: [itemid],
        history: valueType,
        limit,
        sortfield: "clock",
        sortorder: "DESC",
        output: ["itemid", "clock", "value"],
      });
    }
    throw new Error("Failed to get history data");
  }
}

