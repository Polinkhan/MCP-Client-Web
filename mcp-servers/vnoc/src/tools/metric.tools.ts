import { findHost, getHostItems, matchItems, getItemHistory } from "./helpers";

export const metricTools = [
  {
    name: "vnoc_query_metric",
    description:
      "Intelligent query builder for vNOC metrics. Understands natural language queries like 'CPU utilization', 'memory usage', 'disk space' etc. Finds the relevant items for a host and retrieves the latest values. Example: 'What is the CPU utilization for Tomcat Linux?' or 'Get memory usage for host 11289'.",
    inputSchema: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description:
            "Host identifier - can be hostid (numeric), hostname, or host name (partial match supported)",
        },
        query: {
          type: "string",
          description:
            "Natural language query describing what metric you want (e.g., 'CPU utilization', 'memory usage', 'disk space', 'network traffic', 'last value')",
        },
        limit: {
          type: "number",
          description:
            "Number of historical values to retrieve (default: 1 for latest value)",
        },
      },
      required: ["host", "query"],
    },
    handler: async (args: unknown) => {
      try {
        const { host, query, limit = 1 } = args as {
          host: string;
          query: string;
          limit?: number;
        };

        // Step 1: Find the host
        const foundHost = await findHost(host);
        if (!foundHost) {
          return {
            content: [
              {
                type: "text",
                text: `Host not found: ${host}. Please check the host identifier and try again.`,
              },
            ],
            isError: true,
          };
        }

        // Step 2: Get items for the host
        const items = await getHostItems(foundHost.hostid);
        if (items.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No items found for host: ${foundHost.name || foundHost.host} (ID: ${foundHost.hostid})`,
              },
            ],
            isError: true,
          };
        }

        // Step 3: Match items based on query
        const matchedItems = matchItems(query, items);
        if (matchedItems.length === 0) {
          // If no matches, show available items
          const itemList = items
            .slice(0, 20)
            .map((item) => `- ${item.name} (${item.key_})`)
            .join("\n");
          return {
            content: [
              {
                type: "text",
                text: `No matching items found for query: "${query}"\n\nHost: ${foundHost.name || foundHost.host} (ID: ${foundHost.hostid})\n\nAvailable items (showing first 20):\n${itemList}\n\nTry refining your query with keywords like: CPU, memory, disk, network, etc.`,
              },
            ],
            isError: true,
          };
        }

        // Step 4: Get history for matched items
        const results = await Promise.all(
          matchedItems.slice(0, 5).map(async (item) => {
            try {
              const history = await getItemHistory(item.itemid, item.value_type, limit);
              return {
                item,
                history,
              };
            } catch (error) {
              return {
                item,
                history: [],
                error: error instanceof Error ? error.message : "Unknown error",
              };
            }
          })
        );

        // Step 5: Format results
        const resultLines: string[] = [];
        resultLines.push(
          `Query: "${query}" for host: ${foundHost.name || foundHost.host} (ID: ${foundHost.hostid})\n`
        );
        resultLines.push(`Found ${matchedItems.length} matching item(s):\n`);

        for (const result of results) {
          const { item, history, error } = result;
          resultLines.push(`\n📊 ${item.name}`);
          resultLines.push(`   Key: ${item.key_}`);
          if (item.units) {
            resultLines.push(`   Units: ${item.units}`);
          }

          if (error) {
            resultLines.push(`   ⚠️  Error: ${error}`);
          } else if (history.length === 0) {
            resultLines.push(`   ⚠️  No history data available`);
          } else {
            resultLines.push(`   Latest value(s):`);
            for (const h of history) {
              const date = new Date(parseInt(h.clock) * 1000).toLocaleString();
              let value = h.value;
              
              // Handle trends.get response format
              if ('value_avg' in h) {
                const trend = h as unknown as { value_avg: string; value_min: string; value_max: string };
                value = `Avg: ${trend.value_avg}${item.units ? ` ${item.units}` : ""}, Min: ${trend.value_min}${item.units ? ` ${item.units}` : ""}, Max: ${trend.value_max}${item.units ? ` ${item.units}` : ""}`;
              } else {
                value = `${value}${item.units ? ` ${item.units}` : ""}`;
              }
              
              resultLines.push(`     • ${date}: ${value}`);
            }
          }
        }

        if (matchedItems.length > 5) {
          resultLines.push(
            `\n... and ${matchedItems.length - 5} more matching item(s). Showing top 5 results.`
          );
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
              text: `Failed to query metric: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
];

