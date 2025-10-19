resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project}-${var.env}"
  location = var.location
}
