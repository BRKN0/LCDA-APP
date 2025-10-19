variable "location" {
    type = string  
    default = "westus" 
}

variable "project" { 
    type = string  
    default = "lcda" 
}

variable "env" { 
    type = string  
    default = "free"
}

# App Service en nivel gratuito
variable "app_service_sku" { 
    type = string 
    default = "F1" 
}

variable "node_version" { 
    type = string 
    default = "20" 
}

variable "supabase_url" { 
    type = string 
    default = "https://sbzvpvsjrbjrnanruloz.supabase.co" 
}

variable "supabase_key" { 
    type = string 
    default = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNienZwdnNqcmJqcm5hbnJ1bG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwNTMyODgsImV4cCI6MjA0OTYyOTI4OH0.ahJbSTgC3sfeLJg9HbfXRMmaoZ-MGSYIG6vKnRnOgfk" 
}

variable "enable_frontdoor" { 
    type = bool 
    default = false 
}

variable "enable_traffic_mgr" { 
    type = bool 
    default = false 
}
