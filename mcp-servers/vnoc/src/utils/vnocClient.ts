import axios from "axios";
import https from "https";
import { config } from "../config";
import { getAuthHeader } from "../auth/tokenStore";

interface VnocJsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: Record<string, unknown>;
  id: number;
}

interface VnocJsonRpcResponse<T = unknown> {
  jsonrpc: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: string;
  };
  id: number;
}

/**
 * Makes a JSON-RPC call to vNOC API
 */
export async function vnocApiCall<T = unknown>(
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const apiUrl = `${config.vnocApiBaseUrl}/api_jsonrpc.php`;
  const auth = getAuthHeader();

  const request: VnocJsonRpcRequest = {
    jsonrpc: "2.0",
    method,
    params: params || {},
    id: 1,
  };

  const response = await axios.post<VnocJsonRpcResponse<T>>(apiUrl, request, {
    headers: {
      "Content-Type": "application/json-rpc",
      ...auth,
    },
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  });

  if (response.data.error) {
    throw new Error(
      `vNOC API error: ${response.data.error.message} (${response.data.error.data})`
    );
  }

  if (!response.data.result) {
    throw new Error("vNOC API returned no result");
  }

  return response.data.result;
}

