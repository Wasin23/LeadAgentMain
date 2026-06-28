export interface CrmField {
  name: string
  key: "apiUrl" | "apiKey"
  type: "text" | "password"
  placeholder: string
  helpText?: string
}

export interface CrmConfig {
  id: string
  name: string
  fields: CrmField[]
}

export const CRM_CONFIGS: CrmConfig[] = [
  { id: "activecampaign", name: "ActiveCampaign", fields: [{ name: "API URL", key: "apiUrl", type: "text", placeholder: "https://youracccount.api-us1.com" }, { name: "API Key", key: "apiKey", type: "password", placeholder: "Your ActiveCampaign API key", helpText: "Found in Settings → Developer → API Access" }] },
  { id: "hubspot", name: "HubSpot", fields: [{ name: "Private App Access Token", key: "apiKey", type: "password", placeholder: "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", helpText: "Create a Private App in HubSpot Settings → Integrations → Private Apps" }] },
  { id: "salesforce", name: "Salesforce", fields: [{ name: "Instance URL", key: "apiUrl", type: "text", placeholder: "https://yourinstance.salesforce.com" }, { name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Salesforce OAuth access token" }] },
  { id: "pipedrive", name: "Pipedrive", fields: [{ name: "API Token", key: "apiKey", type: "password", placeholder: "Your Pipedrive API token", helpText: "Found in Settings → Personal Preferences → API" }] },
  { id: "zoho", name: "Zoho CRM", fields: [{ name: "Data Center", key: "apiUrl", type: "text", placeholder: "https://www.zohoapis.com" }, { name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Zoho OAuth access token" }] },
  { id: "copper", name: "Copper", fields: [{ name: "User Email", key: "apiUrl", type: "text", placeholder: "Your Copper account email" }, { name: "API Key", key: "apiKey", type: "password", placeholder: "Your Copper API key", helpText: "Found in Settings → Integrations → API Key" }] },
  { id: "close", name: "Close", fields: [{ name: "API Key", key: "apiKey", type: "password", placeholder: "Your Close API key", helpText: "Found in Settings → Your API Keys" }] },
  { id: "affinity", name: "Affinity", fields: [{ name: "API Key", key: "apiKey", type: "password", placeholder: "Your Affinity API key", helpText: "Found in Settings → API" }] },
  { id: "capsule", name: "Capsule", fields: [{ name: "API Token", key: "apiKey", type: "password", placeholder: "Your Capsule API token", helpText: "Found in My Preferences → API Authentication Token" }] },
  { id: "insightly", name: "Insightly", fields: [{ name: "API Key", key: "apiKey", type: "password", placeholder: "Your Insightly API key", helpText: "Found in User Settings → API Key" }] },
  { id: "keap", name: "Keap (Infusionsoft)", fields: [{ name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Keap access token", helpText: "OAuth access token from Keap Developer Console" }] },
  { id: "dynamics365", name: "Microsoft Dynamics 365", fields: [{ name: "Organization URL", key: "apiUrl", type: "text", placeholder: "https://yourorg.crm.dynamics.com" }, { name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Dynamics 365 OAuth access token" }] },
  { id: "nutshell", name: "Nutshell", fields: [{ name: "User Email", key: "apiUrl", type: "text", placeholder: "Your Nutshell account email" }, { name: "API Key", key: "apiKey", type: "password", placeholder: "Your Nutshell API key", helpText: "Found in Setup → API Keys" }] },
  { id: "pipeliner", name: "Pipeliner", fields: [{ name: "Space ID", key: "apiUrl", type: "text", placeholder: "Your Pipeliner Space ID" }, { name: "API Token", key: "apiKey", type: "password", placeholder: "Your Pipeliner API token" }] },
  { id: "salesflare", name: "Salesflare", fields: [{ name: "API Key", key: "apiKey", type: "password", placeholder: "Your Salesflare API key", helpText: "Found in Settings → API keys" }] },
  { id: "sugarcrm", name: "SugarCRM", fields: [{ name: "Instance URL", key: "apiUrl", type: "text", placeholder: "https://yourinstance.sugarcrm.com" }, { name: "OAuth Token", key: "apiKey", type: "password", placeholder: "Your SugarCRM OAuth token" }] },
  { id: "teamleader", name: "Teamleader", fields: [{ name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Teamleader access token", helpText: "OAuth token from Teamleader Marketplace" }] },
  { id: "teamwork", name: "Teamwork CRM", fields: [{ name: "Site URL", key: "apiUrl", type: "text", placeholder: "https://yoursite.teamwork.com" }, { name: "API Key", key: "apiKey", type: "password", placeholder: "Your Teamwork API key" }] },
  { id: "vtiger", name: "Vtiger", fields: [{ name: "Instance URL", key: "apiUrl", type: "text", placeholder: "https://yourinstance.vtiger.com" }, { name: "Access Key", key: "apiKey", type: "password", placeholder: "Your Vtiger access key", helpText: "Found in My Preferences → Access Key" }] },
  { id: "zendesksell", name: "Zendesk Sell", fields: [{ name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Zendesk Sell access token", helpText: "OAuth token from Settings → OAuth" }] },
  { id: "accelo", name: "Accelo", fields: [{ name: "Deployment URL", key: "apiUrl", type: "text", placeholder: "https://yourcompany.api.accelo.com" }, { name: "Access Token", key: "apiKey", type: "password", placeholder: "Your Accelo access token" }] },
]
