import { vnocApiCall } from "../utils/vnocClient";
import { Host } from "./helpers";

export const hostTools = [
  {
    name: "vnoc_get_hosts",
    description: "Get a list of hosts from vNOC. Returns basic host information.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of hosts to return (optional, returns all hosts if not specified)",
        },
      },
    },
    handler: async (args: unknown) => {
      try {
        const limit = (args as { limit?: number })?.limit;
        const params: Record<string, unknown> = {
          output: ["hostid", "host", "name"],
        };
        if (limit !== undefined) {
          params.limit = limit;
        }
        const hosts = await vnocApiCall<Array<{ hostid: string; host: string; name: string }>>(
          "host.get",
          params
        );

        if (hosts.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No hosts found.",
              },
            ],
          };
        }

        const hostsList = hosts
          .map((h) => `- ${h.name || h.host} (ID: ${h.hostid}, Host: ${h.host})`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Found ${hosts.length} host(s):\n${hostsList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get hosts: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "vnoc_check_hosts_online",
    description: "Check which hosts are currently online/available in vNOC. Returns a list of hosts with their availability status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      try {
        const hosts = await vnocApiCall<Host[]>("host.get", {
          output: ["hostid", "host", "name"],
        });

        if (hosts.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No hosts found.",
              },
            ],
          };
        }

        // Check host status by looking at item availability
        // For active checks: agents send data periodically, so we check the most recent data across ALL items
        // A host is considered "online" if it has items that have received data recently (within last 15 minutes for active checks)
        const onlineHosts: Array<Host & { lastData?: string }> = [];
        const offlineHosts: Array<Host & { lastData?: string }> = [];
        const unknownHosts: Array<Host & { lastData?: string }> = [];

        // For active checks, use 15 minutes threshold (agents typically send data every 30s-2min, but may have delays)
        const thresholdSeconds = 15 * 60; // 15 minutes in seconds
        const thresholdTime = Math.floor(Date.now() / 1000) - thresholdSeconds;

        for (const host of hosts) {
          try {
            // Get ALL items for this host to find the most recent data timestamp
            const items = await vnocApiCall<
              Array<{ itemid: string; lastclock: string; state: string }>
            >("item.get", {
              hostids: [host.hostid],
              output: ["itemid", "lastclock", "state"],
              // No limit - get all items to find the most recent data
            });

            if (items.length === 0) {
              unknownHosts.push(host);
              continue;
            }

            // Filter items with valid lastclock values and find the most recent one
            const itemsWithData = items.filter(
              (item) => item.lastclock && item.lastclock !== "0" && item.state === "0"
            );

            if (itemsWithData.length === 0) {
              // Has items but none have data or all are not supported
              const hasActiveItems = items.some((item) => item.state === "0");
              if (hasActiveItems) {
                unknownHosts.push(host);
              } else {
                unknownHosts.push(host);
              }
              continue;
            }

            // Find the most recent data timestamp across all items
            const latestItem = itemsWithData.sort(
              (a, b) => parseInt(b.lastclock) - parseInt(a.lastclock)
            )[0];

            if (!latestItem) {
              unknownHosts.push(host);
              continue;
            }

            const lastClock = parseInt(latestItem.lastclock);
            const lastDataTime = new Date(lastClock * 1000).toLocaleString();

            // Check if the most recent data is within the threshold
            if (lastClock >= thresholdTime) {
              // Host is online - has received data recently
              const hostWithData: Host & { lastData?: string } = { ...host };
              hostWithData.lastData = lastDataTime;
              onlineHosts.push(hostWithData);
            } else {
              // Has items with data, but data is too old - host is offline
              offlineHosts.push(host);
            }
          } catch {
            // If we can't check items, mark as unknown
            unknownHosts.push(host);
          }
        }

        const resultLines: string[] = [];
        resultLines.push(`Host Status Summary:\n`);
        resultLines.push(`✅ Online: ${onlineHosts.length}`);
        resultLines.push(`❌ Offline: ${offlineHosts.length}`);
        resultLines.push(`❓ Unknown: ${unknownHosts.length}`);
        resultLines.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        if (onlineHosts.length > 0) {
          resultLines.push(`\n✅ ONLINE HOSTS (${onlineHosts.length}):\n`);
          onlineHosts.forEach((h) => {
            const lastDataInfo = h.lastData ? ` [Last data: ${h.lastData}]` : "";
            resultLines.push(`  • ${h.name || h.host} (ID: ${h.hostid}, Host: ${h.host})${lastDataInfo}`);
          });
        }

        if (offlineHosts.length > 0) {
          resultLines.push(`\n❌ OFFLINE HOSTS (${offlineHosts.length}):\n`);
          offlineHosts.forEach((h) => {
            resultLines.push(`  • ${h.name || h.host} (ID: ${h.hostid}, Host: ${h.host})`);
          });
        }

        if (unknownHosts.length > 0) {
          resultLines.push(`\n❓ UNKNOWN STATUS (${unknownHosts.length}):\n`);
          unknownHosts.forEach((h) => {
            resultLines.push(`  • ${h.name || h.host} (ID: ${h.hostid}, Host: ${h.host})`);
          });
        }

        return {
          content: [
            {
              type: "text",
              text: resultLines.join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to check host status: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
];

