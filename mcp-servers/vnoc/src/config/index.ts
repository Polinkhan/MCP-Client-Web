export const config = {
  token: process.env.VNOC_API_TOKEN ?? "",
  vnocApiBaseUrl: process.env.VNOC_API_BASE_URL ?? "",
  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "",
  elasticsearchUsername: process.env.ELASTICSEARCH_USERNAME,
  elasticsearchPassword: process.env.ELASTICSEARCH_PASSWORD,
};
