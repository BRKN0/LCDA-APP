resource "azurerm_traffic_manager_profile" "tm" {
  count               = var.enable_traffic_mgr ? 1 : 0
  name                = "tm-${var.project}-${var.env}"
  resource_group_name = azurerm_resource_group.main.name
  traffic_routing_method = "Priority"

  dns_config {
    relative_name = "tm-${var.project}-${var.env}"
    ttl           = 30
  }

  monitor_config {
    protocol = "HTTPS"
    port     = 443
    path     = "/"
  }
}

# Cuando se active: endpoints apuntando a wa-lcda-prod (y futuras réplicas).
