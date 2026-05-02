import { vnocApiCall } from "../utils/vnocClient";

export const apiTools = [
  {
    name: "vnoc_get_api_version",
    description: "Get the version of the vNOC API. This is a test tool to verify API connectivity.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async () => {
      try {
        const version = await vnocApiCall<string>("apiinfo.version");
        return {
          content: [
            {
              type: "text",
              text: `vNOC API version: ${version}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get API version: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
];

