import { elasticsearchClient } from "../utils/elasticsearchClient";
import { findHost, getHostItems, matchItems, Host } from "./helpers";
import { vnocApiCall } from "../utils/vnocClient";

export const elasticsearchTools = [
  {
    name: "vnoc_elasticsearch_discover",
    description:
      "Discover Elasticsearch indices and their mappings. Helps identify which indices contain monitoring data and what fields are available.",
    inputSchema: {
      type: "object",
      properties: {
        indexPattern: {
          type: "string",
          description: "Index pattern to search (e.g., 'zabbix-*', 'vnoc-*'). Leave empty to get all indices.",
        },
      },
    },
    handler: async (args: unknown) => {
      try {
        const { indexPattern } = (args as { indexPattern?: string }) || {};
        const indices = await elasticsearchClient.getIndices(indexPattern);

        if (indices.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No indices found${indexPattern ? ` matching pattern: ${indexPattern}` : ""}.`,
              },
            ],
          };
        }

        const resultLines: string[] = [];
        resultLines.push(`Found ${indices.length} index(es):\n`);

        // Get mappings for first few indices to understand structure
        const indicesToCheck = indices.slice(0, 5);
        for (const index of indicesToCheck) {
          try {
            const mapping = await elasticsearchClient.getIndexMapping(index);
            const indexData = mapping[index] as { mappings?: { properties?: Record<string, unknown> } };
            const properties = indexData?.mappings?.properties || {};
            const fieldNames = Object.keys(properties).slice(0, 20); // Show first 20 fields

            resultLines.push(`\n📊 Index: ${index}`);
            resultLines.push(`   Fields (showing first ${Math.min(20, fieldNames.length)}):`);
            fieldNames.forEach((field) => {
              const fieldType = (properties[field] as { type?: string })?.type || "unknown";
              resultLines.push(`     • ${field}: ${fieldType}`);
            });
            if (Object.keys(properties).length > 20) {
              resultLines.push(`     ... and ${Object.keys(properties).length - 20} more fields`);
            }
          } catch (error) {
            resultLines.push(`\n📊 Index: ${index} (failed to get mapping)`);
          }
        }

        if (indices.length > 5) {
          resultLines.push(`\n... and ${indices.length - 5} more index(es)`);
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
              text: `Failed to discover Elasticsearch indices: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "vnoc_elasticsearch_query_threshold",
    description:
      "Query Elasticsearch to find when a metric exceeded a threshold. Optimized for large datasets. Example: Find when memory usage exceeded 80% for a host.",
    inputSchema: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description: "Host identifier (hostname, hostid, or name)",
        },
        metric: {
          type: "string",
          description: "Metric name or query (e.g., 'memory', 'CPU', 'memory utilization')",
        },
        threshold: {
          type: "number",
          description: "Threshold value (e.g., 80 for 80%). Use minThreshold and maxThreshold for range queries.",
        },
        minThreshold: {
          type: "number",
          description: "Minimum threshold for range queries (e.g., 50 for values between 50-60%)",
        },
        maxThreshold: {
          type: "number",
          description: "Maximum threshold for range queries (e.g., 60 for values between 50-60%)",
        },
        comparison: {
          type: "string",
          enum: ["gt", "gte", "lt", "lte"],
          description: "Comparison operator: gt (greater than), gte (greater than or equal), lt (less than), lte (less than or equal). Not needed if using minThreshold/maxThreshold.",
        },
        index: {
          type: "string",
          description: "Elasticsearch index pattern (e.g., 'zabbix-*', 'vnoc-*'). If not provided, will try common patterns.",
        },
        startTime: {
          type: "string",
          description: "Start time in ISO format, Unix timestamp (seconds), or relative (e.g., '2025-01-01T00:00:00Z', '1735344000', or 'now-7d'). Dates are converted to Unix timestamps matching Zabbix timezone (UTC).",
        },
        endTime: {
          type: "string",
          description: "End time in ISO format, Unix timestamp (seconds), or relative (e.g., '2025-01-01T23:59:59Z', '1735430399', or 'now'). Dates are converted to Unix timestamps matching Zabbix timezone (UTC).",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 100, max: 10000)",
        },
      },
      required: ["host", "metric"],
    },
    handler: async (args: unknown) => {
      try {
        const rawArgs = args as {
          host: string;
          metric: string;
          threshold?: number | string;
          minThreshold?: number | string;
          maxThreshold?: number | string;
          comparison?: "gt" | "gte" | "lt" | "lte";
          index?: string;
          startTime?: string;
          endTime?: string;
          limit?: number | string;
        };

        // Parse numeric values (MCP might pass them as strings)
        const host = rawArgs.host;
        const metric = rawArgs.metric;
        const threshold = rawArgs.threshold !== undefined ? Number(rawArgs.threshold) : undefined;
        const minThreshold = rawArgs.minThreshold !== undefined ? Number(rawArgs.minThreshold) : undefined;
        const maxThreshold = rawArgs.maxThreshold !== undefined ? Number(rawArgs.maxThreshold) : undefined;
        const comparison = rawArgs.comparison;
        const index = rawArgs.index;
        // Helper function to convert date string to Unix timestamp (seconds)
        // Zabbix stores timestamps as Unix epoch seconds in UTC
        const parseTimeToUnix = (timeStr: string | undefined): string | undefined => {
          if (!timeStr) return undefined;
          
          // If it's already a number (Unix timestamp), return as string
          if (/^\d+$/.test(timeStr)) {
            return timeStr;
          }
          
          // Handle relative times like "now-1d"
          if (timeStr.startsWith("now")) {
            // For now, return as-is and let Elasticsearch handle it
            // But we should convert to actual timestamp
            const now = Math.floor(Date.now() / 1000);
            if (timeStr === "now") return String(now);
            
            // Parse relative time (e.g., "now-7d", "now-1h")
            const match = timeStr.match(/now-(\d+)([smhd])/);
            if (match && match[1] && match[2]) {
              const value = parseInt(match[1]);
              const unit = match[2];
              let seconds = 0;
              switch (unit) {
                case "s": seconds = value; break;
                case "m": seconds = value * 60; break;
                case "h": seconds = value * 60 * 60; break;
                case "d": seconds = value * 24 * 60 * 60; break;
              }
              return String(now - seconds);
            }
            return String(now);
          }
          
          // Parse ISO date string and convert to Unix timestamp (UTC)
          try {
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date format: ${timeStr}`);
            }
            // Convert to Unix timestamp in seconds (Zabbix uses UTC)
            return String(Math.floor(date.getTime() / 1000));
          } catch {
            return timeStr; // Return as-is if parsing fails
          }
        };

        const startTime = parseTimeToUnix(rawArgs.startTime);
        const endTime = parseTimeToUnix(rawArgs.endTime);
        const limit = rawArgs.limit !== undefined ? Number(rawArgs.limit) : 100;

        // Validate parameters
        if (!threshold && !comparison && (minThreshold === undefined || maxThreshold === undefined)) {
          return {
            content: [
              {
                type: "text",
                text: "Either 'threshold' + 'comparison' OR 'minThreshold' + 'maxThreshold' must be provided.",
              },
            ],
            isError: true,
          };
        }

        // Step 1: Find the host
        const foundHost = await findHost(host);
        if (!foundHost) {
          return {
            content: [
              {
                type: "text",
                text: `Host not found: ${host}`,
              },
            ],
            isError: true,
          };
        }

        // Step 2: Find the metric item
        const items = await getHostItems(foundHost.hostid);
        const matchedItems = matchItems(metric, items);

        if (matchedItems.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No matching items found for metric: "${metric}" on host: ${foundHost.name || foundHost.host}`,
              },
            ],
            isError: true,
          };
        }

        // Use the first/best matching item
        const targetItem = matchedItems[0];
        if (!targetItem) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to get item details for metric: "${metric}"`,
              },
            ],
            isError: true,
          };
        }

        // Step 3: Determine Elasticsearch index
        let indicesToSearch: string | string[] = index || "*";
        if (!indicesToSearch) {
          // Try common index patterns
          const commonPatterns = ["zabbix-*", "vnoc-*", "monitoring-*", "metrics-*"];
          try {
            const availableIndices = await elasticsearchClient.getIndices();
            // Find matching pattern
            for (const pattern of commonPatterns) {
              const patternRegex = new RegExp(pattern.replace("*", ".*"));
              const matching = availableIndices.filter((idx) => patternRegex.test(idx));
              if (matching.length > 0) {
                indicesToSearch = pattern;
                break;
              }
            }
            if (!indicesToSearch && availableIndices.length > 0) {
              // Use all indices if no pattern matches
              indicesToSearch = "*";
            }
          } catch {
            // Default to common pattern
            indicesToSearch = "zabbix-*";
          }
        }

        // Step 4: Build field names (common Elasticsearch field patterns)
        // Try different possible field names for the metric
        const possibleMetricFields = [
          `value`,
          `metric.${targetItem.key_}`,
          `item.${targetItem.key_}`,
          targetItem.key_,
          `metrics.${targetItem.name?.toLowerCase().replace(/\s+/g, "_")}`,
        ];

        // Common host field patterns
        const possibleHostFields = [
          `host`,
          `hostname`,
          `host.name`,
          `hostid`,
          `host.id`,
          `@metadata.host`,
        ];

        // Step 5: Query Elasticsearch
        // First try itemid-based query (for Zabbix-style indices like dbl, uint, str)
        const results: Array<{ timestamp: string; value: number; host: string }> = [];
        let lastError: Error | null = null;

        // Determine which index types to try based on value type
        // 0 = numeric (uint), 1 = text (str), 2 = log (log), 3 = text (str), 4 = numeric (dbl)
        const indexTypesToTry = ["dbl", "uint"]; // Try both for decimal values
        if (targetItem.value_type === "0") {
          indexTypesToTry.unshift("uint"); // Prefer uint for integers
        }

        // Try itemid-based query first (Zabbix-style) - try multiple index types
        for (const indexType of indexTypesToTry) {
          try {
            // First, verify data exists by getting a sample
            try {
              const sample = await elasticsearchClient.getSampleData(indexType, targetItem.itemid, 1);
              if (sample.length === 0) {
                continue; // No data in this index, try next
              }
            } catch {
              continue; // Index might not exist or error, try next
            }

            const breachParams: Parameters<typeof elasticsearchClient.findThresholdBreachesByItemId>[0] = {
              index: indexType,
              itemid: targetItem.itemid,
              timeField: "clock",
              size: Math.min(limit, 10000),
            };
            if (minThreshold !== undefined && maxThreshold !== undefined) {
              breachParams.minThreshold = minThreshold;
              breachParams.maxThreshold = maxThreshold;
            } else if (threshold !== undefined && comparison) {
              breachParams.threshold = threshold;
              breachParams.comparison = comparison as "gt" | "gte" | "lt" | "lte";
            }
            if (startTime !== undefined) breachParams.startTime = startTime;
            if (endTime !== undefined) breachParams.endTime = endTime;
            const breaches = await elasticsearchClient.findThresholdBreachesByItemId(breachParams);

            if (breaches.length > 0) {
              // Convert to expected format
              results.push(
                ...breaches.map((b) => ({
                  timestamp: b.timestamp,
                  value: b.value,
                  host: foundHost.name || foundHost.host,
                }))
              );
              break; // Found results, stop trying other indices
            }
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            continue; // Try next index type
          }
        }

        // If itemid query didn't work, try host-based queries (fallback)
        // Only use this for single threshold queries, not range queries
        if (results.length === 0 && threshold !== undefined && comparison) {
          for (const metricField of possibleMetricFields) {
            for (const hostField of possibleHostFields) {
              try {
                const breachParams: Parameters<typeof elasticsearchClient.findThresholdBreaches>[0] = {
                  index: indicesToSearch,
                  hostField,
                  hostValue: foundHost.hostid,
                  metricField,
                  threshold,
                  comparison: comparison as "gt" | "gte" | "lt" | "lte",
                  timeField: "@timestamp",
                  size: Math.min(limit, 10000),
                };
                if (startTime) breachParams.startTime = startTime;
                if (endTime) breachParams.endTime = endTime;
                const breaches = await elasticsearchClient.findThresholdBreaches(breachParams);

                if (breaches.length > 0) {
                  results.push(...breaches);
                  break; // Found working fields
                }
              } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                continue; // Try next field combination
              }
            }
            if (results.length > 0) break; // Found results, stop trying
          }
        }

        if (results.length === 0) {
          const thresholdDesc = minThreshold !== undefined && maxThreshold !== undefined
            ? `between ${minThreshold} and ${maxThreshold}${targetItem.units ? ` ${targetItem.units}` : ""}`
            : `${comparison} ${threshold}${targetItem.units ? ` ${targetItem.units}` : ""}`;
          return {
            content: [
              {
                type: "text",
                text: `No threshold breaches found for ${foundHost.name || foundHost.host}.\n\nMetric: ${targetItem.name} (${targetItem.key_})\nThreshold: ${thresholdDesc}\n\n${lastError ? `Last error: ${lastError.message}\n\n` : ""}Tip: You may need to specify the correct index pattern using the 'index' parameter, or check available indices using vnoc_elasticsearch_discover.`,
              },
            ],
            isError: true,
          };
        }

        // Step 6: Format results
        const resultLines: string[] = [];
        resultLines.push(
          `Found ${results.length} threshold breach(es) for ${foundHost.name || foundHost.host}:`
        );
        resultLines.push(`Metric: ${targetItem.name} (${targetItem.key_})`);
        const thresholdDesc = minThreshold !== undefined && maxThreshold !== undefined
          ? `between ${minThreshold} and ${maxThreshold}${targetItem.units ? ` ${targetItem.units}` : ""}`
          : `${comparison} ${threshold}${targetItem.units ? ` ${targetItem.units}` : ""}`;
        resultLines.push(`Threshold: ${thresholdDesc}`);
        resultLines.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        // Group by date or show chronologically
        const sortedResults = results
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(0, limit);

        resultLines.push(`\n📅 Chronological list (showing first ${sortedResults.length}):\n`);
        sortedResults.forEach((result, index) => {
          const date = new Date(result.timestamp);
          resultLines.push(
            `${index + 1}. ${date.toLocaleString()} - Value: ${result.value}${targetItem.units ? ` ${targetItem.units}` : ""}`
          );
        });

        if (results.length > limit) {
          resultLines.push(`\n... and ${results.length - limit} more result(s)`);
        }

        // Show first occurrence
        if (sortedResults.length > 0 && sortedResults[0]) {
          const first = sortedResults[0];
          const firstDate = new Date(first.timestamp);
          resultLines.push(`\n\n🎯 First occurrence: ${firstDate.toLocaleString()}`);
          resultLines.push(`   Value: ${first.value}${targetItem.units ? ` ${targetItem.units}` : ""}`);
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
              text: `Failed to query threshold: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "vnoc_query_hosts_by_metric_threshold",
    description:
      "Query multiple hosts to find which ones have a metric that exceeded a threshold within a time range. Returns a list of hosts that match the criteria. Example: Find all hosts with CPU usage above 70% in the last 30 days.",
    inputSchema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "Metric name or query (e.g., 'CPU utilization', 'memory usage', 'disk space')",
        },
        threshold: {
          type: "number",
          description: "Threshold value (e.g., 70 for 70%)",
        },
        comparison: {
          type: "string",
          enum: ["gt", "gte", "lt", "lte"],
          description: "Comparison operator: gt (greater than), gte (greater than or equal), lt (less than), lte (less than or equal)",
        },
        startTime: {
          type: "string",
          description: "Start time in ISO format, Unix timestamp (seconds), or relative (e.g., '2025-01-01T00:00:00Z', '1735344000', or 'now-30d'). Dates are converted to Unix timestamps matching Zabbix timezone (UTC).",
        },
        endTime: {
          type: "string",
          description: "End time in ISO format, Unix timestamp (seconds), or relative (e.g., '2025-01-01T23:59:59Z', '1735430399', or 'now'). Dates are converted to Unix timestamps matching Zabbix timezone (UTC).",
        },
        hostFilter: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of host identifiers to filter (hostid, hostname, or name). If not provided, queries all hosts.",
        },
        limit: {
          type: "number",
          description: "Maximum number of hosts to return (default: 100)",
        },
        index: {
          type: "string",
          description: "Elasticsearch index pattern (e.g., 'zabbix-*', 'vnoc-*'). If not provided, will try common patterns.",
        },
      },
      required: ["metric", "threshold", "comparison"],
    },
    handler: async (args: unknown) => {
      try {
        const rawArgs = args as {
          metric: string;
          threshold: number | string;
          comparison: "gt" | "gte" | "lt" | "lte";
          startTime?: string;
          endTime?: string;
          hostFilter?: string[];
          limit?: number | string;
          index?: string;
        };

        // Parse numeric values
        const metric = rawArgs.metric;
        const threshold = Number(rawArgs.threshold);
        const comparison = rawArgs.comparison;
        const hostFilter = rawArgs.hostFilter;
        const limit = rawArgs.limit !== undefined ? Number(rawArgs.limit) : 100;
        const index = rawArgs.index;

        // Helper function to convert date string to Unix timestamp (seconds)
        const parseTimeToUnix = (timeStr: string | undefined): string | undefined => {
          if (!timeStr) return undefined;
          
          if (/^\d+$/.test(timeStr)) {
            return timeStr;
          }
          
          if (timeStr.startsWith("now")) {
            const now = Math.floor(Date.now() / 1000);
            if (timeStr === "now") return String(now);
            
            const match = timeStr.match(/now-(\d+)([smhd])/);
            if (match && match[1] && match[2]) {
              const value = parseInt(match[1]);
              const unit = match[2];
              let seconds = 0;
              switch (unit) {
                case "s": seconds = value; break;
                case "m": seconds = value * 60; break;
                case "h": seconds = value * 60 * 60; break;
                case "d": seconds = value * 24 * 60 * 60; break;
              }
              return String(now - seconds);
            }
            return String(now);
          }
          
          try {
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date format: ${timeStr}`);
            }
            return String(Math.floor(date.getTime() / 1000));
          } catch {
            return timeStr;
          }
        };

        const startTime = parseTimeToUnix(rawArgs.startTime);
        const endTime = parseTimeToUnix(rawArgs.endTime);

        // Step 1: Get hosts to query
        let hostsToQuery: Host[] = [];
        if (hostFilter && hostFilter.length > 0) {
          // Find specific hosts
          const foundHosts = await Promise.all(
            hostFilter.map(async (identifier) => await findHost(identifier))
          );
          hostsToQuery = foundHosts.filter((h): h is Host => h !== null);
        } else {
          // Get all hosts
          hostsToQuery = await vnocApiCall<Host[]>("host.get", {
            output: ["hostid", "host", "name"],
          });
        }

        if (hostsToQuery.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No hosts found to query.",
              },
            ],
            isError: true,
          };
        }

        // Step 2: Determine Elasticsearch index
        let indicesToSearch: string | string[] = index || "*";
        if (!index) {
          const commonPatterns = ["zabbix-*", "vnoc-*", "monitoring-*", "metrics-*"];
          try {
            const availableIndices = await elasticsearchClient.getIndices();
            for (const pattern of commonPatterns) {
              const patternRegex = new RegExp(pattern.replace("*", ".*"));
              const matching = availableIndices.filter((idx) => patternRegex.test(idx));
              if (matching.length > 0) {
                indicesToSearch = pattern;
                break;
              }
            }
            if (!indicesToSearch && availableIndices.length > 0) {
              indicesToSearch = "*";
            }
          } catch {
            indicesToSearch = "zabbix-*";
          }
        }

        // Step 3: For each host, find matching metric items and check threshold
        const matchingHosts: Array<{
          host: Host;
          item: { itemid: string; name: string; key_: string; units?: string };
          breachCount: number;
          firstBreach?: string | undefined;
          lastBreach?: string | undefined;
          maxValue?: number | undefined;
          avgValue?: number | undefined;
          minValue?: number | undefined;
        }> = [];

        // Process hosts in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < hostsToQuery.length; i += batchSize) {
          const batch = hostsToQuery.slice(i, i + batchSize);
          
          await Promise.all(
            batch.map(async (host) => {
              try {
                // Get items for this host
                const items = await getHostItems(host.hostid);
                if (items.length === 0) return;

                // Match items based on metric query
                const matchedItems = matchItems(metric, items);
                if (matchedItems.length === 0) return;

                // Use the first/best matching item
                const targetItem = matchedItems[0];
                if (!targetItem) return;

                // Determine which index types to try
                const indexTypesToTry = ["dbl", "uint"];
                if (targetItem.value_type === "0") {
                  indexTypesToTry.unshift("uint");
                }

                // Query Elasticsearch for threshold breaches
                let breaches: Array<{ timestamp: string; value: number; itemid: string }> = [];
                
                for (const indexType of indexTypesToTry) {
                  try {
                    // Check if data exists
                    try {
                      const sample = await elasticsearchClient.getSampleData(indexType, targetItem.itemid, 1);
                      if (sample.length === 0) continue;
                    } catch {
                      continue;
                    }

                    const breachParams: Parameters<typeof elasticsearchClient.findThresholdBreachesByItemId>[0] = {
                      index: indexType,
                      itemid: targetItem.itemid,
                      timeField: "clock",
                      size: 1000, // Limit per host to avoid too much data
                      threshold,
                      comparison,
                    };
                    if (startTime !== undefined) breachParams.startTime = startTime;
                    if (endTime !== undefined) breachParams.endTime = endTime;
                    
                    const hostBreaches = await elasticsearchClient.findThresholdBreachesByItemId(breachParams);
                    if (hostBreaches.length > 0) {
                      breaches = hostBreaches;
                      break; // Found results, stop trying other indices
                    }
                  } catch {
                    continue; // Try next index type
                  }
                }

                // If we found breaches, add this host to matching list
                if (breaches.length > 0) {
                  const sortedBreaches = breaches.sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );
                  const maxValue = Math.max(...breaches.map((b) => b.value));
                  
                  // Get average value for the time range
                  let avgValue: number | undefined;
                  let minValue: number | undefined;
                  try {
                    for (const indexType of indexTypesToTry) {
                      try {
                        const avgParams: {
                          index: string;
                          itemid: string;
                          timeField?: string;
                          startTime?: string;
                          endTime?: string;
                        } = {
                          index: indexType,
                          itemid: targetItem.itemid,
                          timeField: "clock",
                        };
                        if (startTime !== undefined) {
                          avgParams.startTime = startTime;
                        }
                        if (endTime !== undefined) {
                          avgParams.endTime = endTime;
                        }
                        const avgResult = await elasticsearchClient.getAverageValueByItemId(avgParams);
                        if (avgResult) {
                          avgValue = avgResult.avg;
                          minValue = avgResult.min;
                          break;
                        }
                      } catch {
                        continue;
                      }
                    }
                  } catch {
                    // If average calculation fails, continue without it
                  }
                  
                  const itemData: {
                    itemid: string;
                    name: string;
                    key_: string;
                    units?: string;
                  } = {
                    itemid: targetItem.itemid,
                    name: targetItem.name,
                    key_: targetItem.key_,
                  };
                  if (targetItem.units) {
                    itemData.units = targetItem.units;
                  }
                  
                  const matchingHost: {
                    host: Host;
                    item: { itemid: string; name: string; key_: string; units?: string };
                    breachCount: number;
                    firstBreach?: string | undefined;
                    lastBreach?: string | undefined;
                    maxValue?: number | undefined;
                    avgValue?: number | undefined;
                    minValue?: number | undefined;
                  } = {
                    host,
                    item: itemData,
                    breachCount: breaches.length,
                    maxValue,
                  };
                  
                  if (avgValue !== undefined) {
                    matchingHost.avgValue = avgValue;
                  }
                  if (minValue !== undefined) {
                    matchingHost.minValue = minValue;
                  }
                  
                  const firstBreach = sortedBreaches[0];
                  if (firstBreach?.timestamp) {
                    matchingHost.firstBreach = firstBreach.timestamp;
                  }
                  const lastBreach = sortedBreaches[sortedBreaches.length - 1];
                  if (lastBreach?.timestamp) {
                    matchingHost.lastBreach = lastBreach.timestamp;
                  }
                  
                  matchingHosts.push(matchingHost);
                }
              } catch (error) {
                // Silently skip hosts that fail (could be missing data, etc.)
                console.error(`Error processing host ${host.hostid}:`, error);
              }
            })
          );
        }

        // Step 4: Format results
        if (matchingHosts.length === 0) {
          const timeRange = startTime && endTime
            ? ` from ${new Date(Number(startTime) * 1000).toLocaleString()} to ${new Date(Number(endTime) * 1000).toLocaleString()}`
            : startTime
            ? ` since ${new Date(Number(startTime) * 1000).toLocaleString()}`
            : "";
          
          return {
            content: [
              {
                type: "text",
                text: `No hosts found with ${metric} ${comparison} ${threshold}${timeRange}.\n\nQueried ${hostsToQuery.length} host(s).`,
              },
            ],
          };
        }

        // Sort by breach count (descending) or max value
        matchingHosts.sort((a, b) => {
          if (b.breachCount !== a.breachCount) {
            return b.breachCount - a.breachCount;
          }
          return (b.maxValue || 0) - (a.maxValue || 0);
        });

        const resultLines: string[] = [];
        resultLines.push(
          `Found ${matchingHosts.length} host(s) with ${metric} ${comparison} ${threshold}:`
        );
        if (startTime || endTime) {
          const timeDesc = startTime && endTime
            ? `${new Date(Number(startTime) * 1000).toLocaleString()} to ${new Date(Number(endTime) * 1000).toLocaleString()}`
            : startTime
            ? `since ${new Date(Number(startTime) * 1000).toLocaleString()}`
            : `until ${new Date(Number(endTime) * 1000).toLocaleString()}`;
          resultLines.push(`Time range: ${timeDesc}`);
        }
        resultLines.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        const hostsToShow = matchingHosts.slice(0, limit);
        hostsToShow.forEach((mh, index) => {
          const { host, item, breachCount, firstBreach, lastBreach, maxValue, avgValue, minValue } = mh;
          resultLines.push(`\n${index + 1}. ${host.name || host.host} (ID: ${host.hostid})`);
          resultLines.push(`   Metric: ${item.name} (${item.key_})`);
          resultLines.push(`   Breach count: ${breachCount}`);
          if (avgValue !== undefined) {
            resultLines.push(`   Average: ${avgValue.toFixed(2)}${item.units ? ` ${item.units}` : ""}`);
          }
          if (minValue !== undefined && maxValue !== undefined) {
            resultLines.push(`   Range: ${minValue.toFixed(2)} - ${maxValue.toFixed(2)}${item.units ? ` ${item.units}` : ""}`);
          } else if (maxValue !== undefined) {
            resultLines.push(`   Max value: ${maxValue.toFixed(2)}${item.units ? ` ${item.units}` : ""}`);
          }
          if (firstBreach) {
            const firstDate = new Date(firstBreach);
            resultLines.push(`   First breach: ${firstDate.toLocaleString()}`);
          }
          if (lastBreach && lastBreach !== firstBreach) {
            const lastDate = new Date(lastBreach);
            resultLines.push(`   Last breach: ${lastDate.toLocaleString()}`);
          }
        });

        if (matchingHosts.length > limit) {
          resultLines.push(`\n... and ${matchingHosts.length - limit} more host(s)`);
        }

        resultLines.push(`\n\n📊 Summary: ${matchingHosts.length} of ${hostsToQuery.length} host(s) matched the criteria`);

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
              text: `Failed to query hosts by metric threshold: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "vnoc_elasticsearch_aggregate",
    description:
      "Perform aggregations on metric data. Supports avg, sum, min, max, value_count, cardinality, stats, percentiles, and top_hits aggregations. Example: Get average CPU usage for a host, or find the 95th percentile of memory usage.",
    inputSchema: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description: "Host identifier (hostname, hostid, or name)",
        },
        metric: {
          type: "string",
          description: "Metric name or query (e.g., 'CPU utilization', 'memory usage', 'disk space')",
        },
        aggregationType: {
          type: "string",
          enum: ["avg", "sum", "min", "max", "value_count", "cardinality", "stats", "percentiles", "top_hits"],
          description: "Type of aggregation to perform: avg (average), sum, min, max, value_count (count of values), cardinality (unique count), stats (all statistics), percentiles, top_hits (top documents)",
        },
        field: {
          type: "string",
          description: "Field to aggregate on (default: 'value'). For top_hits, this can be any field.",
        },
        index: {
          type: "string",
          description: "Elasticsearch index pattern (e.g., 'zabbix-*', 'vnoc-*', 'dbl', 'uint'). If not provided, will try common patterns.",
        },
        startTime: {
          type: "string",
          description: "Start time in ISO format, Unix timestamp (seconds), or relative (e.g., '2025-01-01T00:00:00Z', '1735344000', or 'now-7d'). Dates are converted to Unix timestamps matching Zabbix timezone (UTC).",
        },
        endTime: {
          type: "string",
          description: "End time in ISO format, Unix timestamp (seconds), or relative (e.g., '2025-01-01T23:59:59Z', '1735430399', or 'now'). Dates are converted to Unix timestamps matching Zabbix timezone (UTC).",
        },
        percentiles: {
          type: "array",
          items: { type: "number" },
          description: "For percentiles aggregation: array of percentile values (e.g., [1, 5, 25, 50, 75, 95, 99]). Default: [1, 5, 25, 50, 75, 95, 99]",
        },
        topHitsSize: {
          type: "number",
          description: "For top_hits aggregation: number of top documents to return (default: 10)",
        },
      },
      required: ["host", "metric", "aggregationType"],
    },
    handler: async (args: unknown) => {
      try {
        const rawArgs = args as {
          host: string;
          metric: string;
          aggregationType: "avg" | "sum" | "min" | "max" | "value_count" | "cardinality" | "stats" | "percentiles" | "top_hits";
          field?: string;
          index?: string;
          startTime?: string;
          endTime?: string;
          percentiles?: number[];
          topHitsSize?: number;
        };

        const host = rawArgs.host;
        const metric = rawArgs.metric;
        const aggregationType = rawArgs.aggregationType;
        const field = rawArgs.field || "value";
        const index = rawArgs.index;
        const percentiles = rawArgs.percentiles || [1, 5, 25, 50, 75, 95, 99];
        const topHitsSize = rawArgs.topHitsSize || 10;

        // Helper function to convert date string to Unix timestamp (seconds)
        const parseTimeToUnix = (timeStr: string | undefined): string | undefined => {
          if (!timeStr) return undefined;
          
          if (/^\d+$/.test(timeStr)) {
            return timeStr;
          }
          
          if (timeStr.startsWith("now")) {
            const now = Math.floor(Date.now() / 1000);
            if (timeStr === "now") return String(now);
            
            const match = timeStr.match(/now-(\d+)([smhd])/);
            if (match && match[1] && match[2]) {
              const value = parseInt(match[1]);
              const unit = match[2];
              let seconds = 0;
              switch (unit) {
                case "s": seconds = value; break;
                case "m": seconds = value * 60; break;
                case "h": seconds = value * 60 * 60; break;
                case "d": seconds = value * 24 * 60 * 60; break;
              }
              return String(now - seconds);
            }
            return String(now);
          }
          
          try {
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid date format: ${timeStr}`);
            }
            return String(Math.floor(date.getTime() / 1000));
          } catch {
            return timeStr;
          }
        };

        const startTime = parseTimeToUnix(rawArgs.startTime);
        const endTime = parseTimeToUnix(rawArgs.endTime);

        // Step 1: Find the host
        const foundHost = await findHost(host);
        if (!foundHost) {
          return {
            content: [
              {
                type: "text",
                text: `Host not found: ${host}`,
              },
            ],
            isError: true,
          };
        }

        // Step 2: Find the metric item
        const items = await getHostItems(foundHost.hostid);
        const matchedItems = matchItems(metric, items);

        if (matchedItems.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No matching items found for metric: "${metric}" on host: ${foundHost.name || foundHost.host}`,
              },
            ],
            isError: true,
          };
        }

        // Use the first/best matching item
        const targetItem = matchedItems[0];
        if (!targetItem) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to get item details for metric: "${metric}"`,
              },
            ],
            isError: true,
          };
        }

        // Step 3: Determine Elasticsearch index
        let indicesToSearch: string | string[] = index || "*";
        if (!index) {
          // Try common index patterns
          const commonPatterns = ["zabbix-*", "vnoc-*", "monitoring-*", "metrics-*"];
          try {
            const availableIndices = await elasticsearchClient.getIndices();
            // Find matching pattern
            for (const pattern of commonPatterns) {
              const patternRegex = new RegExp(pattern.replace("*", ".*"));
              const matching = availableIndices.filter((idx) => patternRegex.test(idx));
              if (matching.length > 0) {
                indicesToSearch = pattern;
                break;
              }
            }
            if (!indicesToSearch && availableIndices.length > 0) {
              indicesToSearch = "*";
            }
          } catch {
            indicesToSearch = "zabbix-*";
          }
        }

        // Step 4: Determine which index types to try based on value type
        const indexTypesToTry = ["dbl", "uint"];
        if (targetItem.value_type === "0") {
          indexTypesToTry.unshift("uint");
        }

        // Step 5: Perform aggregation
        let aggregationResult: Record<string, unknown> | null = null;
        let lastError: Error | null = null;

        for (const indexType of indexTypesToTry) {
          try {
            // First, verify data exists
            try {
              const sample = await elasticsearchClient.getSampleData(indexType, targetItem.itemid, 1);
              if (sample.length === 0) {
                continue;
              }
            } catch {
              continue;
            }

            const aggParams: Parameters<typeof elasticsearchClient.aggregateByItemId>[0] = {
              index: indexType,
              itemid: targetItem.itemid,
              field,
              aggregationType,
              timeField: "clock",
            };

            if (startTime !== undefined) aggParams.startTime = startTime;
            if (endTime !== undefined) aggParams.endTime = endTime;
            
            if (aggregationType === "percentiles") {
              aggParams.percentiles = percentiles;
            }
            
            if (aggregationType === "top_hits") {
              aggParams.topHitsSize = topHitsSize;
              aggParams.topHitsSort = [{ clock: { order: "desc" } }];
            }

            aggregationResult = await elasticsearchClient.aggregateByItemId(aggParams);
            
            if (aggregationResult) {
              break; // Found results, stop trying other indices
            }
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            continue;
          }
        }

        if (!aggregationResult) {
          return {
            content: [
              {
                type: "text",
                text: `No aggregation results found for ${foundHost.name || foundHost.host}.\n\nMetric: ${targetItem.name} (${targetItem.key_})\nAggregation: ${aggregationType}\n\n${lastError ? `Last error: ${lastError.message}\n\n` : ""}Tip: You may need to specify the correct index pattern using the 'index' parameter, or check available indices using vnoc_elasticsearch_discover.`,
              },
            ],
            isError: true,
          };
        }

        // Step 6: Format results
        const resultLines: string[] = [];
        resultLines.push(`Aggregation Results for ${foundHost.name || foundHost.host}:`);
        resultLines.push(`Metric: ${targetItem.name} (${targetItem.key_})`);
        resultLines.push(`Aggregation Type: ${aggregationType.toUpperCase()}`);
        if (startTime || endTime) {
          const timeDesc = startTime && endTime
            ? `${new Date(Number(startTime) * 1000).toLocaleString()} to ${new Date(Number(endTime) * 1000).toLocaleString()}`
            : startTime
            ? `since ${new Date(Number(startTime) * 1000).toLocaleString()}`
            : `until ${new Date(Number(endTime) * 1000).toLocaleString()}`;
          resultLines.push(`Time Range: ${timeDesc}`);
        }
        resultLines.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        // Format based on aggregation type
        switch (aggregationType) {
          case "avg":
          case "sum":
          case "min":
          case "max":
          case "value_count":
          case "cardinality":
            const value = aggregationResult.value as number;
            resultLines.push(`Result: ${value}${targetItem.units && aggregationType !== "value_count" && aggregationType !== "cardinality" ? ` ${targetItem.units}` : ""}`);
            break;
          
          case "stats":
            resultLines.push(`Statistics:`);
            resultLines.push(`  Count: ${aggregationResult.count || 0}`);
            resultLines.push(`  Average: ${(aggregationResult.avg as number || 0).toFixed(2)}${targetItem.units ? ` ${targetItem.units}` : ""}`);
            resultLines.push(`  Min: ${(aggregationResult.min as number || 0).toFixed(2)}${targetItem.units ? ` ${targetItem.units}` : ""}`);
            resultLines.push(`  Max: ${(aggregationResult.max as number || 0).toFixed(2)}${targetItem.units ? ` ${targetItem.units}` : ""}`);
            resultLines.push(`  Sum: ${(aggregationResult.sum as number || 0).toFixed(2)}${targetItem.units ? ` ${targetItem.units}` : ""}`);
            break;
          
          case "percentiles":
            const values = aggregationResult.values as Record<string, number>;
            resultLines.push(`Percentiles:`);
            const sortedPercentiles = Object.keys(values)
              .map((k) => ({ percentile: parseFloat(k), value: values[k] || 0 }))
              .sort((a, b) => a.percentile - b.percentile);
            sortedPercentiles.forEach((p) => {
              resultLines.push(`  ${p.percentile}th: ${p.value.toFixed(2)}${targetItem.units ? ` ${targetItem.units}` : ""}`);
            });
            break;
          
          case "top_hits":
            const hits = aggregationResult.hits as Array<{ id: string; source: Record<string, unknown> }>;
            const total = aggregationResult.total as number;
            resultLines.push(`Top ${hits.length} of ${total} documents:`);
            hits.forEach((hit, index) => {
              const timestamp = hit.source.clock;
              const value = hit.source.value;
              const timestampStr = typeof timestamp === "number"
                ? new Date(timestamp * 1000).toLocaleString()
                : typeof timestamp === "string"
                ? new Date(timestamp).toLocaleString()
                : String(timestamp);
              resultLines.push(`\n${index + 1}. ${timestampStr}`);
              resultLines.push(`   Value: ${value}${targetItem.units ? ` ${targetItem.units}` : ""}`);
              // Show other relevant fields
              const otherFields = Object.keys(hit.source).filter(k => k !== "clock" && k !== "value" && k !== "itemid");
              if (otherFields.length > 0) {
                otherFields.slice(0, 3).forEach((k) => {
                  resultLines.push(`   ${k}: ${hit.source[k]}`);
                });
              }
            });
            break;
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
              text: `Failed to perform aggregation: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
];

