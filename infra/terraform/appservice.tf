resource "azurerm_service_plan" "asp" {
  name                = "asp-${var.project}-${var.env}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku
}

resource "azurerm_linux_web_app" "app" {
  name                = "wa-${var.project}-${var.env}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.asp.id

  site_config {
    ftps_state = "Disabled"
    always_on  = false  
    application_stack {
      node_version = var.node_version
    }
    app_command_line = "pm2 serve /home/site/wwwroot --no-daemon --spa"
  }

  app_settings = {
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = "true"
    WEBSITE_RUN_FROM_PACKAGE            = "0"
    WEBSITE_NODE_DEFAULT_VERSION        = "~${var.node_version}"

    SUPABASE_URL = var.supabase_url
    SUPABASE_KEY = var.supabase_key
  }

  https_only = true
}
