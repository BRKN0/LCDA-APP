locals {
  fd_name = "fd-${var.project}-${var.env}"
}

resource "azurerm_cdn_frontdoor_profile" "fd" {
  count               = var.enable_frontdoor ? 1 : 0
  name                = local.fd_name
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Premium_AzureFrontDoor"
}

# Cuando se active: endpoint -> origen (webapp) -> rutas -> WAF opcional
# También moveremos el dominio raíz aquí (ALIAS/Apex) y certificados gestionados.
