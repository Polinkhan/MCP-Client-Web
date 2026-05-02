import axios, { AxiosInstance } from "axios";
import https from "https";
import { config } from "../config";

/**
 * Elasticsearch client for querying historical data
 */
export class ElasticsearchClient {
  private client: AxiosInstance;

  constructor() {
    const axiosConfig: {
      baseURL: string;
      auth?: { username: string; password: string };
      timeout: number;
      httpsAgent: https.Agent;
      headers: { "Content-Type": string };
    } = {
      baseURL: config.elasticsearchUrl,
      timeout: 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (config.elasticsearchUsername && config.elasticsearchPassword) {
      axiosConfig.auth = {
        username: config.elasticsearchUsername,
        password: config.elasticsearchPassword,
      };
    }

    this.client = axios.create(axiosConfig);
  }

  /**
   * Get list of indices
   */
  async getIndices(pattern?: string): Promise<string[]> {
    try {
      const url = pattern ? `/_cat/indices/${pattern}?format=json` : "/_cat/indices?format=json";
      const response = await this.client.get(url);
      return response.data.map((idx: { index: string }) => idx.index);
    } catch (error) {
      throw new Error(
        `Failed to get indices: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get index mapping
   */
  async getIndexMapping(index: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.client.get(`/${index}/_mapping`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get index mapping: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Search in Elasticsearch
   */
  async search(
    index: string | string[],
    query: Record<string, unknown>,
    size: number = 100
  ): Promise<{
    hits: {
      hits: Array<{
        _source: Record<string, unknown>;
        _id: string;
        _index: string;
      }>;
      total: { value: number };
    };
  }> {
    try {
      const indices = Array.isArray(index) ? index.join(",") : index;
      const response = await this.client.post(`/${indices}/_search`, {
        size,
        query,
      });
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorDetails = error instanceof Error && "response" in error 
        ? JSON.stringify((error as { response?: { data?: unknown } }).response?.data || {})
        : "";
      throw new Error(
        `Elasticsearch search failed: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ""}`
      );
    }
  }

  /**
   * Test query - get sample data for an itemid
   */
  async getSampleData(index: string, itemid: string, limit: number = 5): Promise<Array<Record<string, unknown>>> {
    try {
      const query = {
        bool: {
          should: [
            { term: { itemid: itemid } },
            { term: { itemid: parseInt(itemid) || 0 } },
          ],
          minimum_should_match: 1,
        },
      };
      const result = await this.search(index, query, limit);
      return result.hits.hits.map((hit) => hit._source);
    } catch (error) {
      throw new Error(
        `Failed to get sample data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generic query builder for finding threshold breaches
   */
  async findThresholdBreaches(params: {
    index: string | string[];
    hostField: string;
    hostValue: string;
    metricField: string;
    threshold: number;
    comparison: "gt" | "gte" | "lt" | "lte";
    timeField?: string;
    startTime?: string;
    endTime?: string;
    size?: number;
  }): Promise<Array<{ timestamp: string; value: number; host: string }>> {
    const {
      index,
      hostField,
      hostValue,
      metricField,
      threshold,
      comparison,
      timeField = "@timestamp",
      startTime,
      endTime,
      size = 1000,
    } = params;

    // Build range query for the metric
    const rangeQuery: Record<string, unknown> = {};
    rangeQuery[comparison] = threshold;

    const mustQueries: Array<Record<string, unknown>> = [
      {
        term: { [hostField]: hostValue },
      },
      {
        exists: { field: metricField },
      },
      {
        range: {
          [metricField]: rangeQuery,
        },
      },
    ];

    // Add time range if provided
    if (startTime || endTime) {
      const timeRange: Record<string, unknown> = {};
      if (startTime) timeRange.gte = startTime;
      if (endTime) timeRange.lte = endTime;
      mustQueries.push({
        range: {
          [timeField]: timeRange,
        },
      });
    }

    const query = {
      bool: {
        must: mustQueries,
      },
    };

    const sort = [{ [timeField]: { order: "asc" as const } }];

    try {
      const result = await this.search(index, query, size);
      return result.hits.hits.map((hit) => {
        const source = hit._source;
        const value = source[metricField];
        const timestamp = source[timeField] || hit._id;
        return {
          timestamp: typeof timestamp === "string" ? timestamp : String(timestamp),
          value: typeof value === "number" ? value : parseFloat(String(value)) || 0,
          host: String(source[hostField] || hostValue),
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to find threshold breaches: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Query by itemid (for Zabbix-style Elasticsearch indices)
   */
  async findThresholdBreachesByItemId(params: {
    index: string | string[];
    itemid: string;
    threshold?: number;
    minThreshold?: number;
    maxThreshold?: number;
    comparison?: "gt" | "gte" | "lt" | "lte";
    timeField?: string;
    startTime?: string;
    endTime?: string;
    size?: number;
  }): Promise<Array<{ timestamp: string; value: number; itemid: string }>> {
    const {
      index,
      itemid,
      threshold,
      minThreshold,
      maxThreshold,
      comparison,
      timeField = "clock",
      startTime,
      endTime,
      size = 1000,
    } = params;

    // Build range query for the value
    const rangeQuery: Record<string, unknown> = {};
    if (minThreshold !== undefined && maxThreshold !== undefined) {
      // Range query (between min and max)
      rangeQuery.gte = minThreshold;
      rangeQuery.lte = maxThreshold;
    } else if (threshold !== undefined && comparison) {
      // Single threshold query
      rangeQuery[comparison] = threshold;
    } else {
      throw new Error("Either threshold+comparison or minThreshold+maxThreshold must be provided");
    }

    const mustQueries: Array<Record<string, unknown>> = [
      // Try both string and numeric itemid (Elasticsearch might store it as long)
      {
        bool: {
          should: [
            { term: { itemid: itemid } }, // String match
            { term: { itemid: parseInt(itemid) || 0 } }, // Numeric match
          ],
          minimum_should_match: 1,
        },
      },
      {
        exists: { field: "value" },
      },
      {
        range: {
          value: rangeQuery,
        },
      },
    ];

    // Add time range if provided
    if (startTime || endTime) {
      const timeRange: Record<string, unknown> = {};
      if (startTime) timeRange.gte = startTime;
      if (endTime) timeRange.lte = endTime;
      mustQueries.push({
        range: {
          [timeField]: timeRange,
        },
      });
    }

    const query = {
      bool: {
        must: mustQueries,
      },
    };

    try {
      const result = await this.search(index, query, size);
      return result.hits.hits.map((hit) => {
        const source = hit._source;
        const value = source.value;
        const timestamp = source[timeField] || hit._id;
        // Convert timestamp - could be number (Unix timestamp in seconds) or date string
        let timestampStr: string;
        if (typeof timestamp === "number") {
          timestampStr = new Date(timestamp * 1000).toISOString(); // Convert Unix seconds to ISO
        } else if (timestamp instanceof Date) {
          timestampStr = timestamp.toISOString();
        } else {
          timestampStr = String(timestamp);
        }

        return {
          timestamp: timestampStr,
          value: typeof value === "number" ? value : parseFloat(String(value)) || 0,
          itemid: String(source.itemid || itemid),
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to find threshold breaches by itemid: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get average metric value for an itemid within a time range
   */
  async getAverageValueByItemId(params: {
    index: string | string[];
    itemid: string;
    timeField?: string;
    startTime?: string;
    endTime?: string;
  }): Promise<{ avg: number; min: number; max: number; count: number } | null> {
    const {
      index,
      itemid,
      timeField = "clock",
      startTime,
      endTime,
    } = params;

    const mustQueries: Array<Record<string, unknown>> = [
      {
        bool: {
          should: [
            { term: { itemid: itemid } },
            { term: { itemid: parseInt(itemid) || 0 } },
          ],
          minimum_should_match: 1,
        },
      },
      {
        exists: { field: "value" },
      },
    ];

    // Add time range if provided
    if (startTime || endTime) {
      const timeRange: Record<string, unknown> = {};
      if (startTime) timeRange.gte = startTime;
      if (endTime) timeRange.lte = endTime;
      mustQueries.push({
        range: {
          [timeField]: timeRange,
        },
      });
    }

    const query = {
      bool: {
        must: mustQueries,
      },
    };

    const indices = Array.isArray(index) ? index.join(",") : index;
    
    try {
      const response = await this.client.post(`/${indices}/_search`, {
        size: 0, // Don't return documents, just aggregations
        query,
        aggs: {
          value_stats: {
            stats: {
              field: "value",
            },
          },
        },
      });

      const stats = response.data.aggregations?.value_stats;
      if (!stats || stats.count === 0) {
        return null;
      }

      return {
        avg: stats.avg || 0,
        min: stats.min || 0,
        max: stats.max || 0,
        count: stats.count || 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to get average value: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Generic aggregation method supporting all aggregation types
   */
  async aggregateByItemId(params: {
    index: string | string[];
    itemid: string;
    field?: string;
    aggregationType: "avg" | "sum" | "min" | "max" | "value_count" | "cardinality" | "stats" | "percentiles" | "top_hits";
    timeField?: string;
    startTime?: string;
    endTime?: string;
    percentiles?: number[]; // For percentiles aggregation (e.g., [1, 5, 25, 50, 75, 95, 99])
    topHitsSize?: number; // For top_hits aggregation
    topHitsSort?: Array<{ [key: string]: { order: "asc" | "desc" } }>; // For top_hits aggregation
  }): Promise<Record<string, unknown> | null> {
    const {
      index,
      itemid,
      field = "value",
      aggregationType,
      timeField = "clock",
      startTime,
      endTime,
      percentiles = [1, 5, 25, 50, 75, 95, 99],
      topHitsSize = 10,
      topHitsSort = [{ [timeField]: { order: "desc" as const } }],
    } = params;

    const mustQueries: Array<Record<string, unknown>> = [
      {
        bool: {
          should: [
            { term: { itemid: itemid } },
            { term: { itemid: parseInt(itemid) || 0 } },
          ],
          minimum_should_match: 1,
        },
      },
      {
        exists: { field },
      },
    ];

    // Add time range if provided
    if (startTime || endTime) {
      const timeRange: Record<string, unknown> = {};
      if (startTime) timeRange.gte = startTime;
      if (endTime) timeRange.lte = endTime;
      mustQueries.push({
        range: {
          [timeField]: timeRange,
        },
      });
    }

    const query = {
      bool: {
        must: mustQueries,
      },
    };

    // Build aggregation based on type
    let aggregation: Record<string, unknown> = {};
    
    switch (aggregationType) {
      case "avg":
        aggregation = {
          avg: {
            field,
          },
        };
        break;
      case "sum":
        aggregation = {
          sum: {
            field,
          },
        };
        break;
      case "min":
        aggregation = {
          min: {
            field,
          },
        };
        break;
      case "max":
        aggregation = {
          max: {
            field,
          },
        };
        break;
      case "value_count":
        aggregation = {
          value_count: {
            field,
          },
        };
        break;
      case "cardinality":
        aggregation = {
          cardinality: {
            field,
          },
        };
        break;
      case "stats":
        aggregation = {
          stats: {
            field,
          },
        };
        break;
      case "percentiles":
        aggregation = {
          percentiles: {
            field,
            percents: percentiles,
          },
        };
        break;
      case "top_hits":
        aggregation = {
          top_hits: {
            size: topHitsSize,
            sort: topHitsSort,
          },
        };
        break;
      default:
        throw new Error(`Unsupported aggregation type: ${aggregationType}`);
    }

    const indices = Array.isArray(index) ? index.join(",") : index;
    
    try {
      const response = await this.client.post(`/${indices}/_search`, {
        size: 0, // Don't return documents, just aggregations
        query,
        aggs: {
          value_agg: aggregation,
        },
      });

      const aggResult = response.data.aggregations?.value_agg;
      if (!aggResult) {
        return null;
      }

      // Format the result based on aggregation type
      const result: Record<string, unknown> = {
        aggregationType,
        field,
      };

      switch (aggregationType) {
        case "avg":
          result.value = aggResult.value;
          break;
        case "sum":
          result.value = aggResult.value;
          break;
        case "min":
          result.value = aggResult.value;
          break;
        case "max":
          result.value = aggResult.value;
          break;
        case "value_count":
          result.value = aggResult.value;
          break;
        case "cardinality":
          result.value = aggResult.value;
          break;
        case "stats":
          result.avg = aggResult.avg;
          result.min = aggResult.min;
          result.max = aggResult.max;
          result.sum = aggResult.sum;
          result.count = aggResult.count;
          break;
        case "percentiles":
          result.values = aggResult.values;
          break;
        case "top_hits":
          result.hits = aggResult.hits?.hits?.map((hit: { _source: Record<string, unknown>; _id: string }) => ({
            id: hit._id,
            source: hit._source,
          })) || [];
          result.total = aggResult.hits?.total?.value || 0;
          break;
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to perform aggregation: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export const elasticsearchClient = new ElasticsearchClient();

